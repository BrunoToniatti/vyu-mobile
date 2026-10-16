import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { DarkTheme, NavigationContainer, Theme } from '@react-navigation/native';
import {
  createStackNavigator,
  StackCardInterpolationProps,
  StackCardStyleInterpolator,
  TransitionPresets,
  TransitionSpecs,
} from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import PreferencesScreen from './src/screens/PreferencesScreen';
import RestaurantsScreen from './src/screens/RestaurantsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import MapScreen from './src/screens/MapScreen';
import RestaurantDetailScreen from './src/screens/RestaurantDetailScreen';
import RestaurantListScreen from './src/screens/RestaurantListScreen';
import ChatScreen from './src/screens/ChatScreen';
import FloatingTabBar from './src/components/FloatingTabBar';
import Aurora from './src/components/Aurora';
import VyuLogo from './src/components/VyuLogo';
import { BurstProvider } from './src/components/Burst';
import { DialogProvider } from './src/components/Dialog';
import { isAuthenticated } from './src/services/auth';
import { Restaurant } from './src/types';
import { colors, fonts } from './src/theme';
import { fontApi } from './src/theme/fontSupport';
import { ease, springTo, tween } from './src/motion';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Onboarding: undefined;
  Preferences: undefined;
  Main: undefined;
  RestaurantList: undefined;
  RestaurantDetail: { restaurant: Restaurant };
  Chat: { restaurant: Restaurant };
};

export type MainTabParamList = {
  Restaurants: undefined;
  Map: undefined;
  Profile: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.cyan,
    background: colors.void,
    card: colors.night,
    text: colors.text,
    border: 'transparent',
    notification: colors.purple,
  },
};

/** Screens rise out of the depth while the previous one sinks back. */
const portal: StackCardStyleInterpolator = ({ current, next, layouts }: StackCardInterpolationProps) => {
  const enter = current.progress.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1], extrapolate: 'clamp' });
  const scale = next
    ? Animated.multiply(enter, next.progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92], extrapolate: 'clamp' }))
    : enter;
  return {
    cardStyle: {
      opacity: current.progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
      transform: [
        { translateY: current.progress.interpolate({ inputRange: [0, 1], outputRange: [layouts.screen.height * 0.12, 0], extrapolate: 'clamp' }) },
        { scale },
      ],
    },
    overlayStyle: {
      opacity: current.progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.75], extrapolate: 'clamp' }),
    },
  };
};

const portalTransition = {
  gestureDirection: 'vertical' as const,
  transitionSpec: {
    open: { animation: 'spring' as const, config: { stiffness: 260, damping: 26, mass: 1 } },
    close: TransitionSpecs.TransitionIOSSpec,
  },
  cardStyleInterpolator: portal,
  cardOverlayEnabled: true,
};

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
      sceneContainerStyle={{ backgroundColor: colors.void }}
    >
      <Tab.Screen name="Restaurants" component={RestaurantsScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

/** Opening act: the eye draws itself, the wordmark snaps in, then everything zooms through. */
function Splash({ leaving, onGone }: { leaving: boolean; onGone: () => void }) {
  const word = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const gone = useRef(onGone);
  gone.current = onGone;

  useEffect(() => {
    springTo(word, 1, { bounce: 0.5, duration: 700, delay: 650 }).start();
  }, [word]);

  useEffect(() => {
    if (leaving) tween(exit, 1, { duration: 520, easing: ease.in3 }).start(() => gone.current());
  }, [leaving, exit]);

  return (
    <Animated.View
      pointerEvents={leaving ? 'none' : 'auto'}
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: exit.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] }),
          transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
        },
      ]}
    >
      <Aurora intensity="vivid" sparkles={18}>
        <View style={styles.splash}>
          <VyuLogo size={104} />
          <Animated.Text
            style={[
              styles.splashWord,
              {
                opacity: word,
                transform: [
                  { translateY: word.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
                  { scale: word.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
                ],
              },
            ]}
          >
            VYU
          </Animated.Text>
          <Animated.Text style={[styles.splashTag, { opacity: word }]}>veja antes de ir</Animated.Text>
        </View>
      </Aurora>
    </Animated.View>
  );
}

const FONT_MAP = {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
};
const loadFonts = fontApi?.useFonts;
const useAppFonts: () => [boolean, Error | null] = loadFonts
  ? () => loadFonts(FONT_MAP)
  : () => [true, null];

export default function App() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
  const [minTimeDone, setMinTimeDone] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  const [fontsLoaded, fontError] = useAppFonts();

  useEffect(() => {
    async function init() {
      const auth = await isAuthenticated();
      if (!auth) {
        setInitialRoute('Login');
        return;
      }
      const onboardingDone = await AsyncStorage.getItem('onboarding_done');
      setInitialRoute(onboardingDone ? 'Main' : 'Onboarding');
    }
    init();
    const t = setTimeout(() => setMinTimeDone(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const fontsReady = fontsLoaded || !!fontError;
  const ready = !!initialRoute && fontsReady;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.void }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <BurstProvider>
          <DialogProvider>
            {ready && (
              <NavigationContainer theme={navTheme}>
                <Stack.Navigator
                  initialRouteName={initialRoute!}
                  screenOptions={{
                    headerShown: false,
                    cardStyle: [{ backgroundColor: colors.void }, Platform.OS === 'web' && styles.webCard],
                    ...TransitionPresets.SlideFromRightIOS,
                  }}
                >
                  <Stack.Screen name="Login" component={LoginScreen} options={{ ...TransitionPresets.FadeFromBottomAndroid }} />
                  <Stack.Screen name="Register" component={RegisterScreen} options={portalTransition} />
                  <Stack.Screen name="Onboarding" component={OnboardingScreen} options={portalTransition} />
                  <Stack.Screen name="Preferences" component={PreferencesScreen} options={portalTransition} />
                  <Stack.Screen name="Main" component={MainTabs} options={portalTransition} />
                  <Stack.Screen name="RestaurantList" component={RestaurantListScreen} />
                  <Stack.Screen name="RestaurantDetail" component={RestaurantDetailScreen} options={portalTransition} />
                  <Stack.Screen name="Chat" component={ChatScreen} />
                </Stack.Navigator>
              </NavigationContainer>
            )}
            {fontsReady && !splashGone && (
              <Splash leaving={ready && minTimeDone} onGone={() => setSplashGone(true)} />
            )}
            {!fontsReady && <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.void }]} />}
          </DialogProvider>
        </BurstProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  // react-navigation lets web cards grow with their content (document scroll); pin them to the viewport instead
  webCard: { height: '100%', overflow: 'hidden' },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  splashWord: {
    fontFamily: fonts.display,
    fontSize: 64,
    letterSpacing: 14,
    color: colors.text,
    marginTop: 18,
    marginRight: -14,
  },
  splashTag: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: colors.cyan,
    marginTop: 4,
  },
});
