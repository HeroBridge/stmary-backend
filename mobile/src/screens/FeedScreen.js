import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, RefreshControl, Modal, TextInput, Alert } from 'react-native';
import { api, apiV1 } from '../api/client';
import { useTheme } from '../context/ThemeContext';

// Instagram-style curated feed with the group carousel on top.
export default function FeedScreen() {
  const t = useTheme();
  const s = makeStyles(t);
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftGroup, setDraftGroup] = useState(null);

  const load = useCallback(async (groupId = activeGroup) => {
    try {
      const [g, p] = await Promise.all([api.carousel(), api.feed(groupId)]);
      setGroups(g); setPosts(p);
    } catch (e) { console.warn(e.message); }
  }, [activeGroup]);

  useEffect(() => { load(); }, [activeGroup]);

  const publish = async () => {
    const body = draft.trim();
    if (!body) return;
    try {
      await apiV1.createPost(body, draftGroup, []);
      setDraft(''); setComposing(false);
      load();
    } catch (e) { Alert.alert('Could not post', e.message); }
  };

  const like = async (post) => {
    await api.likePost(post.id).catch(() => {});
    setPosts(ps => ps.map(p => p.id === post.id
      ? { ...p, liked_by_me: true, like_count: p.like_count + (p.liked_by_me ? 0 : 1) } : p));
  };

  return (
    <View style={s.container}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load()} />}
        ListHeaderComponent={
          <FlatList horizontal data={[{ id: null, name: 'All' }, ...groups]}
            keyExtractor={(g) => g.id || 'all'} showsHorizontalScrollIndicator={false} style={s.carousel}
            renderItem={({ item }) => (
              <TouchableOpacity style={[s.chip, activeGroup === item.id && s.chipActive]}
                onPress={() => setActiveGroup(item.id)}>
                {item.avatar_url
                  ? <Image source={{ uri: item.avatar_url }} style={s.chipImg} />
                  : <View style={s.chipImgFallback}><Text style={s.chipInitial}>{item.name[0]}</Text></View>}
                <Text style={s.chipText} numberOfLines={1}>{item.name}</Text>
              </TouchableOpacity>
            )} />
        }
        renderItem={({ item }) => (
          <View style={s.post}>
            <Text style={s.postGroup}>{item.group_name || 'Announcements'}</Text>
            <Text style={s.postAuthor}>{item.author_name}</Text>
            <Text style={s.postBody}>{item.body}</Text>
            <View style={s.postActions}>
              <TouchableOpacity onPress={() => like(item)}>
                <Text style={[s.action, item.liked_by_me && s.liked]}>♥ {item.like_count}</Text>
              </TouchableOpacity>
              <Text style={s.action}>💬 {item.comment_count}</Text>
            </View>
          </View>
        )}
      />
      <TouchableOpacity style={s.fab} onPress={() => { setDraftGroup(activeGroup); setComposing(true); }}>
        <Text style={s.fabText}>＋</Text>
      </TouchableOpacity>

      <Modal visible={composing} animationType="slide" transparent>
        <View style={s.modalWrap}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Share with your community</Text>
            <FlatList horizontal data={[{ id: null, name: 'Announcements' }, ...groups]}
              keyExtractor={(g) => g.id || 'ann'} showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.groupPick, draftGroup === item.id && s.groupPickActive]}
                  onPress={() => setDraftGroup(item.id)}>
                  <Text style={[s.groupPickText, draftGroup === item.id && s.groupPickTextActive]}>{item.name}</Text>
                </TouchableOpacity>
              )} style={{ marginBottom: 10, flexGrow: 0 }} />
            <TextInput style={s.composeInput} placeholder="What's happening?" placeholderTextColor="#888"
              multiline value={draft} onChangeText={setDraft} autoFocus />
            <View style={s.modalRow}>
              <TouchableOpacity onPress={() => setComposing(false)}>
                <Text style={s.cancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.postBtn} onPress={publish}>
                <Text style={s.postBtnText}>Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (t) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.light },
  carousel: { paddingVertical: 10, paddingLeft: 10 },
  chip: { alignItems: 'center', marginRight: 14, width: 64 },
  chipActive: { opacity: 1 },
  chipImg: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: t.accent },
  chipImgFallback: { width: 56, height: 56, borderRadius: 28, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' },
  chipInitial: { color: t.light, fontSize: 22, fontWeight: '700' },
  chipText: { fontSize: 11, marginTop: 4, color: t.primary },
  post: { backgroundColor: t.surface, marginHorizontal: 10, marginBottom: 10, borderRadius: 10, padding: 14 },
  postGroup: { color: t.accent, fontWeight: '700', fontSize: 12 },
  postAuthor: { color: t.primary, fontWeight: '600', marginTop: 2 },
  postBody: { color: '#333', marginTop: 6, fontSize: 15, lineHeight: 21 },
  postActions: { flexDirection: 'row', gap: 18, marginTop: 10 },
  action: { color: t.primary, fontWeight: '600' },
  liked: { color: t.accent },
  fab: { position: 'absolute', right: 20, bottom: 24, backgroundColor: t.accent,
         width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  fabText: { color: t.light, fontSize: 28, marginTop: -2 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(26,26,61,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: t.light, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18 },
  modalTitle: { fontWeight: '800', color: t.primary, fontSize: 17, marginBottom: 12 },
  groupPick: { borderWidth: 1, borderColor: t.primary, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8 },
  groupPickActive: { backgroundColor: t.primary },
  groupPickText: { color: t.primary, fontWeight: '600', fontSize: 13 },
  groupPickTextActive: { color: t.light },
  composeInput: { backgroundColor: t.surface, borderRadius: 10, padding: 14, minHeight: 100, textAlignVertical: 'top', fontSize: 16 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 6 },
  cancel: { color: '#888', fontWeight: '600' },
  postBtn: { backgroundColor: t.accent, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 },
  postBtnText: { color: t.light, fontWeight: '800' },
});
