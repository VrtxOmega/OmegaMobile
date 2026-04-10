import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

const STORAGE_KEY = 'omega_connection';
const RECONNECT_BASE_DELAY = 2000;
const PING_INTERVAL = 8000;      // Send PING every 8 seconds
const PONG_TIMEOUT = 12000;      // If no PONG in 12s, connection is dead
const MAX_BACKOFF = 30000;       // Cap backoff at 30 seconds

/**
 * PERMANENT CONNECTION WebSocket Service
 * 
 * Design principle: This service NEVER stops trying to connect.
 * There is no MAX_RECONNECT_ATTEMPTS. The backoff caps at 30s
 * and cycles forever until the bridge is reachable.
 * 
 * Heartbeat: PING every 8s, expects PONG within 12s.
 * If PONG is missed, the socket is force-closed and reconnect fires.
 * 
 * Pull-to-refresh: Calls forceReconnect() which resets backoff and
 * immediately tries a fresh connection.
 *
 * AppState: When the app returns to foreground, if the socket is not
 * OPEN, forceReconnect() is called.
 */
class WebSocketService {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.connected = false;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.pingInterval = null;
    this.pongTimer = null;
    this.connectionData = null;
    this.pendingMessages = [];
    this._destroyed = false;       // Only true if disconnect() is called explicitly
    this._appStateListener = null;

