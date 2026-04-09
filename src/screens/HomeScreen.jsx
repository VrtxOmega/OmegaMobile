import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
  Pressable,
  Dimensions,
} from 'react-native';
import { colors, spacing, radius, typography, fonts } from '../theme/veritas';
import WSService from '../services/WebSocketService';

const { width } = Dimensions.get('window');

const StatusDot = ({ online }) => (
  <View style={[styles.dot, { backgroundColor: online ? colors.green : colors.red }]} />
);

const StatusCard = ({ label, status, online }) => (
  <View style={styles.statusRow}>
    <Text style={styles.statusLabel}>{label}</Text>
    <View style={styles.statusRight}>
      <StatusDot online={online} />
      <Text style={[styles.statusValue, { color: online ? colors.green : colors.red }]}>
        {status}
      </Text>
    </View>
  </View>
);

const QuickAction = ({ icon, label, onPress, color }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.92, friction: 5, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={[styles.gridItemWrapper, { transform: [{ scale }] }]}>
      <Pressable
        style={styles.gridItem}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Text style={[styles.gridIcon, { color: color || colors.gold }]}>{icon}</Text>
        <Text style={styles.gridLabel}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
};

const ActiveTask = ({ task }) => {
  if (!task) {
    return (
      <View style={styles.emptyTask}>
        <Text style={styles.emptyTaskText}>No active task</Text>
      </View>
    );
  }

  const progress = task.current / task.total;

  return (
    <View style={styles.activeTask}>
      <View style={styles.taskBorder} />
      <View style={styles.taskContent}>
        <Text style={styles.taskName}>{task.name}</Text>
        <Text style={styles.taskSub}>
          Step {task.current} of {task.total} — {task.action}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>
    </View>
  );
};

const ActivityItem = ({ item }) => {
  const icons = { AST: '📝', NET: '🌐', SYS: '⚙️', VLT: '🗄️' };
  const icon = icons[item.type] || '🔧';
  const timeStr = new Date(item.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.activityItem}>
      <Text style={styles.activityIcon}>{icon}</Text>
      <View style={styles.activityContent}>
        <Text style={styles.activityLabel} numberOfLines={1}>
          {item.label}
        </Text>
        <Text style={styles.activityTime}>{timeStr}</Text>
      </View>
      <View
        style={[styles.activityDot, { backgroundColor: item.ok ? colors.green : colors.red }]}
      />
    </View>
  );
};

