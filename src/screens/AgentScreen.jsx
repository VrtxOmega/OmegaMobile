import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { colors, spacing, radius, typography } from '../theme/veritas';
import WSService from '../services/WebSocketService';
import ApprovalModal from '../components/ApprovalModal';

const ToolStepCard = ({ step }) => {
  const icons = { AST: '📝', NET: '🌐', SYS: '⚙️', VLT: '🗄️' };
  const icon = icons[step.type] || '🔧';

  return (
    <View style={styles.toolStep}>
      <Text style={styles.toolStepIcon}>{step.ok ? '✓' : step.ok === false ? '✗' : '⚙'}</Text>
      <Text style={styles.toolStepLabel} numberOfLines={1}>{icon} {step.label}</Text>
    </View>
  );
};

const ProgressBar = ({ current, total, action }) => {
  const progress = total > 0 ? current / total : 0;

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressText}>Step {current} of {total}</Text>
        <Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      {action && <Text style={styles.progressAction} numberOfLines={1}>{action}</Text>}
    </View>
  );
};

const ThinkingIndicator = ({ steps, elapsed }) => {
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.thinkingContainer}>
      <View style={styles.thinkingHeader}>
        <Text style={styles.thinkingIcon}>Ω</Text>
        <Animated.Text style={[styles.thinkingLabel, { opacity: dotAnim }]}>
          Thinking...
        </Animated.Text>
        <Text style={styles.thinkingTimer}>{elapsed}s</Text>
      </View>
      {steps.length > 0 && (
        <View style={styles.thinkingSteps}>
          {steps.slice(-3).map((s, i) => (
            <ToolStepCard key={i} step={s} />
          ))}
        </View>
      )}
    </View>
  );
};

const ChatBubble = ({ msg }) => {
  const [expanded, setExpanded] = useState(false);
  const isOmega = msg.role === 'assistant';

  return (
    <View style={[styles.bubbleWrapper, isOmega ? styles.bubbleLeft : styles.bubbleRight]}>
      {isOmega && (
        <Text style={styles.bubbleSender}>Ω OMEGA</Text>
      )}
      <View style={[styles.bubble, isOmega ? styles.bubbleOmega : styles.bubbleUser]}>
        <Text style={[styles.bubbleText, !isOmega && { color: colors.gold }]}>
          {msg.content}
        </Text>
      </View>
      {isOmega && msg.steps > 0 && (
        <>
          <TouchableOpacity style={styles.stepsBadge} onPress={() => setExpanded(!expanded)}>
            <Text style={styles.stepsBadgeText}>
              ⚡ {msg.steps} tool steps {expanded ? '▾' : '▸'}
            </Text>
          </TouchableOpacity>
          {expanded && msg.stepLog?.map((s, i) => (
            <ToolStepCard key={i} step={s} />
          ))}
        </>
      )}
    </View>
  );
};

