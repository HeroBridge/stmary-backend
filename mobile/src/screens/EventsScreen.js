import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';

export default function EventsScreen() {
  const t = useTheme();
  const s = makeStyles(t);
  const [events, setEvents] = useState([]);
  const load = () => api.events().then(setEvents).catch(e => console.warn(e.message));
  useEffect(() => { load(); }, []);

  const rsvp = async (id, status) => { await api.rsvp(id, status).catch(() => {}); load(); };

  return (
    <View style={s.container}>
      <FlatList data={events} keyExtractor={e => e.id}
        renderItem={({ item }) => (
          <View style={s.card}>
            <Text style={s.date}>{new Date(item.starts_at).toLocaleString()}</Text>
            <Text style={s.title}>{item.title}</Text>
            {item.description ? <Text style={s.desc}>{item.description}</Text> : null}
            <View style={s.row}>
              <Text style={s.going}>{item.going_count} going</Text>
              <TouchableOpacity style={s.btn} onPress={() => rsvp(item.id, 'going')}>
                <Text style={s.btnText}>I'm going</Text>
              </TouchableOpacity>
            </View>
          </View>
        )} />
    </View>
  );
}

const makeStyles = (t) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.light, paddingTop: 10 },
  card: { backgroundColor: t.surface, marginHorizontal: 10, marginBottom: 10, borderRadius: 10, padding: 14 },
  date: { color: t.accent, fontWeight: '700', fontSize: 12 },
  title: { color: t.primary, fontSize: 17, fontWeight: '700', marginTop: 2 },
  desc: { color: '#555', marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  going: { color: t.primary, fontWeight: '600' },
  btn: { backgroundColor: t.primary, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 14 },
  btnText: { color: t.light, fontWeight: '700' },
});
