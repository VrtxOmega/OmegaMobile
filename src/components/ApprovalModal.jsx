import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Vibration, Modal } from 'react-native';
import { colors, spacing, radius, typography } from '../theme/veritas';
import BiometricService from '../services/BiometricService';

const EXPIRY_SECONDS = 60;

export default function ApprovalModal({ challenge, onResult, onDismiss }) {
  const [status, setStatus] = useState('pending'); // pending | authenticating | approved | denied | expired | error
  const [countdown, setCountdown] = useState(EXPIRY_SECONDS);
  const [errorMsg, setErrorMsg] = useState('');
  const slideAnim = useRef(new Animated.Value(300)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    // Slide up
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 80,
      friction: 12,
      useNativeDriver: true,
    }).start();

    // Vibrate to get attention
    Vibration.vibrate([0, 400, 200, 400]);

    // Countdown timer
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setStatus('expired');
          onResult(false, null, null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [onResult, slideAnim]);

  const handleApprove = async () => {
    clearInterval(timerRef.current);
    setStatus('authenticating');

    try {
      const { success, signature, error } = await BiometricService.approveChallenge(challenge);
      const deviceId = await BiometricService.getOrCreateDeviceId();

      if (success && signature) {
        setStatus('approved');
        Vibration.vibrate(100);
        setTimeout(() => {
          onResult(true, signature, deviceId);
        }, 500);
      } else {
        setStatus('error');
        setErrorMsg(error || 'Biometric authentication failed');
        // Allow retry
        setTimeout(() => setStatus('pending'), 2000);
        timerRef.current = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timerRef.current);
              setStatus('expired');
              onResult(false, null, null);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (e) {
      setStatus('error');
      setErrorMsg(e.message);
      setTimeout(() => setStatus('pending'), 2000);
    }
  };

  const handleDeny = () => {
    clearInterval(timerRef.current);
    setStatus('denied');
    Vibration.vibrate([0, 100, 50, 100]);
    setTimeout(() => {
      onResult(false, null, null);
    }, 300);
  };

  const safetyColor =
    {
      SAFE: colors.green,
      GATED: colors.gold,
      RESTRICTED: colors.red,
    }[challenge.safety] || colors.orange;

  const countdownColor =
    countdown <= 10 ? colors.red : countdown <= 20 ? colors.orange : colors.textDim;

  const renderArgs = () => {
    try {
      const args = typeof challenge.args === 'object' ? challenge.args : JSON.parse(challenge.args);
      return Object.entries(args).map(([k, v]) => (
        <View key={k} style={styles.argRow}>
          <Text style={styles.argKey}>{k}:</Text>
          <Text style={styles.argValue} numberOfLines={2}>
            {typeof v === 'string' ? v : JSON.stringify(v)}
          </Text>
        </View>
      ));
    } catch (e) {
      console.error('[ApprovalModal] Failed to parse args:', e);
      return <Text style={styles.argValue}>{String(challenge.args)}</Text>;
    }
  };

  return (
    <Modal transparent animationType="none" visible statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
          {/* Header */}
          <View style={[styles.header, { borderTopColor: safetyColor }]}>
            <Text style={[styles.safetyBadge, { color: safetyColor, borderColor: safetyColor }]}>
              {challenge.safety}
            </Text>
            <Text style={styles.headerTitle}>APPROVAL REQUIRED</Text>
            <Text style={[styles.countdown, { color: countdownColor }]}>{countdown}s</Text>
          </View>

          {/* Tool info */}
          <View style={styles.toolSection}>
            <Text style={styles.toolLabel}>TOOL</Text>
            <Text style={styles.toolName}>{challenge.tool}</Text>
          </View>

          {/* Args */}
          <View style={styles.argsSection}>
            <Text style={styles.argsLabel}>ARGUMENTS</Text>
            <View style={styles.argsContent}>{renderArgs()}</View>
          </View>

          {/* Status message */}
          {status === 'authenticating' && (
            <View style={styles.statusMsg}>
              <Text style={styles.statusText}>👆 Waiting for fingerprint...</Text>
            </View>
          )}
          {status === 'approved' && (
            <View style={[styles.statusMsg, { backgroundColor: colors.greenDim }]}>
              <Text style={[styles.statusText, { color: colors.green }]}>
                ✓ Approved — executing
              </Text>
            </View>
          )}
          {status === 'denied' && (
            <View style={[styles.statusMsg, { backgroundColor: colors.redDim }]}>
              <Text style={[styles.statusText, { color: colors.red }]}>✗ Denied</Text>
            </View>
          )}
          {status === 'expired' && (
            <View style={[styles.statusMsg, { backgroundColor: colors.redDim }]}>
              <Text style={[styles.statusText, { color: colors.red }]}>⏱ Expired — timed out</Text>
            </View>
          )}
          {status === 'error' && (
            <View style={[styles.statusMsg, { backgroundColor: colors.redDim }]}>
              <Text style={[styles.statusText, { color: colors.red }]}>⚠ {errorMsg}</Text>
            </View>
          )}

          {/* Buttons */}
          {(status === 'pending' || status === 'error') && (
            <View style={styles.buttons}>
              <TouchableOpacity style={styles.denyBtn} onPress={handleDeny}>
                <Text style={styles.denyBtnText}>✗ DENY</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.approveBtn} onPress={handleApprove}>
                <Text style={styles.approveBtnTitle}>APPROVE</Text>
                <Text style={styles.approveBtnSub}>Requires biometric</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Security note */}
          <Text style={styles.securityNote}>
            🔒 Signed with Android Keystore · VERITAS SEAL on approval
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.obsidianLight,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderTopWidth: 3,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    gap: spacing.sm,
  },
  safetyBadge: {
    fontFamily: 'Courier New',
    fontSize: 9,
    letterSpacing: 2,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  headerTitle: {
    flex: 1,
    fontFamily: 'Courier New',
    fontSize: 11,
    letterSpacing: 2,
    color: colors.text,
  },
  countdown: {
    fontFamily: 'Courier New',
    fontSize: 13,
    fontWeight: 'bold',
  },

  toolSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toolLabel: { ...typography.label, marginBottom: 4 },
  toolName: {
    fontFamily: 'Courier New',
    fontSize: 18,
    color: colors.gold,
    fontWeight: '600',
  },

  argsSection: { padding: spacing.lg },
  argsLabel: { ...typography.label, marginBottom: spacing.sm },
  argsContent: {
    backgroundColor: colors.obsidianMid,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  argRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  argKey: { fontFamily: 'Courier New', fontSize: 11, color: colors.goldDim, minWidth: 80 },
  argValue: { fontFamily: 'Courier New', fontSize: 11, color: colors.text, flex: 1 },

  statusMsg: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.obsidianMid,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statusText: { fontFamily: 'Courier New', fontSize: 12, color: colors.text, textAlign: 'center' },

  buttons: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  denyBtn: {
    flex: 1,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  denyBtnText: { fontFamily: 'Courier New', fontSize: 12, color: colors.red, letterSpacing: 2 },
  approveBtn: {
    flex: 2,
    backgroundColor: colors.greenDim,
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  approveBtnTitle: {
    fontFamily: 'Courier New',
    fontSize: 12,
    color: colors.green,
    letterSpacing: 2,
    fontWeight: 'bold',
  },
  approveBtnSub: {
    fontFamily: 'Courier New',
    fontSize: 9,
    color: 'rgba(76,175,80,0.6)',
    marginTop: 2,
  },

  securityNote: {
    fontFamily: 'Courier New',
    fontSize: 9,
    color: colors.textFaint,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    letterSpacing: 0.5,
  },
});