    // Auto-setup foreground listener
    this._setupAppStateListener();
  }

  _setupAppStateListener() {
    this._appStateListener = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        // App came to foreground — force reconnect if not connected
        if (!this.connected || this.ws?.readyState !== WebSocket.OPEN) {
          console.log('[WS] App foregrounded — forcing reconnect');
          this.forceReconnect();
        }
      }
    });
  }

  async connect(connectionData) {
    this._destroyed = false;

    if (connectionData) {
      this.connectionData = connectionData;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(connectionData));
    } else {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) this.connectionData = JSON.parse(stored);
    }

    if (!this.connectionData) {
      console.warn('[WS] No connection data — defaulting to Sovereign Tunnel (loca.lt)');
      this.connectionData = { host: 'omega-bridge-vrts.loca.lt', port: '' };
    }

    // Clear any pending reconnect
    this._clearTimers();
    this.reconnectAttempts = 0;

    return this._connect();
  }

  /**
   * Force reconnect — called by pull-to-refresh or foreground resume.
   * Resets backoff counter and immediately attempts a fresh connection.
   */
  async forceReconnect() {
    this._destroyed = false;
    this._clearTimers();
    this.reconnectAttempts = 0;

    // Ensure we have connection data
    if (!this.connectionData) {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) this.connectionData = JSON.parse(stored);
      else this.connectionData = { host: 'omega-bridge-vrts.loca.lt', port: '' };
    }

    return this._connect();
  }

  _connect() {
    if (this._destroyed) return false;

    const { host, port, url: providedUrl } = this.connectionData || {};
    if (!host && !providedUrl) {
      console.error('[WS] No host or url configured');
      this._scheduleReconnect();
      return false;
    }

    const protocol = host && (host.includes('loca.lt') || host.includes('lhr.life')) ? 'wss://' : 'ws://';
    const portSuffix = port && !host.includes('.lt') && !host.includes('.life') ? `:${port}` : '';
    const url = providedUrl || `${protocol}${host}${portSuffix}/ws`;

    try {
      console.log(`[WS] Connecting to ${url} (attempt ${this.reconnectAttempts + 1})`);

      // Cleanly close existing socket
      if (this.ws) {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.onopen = null;
        try { this.ws.close(); } catch (_) {}
      }

      this.ws = new WebSocket(url, null, {
        headers: { 'Bypass-Tunnel-Reminder': 'true' }
      });

      this.ws.onopen = () => {
        console.log('[WS] ✓ Connected');
        this.connected = true;
        this.reconnectAttempts = 0;
        this._emit('connected', { host, port });

        // Start heartbeat
        this._startHeartbeat();

        // Flush pending messages
        while (this.pendingMessages.length > 0) {
          try {
            this.ws.send(this.pendingMessages.shift());
          } catch (e) {
            console.warn('[WS] Failed to flush pending message:', e.message);
          }
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          // PONG handling — reset the dead-man's switch
          if (msg.type === 'PONG') {
            this._resetPongTimer();
            return;
          }

          this._emit(msg.type, msg);
          this._emit('*', msg); // wildcard
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error.message);
        this._emit('error', error);
      };

      this.ws.onclose = (event) => {
        console.log(`[WS] Closed: code=${event.code}`);
        this.connected = false;
        this._stopHeartbeat();
        this._emit('disconnected', { code: event.code });

        // ALWAYS reconnect unless explicitly destroyed
        if (!this._destroyed) {
          this._scheduleReconnect();
        }
      };

      return true;
    } catch (e) {
      console.error('[WS] Connection exception:', e);
      if (!this._destroyed) this._scheduleReconnect();
      return false;
    }
  }

  // ── Heartbeat system ──────────────────────────────────────────────────────
  _startHeartbeat() {
    this._stopHeartbeat();

    // Send PING every 8 seconds
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, PING_INTERVAL);

    // Start the PONG dead-man's switch
    this._resetPongTimer();
  }

  _resetPongTimer() {
    clearTimeout(this.pongTimer);
    this.pongTimer = setTimeout(() => {
      // No PONG received in 12 seconds — connection is dead
      console.warn('[WS] PONG timeout — connection dead, force-closing');
      this.connected = false;
      if (this.ws) {
        this.ws.onclose = null; // prevent double-reconnect
        try { this.ws.close(); } catch (_) {}
      }
      this._stopHeartbeat();
      this._emit('disconnected', { code: 'PONG_TIMEOUT' });
      this._scheduleReconnect();
    }, PONG_TIMEOUT);
  }

  _stopHeartbeat() {
    clearInterval(this.pingInterval);
    this.pingInterval = null;
    clearTimeout(this.pongTimer);
    this.pongTimer = null;
  }

  // ── Reconnect with exponential backoff (NO max attempts) ──────────────────
  _scheduleReconnect() {
    if (this._destroyed) return;

    this.reconnectAttempts++;
    // Exponential backoff: 2s, 4s, 8s, 16s, capped at 30s
    const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts - 1), MAX_BACKOFF);
    console.log(`[WS] Reconnecting in ${delay}ms (attempt #${this.reconnectAttempts})`);

    this._clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this._connect();
    }, delay);
  }

  _clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  _clearTimers() {
    this._clearReconnectTimer();
    this._stopHeartbeat();
  }

  // ── Public API ────────────────────────────────────────────────────────────
  send(type, payload = {}) {
    const msg = JSON.stringify({ type, ...payload });
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      // Cap pending queue at 50 messages to prevent memory leak
      if (this.pendingMessages.length < 50) {
        this.pendingMessages.push(msg);
      }
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }

  _emit(event, data) {
    this.listeners.get(event)?.forEach(cb => {
      try { cb(data); } catch (e) { console.error('[WS] Listener error:', e); }
    });
  }

  /**
   * Explicit disconnect — the ONLY thing that stops reconnection.
   * Used when the user manually unpairs or logs out.
   */
  disconnect() {
    this._destroyed = true;
    this._clearTimers();
    if (this.ws) {
      this.ws.onclose = null;
      try { this.ws.close(); } catch (_) {}
    }
    this.connected = false;
    this.pendingMessages = [];
  }

  async getSavedConnection() {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  }

  async clearSavedConnection() {
    await AsyncStorage.removeItem(STORAGE_KEY);
    this.connectionData = null;
  }

  getStatus() {
    return {
      connected: this.connected,
      reconnectAttempts: this.reconnectAttempts,
      host: this.connectionData?.host,
      port: this.connectionData?.port,
      socketState: this.ws?.readyState,
    };
  }
}

export default new WebSocketService();
