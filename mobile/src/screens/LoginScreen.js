import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function LoginScreen() {
  const t = useTheme();
  const s = makeStyles(t);
  const { login, registerWithCode } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const submit = async () => {
    try {
      if (mode === 'login') await login(email, password);
      else await registerWithCode({ email, password, display_name: name });
    } catch (e) { Alert.alert('Oops', e.message); }
  };

  return (
    <View style={s.container}>
      <Image source={t.logo_url ? { uri: t.logo_url } : require('../../assets/logo.png')} style={s.logo} resizeMode="contain" />
      <Text style={s.title}>{t.app_name.toUpperCase()}</Text>
      <Text style={s.subtitle}>{t.tagline}</Text>
      {mode === 'join' && (
        <TextInput style={s.input} placeholder="Your name" placeholderTextColor="#888"
          value={name} onChangeText={setName} />
      )}
      <TextInput style={s.input} placeholder="Email or username" placeholderTextColor="#888"
        autoCapitalize="none" keyboardType="default" value={email} onChangeText={setEmail} />
      <TextInput style={s.input} placeholder="Password" placeholderTextColor="#888"
        secureTextEntry value={password} onChangeText={setPassword} />
      <TouchableOpacity style={s.button} onPress={submit}>
        <Text style={s.buttonText}>{mode === 'login' ? 'Sign in' : 'Join'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'join' : 'login')}>
        <Text style={s.switch}>{mode === 'login' ? 'New here? Join with your code' : 'Have an account? Sign in'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (t) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.primary, justifyContent: 'center', padding: 24 },
  logo: { width: 120, height: 120, alignSelf: 'center', marginBottom: 16 },
  title: { color: t.light, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: t.light, opacity: 0.7, textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: t.light, borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 16 },
  button: { backgroundColor: t.accent, borderRadius: 8, padding: 16, marginTop: 8 },
  buttonText: { color: t.light, textAlign: 'center', fontWeight: '700', fontSize: 16 },
  switch: { color: t.light, textAlign: 'center', marginTop: 20, textDecorationLine: 'underline' },
});
