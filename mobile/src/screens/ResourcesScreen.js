import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Linking, Switch } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';

// Entitlement-filtered resource library with GIS map toggle.
export default function ResourcesScreen() {
  const t = useTheme();
  const s = makeStyles(t);
  const [items, setItems] = useState([]);
  const [mapMode, setMapMode] = useState(false);

  useEffect(() => {
    api.resources(mapMode ? '?on_map=true' : '').then(setItems).catch(e => console.warn(e.message));
  }, [mapMode]);

  const open = async (r) => {
    const res = await api.openResource(r.id); // logs the view to the journey transcript
    if (res.url) Linking.openURL(res.url);    // swap for in-app player when built
  };

  const pins = items.filter(r => r.lat && r.lng);

  return (
    <View style={s.container}>
      <View style={s.toggleRow}>
        <Text style={s.toggleLabel}>Map view</Text>
        <Switch value={mapMode} onValueChange={setMapMode} trackColor={{ true: t.accent }} />
      </View>
      {mapMode ? (
        <MapView style={s.map}
          initialRegion={{ latitude: pins[0]?.lat || 34.05, longitude: pins[0]?.lng || -118.24,
                           latitudeDelta: 0.3, longitudeDelta: 0.3 }}>
          {pins.map(r => (
            <Marker key={r.id} coordinate={{ latitude: r.lat, longitude: r.lng }}
              title={r.title} description={r.category} pinColor={t.accent} />
          ))}
        </MapView>
      ) : (
        <FlatList data={items} keyExtractor={r => r.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.card} onPress={() => open(item)}>
              <Text style={s.cardType}>{item.resource_type}</Text>
              <Text style={s.cardTitle}>{item.title}</Text>
              {item.description ? <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
            </TouchableOpacity>
          )} />
      )}
    </View>
  );
}

const makeStyles = (t) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.light },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  toggleLabel: { fontWeight: '700', color: t.primary },
  map: { flex: 1 },
  card: { backgroundColor: t.surface, marginHorizontal: 10, marginBottom: 10, borderRadius: 10, padding: 14 },
  cardType: { color: t.accent, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  cardTitle: { color: t.primary, fontSize: 16, fontWeight: '700', marginTop: 2 },
  cardDesc: { color: '#555', marginTop: 4 },
});