const QuickCommands = ({ onSelect }) => {
  const commands = [
    'What are you doing?',
    'Seal the session',
    'Stop and wait',
    'Run status check',
    'Show vault summary',
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickCmds}>
      {commands.map((cmd, i) => (
        <TouchableOpacity key={i} style={styles.quickCmd} onPress={() => onSelect(cmd)}>
          <Text style={styles.quickCmdText}>{cmd}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

export default function AgentScreen() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState([]);
  const [thinkingElapsed, setThinkingElapsed] = useState(0);
  const [activeTask, setActiveTask] = useState(null);
  const [pendingApproval, setPendingApproval] = useState(null);
  const scrollRef = useRef(null);
  const thinkingTimer = useRef(null);
  const thinkingStart = useRef(null);

  useEffect(() => {
    const unsubMsg = WSService.on('AGENT_MESSAGE', (data) => {
      setThinking(false);
      clearThinkingTimer();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        steps: data.steps || 0,
        stepLog: data.stepLog || [],
        timestamp: Date.now(),
      }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });

    const unsubStep = WSService.on('AGENT_STEP', (data) => {
      setThinkingSteps(prev => [...prev.slice(-5), data]);
    });

    const unsubTask = WSService.on('AGENT_TASK_UPDATE', (data) => {
      setActiveTask(data.task);
    });

    const unsubApproval = WSService.on('APPROVAL_REQUIRED', (data) => {
      setPendingApproval(data);
      setThinking(false);
      clearThinkingTimer();
    });

    return () => {
      unsubMsg(); unsubStep(); unsubTask(); unsubApproval();
      clearThinkingTimer();
    };
  }, []);

  const clearThinkingTimer = () => {
    if (thinkingTimer.current) {
      clearInterval(thinkingTimer.current);
      thinkingTimer.current = null;
    }
  };

  const startThinking = () => {
    setThinking(true);
    setThinkingSteps([]);
    setThinkingElapsed(0);
    thinkingStart.current = Date.now();
    thinkingTimer.current = setInterval(() => {
      setThinkingElapsed(Math.round((Date.now() - thinkingStart.current) / 100) / 10);
    }, 100);
  };

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    const userMsg = { role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    startThinking();

    WSService.send('CHAT_MESSAGE', { text, sessionId: 'mobile' });
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [input]);

  const handleApprovalResult = (approved, signature, deviceId) => {
    if (!pendingApproval) return;

    if (approved) {
      WSService.send('BIOMETRIC_APPROVAL', {
        challenge_id: pendingApproval.challenge_id,
        device_id: deviceId,
        signature: signature,
      });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ Approved: ${pendingApproval.tool} — continuing...`,
        timestamp: Date.now(),
      }]);
      startThinking();
    } else {
      WSService.send('BIOMETRIC_DENIAL', {
        challenge_id: pendingApproval.challenge_id,
      });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Denied: ${pendingApproval.tool}`,
        timestamp: Date.now(),
      }]);
    }

    setPendingApproval(null);
  };

  const handleStop = () => {
    WSService.send('AGENT_ABORT', {});
    setThinking(false);
    clearThinkingTimer();
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '⏹ Interrupted by user',
      timestamp: Date.now(),
    }]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Active task progress */}
      {activeTask && thinking && (
        <ProgressBar
          current={activeTask.current}
          total={activeTask.total}
          action={activeTask.action}
        />
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <View style={styles.welcome}>
            <Text style={styles.welcomeIcon}>Ω</Text>
            <Text style={styles.welcomeText}>
              I'm Omega — your command interface. Ask me anything or give me a task to execute.
            </Text>
          </View>
        )}

        {messages.map((msg, i) => (
          <ChatBubble key={i} msg={msg} />
        ))}

        {thinking && (
          <ThinkingIndicator steps={thinkingSteps} elapsed={thinkingElapsed} />
        )}
      </ScrollView>

      {/* Quick commands */}
      <QuickCommands onSelect={(cmd) => { setInput(cmd); }} />

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, input ? { borderColor: colors.gold, shadowColor: colors.gold, shadowOpacity: 0.5, shadowRadius: 10, elevation: 5 } : {}]}
          value={input}
          onChangeText={setInput}
          keyboardAppearance="dark"
          placeholder="Ask Omega anything..."
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={2000}
          onSubmitEditing={sendMessage}
          blurOnSubmit={false}
        />
        {thinking ? (
          <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
            <Text style={styles.stopBtnText}>■</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim()}
          >
            <Text style={styles.sendBtnText}>▶</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Approval modal */}
      {pendingApproval && (
        <ApprovalModal
          challenge={pendingApproval}
          onResult={handleApprovalResult}
          onDismiss={() => setPendingApproval(null)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.obsidian },

  progressContainer: {
    backgroundColor: colors.obsidianMid,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: spacing.md,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progressText: { fontFamily: 'Courier New', fontSize: 10, color: colors.text },
  progressPercent: { fontFamily: 'Courier New', fontSize: 10, color: colors.gold },
  progressTrack: { height: 3, backgroundColor: colors.obsidianLight, borderRadius: 2, marginBottom: 4 },
  progressFill: { height: 3, backgroundColor: colors.gold, borderRadius: 2 },
  progressAction: { fontFamily: 'Courier New', fontSize: 9, color: colors.textDim },

  messages: { flex: 1 },
  messagesContent: { padding: spacing.lg, gap: spacing.md },

  welcome: { alignItems: 'center', paddingVertical: spacing.xxl },
  welcomeIcon: { fontSize: 40, color: colors.gold, marginBottom: spacing.lg },
  welcomeText: { ...typography.body, textAlign: 'center', color: colors.textDim, maxWidth: 260 },

  bubbleWrapper: { maxWidth: '85%', gap: 4 },
  bubbleLeft: { alignSelf: 'flex-start' },
  bubbleRight: { alignSelf: 'flex-end' },
  bubbleSender: { fontFamily: 'Courier New', fontSize: 9, color: colors.gold, marginBottom: 2 },
  bubble: { borderRadius: radius.md, padding: spacing.md },
  bubbleOmega: {
    backgroundColor: colors.obsidianMid,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 0,
  },
  bubbleUser: {
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    borderTopRightRadius: 0,
  },
  bubbleText: { ...typography.body, fontSize: 13 },

  stepsBadge: {
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  stepsBadgeText: { fontFamily: 'Courier New', fontSize: 9, color: colors.goldDim },

  toolStep: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: 2 },
  toolStepIcon: { fontFamily: 'Courier New', fontSize: 10, color: colors.green, width: 14 },
  toolStepLabel: { fontFamily: 'Courier New', fontSize: 9, color: colors.textDim, flex: 1 },

  thinkingContainer: {
    alignSelf: 'flex-start',
    maxWidth: '80%',
    backgroundColor: colors.obsidianMid,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 0,
    padding: spacing.md,
  },
  thinkingHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thinkingIcon: { color: colors.gold, fontFamily: 'Courier New', fontSize: 12 },
  thinkingLabel: { color: colors.textDim, fontFamily: 'Courier New', fontSize: 11, flex: 1 },
  thinkingTimer: { color: colors.goldDim, fontFamily: 'Courier New', fontSize: 10 },
  thinkingSteps: { marginTop: spacing.sm, gap: 2 },

  quickCmds: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.obsidianLight,
    maxHeight: 52, // Crucial flex fix to restrict scaling ceiling
  },
  quickCmd: {
    backgroundColor: colors.obsidianMid,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  quickCmdText: { fontFamily: 'Courier New', fontSize: 11, color: colors.goldDim, fontWeight: '600' },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.obsidianLight,
    borderTopWidth: 1,
    borderTopColor: colors.borderBright,
    gap: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxl : spacing.md, // iOS notch clearance
  },
  input: {
    flex: 1,
    backgroundColor: colors.obsidianMid,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    fontFamily: 'Courier New',
    fontSize: 13,
    maxHeight: 120,
    minHeight: 46,
  },
  sendBtn: {
    width: 44, height: 44,
    backgroundColor: colors.gold,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  sendBtnDisabled: { 
    backgroundColor: colors.obsidianMid, 
    borderWidth: 1, 
    borderColor: colors.border,
    shadowOpacity: 0, 
    elevation: 0 
  },
  sendBtnText: { color: colors.obsidian, fontSize: 16, fontWeight: 'bold' },
  stopBtn: {
    width: 44, height: 44,
    backgroundColor: colors.red,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.red,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  stopBtnText: { color: 'white', fontSize: 16 },
});
