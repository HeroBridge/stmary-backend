import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../api/client';

// The "one code" moment: redeeming applies the whole curated bundle.
export default function CodeEntryScreen() {
  const t = useTheme();
  const s = makeStyles(t);
  const { redeemCode, setNeedsCode } = useAuth();
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState(null);

  const onChange = async (text) => {
    setCode(text);
    if (text.trim().length >= 4) {
      try { setPreview(await api.previewCode(text.trim())); }
      catch { setPreview(null); }
    } else setPreview(null);
  };

  const submit = async () => {
    try { await redeemCode(code.trim()); }
    catch (e) { Alert.alert('Code problem', e.message); }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>Enter your community code</Text>
      <Text style={s.subtitle}>Your mentor or program gave you a code.{'\n'}It sets up everything for you.</Text>
      <TextInput style={s.input} placeholder="e.g. SPRING-COHORT" placeholderTextColor="#888"
        autoCapitalize="characters" value={code} onChangeText={onChange} />
      {preview && (
        <Text style={preview.valid ? s.previewOk : s.previewBad}>
          {preview.valid
            ? `✓ Joining ${preview.org_name || 'your community'}${preview.label ? ' — ' + preview.label : ''}`
            : 'This code is no longer available'}
        </Text>
      )}
      <TouchableOpacity style={s.button} onPress={submit}>
        <Text style={s.buttonText}>Build my community</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setNeedsCode(false)}>
        <Text style={s.skip}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (t) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.primary, justifyContent: 'center', padding: 24 },
  title: { color: t.light, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: t.light, opacity: 0.7, textAlign: 'center', marginVertical: 16 },
  input: { backgroundColor: t.light, borderRadius: 8, padding: 14, fontSize: 18, textAlign: 'center', letterSpacing: 2 },
  button: { backgroundColor: t.accent, borderRadius: 8, padding: 16, marginTop: 16 },
  buttonText: { color: t.light, textAlign: 'center', fontWeight: '700', fontSize: 16 },
  skip: { color: t.light, opacity: 0.5, textAlign: 'center', marginTop: 20 },
  previewOk: { color: t.success, textAlign: 'center', marginTop: 12, fontWeight: '600' },
  previewBad: { color: t.accent, textAlign: 'center', marginTop: 12, fontWeight: '600' },
});
