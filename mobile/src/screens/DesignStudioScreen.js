import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Image } from 'react-native';
import { apiV1 } from '../api/client';
import { useTheme } from '../context/ThemeContext';

// ============================================================
// Design Studio — the admin control panel for branding.
// Changes here propagate to EVERY member's app: colors, name,
// tagline, and image slots all live in org branding data. The
// live preview strip shows the palette before committing.
// ============================================================

const COLOR_FIELDS = [
  { key: 'primary', label: 'Primary (nav, headers)' },
  { key: 'accent', label: 'Accent (buttons, highlights)' },
  { key: 'light', label: 'Light (backgrounds, text on dark)' },
  { key: 'surface', label: 'Surface (cards)' },
  { key: 'success', label: 'Success (confirmations)' },
];

const PRESETS = [
  { name: 'Hero Official', colors: { primary: '#12123D', accent: '#E43024', light: '#F4F4F8', surface: '#FFFFFF', success: '#2FA84F' } },
  { name: 'Forest', colors: { primary: '#1B3A2D', accent: '#E07A2F', light: '#F2F4EF', surface: '#FFFFFF', success: '#5BD98A' } },
  { name: 'Ocean', colors: { primary: '#0E2A47', accent: '#1FA7C9', light: '#F0F4F6', surface: '#FFFFFF', success: '#39D98A' } },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

export default function DesignStudioScreen() {
  const t = useTheme();
  const s = makeStyles(t);
  const [appName, setAppName] = useState(t.app_name);
  const [tagline, setTagline] = useState(t.tagline);
  const [colors, setColors] = useState({
    primary: t.primary, accent: t.accent, light: t.light,
    surface: t.surface, success: t.success,
  });
  const [logoUrl, setLogoUrl] = useState(t.logo_url || '');
  const [saving, setSaving] = useState(false);

  const setColor = (key, value) => setColors(c => ({ ...c, [key]: value }));

  const save = async () => {
    for (const f of COLOR_FIELDS) {
      if (!HEX.test(colors[f.key])) {
        return Alert.alert('Check colors', `${f.label} must be a hex value like #1A2B3C`);
      }
    }
    if (logoUrl && !logoUrl.startsWith('https://')) {
      return Alert.alert('Check logo', 'Logo must be an https:// URL');
    }
    setSaving(true);
    try {
      await apiV1.updateBranding({
        app_name: appName, tagline, colors,
        images: { logo_url: logoUrl || null },
      });
      await t.refresh(); // every screen re-themes immediately
      Alert.alert('Saved', 'Branding updated across the community.');
    } catch (e) {
      Alert.alert('Could not save', e.message);
    } finally { setSaving(false); }
  };

  return (
    <ScrollView style={s.container}>
      <Text style={s.section}>Identity</Text>
      <Text style={s.label}>Community name</Text>
      <TextInput style={s.input} value={appName} onChangeText={setAppName} maxLength={60} />
      <Text style={s.label}>Tagline</Text>
      <TextInput style={s.input} value={tagline} onChangeText={setTagline} maxLength={140} />
      <Text style={s.label}>Logo URL (https)</Text>
      <TextInput style={s.input} value={logoUrl} onChangeText={setLogoUrl}
        autoCapitalize="none" placeholder="https://…/logo.png" placeholderTextColor="#888" />
      {logoUrl.startsWith('https://') ? (
        <Image source={{ uri: logoUrl }} style={s.logoPreview} resizeMode="contain" />
      ) : null}

      <Text style={s.section}>Palette presets</Text>
      <View style={s.presetRow}>
        {PRESETS.map(p => (
          <TouchableOpacity key={p.name} style={s.preset} onPress={() => setColors(p.colors)}>
            <View style={s.presetSwatches}>
              {Object.values(p.colors).slice(0, 4).map((c, i) => (
                <View key={i} style={[s.swatchMini, { backgroundColor: c }]} />
              ))}
            </View>
            <Text style={s.presetName}>{p.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.section}>Colors</Text>
      {COLOR_FIELDS.map(f => (
        <View key={f.key} style={s.colorRow}>
          <View style={[s.swatch, { backgroundColor: HEX.test(colors[f.key]) ? colors[f.key] : '#ccc' }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.label}>{f.label}</Text>
            <TextInput style={s.input} value={colors[f.key]} autoCapitalize="characters"
              onChangeText={(v) => setColor(f.key, v)} maxLength={7} />
          </View>
        </View>
      ))}

      <Text style={s.section}>Live preview</Text>
      <View style={[s.preview, { backgroundColor: colors.light }]}>
        <View style={[s.previewHeader, { backgroundColor: colors.primary }]}>
          <Text style={{ color: colors.light, fontWeight: '800' }}>{appName}</Text>
        </View>
        <View style={[s.previewCard, { backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>A community post</Text>
          <Text style={{ color: '#555', marginTop: 4 }}>{tagline}</Text>
          <View style={[s.previewBtn, { backgroundColor: colors.accent }]}>
            <Text style={{ color: colors.light, fontWeight: '700' }}>Take action</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving}>
        <Text style={s.saveText}>{saving ? 'Saving…' : 'Apply to whole community'}</Text>
      </TouchableOpacity>
      <Text style={s.note}>
        Changes apply to every member's app. Colors must meet readable contrast —
        preview dark text on your light color before saving.
      </Text>
    </ScrollView>
  );
}

const makeStyles = (t) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.light, padding: 16 },
  section: { fontSize: 13, fontWeight: '800', color: t.accent, marginTop: 20, marginBottom: 8, textTransform: 'uppercase' },
  label: { color: t.primary, fontWeight: '600', fontSize: 13, marginBottom: 4 },
  input: { backgroundColor: t.surface, borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 15 },
  logoPreview: { width: 100, height: 100, alignSelf: 'center', marginVertical: 8 },
  presetRow: { flexDirection: 'row', gap: 10 },
  preset: { flex: 1, backgroundColor: t.surface, borderRadius: 10, padding: 10, alignItems: 'center' },
  presetSwatches: { flexDirection: 'row', gap: 3 },
  swatchMini: { width: 16, height: 16, borderRadius: 4 },
  presetName: { fontSize: 11, marginTop: 6, color: t.primary, fontWeight: '600' },
  colorRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  swatch: { width: 44, height: 44, borderRadius: 8, marginTop: 18, borderWidth: 1, borderColor: '#ddd' },
  preview: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e0e0dc' },
  previewHeader: { padding: 12 },
  previewCard: { margin: 10, borderRadius: 10, padding: 12 },
  previewBtn: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, alignSelf: 'flex-start', marginTop: 10 },
  saveBtn: { backgroundColor: t.accent, borderRadius: 10, padding: 16, marginTop: 20 },
  saveText: { color: t.light, fontWeight: '800', textAlign: 'center', fontSize: 16 },
  note: { color: '#777', fontSize: 12, marginTop: 12, marginBottom: 50, lineHeight: 17 },
});
