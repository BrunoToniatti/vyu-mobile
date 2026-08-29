import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, ActivityIndicator } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import RestaurantsScreen from './src/screens/RestaurantsScreen';
import { isAuthenticated } from './src/services/auth';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Restaurants: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    isAuthenticated().then((auth) => {
      setInitialRoute(auth ? 'Restaurants' : 'Login');
    });
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a237e' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Restaurants" component={RestaurantsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