export default function HomeScreen({ navigation }) {
  const [status, setStatus] = useState({
    backend: false,
    ollama: false,
    sentinel: false,
    connected: false,
  });
  const [activeTask, setActiveTask] = useState(null);
  const [activity, setActivity] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [latency, setLatency] = useState(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const watermarkAnim = useRef(new Animated.Value(1)).current;

  // Staggered entrance animations
  const fadeAnims = useRef([...Array(6)].map(() => new Animated.Value(0))).current;
  const slideAnims = useRef([...Array(6)].map(() => new Animated.Value(30))).current;

  useEffect(() => {
    // Staggered entrance
    const animations = fadeAnims.map((anim, i) => {
      return Animated.parallel([
        Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(slideAnims[i], {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]);
    });
    Animated.stagger(120, animations).start();

    // Pulse animation for connection indicator
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    ).start();

    // Watermark breathing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(watermarkAnim, { toValue: 1.05, duration: 4000, useNativeDriver: true }),
        Animated.timing(watermarkAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
      ]),
    ).start();

    const unsubStatus = WSService.on('NAEF_STATUS', data => {
      setStatus({
        backend: data.backend === 'ONLINE',
        ollama: data.ollama === 'READY',
        sentinel: data.sentinel === 'ACTIVE',
        connected: true,
      });
      if (data.latency) {
        setLatency(data.latency);
      }
    });

    const unsubTask = WSService.on('AGENT_TASK_UPDATE', data => {
      setActiveTask(data.task);
    });

    const unsubActivity = WSService.on('AGENT_STEP_COMPLETE', data => {
      // deduplicate or slice safely
      setActivity(prev => [data, ...prev].slice(0, 10));
    });

    const unsubConnected = WSService.on('connected', () => {
      setStatus(s => ({ ...s, connected: true }));
      WSService.send('REQUEST_STATUS');
    });

    const unsubDisconnected = WSService.on('disconnected', () => {
      setStatus({ backend: false, ollama: false, sentinel: false, connected: false });
    });

    WSService.send('REQUEST_STATUS');

    return () => {
      unsubStatus();
      unsubTask();
      unsubActivity();
      unsubConnected();
      unsubDisconnected();
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    WSService.send('REQUEST_STATUS');
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  // Helper macro for animated wrapping
  const wrapAnimated = (index, Component) => (
    <Animated.View
      style={{ opacity: fadeAnims[index], transform: [{ translateY: slideAnims[index] }] }}
    >
      {Component}
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      {/* Background Watermark */}
      <Animated.Text style={[styles.watermark, { transform: [{ scale: watermarkAnim }] }]}>
        Ω
      </Animated.Text>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
        }
      >
        {/* Header */}
        {wrapAnimated(
          0,
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Ω OMEGA</Text>
            <Text style={styles.headerSub}>COMMAND CENTER</Text>
            <View style={styles.connectionBadge}>
              <Animated.View
                style={[
                  styles.connectionPulse,
                  { transform: [{ scale: pulseAnim }], opacity: status.connected ? 1 : 0.3 },
                ]}
              />
              <Text
                style={[
                  styles.connectionText,
                  { color: status.connected ? colors.green : colors.red },
                ]}
              >
                {status.connected ? `CONNECTED${latency ? ` · ${latency}ms` : ''}` : 'OFFLINE'}
              </Text>
            </View>
          </View>,
        )}

        {/* Status */}
        {wrapAnimated(
          1,
          <View>
            <Text style={styles.sectionLabel}>STATUS</Text>
            <View style={styles.card}>
              <StatusCard
                label="Backend"
                status={status.backend ? 'ONLINE' : 'OFFLINE'}
                online={status.backend}
              />
              <View style={styles.divider} />
              <StatusCard
                label="Ollama"
                status={status.ollama ? 'READY' : 'OFFLINE'}
                online={status.ollama}
              />
              <View style={styles.divider} />
              <StatusCard
                label="Sentinel"
                status={status.sentinel ? 'ACTIVE' : 'PAUSED'}
                online={status.sentinel}
              />
            </View>
          </View>,
        )}

        {/* Quick Actions */}
        {wrapAnimated(
          2,
          <View>
            <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
            <View style={styles.grid}>
              <QuickAction icon="⌖" label="Command" onPress={() => navigation.navigate('Agent')} />
              <QuickAction icon="◈" label="Vault" onPress={() => navigation.navigate('Vault')} />
              <QuickAction
                icon="⬡"
                label="Terminal"
                onPress={() => navigation.navigate('Terminal')}
              />
              <QuickAction
                icon="◉"
                label="Aegis"
                onPress={() => navigation.navigate('Aegis')}
                color={colors.green}
              />
            </View>
          </View>,
        )}

        {/* Active Task */}
        {wrapAnimated(
          3,
          <View>
            <Text style={styles.sectionLabel}>ACTIVE TASK</Text>
            <ActiveTask task={activeTask} />
          </View>,
        )}

        {/* Recent Activity */}
        {activity.length > 0 &&
          wrapAnimated(
            4,
            <View>
              <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
              <View style={styles.card}>
                {activity.map((item, i) => (
                  <ActivityItem key={i} item={item} />
                ))}
              </View>
            </View>,
          )}

        {/* Footer */}
        {wrapAnimated(
          5,
          <View style={styles.footer}>
            <Text style={styles.footerText}>VERITAS · Examina omnia, venerare nihil</Text>
          </View>,
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.obsidian },
  content: { padding: spacing.lg, paddingBottom: 40 },

  watermark: {
    position: 'absolute',
    top: '15%',
    left: '-15%',
    fontSize: width * 1.5,
    color: colors.gold,
    opacity: 0.03,
    fontFamily: fonts.sans,
    fontWeight: 'bold',
    zIndex: 0,
  },

  header: { alignItems: 'center', paddingVertical: spacing.xl, marginBottom: spacing.md },
  headerTitle: {
    ...typography.title,
    fontSize: 20,
    letterSpacing: 6,
    marginBottom: 4,
    textShadowColor: colors.goldDim,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  headerSub: { ...typography.subtitle, fontSize: 10 },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  connectionPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
    shadowColor: colors.green,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  connectionText: { fontFamily: 'Courier New', fontSize: 10, letterSpacing: 1 },

  sectionLabel: { ...typography.label, marginBottom: spacing.sm, marginTop: spacing.lg },

  card: {
    backgroundColor: colors.obsidianMid,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },

  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  statusLabel: { ...typography.bodySmall, color: colors.text, fontSize: 12 },
  statusRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusValue: { fontFamily: 'Courier New', fontSize: 10, letterSpacing: 1, fontWeight: '700' },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
  },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  gridItemWrapper: {
    flex: 1,
    minWidth: '45%',
  },
  gridItem: {
    backgroundColor: colors.obsidianMid,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
  },
  gridIcon: { fontSize: 26, marginBottom: spacing.sm },
  gridLabel: { ...typography.bodySmall, color: colors.gold, fontWeight: 'bold' },

  activeTask: {
    flexDirection: 'row',
    backgroundColor: colors.obsidianMid,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  taskBorder: { width: 3, backgroundColor: colors.gold },
  taskContent: { flex: 1, padding: spacing.md },
  taskName: {
    color: colors.gold,
    fontFamily: 'Courier New',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  taskSub: { ...typography.bodySmall, marginBottom: spacing.sm, color: colors.text },
  progressTrack: { height: 4, backgroundColor: colors.obsidianLight, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: colors.gold, borderRadius: 2 },
  emptyTask: {
    backgroundColor: colors.obsidianMid,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyTaskText: { ...typography.bodySmall },

  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  activityIcon: { fontSize: 16 },
  activityContent: { flex: 1 },
  activityLabel: { ...typography.bodySmall, color: colors.text },
  activityTime: { ...typography.bodySmall, fontSize: 10, color: colors.textFaint },
  activityDot: { width: 6, height: 6, borderRadius: 3 },

  footer: { alignItems: 'center', marginTop: spacing.xl },
  footerText: { fontFamily: 'Courier New', fontSize: 9, color: colors.goldDim, letterSpacing: 1 },
});
