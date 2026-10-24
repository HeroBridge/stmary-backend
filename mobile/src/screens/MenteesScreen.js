import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { apiV1 } from '../api/client';
import { useTheme } from '../context/ThemeContext';

// The mentor's list of people. Ordered by who needs attention most —
// preferential option for the poor, expressed as a sort order.
export default function MenteesScreen({ navigation }) {
  const t = useTheme();
  const s = makeStyles(t);
  const [mentees, setMentees] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setMentees(await apiV1.myMentees()); }
    catch (e) { /* empty state handles it */ }
    finally { setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <FlatList
      style={s.container}
      data={mentees}
      keyExtractor={(m) => m.id}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.accent}
        onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={
        <Text style={s.header}>The people you walk with</Text>
      }
      ListEmptyComponent={
        <Text style={s.empty}>No one is matched with you yet.</Text>
      }
      renderItem={({ item }) => (
        <TouchableOpacity style={s.card}
          onPress={() => navigation.navigate('MentorBriefing',
            { menteeId: item.id, menteeName: item.display_name })}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{(item.display_name || '?')[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{item.display_name}</Text>
            <Text style={s.sub}>
              {item.needs_attention
                ? 'Could use your attention'
                : item.last_session
                  ? `Last spoke ${new Date(item.last_session).toLocaleDateString()}`
                  : 'You have not spoken yet'}
            </Text>
          </View>
          {item.needs_attention ? <View style={s.dot} /> : null}
        </TouchableOpacity>
      )}
    />
  );
}

const makeStyles = (t) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.light, padding: 16 },
  header: { fontSize: 22, fontWeight: '800', color: t.primary, marginVertical: 12 },
  empty: { color: '#8A8898', textAlign: 'center', marginTop: 40 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.surface,
    borderRadius: 14, padding: 14, marginBottom: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: t.primary,
    alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: t.light, fontWeight: '800', fontSize: 18 },
  name: { color: t.primary, fontWeight: '700', fontSize: 16 },
  sub: { color: '#8A8898', fontSize: 13, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.accent },
});
