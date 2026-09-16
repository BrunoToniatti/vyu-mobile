import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import { isAuthenticated } from './src/services/auth';
import { Restaurant } from './src/types';

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

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Restaurants" component={RestaurantsScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

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
  }, []);

  if (!initialRoute) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a237e' }}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerShown: false,
            ...TransitionPresets.SlideFromRightIOS,
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Preferences" component={PreferencesScreen} />
          <Stack.Screen
            name="Main"
            component={MainTabs}
            options={{ ...TransitionPresets.FadeFromBottomAndroid }}
          />
          <Stack.Screen
            name="RestaurantList"
            component={RestaurantListScreen}
            options={{ ...TransitionPresets.SlideFromRightIOS }}
          />
          <Stack.Screen
            name="RestaurantDetail"
            component={RestaurantDetailScreen}
            options={{ ...TransitionPresets.SlideFromRightIOS }}
          />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{ ...TransitionPresets.SlideFromRightIOS }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
