import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();
export const SESSION_EXPIRED_KEY = 'session_expired';

let expiring = false;

/** Clears the stored session and sends the user to the login screen. */
export async function handleSessionExpired(): Promise<void> {
  if (expiring) return;
  expiring = true;
  try {
    await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
    await AsyncStorage.setItem(SESSION_EXPIRED_KEY, '1');
    if (navigationRef.isReady()) {
      const current = navigationRef.getCurrentRoute()?.name;
      if (current !== 'Login' && current !== 'Register') {
        navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
    }
  } finally {
    // allow a later session to expire again
    setTimeout(() => { expiring = false; }, 1500);
  }
}
