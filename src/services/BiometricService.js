import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'omega_device_id';
const PUB_KEY_CACHE = 'omega_pub_key';

/**
 * Service managing device identification and cryptographic biometrics.
 */
class BiometricService {
  constructor() {
    this.deviceId = null;
    this.publicKey = null;
  }

  /**
   * Checks if local biometrics are active and available on device.
   * @returns {Promise<Object>} Contains boolean 'available' and string 'biometryType'
   */
  async checkAvailability() {
    // TODO: Replace mock with true crypto generation / platform check
    return { available: true, biometryType: 'FaceID' };
  }

  /**
   * Retrieves the secure device ID used for desktop pairing, or generates one.
   * @returns {Promise<string>} The device ID string.
   */
  async getOrCreateDeviceId() {
    if (this.deviceId) {
      return this.deviceId;
    }

    let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = 'omega_' + Math.random().toString(36).substr(2, 16) + '_' + Date.now();
      await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    }

    this.deviceId = id;
    return id;
  }

  /**
   * Generates a new cryptographic keypair backed by the Android Keystore.
   * @returns {Promise<string>} The base64 encoded public key.
   */
  async generateKeypair() {
    // TODO: Replace mock with true crypto generation using Android Keystore
    const publicKey = 'mock_public_key_' + Date.now();
    this.publicKey = publicKey;
    await AsyncStorage.setItem(PUB_KEY_CACHE, publicKey);
    return publicKey;
  }

  /**
   * Gets the cached public key, generating a new one if it doesn't exist.
   * @returns {Promise<string>} The current public key.
   */
  async getPublicKey() {
    if (this.publicKey) {
      return this.publicKey;
    }

    let key = await AsyncStorage.getItem(PUB_KEY_CACHE);
    if (!key) {
      return await this.generateKeypair();
    }
    this.publicKey = key;
    return key;
  }

  /**
   * Cryptographically signs a payload requiring a biometric prompt.
   * @param {string} payload - The message or hash to sign.
   * @param {string} promptMessage - The message shown to user on the scanner.
   * @returns {Promise<Object>} Contains boolean success and string signature.
   */
  async signChallenge(payload, promptMessage) {
    // TODO: Replace mock with true crypto generation / signing
    return { success: true, signature: 'mock_signature_for_' + payload };
  }

  /**
   * High-level wrapper to parse an agent challenge and request a signed approval.
   * @param {Object} challenge - Challenge data payload.
   * @returns {Promise<Object>} Signature response payload.
   */
  async approveChallenge(challenge) {
    return await this.signChallenge(challenge.payload || 'dummy', 'Approve');
  }

  async simpleAuth(promptMessage) {
    return true;
  }
}

export default new BiometricService();
