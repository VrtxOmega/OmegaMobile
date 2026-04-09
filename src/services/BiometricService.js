import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'omega_device_id';
const PUB_KEY_CACHE = 'omega_pub_key';

class BiometricService {
  constructor() {
    this.deviceId = null;
    this.publicKey = null;
  }

  async checkAvailability() {
    return { available: true, biometryType: 'FaceID' };
  }

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

  async generateKeypair() {
    const publicKey = 'mock_public_key_' + Date.now();
    this.publicKey = publicKey;
    await AsyncStorage.setItem(PUB_KEY_CACHE, publicKey);
    return publicKey;
  }

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

  async signChallenge(payload, promptMessage) {
    return { success: true, signature: 'mock_signature_for_' + payload };
  }

  async approveChallenge(challenge) {
    return await this.signChallenge(challenge.payload || 'dummy', 'Approve');
  }

  async simpleAuth(promptMessage) {
    return true;
  }
}

export default new BiometricService();
