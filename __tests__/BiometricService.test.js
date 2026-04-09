import BiometricService from '../src/services/BiometricService';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('BiometricService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    BiometricService.deviceId = null;
    BiometricService.publicKey = null;
  });

  it('generates a mock device ID on first access', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(null);
    const deviceId = await BiometricService.getOrCreateDeviceId();
    expect(deviceId).toMatch(/^omega_/);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('omega_device_id', deviceId);
  });

  it('signs challenges successfully (mocked)', async () => {
    const res = await BiometricService.approveChallenge({ payload: 'test_payload' });
    expect(res.success).toBe(true);
    expect(res.signature).toBe('mock_signature_for_test_payload');
  });
});
