import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React2, { useEffect } from 'react';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import DesignStudioScreen from './src/screens/DesignStudioScreen';
import MentorBriefingScreen from './src/screens/MentorBriefingScreen';
import MenteesScreen from './src/screens/MenteesScreen';
import LoginScreen from './src/screens/LoginScreen';
import CodeEntryScreen from './src/screens/CodeEntryScreen';
import FeedScreen from './src/screens/FeedScreen';
import ResourcesScreen from './src/screens/ResourcesScreen';
import EventsScreen from './src/screens/EventsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import MessagesScreen from './src/screens/MessagesScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  const t = useTheme();
  const { user } = useAuth();
  return (
    <Tab.Navigator screenOptions={{
      headerStyle: { backgroundColor: t.primary }, headerTintColor: t.light,
      tabBarActiveTintColor: t.accent,
    }}>
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Resources" component={ResourcesScreen} />
      <Tab.Screen name="Events" component={EventsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      {(user?.role === 'mentor' || user?.role === 'admin') && (
        <Tab.Screen name="Mentees" component={MenteesScreen} />
      )}
      {user?.role === 'admin' && (
        <Tab.Screen name="Design" component={DesignStudioScreen} />
      )}
    </Tab.Navigator>
  );
}

function Root() {
  const { token, needsCode } = useAuth();
  const { refresh } = useTheme();
  useEffect(() => { if (token) refresh(); }, [token, needsCode]);
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!token ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : needsCode ? (
        <Stack.Screen name="CodeEntry" component={CodeEntryScreen} />
      ) : (
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="MentorBriefing" component={MentorBriefingScreen}
          options={{ headerShown: true, title: 'Briefing' }} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <NavigationContainer><Root /></NavigationContainer>
      </ThemeProvider>
    </AuthProvider>
  );
}
