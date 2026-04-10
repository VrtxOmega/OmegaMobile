import GemmaService from './GemmaService';
import WSService from './WebSocketService';

/**
 * InferenceRouter — Decides whether to route inference to
 * the local on-device Gemma 4 or the desktop bridge (Ollama).
 *
 * Routing logic:
 *   1. User-forced mode → obey unconditionally
 *   2. Bridge connected + complex query → remote (desktop Ollama)
 *   3. Bridge disconnected → local Gemma (always)
 *   4. Bridge connected + simple query → local Gemma (faster)
 *
 * Complexity heuristic:
 *   - Local: < 500 chars, conversational, status queries, quick Q&A
 *   - Remote: code generation, multi-file analysis, vault queries, tool use
 */

// Keywords that signal complex queries better suited for desktop
const REMOTE_SIGNALS = [
  'write code', 'create a', 'build a', 'implement', 'refactor',
  'analyze', 'scan', 'vault', 'deploy', 'run', 'execute',
  'search files', 'git', 'commit', 'push', 'install',
  'sentinel', 'aegis', 'seal', 'veritas',
];

// Routing modes
export const ROUTE_MODE = {
  AUTO: 'auto',       // Intelligent routing based on context
  LOCAL: 'local',     // Always use on-device Gemma 4
  BRIDGE: 'bridge',   // Always use desktop bridge
};

class InferenceRouter {
  constructor() {
    this.mode = ROUTE_MODE.AUTO;
    this.lastRoute = null;
  }

  /**
   * Set routing mode.
   */
  setMode(mode) {
    this.mode = mode;
  }

  /**
   * Determine the best backend for a given prompt.
   * Returns: { backend: 'local'|'bridge', reason: string }
   */
  async route(prompt) {
    const bridgeConnected = WSService.connected;
    const gemmaReady = await GemmaService.isReady();
    const gemmaDownloaded = await GemmaService.isModelDownloaded().catch(() => false);

    // Forced modes
    if (this.mode === ROUTE_MODE.LOCAL) {
      this.lastRoute = { backend: 'local', reason: 'User forced local mode' };
      return this.lastRoute;
    }
    if (this.mode === ROUTE_MODE.BRIDGE) {
      if (!bridgeConnected) {
        // Can't honor bridge mode if disconnected — fallback
        this.lastRoute = { backend: 'local', reason: 'Bridge forced but offline — fallback to local' };
        return this.lastRoute;
      }
      this.lastRoute = { backend: 'bridge', reason: 'User forced bridge mode' };
      return this.lastRoute;
    }

    // AUTO mode
    // If bridge is down, local is the only option
    if (!bridgeConnected) {
      this.lastRoute = { backend: 'local', reason: 'Bridge offline — using on-device Gemma' };
      return this.lastRoute;
    }

    // If Gemma is not available, bridge is the only option
    if (!gemmaDownloaded) {
      this.lastRoute = { backend: 'bridge', reason: 'Gemma not downloaded — using bridge' };
      return this.lastRoute;
    }

    // Both available — use complexity heuristic
    const isComplex = this._isComplexQuery(prompt);
    if (isComplex) {
      this.lastRoute = { backend: 'bridge', reason: 'Complex query — routing to desktop Ollama' };
    } else {
      this.lastRoute = { backend: 'local', reason: 'Simple query — fast on-device response' };
    }
    return this.lastRoute;
  }

  /**
   * Execute inference on the routed backend.
   * Returns: { response, elapsed_ms, backend, model }
   */
  async infer(prompt, streaming = false) {
    const decision = await this.route(prompt);
    console.log(`[Router] ${decision.backend}: ${decision.reason}`);

    if (decision.backend === 'local') {
      return this._inferLocal(prompt, streaming);
    } else {
      return this._inferBridge(prompt, streaming);
    }
  }

  /**
   * Run inference on local Gemma 4.
   */
  async _inferLocal(prompt, streaming) {
    if (streaming) {
      // Streaming: caller should listen to GemmaService events
      await GemmaService.stream(prompt);
      return { backend: 'local', model: 'gemma-4-e4b', streaming: true };
    } else {
      const result = await GemmaService.generate(prompt);
      return { ...result, backend: 'local' };
    }
  }

  /**
   * Send inference request over WebSocket bridge.
   * Returns a Promise that resolves when AGENT_MESSAGE arrives.
   */
  _inferBridge(prompt, streaming) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Bridge inference timeout (30s)'));
      }, 30000);

      const cleanup = WSService.on('AGENT_MESSAGE', (data) => {
        clearTimeout(timeout);
        cleanup();
        resolve({
          response: data.message,
          elapsed_ms: data.elapsed_ms || 0,
          backend: 'bridge',
          model: data.model || 'ollama',
          steps: data.steps || 0,
          stepLog: data.stepLog || [],
        });
      });

      WSService.send('CHAT_MESSAGE', { text: prompt, sessionId: 'mobile' });
    });
  }

  /**
   * Complexity heuristic — determines if a query should go to the desktop.
   */
  _isComplexQuery(prompt) {
    const lower = prompt.toLowerCase();

    // Long prompts → desktop
    if (prompt.length > 500) return true;

    // Check for remote signal keywords
    for (const signal of REMOTE_SIGNALS) {
      if (lower.includes(signal)) return true;
    }

    // Multi-line → likely code or complex instruction
    if (prompt.split('\n').length > 3) return true;

    // Default: simple → local
    return false;
  }

  /**
   * Get the last routing decision.
   */
  getLastRoute() {
    return this.lastRoute;
  }
}

export default new InferenceRouter();
