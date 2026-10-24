import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
         ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { apiV1 } from '../api/client';
import { useTheme } from '../context/ThemeContext';

// ============================================================
// MENTOR BRIEFING
// ============================================================
// SUBSIDIARITY IN THE UI. Every design choice here defends the
// mentor's authority over the system's suggestion:
//
//  - The POSTURE is the largest text on the screen. The data is small.
//  - The EVIDENCE sits beside the posture, so the mentor can reject the
//    reasoning, not merely the conclusion.
//  - "Doesn't fit her" is exactly as easy to tap as "I used this."
//    A suggestion you cannot refuse is an instruction.
//  - No scripts. No suggested messages. No "send this" button. The
//    mentor speaks in their own voice or the tool has failed.
//  - The disclaimer is permanent, not a first-run tooltip.
// ============================================================

const TRADITION_LABEL = {
  csd: 'Catholic Social Doctrine',
  confessions: 'Confessions',
  city_of_god: 'City of God',
  org: 'Our community',
};

const STAGE_COPY = {
  arrival: { label: 'Arrival', note: 'Newly here. Their history came with them.' },
  early: { label: 'Early days', note: 'Questions are the work, not an obstacle to it.' },
  middle: { label: 'Mid-journey', note: 'The visible record is the least of what is happening.' },
  late: { label: 'Far along', note: 'The temptation now is to think one has arrived.' },
  complete: { label: 'Journey complete', note: 'No one has arrived. Keep walking together.' },
};

