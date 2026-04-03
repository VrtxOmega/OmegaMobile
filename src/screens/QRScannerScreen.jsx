import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { colors, spacing, radius, typography } from '../theme/veritas';
import WSService from '../services/WebSocketService';
import BiometricService from '../services/BiometricService';
import { Camera, CameraType } from 'react-native-camera-kit';

export default function QRScannerScreen({ navigation }) {
  const [paired, setPaired] = useState(false);
  const [pairing, setPairing] = useState(false);

  const handleQRRead = async (qrData) => {
    if (pairing || paired) return;
    setPairing(true);

    try {
      const data = JSON.parse(qrData.data || qrData);

      if (!data.url && (!data.host || !data.port)) {
        Alert.alert('Invalid QR', 'This QR code is not from Gravity Omega');
        setPairing(false);
        return;
      }

      // Check expiry
      if (data.expires && Date.now() / 1000 > data.expires) {
        Alert.alert('Expired', 'This QR code has expired. Generate a new one from Gravity Omega.');
        setPairing(false);
        return;
      }

      // Connect to desktop
      const connectUrl = data.url || `ws://${data.host}:${data.port}`;
      console.log('[PAIR] Connecting to', connectUrl);
      const connected = await WSService.connect(data);

      if (!connected) {
        Alert.alert('Connection Failed', `Could not connect to ${connectUrl}`);
        setPairing(false);
        return;
      }

      // Wait a moment for connection to establish
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Generate or retrieve biometric keypair
      const publicKey = await BiometricService.getPublicKey();
      const deviceId = await BiometricService.getOrCreateDeviceId();

      // Register device with desktop
      WSService.send('REGISTER_DEVICE', {
        device_id: deviceId,
        public_key: publicKey,
        pairing_token: data.token,
      });

      // Wait for registration confirmation
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Registration timeout')), 10000);
        const unsub = WSService.on('REGISTERED', (msg) => {
          if (msg.device_id === deviceId) {
            clearTimeout(timeout);
            unsub();
            resolve();
          }
        });
      });

      setPaired(true);
      Alert.alert(
        'Paired!',
        `Successfully paired with Gravity Omega at ${data.host || (data.url.split('://')[1])}`,
        [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
      );

    } catch (e) {
      console.error('[PAIR] Error:', e);
      Alert.alert('Pairing Failed', e.message);
      setPairing(false);
    }
  };

  // Since react-native-qrcode-scanner may not be available in all setups,
  // provide a manual entry fallback
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>PAIR DEVICE</Text>
        <Text style={styles.subtitle}>Scan the QR code from Gravity Omega</Text>
      </View>

      {/* Camera viewfinder */}
      <View style={styles.viewfinder}>
        <Camera
          style={{ width: 240, height: 240 }}
          cameraType={CameraType.Back}
          scanBarcode={true}
          onReadCode={(event) => {
            if (event?.nativeEvent?.codeStringValue) {
              handleQRRead(event.nativeEvent.codeStringValue);
            }
          }}
        />
        <Text style={[styles.viewfinderText, { position: 'absolute', bottom: -25 }]}>
          {pairing ? '⏳ Pairing...' : paired ? '✓ Paired' : '📷 Point at QR Code'}
        </Text>
        <View style={styles.cornerTL} />
        <View style={styles.cornerTR} />
        <View style={styles.cornerBL} />
        <View style={styles.cornerBR} />
      </View>

      <View style={styles.instructions}>
        <Text style={styles.step}>1. Open Gravity Omega on your desktop</Text>
        <Text style={styles.step}>2. Go to Settings → Mobile Pairing</Text>
        <Text style={styles.step}>3. Click "Generate QR Code"</Text>
        <Text style={styles.step}>4. Point this camera at the QR code</Text>
      </View>

      {/* For testing without camera */}
      <TouchableOpacity
        style={styles.testBtn}
        onPress={() => {
          // Test pairing with local connection
          handleQRRead(JSON.stringify({
            url: 'ws://10.0.2.2:5001/ws',
            token: 'test',
            expires: Math.floor(Date.now() / 1000) + 300
          }));
        }}
      >
        <Text style={styles.testBtnText}>Manual Entry (Development)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.obsidian, padding: spacing.lg },

  header: { alignItems: 'center', paddingVertical: spacing.xl },
  title: { ...typography.title, fontSize: 16, letterSpacing: 4 },
  subtitle: { ...typography.bodySmall, marginTop: spacing.sm, textAlign: 'center' },

  viewfinder: {
    width: 240, height: 240,
    alignSelf: 'center',
    borderColor: colors.gold,
    backgroundColor: 'rgba(212,175,55,0.05)',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xl,
  },
  cornerTL: { position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderTopWidth: 3, borderLeftWidth: 3, borderColor: colors.gold },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: 30, height: 30, borderTopWidth: 3, borderRightWidth: 3, borderColor: colors.gold },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 30, height: 30, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: colors.gold },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderBottomWidth: 3, borderRightWidth: 3, borderColor: colors.gold },
  viewfinderText: { fontFamily: 'Courier New', fontSize: 12, color: colors.goldDim, textAlign: 'center' },

  instructions: { gap: spacing.sm, marginBottom: spacing.xl },
  step: { fontFamily: 'Courier New', fontSize: 11, color: colors.textDim },

  testBtn: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
    alignItems: 'center', marginBottom: spacing.md,
  },
  testBtnText: { fontFamily: 'Courier New', fontSize: 10, color: colors.textDim },

  backBtn: { alignItems: 'center', padding: spacing.md },
  backBtnText: { fontFamily: 'Courier New', fontSize: 11, color: colors.goldDim },
});
