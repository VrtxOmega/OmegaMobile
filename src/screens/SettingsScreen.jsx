import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Image, Alert,
} from 'react-native';
import { colors, spacing, radius, typography } from '../theme/veritas';
import WSService from '../services/WebSocketService';
import BiometricService from '../services/BiometricService';
import GemmaService, { GEMMA_MODELS } from '../services/GemmaService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingRow = ({ label, value, onPress, danger }) => (
  <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.settingInfo}>
      <Text style={styles.settingLabel}>{label}</Text>
      {value && <Text style={styles.settingValue}>{value}</Text>}
    </View>
    <Text style={[styles.settingArrow, danger && { color: colors.red }]}>
      {danger ? '⚠' : '›'}
    </Text>
  </TouchableOpacity>
);

const ConnectionStatus = ({ status }) => (
  <View style={[styles.connStatus, { borderColor: status.connected ? colors.green : colors.red }]}>
    <View style={[styles.connDot, { backgroundColor: status.connected ? colors.green : colors.red }]} />
    <View style={styles.connInfo}>
      <Text style={[styles.connStatusText, { color: status.connected ? colors.green : colors.red }]}>
        {status.connected ? 'CONNECTED' : 'DISCONNECTED'}
      </Text>
      {status.host && (
        <Text style={styles.connHost}>{status.host}:{status.port}</Text>
      )}
      {status.reconnectAttempts > 0 && (
        <Text style={styles.connRetry}>Reconnect attempt {status.reconnectAttempts}</Text>
      )}
    </View>
  </View>
);

