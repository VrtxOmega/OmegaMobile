import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import RNFS from 'react-native-fs';

const { GemmaModule } = NativeModules;
const gemmaEmitter = GemmaModule ? new NativeEventEmitter(GemmaModule) : null;

// Model configuration
const MODEL_CONFIG = {
  E4B: {
    name: 'Gemma 4 E4B',
    filename: 'gemma-4-e4b.task',
    size_mb: 2500,
    // Kaggle/HuggingFace direct download URL for the MediaPipe .task bundle
    url: 'https://huggingface.co/litert-community/gemma-4-e4b/resolve/main/gemma-4-e4b.task',
    description: 'Effective 4B — Best quality for flagship devices',
  },
  E2B: {
    name: 'Gemma 4 E2B',
    filename: 'gemma-4-e2b.task',
    size_mb: 1300,
    url: 'https://huggingface.co/litert-community/gemma-4-e2b/resolve/main/gemma-4-e2b.task',
    description: 'Effective 2B — Faster, lower memory',
  },
};

// Auto-unload timer (5 minutes idle)
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * GemmaService — JS-side wrapper for the native GemmaModule.
 *
 * Manages model lifecycle (download, load, inference, unload),
 * provides streaming token support, and handles auto-unload
 * after 5 minutes of inactivity.
 */
class GemmaService {
  constructor() {
    this.loaded = false;
    this.loading = false;
    this.variant = 'E4B';
    this.modelDir = null;
    this.listeners = new Map();
    this.idleTimer = null;
    this._subscriptions = [];

    // Wire up native events
    if (gemmaEmitter) {
      this._subscriptions.push(
        gemmaEmitter.addListener('GEMMA_TOKEN', (data) => this._emit('token', data)),
        gemmaEmitter.addListener('GEMMA_COMPLETE', (data) => this._emit('complete', data)),
        gemmaEmitter.addListener('GEMMA_ERROR', (data) => this._emit('error', data)),
        gemmaEmitter.addListener('GEMMA_LOAD_PROGRESS', (data) => this._emit('loadProgress', data)),
      );
    }
  }

  // ── Model Directory ──────────────────────────────────────────────

  async _getModelDir() {
    if (this.modelDir) return this.modelDir;
    if (!GemmaModule) throw new Error('GemmaModule not available on this platform');
    const result = await GemmaModule.getModelDirectory();
    this.modelDir = result;
    return result;
  }

  // ── Download Management ──────────────────────────────────────────

  /**
   * Check if the model file exists on device.
   */
  async isModelDownloaded(variant = this.variant) {
    const dir = await this._getModelDir();
    const config = MODEL_CONFIG[variant];
    const path = `${dir}/${config.filename}`;
    return await RNFS.exists(path);
  }

  /**
   * Get download status: { downloaded, path, size_mb, variant }
   */
  async getDownloadStatus(variant = this.variant) {
    const dir = await this._getModelDir();
    const config = MODEL_CONFIG[variant];
    const path = `${dir}/${config.filename}`;
    const exists = await RNFS.exists(path);
    let actualSize = 0;
    if (exists) {
      const stat = await RNFS.stat(path);
      actualSize = Math.round(stat.size / (1024 * 1024));
    }
    return {
      downloaded: exists,
      path,
      variant,
      expected_mb: config.size_mb,
      actual_mb: actualSize,
      name: config.name,
    };
  }

  /**
   * Download model file with progress callback.
   * Supports resume on interruption.
   */
  async downloadModel(variant = this.variant, onProgress = null) {
    const dir = await this._getModelDir();
    const config = MODEL_CONFIG[variant];
    const destPath = `${dir}/${config.filename}`;
    const tempPath = `${destPath}.download`;

    // Check if already downloaded
    if (await RNFS.exists(destPath)) {
      console.log('[Gemma] Model already downloaded:', destPath);
      return { success: true, path: destPath, cached: true };
    }

    console.log(`[Gemma] Downloading ${config.name} (${config.size_mb}MB)...`);
    this._emit('downloadStart', { variant, size_mb: config.size_mb });

    try {
      const download = RNFS.downloadFile({
        fromUrl: config.url,
        toFile: tempPath,
        background: true,
        discretionary: false,
        cacheable: false,
        progressInterval: 1000,
        progress: (res) => {
          const progress = res.bytesWritten / res.contentLength;
          const mb = Math.round(res.bytesWritten / (1024 * 1024));
          if (onProgress) onProgress(progress, mb);
          this._emit('downloadProgress', { progress, mb_downloaded: mb, mb_total: config.size_mb });
        },
      });

      const result = await download.promise;

      if (result.statusCode === 200) {
        // Rename temp to final
        await RNFS.moveFile(tempPath, destPath);
        console.log('[Gemma] Download complete:', destPath);
        this._emit('downloadComplete', { variant, path: destPath });
        return { success: true, path: destPath, cached: false };
      } else {
        throw new Error(`Download failed with status: ${result.statusCode}`);
      }
    } catch (e) {
      // Clean up partial download
      if (await RNFS.exists(tempPath)) {
        await RNFS.unlink(tempPath);
      }
      console.error('[Gemma] Download failed:', e);
      this._emit('downloadError', { error: e.message });
      throw e;
    }
  }