export default function MentorBriefingScreen({ route, navigation }) {
  const t = useTheme();
  const s = makeStyles(t);
  const menteeId = route?.params?.menteeId;
  const menteeName = route?.params?.menteeName || 'this person';

  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissed, setDismissed] = useState({});   // mentor rejected this suggestion
  const [applied, setApplied] = useState({});
  const [noteFor, setNoteFor] = useState(null);     // principle_id being annotated
  const [noteText, setNoteText] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiV1.mentorBriefing(menteeId);
      setBrief(data);
    } catch (e) {
      Alert.alert('Could not load briefing', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [menteeId]);

  useEffect(() => { load(); }, [load]);

  const recordApplied = async (principleId) => {
    try {
      await apiV1.principleApplied(menteeId, principleId, noteText || null);
      setApplied(a => ({ ...a, [principleId]: true }));
      setNoteFor(null);
      setNoteText('');
    } catch (e) {
      Alert.alert('Could not save', e.message);
    }
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={t.accent} /></View>;
  }
  if (!brief) {
    return <View style={s.center}><Text style={s.muted}>No briefing available.</Text></View>;
  }

  const stage = STAGE_COPY[brief.stage] || { label: brief.stage, note: '' };
  const o = brief.observed || {};
  const visible = (brief.suggestions || []).filter(x => !dismissed[x.principle_id]);

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.accent}
        onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      {/* Who, and where they are — quietly stated */}
      <Text style={s.name}>{menteeName}</Text>
      <View style={s.stageRow}>
        <View style={s.stagePill}><Text style={s.stagePillText}>{stage.label}</Text></View>
      </View>
      <Text style={s.stageNote}>{stage.note}</Text>

      {/* Facts. Small, deliberately. Activity is not the soul. */}
      <Text style={s.sectionLabel}>WHAT WE CAN SEE</Text>
      <View style={s.factsCard}>
        <Fact s={s} label="Active in the last 30 days"
              value={o.events_30d > 0 ? `${o.events_30d} times` : 'Not since we last spoke'} />
        <Fact s={s} label="People she talks with here"
              value={o.conversation_partners === 0 ? 'No one yet'
                : o.conversation_partners === 1 ? 'Only you'
                : `${o.conversation_partners} people`}
              alert={o.conversation_partners <= 1} />
        <Fact s={s} label="Readings completed" value={String(o.milestones_done ?? 0)} />
        <Fact s={s} label="Waiting for a reply"
              value={o.open_requests > 0 ? `${o.open_requests} request` : 'Nothing outstanding'}
              alert={o.open_requests > 0} />
        <Text style={s.factsFoot}>
          This is activity, not interior life. What matters most here is invisible to us.
        </Text>
      </View>

      {/* The postures — the heart of the screen */}
      <Text style={s.sectionLabel}>WHAT MIGHT SERVE HER NOW</Text>

      {visible.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>
            Nothing to suggest. That is not a failure — it usually means she is well.
            Go and be with her.
          </Text>
        </View>
      ) : visible.map((sug) => (
        <View key={sug.principle_id} style={s.postureCard}>
          {/* The posture is the biggest thing on the screen. */}
          <Text style={s.posture}>{sug.consider}</Text>

          {/* The evidence, so the mentor can reject the REASONING. */}
          <View style={s.becauseRow}>
            <View style={s.becauseBar} />
            <Text style={s.because}>{sug.because}</Text>
          </View>

          <View style={s.principleRow}>
            <Text style={s.principleName}>{sug.principle}</Text>
            <Text style={s.tradition}>{TRADITION_LABEL[sug.tradition] || sug.tradition}</Text>
          </View>

          {applied[sug.principle_id] ? (
            <View style={s.appliedBadge}>
              <Text style={s.appliedText}>✓ You noted this</Text>
            </View>
          ) : noteFor === sug.principle_id ? (
            <View style={s.noteBox}>
              <Text style={s.noteLabel}>In your words — what happened? (optional)</Text>
              <TextInput
                style={s.noteInput}
                value={noteText}
                onChangeText={setNoteText}
                placeholder="I asked what her restlessness was pointing at…"
                placeholderTextColor="#9A98A8"
                multiline
              />
              <View style={s.noteActions}>
                <TouchableOpacity onPress={() => { setNoteFor(null); setNoteText(''); }}>
                  <Text style={s.linkMuted}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn}
                  onPress={() => recordApplied(sug.principle_id)}>
                  <Text style={s.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // Both choices carry EQUAL weight. Refusing is as easy as accepting.
            <View style={s.actions}>
              <TouchableOpacity style={s.actionGhost}
                onPress={() => setDismissed(d => ({ ...d, [sug.principle_id]: true }))}>
                <Text style={s.actionGhostText}>Doesn't fit her</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionSolid}
                onPress={() => setNoteFor(sug.principle_id)}>
                <Text style={s.actionSolidText}>I used this</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}

      {/* Permanent. Not a dismissible tooltip. */}
      <View style={s.disclaimer}>
        <Text style={s.disclaimerText}>
          {brief.note || 'These are postures to consider, not instructions. You know this person; the system does not. Ignore anything that does not fit.'}
        </Text>
      </View>

      <TouchableOpacity style={s.talkBtn}
        onPress={() => navigation.navigate('Messages', { userId: menteeId })}>
        <Text style={s.talkBtnText}>Go talk with her</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function Fact({ s, label, value, alert }) {
  return (
    <View style={s.factRow}>
      <Text style={s.factLabel}>{label}</Text>
      <Text style={[s.factValue, alert && s.factAlert]}>{value}</Text>
    </View>
  );
}

const makeStyles = (t) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.light, padding: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.light },
  muted: { color: '#8A8898' },

  name: { fontSize: 30, fontWeight: '800', color: t.primary, marginTop: 4 },
  stageRow: { flexDirection: 'row', marginTop: 8 },
  stagePill: { backgroundColor: t.primary, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 14 },
  stagePillText: { color: t.light, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  stageNote: { color: '#6E6C7E', fontSize: 14, marginTop: 10, lineHeight: 20, fontStyle: 'italic' },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: t.accent, letterSpacing: 1,
    marginTop: 26, marginBottom: 10 },

  // Facts are small and quiet by design.
  factsCard: { backgroundColor: t.surface, borderRadius: 14, padding: 14 },
  factRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 7 },
  factLabel: { color: '#6E6C7E', fontSize: 13, flex: 1 },
  factValue: { color: t.primary, fontSize: 13, fontWeight: '700' },
  factAlert: { color: t.accent },
  factsFoot: { color: '#9A98A8', fontSize: 11.5, marginTop: 10, lineHeight: 16,
    borderTopWidth: 1, borderTopColor: '#EFEFF3', paddingTop: 10 },

  // The posture dominates.
  postureCard: { backgroundColor: t.surface, borderRadius: 16, padding: 18, marginBottom: 14 },
  posture: { fontSize: 20, lineHeight: 29, color: t.primary, fontWeight: '600' },
  becauseRow: { flexDirection: 'row', marginTop: 14 },
  becauseBar: { width: 3, borderRadius: 2, backgroundColor: t.accent, marginRight: 10 },
  because: { flex: 1, color: '#6E6C7E', fontSize: 13.5, lineHeight: 19 },
  principleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  principleName: { color: t.primary, fontSize: 12, fontWeight: '800' },
  tradition: { color: '#9A98A8', fontSize: 11.5 },

  // Equal visual weight: refusing is as easy as accepting.
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionGhost: { flex: 1, borderWidth: 1.5, borderColor: '#DCDCE4', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center' },
  actionGhostText: { color: '#6E6C7E', fontWeight: '700', fontSize: 14 },
  actionSolid: { flex: 1, backgroundColor: t.primary, borderRadius: 10,
    paddingVertical: 11, alignItems: 'center' },
  actionSolidText: { color: t.light, fontWeight: '700', fontSize: 14 },

  noteBox: { marginTop: 14, backgroundColor: t.light, borderRadius: 12, padding: 12 },
  noteLabel: { color: '#6E6C7E', fontSize: 12.5, marginBottom: 8 },
  noteInput: { backgroundColor: t.surface, borderRadius: 8, padding: 10, minHeight: 70,
    color: t.primary, fontSize: 14, textAlignVertical: 'top' },
  noteActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
    gap: 16, marginTop: 10 },
  linkMuted: { color: '#8A8898', fontWeight: '600', fontSize: 14 },
  saveBtn: { backgroundColor: t.accent, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 22 },
  saveBtnText: { color: t.light, fontWeight: '800', fontSize: 14 },

  appliedBadge: { marginTop: 14, backgroundColor: '#EAF7EE', borderRadius: 10, padding: 11,
    alignItems: 'center' },
  appliedText: { color: t.success, fontWeight: '700', fontSize: 13.5 },

  emptyCard: { backgroundColor: t.surface, borderRadius: 16, padding: 20 },
  emptyText: { color: '#6E6C7E', fontSize: 15, lineHeight: 22, textAlign: 'center' },

  disclaimer: { marginTop: 12, backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 12,
    padding: 14, borderLeftWidth: 3, borderLeftColor: '#C9C7D4' },
  disclaimerText: { color: '#6E6C7E', fontSize: 13, lineHeight: 19, fontStyle: 'italic' },

  talkBtn: { backgroundColor: t.accent, borderRadius: 12, paddingVertical: 15, marginTop: 20 },
  talkBtnText: { color: t.light, fontWeight: '800', fontSize: 16, textAlign: 'center' },
});
