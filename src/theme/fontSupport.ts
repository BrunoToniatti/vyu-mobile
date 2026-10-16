/**
 * expo-font pulls in expo-asset, which needs the native `ExpoAsset` module at import time.
 * Older Expo Go builds do not ship it, so the require is guarded: when it throws the app
 * falls back to system fonts instead of crashing before the first screen.
 */
type FontApi = { useFonts: (map: Record<string, any>) => [boolean, Error | null] };

function load(): FontApi | null {
  try {
    const api = require('expo-font');
    return typeof api?.useFonts === 'function' ? api : null;
  } catch {
    return null;
  }
}

export const fontApi = load();
export const customFontsAvailable = fontApi !== null;
