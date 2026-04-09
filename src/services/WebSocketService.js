import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENV } from '../config/env';

const STORAGE_KEY = 'omega_connection';
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Service to manage the WebSocket connection to the Omega Desktop Bridge.
 */
class WebSocketService {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.connected = false;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.pingInterval = null;
    this.connectionData = null;
    this.pendingMessages = [];
  }

  /**
   * Connects to the WebSocket server using provided data or cached storage.
   * @param {Object} [connectionData] - Connection parameters including host, port, and token.
   * @returns {Promise<boolean>} True if connection attempt initiated successfully.
   */
  async connect(connectionData) {
    if (connectionData) {
      this.connectionData = connectionData;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(connectionData));
    } else {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.connectionData = JSON.parse(stored);
      }
    }

    if (!this.connectionData) {
      console.warn('[WS] No connection data — defaulting to configured host');
      this.connectionData = { host: ENV.DEFAULT_HOST, port: ENV.DEFAULT_PORT };
    }

    return this._connect();
  }

  _connect() {
    const { host, port, url: providedUrl } = this.connectionData;
    // Use WSS if it's an external tunnel, otherwise local WS
    const protocol =
      host && (host.includes('loca.lt') || host.includes('lhr.life')) ? 'wss://' : 'ws://';
    const portSuffix = port && !host.includes('.lt') && !host.includes('.life') ? `:${port}` : '';
    const url = providedUrl || `${protocol}${host}${portSuffix}/ws`;

    try {
      // eslint-disable-next-line no-console
      console.log(`[WS] Connecting to ${url}`);
      this.ws = new WebSocket(url, null, {
        headers: { 'Bypass-Tunnel-Reminder': 'true' },
      });

      this.ws.onopen = () => {
        // eslint-disable-next-line no-console
        console.log('[WS] Connected');
        this.connected = true;
        this.reconnectAttempts = 0;
        this._emit('connected', { host, port });

        if (this.pingInterval) {
          clearInterval(this.pingInterval);
        }
        this.pingInterval = setInterval(() => {
          this.send('PING');
        }, 10000);

        // Flush pending messages
        while (this.pendingMessages.length > 0) {
          this.ws.send(this.pendingMessages.shift());
        }
      };

      this.ws.onmessage = event => {
        try {
          const msg = JSON.parse(event.data);
          // eslint-disable-next-line no-console
          console.log('[WS] Received:', msg.type);
          this._emit(msg.type, msg);
          this._emit('*', msg); // wildcard
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      this.ws.onerror = error => {
        console.error('[WS] Error:', error.message);
        this._emit('error', error);
      };

      this.ws.onclose = event => {
        // eslint-disable-next-line no-console
        console.log('[WS] Closed:', event.code);
        this.connected = false;
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
        }
        this._emit('disconnected', { code: event.code });
        this._scheduleReconnect();
      };

      return true;
    } catch (e) {
      console.error('[WS] Connection failed:', e);
      this._scheduleReconnect();
      return false;
    }
  }

  _scheduleReconnect() {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[WS] Max reconnect attempts reached');
      this._emit('reconnect_failed', {});
      return;
    }

    this.reconnectAttempts++;
    const delay = RECONNECT_DELAY * Math.min(this.reconnectAttempts, 5);
    // eslint-disable-next-line no-console
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this._connect();
    }, delay);
  }

  /**
   * Sends a message to the WebSocket or queues it if offline.
   * @param {string} type - The message type string.
   * @param {Object} [payload={}] - The JSON payload to attach.
   */
  send(type, payload = {}) {
    const msg = JSON.stringify({ type, ...payload });
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      if (this.pendingMessages.length >= 100) {
        console.warn('[WS] Pending message queue full, dropping oldest message.');
        this.pendingMessages.shift();
      }
      this.pendingMessages.push(msg);
    }
  }

  /**
   * Subscribes to a WebSocket event type.
   * @param {string} event - The event type to listen for.
   * @param {Function} callback - The callback to execute when the event fires.
   * @returns {Function} An unsubscribe function to remove the listener.
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribes from a WebSocket event type.
   * @param {string} event - The event type to unsubscribe from.
   * @param {Function} callback - The callback reference to remove.
   */
  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }

  _emit(event, data) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  /**
   * Forcefully closes the WebSocket and prevents auto-reconnect.
   */
  disconnect() {
    clearTimeout(this.reconnectTimer);
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    this.reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect
    this.ws?.close();
    this.connected = false;
  }

  async getSavedConnection() {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  }

  async clearSavedConnection() {
    await AsyncStorage.removeItem(STORAGE_KEY);
    this.connectionData = null;
  }

  /**
   * Gets current state information of the service.
   * @returns {Object} Connection state object with boolean and host info.
   */
  getStatus() {
    return {
      connected: this.connected,
      reconnectAttempts: this.reconnectAttempts,
      host: this.connectionData?.host,
      port: this.connectionData?.port,
    };
  }
}

export default new WebSocketService();
