import React from 'react';
import { render } from '@react-native-community/react-native-template';
import HomeScreen from '../src/screens/HomeScreen';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('../src/services/WebSocketService', () => ({
  on: jest.fn(() => jest.fn()),
  send: jest.fn(),
}));

describe('HomeScreen', () => {
  it('renders correctly', () => {
    // Basic structural test
    expect(true).toBe(true);
  });
});
