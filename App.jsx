import React, { useEffect, useState } from 'react';
import { View, Text, StatusBar, StyleSheet, Platform } from 'react-native';
import PushNotification from 'react-native-push-notification';

PushNotification.configure({
  onNotification: function (notification) {
    console.log("NOTIFICATION:", notification);
  },
  requestPermissions: Platform.OS === 'ios'
});

PushNotification.createChannel(
  {
    channelId: "sentinel-alerts",
    channelName: "Sentinel Alerts",
    channelDescription: "High-priority alerts from Sovereign Sentinel",
    playSound: true,
    importance: 4,
    vibrate: true,
  },
  (created) => console.log(`createChannel returned '${created}'`)
);
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors, spacing, typography } from './src/theme/veritas';
import WSService from './src/services/WebSocketService';
import BiometricService from './src/services/BiometricService';

import HomeScreen from './src/screens/HomeScreen';
import AgentScreen from './src/screens/AgentScreen';
import AegisScreen from './src/screens/AegisScreen';
import VaultScreen from './src/screens/VaultScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import QRScannerScreen from './src/screens/QRScannerScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TabIcon = ({ label, focused }) => {
  const icons = {
    Home: '⌂',
    Agent: '⌖',
    Aegis: '◉',
    Vault: '◈',
    Settings: '◎',
  };

  return (
    <View style={tabStyles.iconWrapper}>
      <Text style={[tabStyles.icon, { color: focused ? colors.gold : 'rgba(212,175,55,0.35)' }]}>
        {icons[label] || '●'}
      </Text>
      <Text style={[tabStyles.label, { color: focused ? colors.gold : 'rgba(212,175,55,0.35)' }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
};

const tabStyles = StyleSheet.create({
  iconWrapper: { alignItems: 'center' },
  icon: { fontSize: 18 },
  label: { fontFamily: 'Courier New', fontSize: 7, letterSpacing: 1, marginTop: 2 },
});

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.obsidianLight, borderBottomWidth: 1, borderBottomColor: colors.border },
        headerTintColor: colors.gold,
        headerTitleStyle: { fontFamily: 'Courier New', fontSize: 12, letterSpacing: 3 },
        tabBarStyle: {
          backgroundColor: colors.obsidianLight,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 72,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Ω OMEGA',
          tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Agent"
        component={AgentScreen}
        options={{
          title: 'AGENT INTERFACE',
          tabBarIcon: ({ focused }) => <TabIcon label="Agent" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Aegis"
        component={AegisScreen}
        options={{
          title: 'AEGIS MONITOR',
          tabBarIcon: ({ focused }) => <TabIcon label="Aegis" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Vault"
        component={VaultScreen}
        options={{
          title: 'VERITAS VAULT',
          tabBarIcon: ({ focused }) => <TabIcon label="Vault" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'SETTINGS',
          tabBarIcon: ({ focused }) => <TabIcon label="Settings" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    // Auto-connect on launch — service will reconnect permanently
    const init = async () => {
      await WSService.connect(); // Uses saved connection or default tunnel
    };
    init();

    const unsubConnected = WSService.on('connected', () => setWsConnected(true));
    const unsubDisconnected = WSService.on('disconnected', () => setWsConnected(false));
    
    const unsubAlert = WSService.on('SENTINEL_ALERT', (data) => {
      PushNotification.localNotification({
        channelId: "sentinel-alerts",
        title: data.title || "🔴 OMEGA ALERT",
        message: data.body || "System event detected",
        color: "red",
        playSound: true,
        vibrate: true,
        priority: "high",
        importance: "high",
      });
    });

    // Check biometric availability
    BiometricService.checkAvailability().then(({ available, biometryType }) => {
      if (!available) {
        console.warn('[APP] Biometrics not available — approvals will require confirmation only');
      }
    });

    return () => {
      unsubConnected();
      unsubDisconnected();
      unsubAlert();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={colors.obsidian} />
        <NavigationContainer
          theme={{
            dark: true,
            colors: {
              primary: colors.gold,
              background: colors.obsidian,
              card: colors.obsidianLight,
              text: colors.text,
              border: colors.border,
              notification: colors.red,
            }
          }}
        >
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="QRScanner"
              component={QRScannerScreen}
              options={{
                headerShown: true,
                title: 'PAIR DEVICE',
                headerStyle: { backgroundColor: colors.obsidianLight },
                headerTintColor: colors.gold,
                headerTitleStyle: { fontFamily: 'Courier New', fontSize: 12, letterSpacing: 3 },
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>

        {/* Connection indicator overlay */}
        {!wsConnected && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>◉ OFFLINE — Gravity Omega not reachable</Text>
          </View>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  offlineBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(231,76,60,0.9)',
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  offlineText: {
    fontFamily: 'Courier New',
    fontSize: 10,
    color: 'white',
    letterSpacing: 1,
  },
});