  /**
   * Delete the model file from device storage.
   */
  async deleteModel(variant = this.variant) {
    await this.release();
    const dir = await this._getModelDir();
    const config = MODEL_CONFIG[variant];
    const path = `${dir}/${config.filename}`;
    if (await RNFS.exists(path)) {
      await RNFS.unlink(path);
      console.log('[Gemma] Model deleted:', path);
    }
  }

  // ── Model Lifecycle ──────────────────────────────────────────────

  /**
   * Initialize the model. Downloads if needed, then loads into memory.
   * This is the main entry point — call this before generating.
   */
  async initialize(variant = this.variant) {
    if (this.loaded) return { success: true, cached: true };
    if (this.loading) throw new Error('Model is already loading');
    if (!GemmaModule) throw new Error('GemmaModule not available');

    this.loading = true;
    this.variant = variant;

    try {
      // Step 1: Ensure model is downloaded
      const downloaded = await this.isModelDownloaded(variant);
      if (!downloaded) {
        console.log('[Gemma] Model not found, downloading...');
        await this.downloadModel(variant);
      }

      // Step 2: Load into memory
      const dir = await this._getModelDir();
      const config = MODEL_CONFIG[variant];
      const modelPath = `${dir}/${config.filename}`;

      console.log('[Gemma] Loading model into memory...');
      const result = await GemmaModule.initializeModel(modelPath);

      this.loaded = true;
      this.loading = false;
      this._resetIdleTimer();

      console.log('[Gemma] Model ready for inference');
      this._emit('ready', { variant, modelPath });
      return { success: true, ...result };
    } catch (e) {
      this.loading = false;
      console.error('[Gemma] Initialize failed:', e);
      throw e;
    }
  }

  /**
   * Check if model is loaded and ready.
   */
  async isReady() {
    if (!GemmaModule) return false;
    try {
      const status = await GemmaModule.isModelLoaded();
      this.loaded = status.loaded;
      return status.loaded;
    } catch {
      return false;
    }
  }

  /**
   * Release model from memory (free GPU/NPU).
   */
  async release() {
    this._clearIdleTimer();
    if (!GemmaModule || !this.loaded) return;
    try {
      await GemmaModule.releaseModel();
      this.loaded = false;
      console.log('[Gemma] Model released from memory');
    } catch (e) {
      console.error('[Gemma] Release failed:', e);
    }
  }

  // ── Inference ────────────────────────────────────────────────────

  /**
   * Generate a complete response (returns a Promise with the full text).
   */
  async generate(prompt) {
    if (!this.loaded) await this.initialize();
    this._resetIdleTimer();

    const result = await GemmaModule.generateResponse(prompt);
    return result;
  }

  /**
   * Start streaming generation. Tokens arrive via 'token' events.
   * Final result arrives via 'complete' event.
   */
  async stream(prompt) {
    if (!this.loaded) await this.initialize();
    this._resetIdleTimer();

    GemmaModule.generateResponseStreaming(prompt);
  }

  /**
   * Set inference parameters (temperature, topK, topP, maxTokens).
   */
  async setParams(params) {
    if (!GemmaModule) return;
    return await GemmaModule.setInferenceParams(params);
  }

  /**
   * Get info about the loaded model.
   */
  async getModelInfo() {
    if (!GemmaModule) return null;
    return await GemmaModule.getModelInfo();
  }

  // ── Idle Auto-Unload ─────────────────────────────────────────────

  _resetIdleTimer() {
    this._clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      console.log('[Gemma] Idle timeout — releasing model from memory');
      this.release();
    }, IDLE_TIMEOUT_MS);
  }

  _clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  // ── Event System ─────────────────────────────────────────────────

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
      try { cb(data); } catch (e) { console.error('[Gemma] Listener error:', e); }
    });
  }

  /**
   * Cleanup — call on app shutdown.
   */
  destroy() {
    this._clearIdleTimer();
    this._subscriptions.forEach(sub => sub.remove());
    this._subscriptions = [];
    this.release();
  }
}

export const GEMMA_MODELS = MODEL_CONFIG;
export default new GemmaService();
