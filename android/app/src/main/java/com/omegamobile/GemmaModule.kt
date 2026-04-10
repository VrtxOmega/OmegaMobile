package com.omegamobile

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import java.io.File
import java.util.concurrent.Executors

/**
 * GemmaModule — React Native Native Module for on-device Gemma 4 inference.
 *
 * Uses MediaPipe LLM Inference API to run Gemma 4 E4B/E2B directly on the
 * device's NPU/GPU. All inference runs on a dedicated background thread
 * to prevent blocking the React Native UI thread.
 *
 * Exposed methods:
 *   - initializeModel(modelPath: String)
 *   - generateResponse(prompt: String)
 *   - generateResponseStreaming(prompt: String)
 *   - isModelLoaded()
 *   - getModelInfo()
 *   - releaseModel()
 */
class GemmaModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "GemmaModule"
        private const val TAG = "GemmaModule"
        private const val DEFAULT_MAX_TOKENS = 2048
        private const val DEFAULT_TEMPERATURE = 0.7f
        private const val DEFAULT_TOP_K = 40
        private const val DEFAULT_TOP_P = 0.95f

        // Event names emitted to JS
        const val EVENT_TOKEN = "GEMMA_TOKEN"
        const val EVENT_COMPLETE = "GEMMA_COMPLETE"
        const val EVENT_ERROR = "GEMMA_ERROR"
        const val EVENT_PROGRESS = "GEMMA_LOAD_PROGRESS"
    }

    private var llmInference: LlmInference? = null
    private var currentModelPath: String? = null
    private var isLoading = false

    // Dedicated executor for inference — never blocks RN UI thread
    private val inferenceExecutor = Executors.newSingleThreadExecutor()

    // Configurable parameters (set from JS via setInferenceParams)
    private var maxTokens = DEFAULT_MAX_TOKENS
    private var temperature = DEFAULT_TEMPERATURE
    private var topK = DEFAULT_TOP_K
    private var topP = DEFAULT_TOP_P

    override fun getName(): String = NAME

    /**
     * Initialize the LLM model from a file path on device storage.
     * This is a heavy operation (~2-5 seconds) and runs on the background executor.
     */
    @ReactMethod
    fun initializeModel(modelPath: String, promise: Promise) {
        if (isLoading) {
            promise.reject("GEMMA_BUSY", "Model is already loading")
            return
        }

        inferenceExecutor.execute {
            try {
                isLoading = true
                Log.i(TAG, "Initializing model from: $modelPath")

                val modelFile = File(modelPath)
                if (!modelFile.exists()) {
                    isLoading = false
                    promise.reject("GEMMA_FILE_NOT_FOUND", "Model file not found: $modelPath")
                    return@execute
                }

                // Release any existing model first
                llmInference?.close()
                llmInference = null

                sendEvent(EVENT_PROGRESS, Arguments.createMap().apply {
                    putString("stage", "loading")
                    putDouble("progress", 0.1)
                })

                val options = LlmInference.LlmInferenceOptions.builder()
                    .setModelPath(modelPath)
                    .setMaxTokens(maxTokens)
                    .build()

                sendEvent(EVENT_PROGRESS, Arguments.createMap().apply {
                    putString("stage", "compiling")
                    putDouble("progress", 0.5)
                })

                llmInference = LlmInference.createFromOptions(reactContext, options)
                currentModelPath = modelPath

                sendEvent(EVENT_PROGRESS, Arguments.createMap().apply {
                    putString("stage", "ready")
                    putDouble("progress", 1.0)
                })

                isLoading = false
                Log.i(TAG, "Model initialized successfully")

                promise.resolve(Arguments.createMap().apply {
                    putBoolean("success", true)
                    putString("modelPath", modelPath)
                })
            } catch (e: Exception) {
                isLoading = false
                Log.e(TAG, "Failed to initialize model", e)
                promise.reject("GEMMA_INIT_FAILED", e.message, e)
            }
        }
    }

    /**
     * Generate a complete response (non-streaming).
     * Blocks on the background executor until the full response is ready.
     */
    @ReactMethod
    fun generateResponse(prompt: String, promise: Promise) {
        val inference = llmInference
        if (inference == null) {
            promise.reject("GEMMA_NOT_LOADED", "Model not loaded. Call initializeModel first.")
            return
        }

        inferenceExecutor.execute {
            try {
                val startTime = System.currentTimeMillis()
                val response = inference.generateResponse(prompt)
                val elapsed = System.currentTimeMillis() - startTime

                promise.resolve(Arguments.createMap().apply {
                    putString("response", response)
                    putDouble("elapsed_ms", elapsed.toDouble())
                    putString("model", "gemma-4-e4b")
                    putString("backend", "on-device")
                })
            } catch (e: Exception) {
                Log.e(TAG, "Generation failed", e)
                promise.reject("GEMMA_GENERATE_FAILED", e.message, e)
            }
        }
    }

    /**
     * Stream a response token-by-token via DeviceEventEmitter.
     * Emits: GEMMA_TOKEN (partial), GEMMA_COMPLETE (final), GEMMA_ERROR (on failure).
     */
    @ReactMethod
    fun generateResponseStreaming(prompt: String) {
        val inference = llmInference
        if (inference == null) {
            sendEvent(EVENT_ERROR, Arguments.createMap().apply {
                putString("error", "Model not loaded. Call initializeModel first.")
            })
            return
        }

        inferenceExecutor.execute {
            try {
                val startTime = System.currentTimeMillis()
                val fullResponse = StringBuilder()

                inference.generateResponseAsync(prompt) { partialResult, done ->
                    if (partialResult != null) {
                        fullResponse.append(partialResult)
                        sendEvent(EVENT_TOKEN, Arguments.createMap().apply {
                            putString("token", partialResult)
                            putString("partial", fullResponse.toString())
                            putBoolean("done", done)
                        })
                    }

                    if (done) {
                        val elapsed = System.currentTimeMillis() - startTime
                        sendEvent(EVENT_COMPLETE, Arguments.createMap().apply {
                            putString("response", fullResponse.toString())
                            putDouble("elapsed_ms", elapsed.toDouble())
                            putString("model", "gemma-4-e4b")
                            putString("backend", "on-device")
                        })
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Streaming generation failed", e)
                sendEvent(EVENT_ERROR, Arguments.createMap().apply {
                    putString("error", e.message ?: "Unknown error")
                })
            }
        }
    }

    /**
     * Set inference parameters before generation.
     */
    @ReactMethod
    fun setInferenceParams(params: ReadableMap, promise: Promise) {
        try {
            if (params.hasKey("maxTokens")) maxTokens = params.getInt("maxTokens")
            if (params.hasKey("temperature")) temperature = params.getDouble("temperature").toFloat()
            if (params.hasKey("topK")) topK = params.getInt("topK")
            if (params.hasKey("topP")) topP = params.getDouble("topP").toFloat()

            // If model is loaded, we need to reinitialize with new params
            val needsReload = llmInference != null
            promise.resolve(Arguments.createMap().apply {
                putBoolean("success", true)
                putBoolean("needsReload", needsReload)
            })
        } catch (e: Exception) {
            promise.reject("GEMMA_PARAMS_FAILED", e.message, e)
        }
    }

    /**
     * Check if a model is currently loaded and ready for inference.
     */
    @ReactMethod
    fun isModelLoaded(promise: Promise) {
        promise.resolve(Arguments.createMap().apply {
            putBoolean("loaded", llmInference != null)
            putBoolean("loading", isLoading)
            putString("modelPath", currentModelPath ?: "")
        })
    }

    /**
     * Get information about the currently loaded model.
     */
    @ReactMethod
    fun getModelInfo(promise: Promise) {
        promise.resolve(Arguments.createMap().apply {
            putBoolean("loaded", llmInference != null)
            putString("modelPath", currentModelPath ?: "")
            putString("variant", if (currentModelPath?.contains("e4b") == true) "E4B" else "E2B")
            putInt("maxTokens", maxTokens)
            putDouble("temperature", temperature.toDouble())
            putInt("topK", topK)
            putDouble("topP", topP.toDouble())
        })
    }

    /**
     * Release the model and free GPU/NPU memory.
     */
    @ReactMethod
    fun releaseModel(promise: Promise) {
        inferenceExecutor.execute {
            try {
                llmInference?.close()
                llmInference = null
                currentModelPath = null
                Log.i(TAG, "Model released")
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to release model", e)
                promise.reject("GEMMA_RELEASE_FAILED", e.message, e)
            }
        }
    }

    /**
     * Get the app's internal model storage directory path.
     * JS uses this to know where to download model files to.
     */
    @ReactMethod
    fun getModelDirectory(promise: Promise) {
        try {
            val modelDir = File(reactContext.filesDir, "models")
            if (!modelDir.exists()) modelDir.mkdirs()
            promise.resolve(modelDir.absolutePath)
        } catch (e: Exception) {
            promise.reject("GEMMA_DIR_FAILED", e.message, e)
        }
    }

    /**
     * Emit events to JS via DeviceEventEmitter.
     */
    private fun sendEvent(eventName: String, params: WritableMap) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    /**
     * Clean up when the module is destroyed.
     */
    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        llmInference?.close()
        llmInference = null
        inferenceExecutor.shutdown()
    }
}
