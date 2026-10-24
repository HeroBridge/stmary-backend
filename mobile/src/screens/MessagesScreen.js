import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { apiV1 } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Conversation list + chat view in one screen.
// (Real-time WebSocket upgrade is a straightforward next step; this
// version polls on open and refreshes after send.)
export default function MessagesScreen() {
  const t = useTheme();
  const s = makeStyles(t);
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);   // active conversation
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const listRef = useRef(null);
  const [picking, setPicking] = useState(false);
  const [members, setMembers] = useState([]);
  const [memberQuery, setMemberQuery] = useState('');

  const openPicker = async () => {
    setPicking(true);
    setMembers(await apiV1.directory().catch(() => []));
  };
  const searchMembers = async (q) => {
    setMemberQuery(q);
    setMembers(await apiV1.directory(q).catch(() => []));
  };
  const startWith = async (member) => {
    setPicking(false);
    const conv = await apiV1.startConversation([member.id]).catch(() => null);
    if (conv) {
      await loadConversations();
      openConversation({ id: conv.id, participants: [{ id: member.id, name: member.display_name }] });
    }
  };

  const loadConversations = () =>
    apiV1.conversations().then(setConversations).catch(e => console.warn(e.message));
  useEffect(() => { loadConversations(); }, []);

  const openConversation = async (conv) => {
    setActive(conv);
    const msgs = await apiV1.messages(conv.id).catch(() => []);
    setMessages(msgs);
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || !active) return;
    setDraft('');
    await apiV1.sendMessage(active.id, body).catch(e => console.warn(e.message));
    const msgs = await apiV1.messages(active.id).catch(() => messages);
    setMessages(msgs);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const nameFor = (conv) =>
    (conv.participants || [])
      .filter(p => p.id !== user?.id)
      .map(p => p.name).join(', ') || 'Conversation';

  if (!active) {
    return (
      <View style={s.container}>
        <TouchableOpacity style={s.newBtn} onPress={openPicker}>
          <Text style={s.newBtnText}>＋ New message</Text>
        </TouchableOpacity>
        <Modal visible={picking} animationType="slide" transparent>
          <View style={s.pickerWrap}>
            <View style={s.picker}>
              <Text style={s.pickerTitle}>Message a community member</Text>
              <TextInput style={s.pickerSearch} placeholder="Search members…" placeholderTextColor="#888"
                value={memberQuery} onChangeText={searchMembers} />
              <FlatList data={members} keyExtractor={m => m.id} style={{ maxHeight: 320 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={s.memberRow} onPress={() => startWith(item)}>
                    <Text style={s.memberName}>{item.display_name}</Text>
                    <Text style={s.memberRole}>{item.role}{item.badge_count ? ` · ${item.badge_count} badges` : ''}</Text>
                  </TouchableOpacity>
                )} />
              <TouchableOpacity onPress={() => setPicking(false)}>
                <Text style={s.pickerClose}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        <FlatList data={conversations} keyExtractor={c => c.id}
          ListEmptyComponent={<Text style={s.empty}>No conversations yet. Your mentor can start one with you.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.convCard} onPress={() => openConversation(item)}>
              <Text style={s.convName}>{nameFor(item)}</Text>
              {item.last_message ? (
                <Text style={s.convPreview} numberOfLines={1}>{item.last_message.body}</Text>
              ) : <Text style={s.convPreview}>Say hello</Text>}
            </TouchableOpacity>
          )} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity onPress={() => { setActive(null); loadConversations(); }}>
        <Text style={s.back}>← All conversations</Text>
      </TouchableOpacity>
      <FlatList ref={listRef} data={messages} keyExtractor={m => m.id} style={s.chat}
        renderItem={({ item }) => {
          const mine = item.sender_id === user?.id;
          return (
            <View style={[s.bubble, mine ? s.mine : s.theirs]}>
              <Text style={mine ? s.mineText : s.theirsText}>{item.body}</Text>
            </View>
          );
        }} />
      <View style={s.inputRow}>
        <TextInput style={s.input} placeholder="Message…" placeholderTextColor="#888"
          value={draft} onChangeText={setDraft} multiline />
        <TouchableOpacity style={s.sendBtn} onPress={send}>
          <Text style={s.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (t) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.light },
  empty: { textAlign: 'center', color: '#888', marginTop: 40, paddingHorizontal: 30 },
  convCard: { backgroundColor: t.surface, marginHorizontal: 10, marginTop: 10, borderRadius: 10, padding: 14 },
  convName: { fontWeight: '700', color: t.primary, fontSize: 16 },
  convPreview: { color: '#777', marginTop: 3 },
  back: { color: t.accent, fontWeight: '700', padding: 12 },
  chat: { flex: 1, paddingHorizontal: 10 },
  bubble: { borderRadius: 14, padding: 10, marginVertical: 3, maxWidth: '80%' },
  mine: { backgroundColor: t.accent, alignSelf: 'flex-end' },
  theirs: { backgroundColor: t.surface, alignSelf: 'flex-start' },
  mineText: { color: t.light },
  theirsText: { color: t.primary },
  inputRow: { flexDirection: 'row', padding: 10, gap: 8, alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: t.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 100 },
  sendBtn: { backgroundColor: t.primary, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16 },
  sendText: { color: t.light, fontWeight: '700' },
  newBtn: { backgroundColor: t.accent, margin: 10, borderRadius: 10, padding: 12 },
  newBtnText: { color: t.light, fontWeight: '800', textAlign: 'center' },
  pickerWrap: { flex: 1, backgroundColor: 'rgba(26,26,61,0.5)', justifyContent: 'flex-end' },
  picker: { backgroundColor: t.light, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18 },
  pickerTitle: { fontWeight: '800', color: t.primary, fontSize: 16, marginBottom: 10 },
  pickerSearch: { backgroundColor: t.surface, borderRadius: 8, padding: 10, marginBottom: 8 },
  memberRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e5e5e0' },
  memberName: { fontWeight: '700', color: t.primary },
  memberRole: { color: '#888', fontSize: 12, textTransform: 'capitalize' },
  pickerClose: { color: t.accent, fontWeight: '700', textAlign: 'center', marginTop: 12 },
});
