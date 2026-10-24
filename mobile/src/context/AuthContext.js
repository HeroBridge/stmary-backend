import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setToken as setApiToken } from '../api/client';
import { registerForPush } from '../api/notifications';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(null);
  const [user, setUser] = useState(null);
  const [needsCode, setNeedsCode] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('auth').then((raw) => {
      if (raw) {
        const { token, user } = JSON.parse(raw);
        setApiToken(token); setTokenState(token); setUser(user);
      }
    });
  }, []);

  const login = async (email, password) => {
    const { token, user } = await api.login(email, password);
    setApiToken(token); setTokenState(token); setUser(user);
    await AsyncStorage.setItem('auth', JSON.stringify({ token, user }));
    registerForPush();
  };

  const registerWithCode = async (data) => {
    const { token, user } = await api.register(data);
    setApiToken(token); setTokenState(token); setUser(user); setNeedsCode(true);
    await AsyncStorage.setItem('auth', JSON.stringify({ token, user }));
    registerForPush();
  };

  const redeemCode = async (code) => {
    await api.redeemCode(code);
    setNeedsCode(false);
  };

  const logout = async () => {
    setApiToken(null); setTokenState(null); setUser(null);
    await AsyncStorage.removeItem('auth');
  };

  return (
    <AuthContext.Provider value={{ token, user, needsCode, login, registerWithCode, redeemCode, logout, setNeedsCode }}>
      {children}
    </AuthContext.Provider>
  );
}
