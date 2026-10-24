import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Alert } from 'react-native';
import { api, apiV1 } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Profile: bio, badges, goals, track progress, saved — plus privacy controls.
export default function ProfileScreen() {
  const t = useTheme();
  const s = makeStyles(t);
  const { logout, user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [impact, setImpact] = useState(null);
  const [showImpact, setShowImpact] = useState(false);

  useEffect(() => {
    api.myProfile().then(setProfile).catch(e => console.warn(e.message));
    api.policies().then(setPolicies).catch(() => {});
    apiV1.myImpact().then(setImpact).catch(() => {});
  }, []);

  const confirmDelete = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and your personal records. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete forever', style: 'destructive',
          onPress: async () => {
            try { await apiV1.deleteAccount(); await logout(); }
            catch (e) { Alert.alert('Could not delete', e.message); }
          } },
      ]
    );
  };

  const toggleConsent = async (policy, value) => {
    await api.setConsent(policy.id, value).catch(() => {});
    setPolicies(ps => ps.map(p => p.id === policy.id ? { ...p, _granted: value } : p));
  };

  if (!profile) return <View style={s.container}><Text style={s.loading}>Loading…</Text></View>;

  return (
    <ScrollView style={s.container}>
      <Text style={s.name}>{profile.user.display_name}</Text>
      {profile.user.bio ? <Text style={s.bio}>{profile.user.bio}</Text> : null}

      <Text style={s.section}>Badges</Text>
      <View style={s.badgeRow}>
        {profile.badges.length === 0 && <Text style={s.empty}>Your first badge is waiting.</Text>}
        {profile.badges.map(b => (
          <View key={b.id} style={s.badge}><Text style={s.badgeText}>{b.name}</Text></View>
        ))}
      </View>

      <Text style={s.section}>Learning tracks</Text>
      {profile.track_progress.map(t => (
        <View key={t.track_id} style={s.track}>
          <Text style={s.trackName}>{t.track_name}</Text>
          <Text style={s.trackProgress}>{t.completed}/{t.total_milestones} milestones</Text>
        </View>
      ))}

      <Text style={s.section}>Goals</Text>
      {profile.goals.map(g => (
        <Text key={g.id} style={s.goal}>{g.status === 'achieved' ? '✓ ' : '○ '}{g.title}</Text>
      ))}

      <Text style={s.section}>My Impact Transcript</Text>
      <Text style={s.transcriptIntro}>
        Your record, visible to you. Everything the community tracks about your
        journey is listed here — nothing is collected that you can't see.
      </Text>
      {impact && (
        <View style={s.track}>
          {impact.summary.slice(0, 6).map(row => (
            <View key={row.event_type} style={s.impactRow}>
              <Text style={s.impactType}>{row.event_type.replace(/_/g, ' ')}</Text>
              <Text style={s.impactCount}>{row.count}</Text>
            </View>
          ))}
          <TouchableOpacity onPress={() => setShowImpact(!showImpact)}>
            <Text style={s.impactToggle}>{showImpact ? 'Hide detail' : 'Show recent activity'}</Text>
          </TouchableOpacity>
          {showImpact && impact.events.slice(0, 25).map((e, i) => (
            <Text key={i} style={s.impactEvent}>
              {new Date(e.created_at).toLocaleDateString()} — {e.event_type.replace(/_/g, ' ')}
            </Text>
          ))}
        </View>
      )}

      <Text style={s.section}>Privacy — what we collect & why</Text>
      {policies.map(p => (
        <View key={p.id} style={s.policyRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.policyName}>{p.category.replace(/_/g, ' ')}</Text>
            <Text style={s.policyDesc}>{p.description}</Text>
          </View>
          <Switch value={p._granted ?? false} onValueChange={(v) => toggleConsent(p, v)}
            trackColor={{ true: t.accent }} />
        </View>
      ))}

      <TouchableOpacity style={s.logout} onPress={logout}>
        <Text style={s.logoutText}>Sign out</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.deleteBtn} onPress={confirmDelete}>
        <Text style={s.deleteText}>Delete my account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const makeStyles = (t) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.light, padding: 16 },
  loading: { textAlign: 'center', marginTop: 40, color: t.primary },
  name: { fontSize: 24, fontWeight: '800', color: t.primary },
  bio: { color: '#555', marginTop: 4 },
  section: { fontSize: 13, fontWeight: '800', color: t.accent, marginTop: 22, marginBottom: 8, textTransform: 'uppercase' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { backgroundColor: t.primary, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  badgeText: { color: t.light, fontWeight: '700', fontSize: 12 },
  empty: { color: '#888', fontStyle: 'italic' },
  track: { backgroundColor: t.surface, borderRadius: 8, padding: 12, marginBottom: 8 },
  trackName: { fontWeight: '700', color: t.primary },
  trackProgress: { color: t.accent, fontWeight: '600', marginTop: 2 },
  goal: { color: t.primary, marginBottom: 6, fontSize: 15 },
  policyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface, borderRadius: 8, padding: 12, marginBottom: 8 },
  policyName: { fontWeight: '700', color: t.primary, textTransform: 'capitalize' },
  policyDesc: { color: '#666', fontSize: 12, marginTop: 2 },
  logout: { marginTop: 30, marginBottom: 40, alignSelf: 'center' },
  logoutText: { color: t.accent, fontWeight: '700' },
  transcriptIntro: { color: '#666', fontSize: 13, marginBottom: 8, lineHeight: 18 },
  impactRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  impactType: { color: t.primary, textTransform: 'capitalize' },
  impactCount: { color: t.accent, fontWeight: '800' },
  impactToggle: { color: t.primary, fontWeight: '700', marginTop: 8, textDecorationLine: 'underline' },
  impactEvent: { color: '#777', fontSize: 12, marginTop: 4 },
  deleteBtn: { alignSelf: 'center', marginBottom: 50 },
  deleteText: { color: '#999', fontSize: 13, textDecorationLine: 'underline' },
});
