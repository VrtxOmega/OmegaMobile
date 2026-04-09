import WSService from '../src/services/WebSocketService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENV } from '../src/config/env';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

global.WebSocket = jest.fn();

describe('WebSocketService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    WSService.ws = null;
    WSService.connected = false;
  });

  it('connects to configured host by default', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(null);
    const originalConnect = WSService._connect;
    WSService._connect = jest.fn().mockReturnValue(true);

    const result = await WSService.connect();

    expect(WSService.connectionData.host).toBe(ENV.DEFAULT_HOST);
    expect(result).toBe(true);

    WSService._connect = originalConnect;
  });
});
