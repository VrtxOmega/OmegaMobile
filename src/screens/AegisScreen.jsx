import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
} from 'react-native';
import { colors, spacing, radius, typography } from '../theme/veritas';
import WSService from '../services/WebSocketService';

const ScoreGauge = ({ score }) => {
  const color = score >= 90 ? colors.green : score >= 60 ? colors.gold : colors.red;
  const label = score >= 90 ? '✓ CLEAN' : score >= 60 ? '⚠ CAUTION' : '✗ THREAT';

  return (
    <View style={styles.gauge}>
      <Text style={[styles.gaugeScore, { color }]}>{score}</Text>
      <Text style={[styles.gaugeLabel, { color }]}>{label}</Text>
    </View>
  );
};

const FindingCard = ({ finding }) => {
  const [expanded, setExpanded] = useState(false);
  const sevColors = {
    CRITICAL: colors.red,
    HIGH: colors.orange,
    MEDIUM: colors.gold,
    LOW: colors.textDim,
  };
  const color = sevColors[finding.severity] || colors.textDim;

  return (
    <TouchableOpacity
      style={[styles.finding, { borderLeftColor: color }]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.findingHeader}>
        <View style={[styles.sevBadge, { borderColor: color }]}>
          <Text style={[styles.sevText, { color }]}>{finding.severity}</Text>
        </View>
        <Text style={styles.findingTitle} numberOfLines={expanded ? undefined : 1}>
          {finding.title}
        </Text>
        <Text style={styles.expandIcon}>{expanded ? '▾' : '▸'}</Text>
      </View>
      {expanded && (
        <>
          <Text style={styles.findingFile}>
            {finding.file}:{finding.line}
          </Text>
          <Text style={styles.findingDetail}>{finding.detail}</Text>
          <View style={styles.findingActions}>
            <TouchableOpacity
              style={styles.fixBtn}
              onPress={() => WSService.send('AEGIS_FIX_FINDING', { finding })}
            >
              <Text style={styles.fixBtnText}>⚡ Apply Fix</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={() => WSService.send('AEGIS_SKIP_FINDING', { id: finding.id })}
            >
              <Text style={styles.skipBtnText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </TouchableOpacity>
  );
};

const DefenseSystem = ({ name, status, onToggle }) => {
  const online = status === 'ONLINE' || status === 'ACTIVE';

  return (
    <View style={styles.defenseRow}>
      <View style={styles.defenseInfo}>
        <Text style={styles.defenseName}>{name}</Text>
        <Text style={[styles.defenseStatus, { color: online ? colors.green : colors.red }]}>
          {status}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.defenseToggle, { borderColor: online ? colors.green : colors.red }]}
        onPress={onToggle}
      >
        <Text style={[styles.defenseToggleText, { color: online ? colors.green : colors.red }]}>
          {online ? 'DISENGAGE' : 'ENGAGE'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default function AegisScreen() {
  const [score, setScore] = useState(100);
  const [findings, setFindings] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [scanDuration, setScanDuration] = useState(null);
  const [defenses, setDefenses] = useState({
    Sentinel: 'ACTIVE',
    'AEGIS Shield': 'ONLINE',
    'Shadow Trap': 'ONLINE',
    'Mirror Gate': 'STANDBY',
  });
  const [refreshing, setRefreshing] = useState(false);
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsubScan = WSService.on('AEGIS_SCAN_RESULT', data => {
      setScanning(false);
      setFindings(data.findings || []);
      setScore(data.score || 100);
      setLastScan(new Date());
      setScanDuration(data.duration_ms);
      Animated.timing(scanAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    });

    const unsubProgress = WSService.on('AEGIS_SCAN_PROGRESS', data => {
      // Could show progress
    });

    const unsubDefense = WSService.on('AEGIS_DEFENSE_STATUS', data => {
      setDefenses(data.defenses);
    });

    // Request current status
    WSService.send('AEGIS_REQUEST_STATUS');

    return () => {
      unsubScan();
      unsubProgress();
      unsubDefense();
    };
  }, []);

  const runScan = useCallback(() => {
    setScanning(true);
    Animated.loop(
      Animated.timing(scanAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
    ).start();
    WSService.send('AEGIS_RUN_SCAN');
  }, [scanAnim]);

  const toggleDefense = name => {
    const current = defenses[name];
    const newStatus = current === 'ONLINE' || current === 'ACTIVE' ? 'STANDBY' : 'ONLINE';
    setDefenses(prev => ({ ...prev, [name]: newStatus }));
    WSService.send('AEGIS_TOGGLE_DEFENSE', { name, status: newStatus });
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    WSService.send('AEGIS_REQUEST_STATUS');
    setTimeout(() => setRefreshing(false), 2000);
  }, []);

  const critical = findings.filter(f => f.severity === 'CRITICAL').length;
  const high = findings.filter(f => f.severity === 'HIGH').length;

  const lastScanStr = lastScan
    ? `${lastScan.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${scanDuration ? ` · ${scanDuration}ms` : ''}`
    : 'Never';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
      }
    >
      {/* Score */}
      <View style={styles.scoreSection}>
        <ScoreGauge score={score} />
        <Text style={styles.lastScan}>Last scan: {lastScanStr}</Text>

        {findings.length > 0 && (
          <View style={styles.severitySummary}>
            {critical > 0 && (
              <View style={[styles.sevCount, { backgroundColor: colors.redDim }]}>
                <Text style={[styles.sevCountNum, { color: colors.red }]}>{critical}</Text>
                <Text style={[styles.sevCountLabel, { color: colors.red }]}>CRITICAL</Text>
              </View>
            )}
            {high > 0 && (
              <View style={[styles.sevCount, { backgroundColor: colors.orangeDim }]}>
                <Text style={[styles.sevCountNum, { color: colors.orange }]}>{high}</Text>
                <Text style={[styles.sevCountLabel, { color: colors.orange }]}>HIGH</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Scan button */}
      <TouchableOpacity
        style={[styles.scanBtn, scanning && styles.scanBtnActive]}
        onPress={runScan}
        disabled={scanning}
        activeOpacity={0.7}
      >
        <Animated.Text
          style={[
            styles.scanBtnIcon,
            {
              transform: [
                {
                  rotate: scanAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        >
          ⬡
        </Animated.Text>
        <Text style={styles.scanBtnText}>{scanning ? 'SCANNING...' : 'RUN FULL SCAN'}</Text>
      </TouchableOpacity>

      {/* Findings */}
      {findings.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>FINDINGS ({findings.length})</Text>
          {findings.map((f, i) => (
            <FindingCard key={i} finding={f} />
          ))}
        </>
      )}

      {findings.length === 0 && !scanning && lastScan && (
        <View style={styles.cleanCard}>
          <Text style={styles.cleanIcon}>✓</Text>
          <Text style={styles.cleanTitle}>All Clear</Text>
          <Text style={styles.cleanSub}>No threats detected in last scan</Text>
        </View>
      )}

      {/* Defense systems */}
      <Text style={styles.sectionLabel}>DEFENSE SYSTEMS</Text>
      <View style={styles.card}>
        {Object.entries(defenses).map(([name, status], i) => (
          <React.Fragment key={name}>
            {i > 0 && <View style={styles.divider} />}
            <DefenseSystem name={name} status={status} onToggle={() => toggleDefense(name)} />
          </React.Fragment>
        ))}
      </View>
    </ScrollView>
  );
}

// Need to add useRef
import { useRef } from 'react';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.obsidian },
  content: { padding: spacing.lg, paddingBottom: 40 },

  scoreSection: { alignItems: 'center', paddingVertical: spacing.xl },
  gauge: { alignItems: 'center' },
  gaugeScore: { fontSize: 64, fontFamily: 'Courier New', fontWeight: 'bold', lineHeight: 72 },
  gaugeLabel: { fontFamily: 'Courier New', fontSize: 12, letterSpacing: 3 },
  lastScan: { ...typography.bodySmall, marginTop: spacing.md },

  severitySummary: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  sevCount: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  sevCountNum: { fontFamily: 'Courier New', fontSize: 20, fontWeight: 'bold' },
  sevCountLabel: { fontFamily: 'Courier New', fontSize: 8, letterSpacing: 2 },

  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  scanBtnActive: { opacity: 0.6, shadowOpacity: 0.05, elevation: 2 },
  scanBtnIcon: { fontSize: 18, color: colors.gold },
  scanBtnText: {
    fontFamily: 'Courier New',
    fontSize: 12,
    color: colors.gold,
    letterSpacing: 2,
    fontWeight: 'bold',
  },

  sectionLabel: { ...typography.label, marginBottom: spacing.sm, marginTop: spacing.md },

  finding: {
    backgroundColor: colors.obsidianMid,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    marginBottom: spacing.sm,
    padding: spacing.md,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  findingHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sevBadge: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  sevText: { fontFamily: 'Courier New', fontSize: 9, letterSpacing: 1, fontWeight: 'bold' },
  findingTitle: {
    flex: 1,
    fontFamily: 'Courier New',
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  expandIcon: { color: colors.goldDim, fontSize: 12 },
  findingFile: {
    fontFamily: 'Courier New',
    fontSize: 9,
    color: colors.textDim,
    marginTop: spacing.sm,
  },
  findingDetail: { ...typography.bodySmall, marginTop: spacing.sm },
  findingActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  fixBtn: {
    flex: 1,
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  fixBtnText: { fontFamily: 'Courier New', fontSize: 11, color: colors.gold, fontWeight: 'bold' },
  skipBtn: {
    paddingHorizontal: spacing.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  skipBtnText: { fontFamily: 'Courier New', fontSize: 10, color: colors.textDim },

  cleanCard: {
    alignItems: 'center',
    padding: spacing.xxl,
    backgroundColor: colors.obsidianMid,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.greenDim,
    marginBottom: spacing.xl,
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  cleanIcon: { fontSize: 32, color: colors.green, marginBottom: spacing.md },
  cleanTitle: {
    fontFamily: 'Courier New',
    fontSize: 16,
    color: colors.green,
    letterSpacing: 2,
    marginBottom: spacing.sm,
    fontWeight: 'bold',
  },
  cleanSub: { ...typography.bodySmall },

  card: {
    backgroundColor: colors.obsidianMid,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  defenseRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  defenseInfo: { flex: 1 },
  defenseName: { fontFamily: 'Courier New', fontSize: 11, color: colors.text },
  defenseStatus: { fontFamily: 'Courier New', fontSize: 9, letterSpacing: 1, marginTop: 2 },
  defenseToggle: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  defenseToggleText: { fontFamily: 'Courier New', fontSize: 9, letterSpacing: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
});
