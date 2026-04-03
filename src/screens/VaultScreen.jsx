import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native';
import { colors, spacing, radius, typography } from '../theme/veritas';
import WSService from '../services/WebSocketService';

const healthColors = {
  hot: colors.red,
  active: colors.gold,
  warm: colors.orange,
  stale: colors.textDim,
  dormant: 'rgba(200,200,180,0.2)',
};

const KICard = ({ ki, onPress }) => {
  const color = healthColors[ki.health] || colors.textDim;

  return (
    <TouchableOpacity style={styles.kiCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.kiBorder, { backgroundColor: color }]} />
      <View style={styles.kiContent}>
        <View style={styles.kiHeader}>
          <Text style={[styles.kiHealth, { color }]}>{(ki.health || 'unknown').toUpperCase()}</Text>
          <Text style={styles.kiCount}>{ki.doc_count || 0} docs</Text>
        </View>
        <Text style={styles.kiTitle} numberOfLines={2}>{ki.title || 'Untitled'}</Text>
        {ki.updated_at && (
          <Text style={styles.kiDate}>{new Date(ki.updated_at).toLocaleDateString()}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const SessionCard = ({ session }) => (
  <View style={styles.sessionCard}>
    <View style={styles.sessionHeader}>
      <Text style={styles.sessionSource}>{session.source || 'UNKNOWN'}</Text>
      <Text style={styles.sessionDate}>{session.updated_at?.split(' ')[0] || ''}</Text>
    </View>
    <Text style={styles.sessionTitle} numberOfLines={1}>{session.title || session.id || 'Untitled'}</Text>
    {session.doc_count > 0 && (
      <Text style={styles.sessionDocs}>{session.doc_count} documents</Text>
    )}
  </View>
);

const SearchResult = ({ result }) => (
  <View style={styles.searchResult}>
    <Text style={styles.searchResultDate}>{result.timestamp?.split(' ')[0] || ''}</Text>
    <Text style={styles.searchResultTitle} numberOfLines={2}>
      {result.title || result.content || result.summary || ''}
    </Text>
    {result.source && (
      <Text style={styles.searchResultSource}>{result.source}</Text>
    )}
  </View>
);

export default function VaultScreen() {
  const [stats, setStats] = useState({ entries: 0, knowledge_items: 0, sessions: 0 });
  const [kis, setKIs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('ki'); // ki | sessions | search
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const unsubContext = WSService.on('VAULT_CONTEXT', (data) => {
      if (data.stats) setStats(data.stats);
      if (data.recent) {
        // Split into KIs and sessions
      }
    });

    const unsubKI = WSService.on('VAULT_KI_HEALTH', (data) => {
      if (data.items) setKIs(data.items);
    });

    const unsubSessions = WSService.on('VAULT_SESSIONS', (data) => {
      if (Array.isArray(data.sessions)) setSessions(data.sessions);
    });

    const unsubSearch = WSService.on('VAULT_SEARCH_RESULTS', (data) => {
      setSearching(false);
      setSearchResults(data.results || []);
    });

    // Request data
    WSService.send('VAULT_REQUEST_CONTEXT');
    WSService.send('VAULT_REQUEST_KI_HEALTH');
    WSService.send('VAULT_REQUEST_SESSIONS');

    return () => { unsubContext(); unsubKI(); unsubSessions(); unsubSearch(); };
  }, []);

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setActiveTab('search');
    WSService.send('VAULT_SEARCH', { query: searchQuery });
  }, [searchQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    WSService.send('VAULT_REQUEST_KI_HEALTH');
    WSService.send('VAULT_REQUEST_SESSIONS');
    setTimeout(() => setRefreshing(false), 2000);
  }, []);

  return (
    <View style={styles.container}>
      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{stats.entries?.toLocaleString() || 0}</Text>
          <Text style={styles.statLabel}>Entries</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statNum}>{stats.knowledge_items || 0}</Text>
          <Text style={styles.statLabel}>KIs</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statNum}>{stats.sessions || 0}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search vault..."
          placeholderTextColor={colors.textFaint}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>⌖</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {[
          { key: 'ki', label: 'KNOWLEDGE' },
          { key: 'sessions', label: 'SESSIONS' },
          { key: 'search', label: 'RESULTS' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {activeTab === 'ki' && (
          kis.length > 0
            ? kis.map((ki, i) => <KICard key={i} ki={ki} onPress={() => {}} />)
            : <Text style={styles.empty}>No knowledge items found</Text>
        )}

        {activeTab === 'sessions' && (
          sessions.length > 0
            ? sessions.map((s, i) => <SessionCard key={i} session={s} />)
            : <Text style={styles.empty}>No sessions found</Text>
        )}

        {activeTab === 'search' && (
          searching
            ? <Text style={styles.empty}>Searching...</Text>
            : searchResults.length > 0
              ? searchResults.map((r, i) => <SearchResult key={i} result={r} />)
              : searchQuery
                ? <Text style={styles.empty}>No results for "{searchQuery}"</Text>
                : <Text style={styles.empty}>Enter a query to search the vault</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.obsidian },

  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.obsidianMid,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: spacing.md,
  },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontFamily: 'Courier New', fontSize: 18, color: colors.gold, fontWeight: 'bold' },
  statLabel: { ...typography.label, fontSize: 8, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },

  searchBar: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.obsidianMid,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontFamily: 'Courier New',
    fontSize: 12,
  },
  searchBtn: {
    width: 36, height: 36,
    backgroundColor: colors.goldFaint,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  searchBtnText: { color: colors.gold, fontSize: 16 },

  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: { flex: 1, padding: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
  tabText: { fontFamily: 'Courier New', fontSize: 9, color: colors.textDim, letterSpacing: 1 },
  tabTextActive: { color: colors.gold },

  content: { flex: 1 },
  contentInner: { padding: spacing.md, gap: spacing.sm },

  kiCard: {
    flexDirection: 'row',
    backgroundColor: colors.obsidianMid,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  kiBorder: { width: 3 },
  kiContent: { flex: 1, padding: spacing.md },
  kiHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  kiHealth: { fontFamily: 'Courier New', fontSize: 9, letterSpacing: 1, fontWeight: 'bold' },
  kiCount: { fontFamily: 'Courier New', fontSize: 8, color: colors.textDim },
  kiTitle: { fontFamily: 'Courier New', fontSize: 12, color: colors.text, fontWeight: '600' },
  kiDate: { fontFamily: 'Courier New', fontSize: 9, color: colors.textFaint, marginTop: 4 },

  sessionCard: {
    backgroundColor: colors.obsidianMid,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    shadowColor: colors.gold,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  sessionSource: { fontFamily: 'Courier New', fontSize: 9, color: colors.gold, letterSpacing: 1, fontWeight: 'bold' },
  sessionDate: { fontFamily: 'Courier New', fontSize: 8, color: colors.textFaint },
  sessionTitle: { fontFamily: 'Courier New', fontSize: 12, color: colors.text, fontWeight: '600' },
  sessionDocs: { fontFamily: 'Courier New', fontSize: 9, color: colors.textDim, marginTop: 4 },

  searchResult: {
    backgroundColor: colors.obsidianMid,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    shadowColor: colors.gold,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  searchResultDate: { fontFamily: 'Courier New', fontSize: 8, color: colors.textFaint, marginBottom: 4 },
  searchResultTitle: { fontFamily: 'Courier New', fontSize: 11, color: colors.text },
  searchResultSource: { fontFamily: 'Courier New', fontSize: 9, color: colors.goldDim, marginTop: 4 },

  empty: { fontFamily: 'Courier New', fontSize: 11, color: colors.textFaint, textAlign: 'center', padding: spacing.xl },
});
