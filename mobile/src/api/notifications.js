// Push notification registration (Expo).
// Called after login; quietly no-ops if permission is denied.
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiV1 } from './client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

export async function registerForPush() {
  try {
    if (!Device.isDevice) return; // simulators can't receive push
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await apiV1.registerPushToken(token, Platform.OS);
  } catch (e) {
    console.warn('push registration skipped:', e.message);
  }
}