export default function SettingsScreen({ navigation }) {
  const [wsStatus, setWsStatus] = useState({ connected: false });
  const [biometricType, setBiometricType] = useState(null);
  const [pairingQR, setPairingQR] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [notifSettings, setNotifSettings] = useState({
    approvals: true,
    aegisAlerts: true,
    taskComplete: false,
    sealComplete: false,
  });
  const [gemmaInfo, setGemmaInfo] = useState({ downloaded: false, loaded: false, actual_mb: 0, variant: 'E4B' });
  const [gemmaDownloading, setGemmaDownloading] = useState(false);
  const [gemmaProgress, setGemmaProgress] = useState(0);

  useEffect(() => {
    // Get connection status
    setWsStatus(WSService.getStatus());

    const unsubConnected = WSService.on('connected', () => setWsStatus(WSService.getStatus()));
    const unsubDisconnected = WSService.on('disconnected', () => setWsStatus(WSService.getStatus()));

    const unsubQR = WSService.on('PAIRING_QR', (data) => {
      setPairingQR(data.qr);
      setShowQR(true);
    });

    // Check biometrics
    BiometricService.checkAvailability().then(({ available, biometryType }) => {
      if (available) setBiometricType(biometryType);
    });

    // Get device ID
    BiometricService.getOrCreateDeviceId().then(setDeviceId);

    // Check Gemma status
    const checkGemma = async () => {
      try {
        const status = await GemmaService.getDownloadStatus();
        const ready = await GemmaService.isReady();
        setGemmaInfo({ ...status, loaded: ready });
      } catch { /* GemmaModule not available */ }
    };
    checkGemma();

    return () => { unsubConnected(); unsubDisconnected(); unsubQR(); };
  }, []);

  const requestPairingQR = () => {
    WSService.send('REQUEST_PAIRING_QR');
    Alert.alert(
      'Pairing QR',
      'Request sent to desktop. Open Gravity Omega → Settings → Mobile Pairing to generate the QR code.',
      [{ text: 'OK' }]
    );
  };

  const handleScanQR = () => {
    navigation.navigate('QRScanner');
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect',
      'Remove saved connection and disconnect from Gravity Omega?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            WSService.disconnect();
            await WSService.clearSavedConnection();
            setWsStatus({ connected: false });
          }
        }
      ]
    );
  };

  const handleRegeneratePair = async () => {
    Alert.alert(
      'Regenerate Keys',
      'This will delete the existing biometric keypair and require re-pairing with the desktop.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: async () => {
            try {
              await BiometricService.generateKeypair();
              Alert.alert('Done', 'New keypair generated. Re-pair with Gravity Omega to update the public key.');
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          }
        }
      ]
    );
  };

  const toggleNotif = (key) => {
    setNotifSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGemmaDownload = async () => {
    try {
      setGemmaDownloading(true);
      setGemmaProgress(0);
      await GemmaService.downloadModel('E4B', (progress) => {
        setGemmaProgress(progress);
      });
      const status = await GemmaService.getDownloadStatus();
      setGemmaInfo(prev => ({ ...prev, ...status, downloaded: true }));
      setGemmaDownloading(false);
      Alert.alert('Download Complete', 'Gemma 4 E4B is ready for on-device inference.');
    } catch (e) {
      setGemmaDownloading(false);
      Alert.alert('Download Failed', e.message);
    }
  };

  const handleGemmaDelete = () => {
    Alert.alert(
      'Delete Model',
      'Remove the Gemma 4 model from device storage? This frees ~2.5GB.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await GemmaService.deleteModel();
            setGemmaInfo(prev => ({ ...prev, downloaded: false, loaded: false, actual_mb: 0 }));
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Connection status */}
      <ConnectionStatus status={wsStatus} />

      {/* Pairing */}
      <Text style={styles.sectionLabel}>CONNECTION</Text>
      <View style={styles.card}>
        <SettingRow
          label="Scan QR Code to Pair"
          value="Point camera at Gravity Omega's pairing QR"
          onPress={handleScanQR}
        />
        <View style={styles.divider} />
        <SettingRow
          label="Disconnect"
          value={wsStatus.host || 'Not connected'}
          onPress={handleDisconnect}
          danger={wsStatus.connected}
        />
      </View>

      {/* Biometrics */}
      <Text style={styles.sectionLabel}>BIOMETRIC SECURITY</Text>
      <View style={styles.card}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Biometric Type</Text>
            <Text style={styles.settingValue}>
              {biometricType || 'Not available'}
            </Text>
          </View>
          <View style={[styles.badge, { borderColor: biometricType ? colors.green : colors.red }]}>
            <Text style={[styles.badgeText, { color: biometricType ? colors.green : colors.red }]}>
              {biometricType ? '✓' : '✗'}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Device ID</Text>
            <Text style={styles.settingValue} numberOfLines={1}>
              {deviceId ? deviceId.substring(0, 24) + '...' : 'Generating...'}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <SettingRow
          label="Regenerate Keypair"
          value="Requires re-pairing with desktop"
          onPress={handleRegeneratePair}
          danger
        />
      </View>

      {/* Notifications */}
      <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
      <View style={styles.card}>
        {[
          { key: 'approvals', label: 'Approval Required', desc: 'Always on — cannot disable' },
          { key: 'aegisAlerts', label: 'AEGIS Alerts', desc: 'Critical and HIGH findings' },
          { key: 'taskComplete', label: 'Task Complete', desc: 'When agent finishes a task' },
          { key: 'sealComplete', label: 'VERITAS Seal', desc: 'When a seal is written' },
        ].map(({ key, label, desc }, i) => (
          <React.Fragment key={key}>
            {i > 0 && <View style={styles.divider} />}
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => key !== 'approvals' && toggleNotif(key)}
              activeOpacity={0.7}
            >
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>{label}</Text>
                <Text style={styles.settingValue}>{desc}</Text>
              </View>
              <View style={[
                styles.toggle,
                (notifSettings[key] || key === 'approvals') && styles.toggleOn
              ]}>
                <View style={[
                  styles.toggleThumb,
                  (notifSettings[key] || key === 'approvals') && styles.toggleThumbOn
                ]} />
              </View>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>

      {/* On-Device Intelligence */}
      <Text style={styles.sectionLabel}>ON-DEVICE INTELLIGENCE</Text>
      <View style={styles.card}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Gemma 4 E4B</Text>
            <Text style={styles.settingValue}>
              {gemmaInfo.downloaded ? `${gemmaInfo.actual_mb || '~2500'}MB · ${gemmaInfo.loaded ? 'Loaded in memory' : 'On disk'}` : 'Not downloaded'}
            </Text>
          </View>
          <View style={[styles.badge, { borderColor: gemmaInfo.loaded ? colors.gold : gemmaInfo.downloaded ? colors.green : colors.red }]}>
            <Text style={[styles.badgeText, { color: gemmaInfo.loaded ? colors.gold : gemmaInfo.downloaded ? colors.green : colors.red }]}>
              {gemmaInfo.loaded ? 'Ω' : gemmaInfo.downloaded ? '✓' : '✗'}
            </Text>
          </View>
        </View>
        {gemmaDownloading && (
          <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
            <View style={styles.gemmaProgressTrack}>
              <View style={[styles.gemmaProgressFill, { width: `${gemmaProgress * 100}%` }]} />
            </View>
            <Text style={{ fontFamily: 'Courier New', fontSize: 9, color: colors.goldDim, marginTop: 2 }}>
              Downloading... {Math.round(gemmaProgress * 100)}%
            </Text>
          </View>
        )}
        <View style={styles.divider} />
        {!gemmaInfo.downloaded ? (
          <SettingRow
            label="Download Gemma 4 E4B"
            value="~2.5GB — Enables offline AI"
            onPress={handleGemmaDownload}
          />
        ) : (
          <SettingRow
            label="Delete Model"
            value="Free ~2.5GB device storage"
            onPress={handleGemmaDelete}
            danger
          />
        )}
        <View style={styles.divider} />
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Inference Routing</Text>
            <Text style={styles.settingValue}>Auto — uses local when bridge is down</Text>
          </View>
        </View>
      </View>

      {/* About */}
      <Text style={styles.sectionLabel}>ABOUT</Text>
      <View style={styles.card}>
        <View style={styles.aboutSection}>
          <Text style={styles.aboutTitle}>Ω OMEGA MOBILE</Text>
          <Text style={styles.aboutSub}>VERITAS Command Interface</Text>
          <Text style={styles.aboutVersion}>v1.0.0 · Built with React Native</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Architecture</Text>
          <Text style={styles.settingValue}>Android Keystore · WebSocket · HMAC-SHA256</Text>
        </View>
      </View>

      <Text style={styles.footer}>
        Examina omnia, venerare nihil, pro te cogita.
      </Text>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.obsidian },
  content: { padding: spacing.lg, paddingBottom: 40 },

  connStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    backgroundColor: colors.obsidianMid,
    shadowColor: colors.gold,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  connDot: { width: 8, height: 8, borderRadius: 4, shadowColor: '#000', shadowOffset: {width: 0, height: 0}, shadowOpacity: 0.8, shadowRadius: 3 },
  connInfo: { flex: 1 },
  connStatusText: { fontFamily: 'Courier New', fontSize: 11, letterSpacing: 2, fontWeight: 'bold' },
  connHost: { fontFamily: 'Courier New', fontSize: 10, color: colors.textDim, marginTop: 2 },
  connRetry: { fontFamily: 'Courier New', fontSize: 9, color: colors.orange, marginTop: 2 },

  sectionLabel: { ...typography.label, marginBottom: spacing.sm, marginTop: spacing.lg },

  card: {
    backgroundColor: colors.obsidianMid,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
    shadowColor: colors.gold,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },

  settingRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  settingInfo: { flex: 1 },
  settingLabel: { fontFamily: 'Courier New', fontSize: 11, color: colors.text },
  settingValue: { fontFamily: 'Courier New', fontSize: 9, color: colors.textDim, marginTop: 2 },
  settingArrow: { color: colors.goldDim, fontSize: 16 },

  badge: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: 'Courier New', fontSize: 11 },

  toggle: {
    width: 44, height: 24, borderRadius: 12,
    backgroundColor: colors.obsidianLight,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleOn: { backgroundColor: 'rgba(212,175,55,0.2)', borderColor: colors.gold },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.textDim },
  toggleThumbOn: { backgroundColor: colors.gold, alignSelf: 'flex-end' },

  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },

  aboutSection: { alignItems: 'center', padding: spacing.xl },
  aboutTitle: { ...typography.title, fontSize: 16, letterSpacing: 4 },
  aboutSub: { ...typography.subtitle, marginTop: 4 },
  aboutVersion: { fontFamily: 'Courier New', fontSize: 10, color: colors.textFaint, marginTop: spacing.sm },

  footer: {
    fontFamily: 'Courier New',
    fontSize: 9,
    color: colors.goldDim,
    textAlign: 'center',
    marginTop: spacing.xl,
    letterSpacing: 1,
  },

  // Gemma download progress
  gemmaProgressTrack: {
    height: 3,
    backgroundColor: colors.obsidianLight,
    borderRadius: 2,
  },
  gemmaProgressFill: {
    height: 3,
    backgroundColor: colors.gold,
    borderRadius: 2,
  },
});
