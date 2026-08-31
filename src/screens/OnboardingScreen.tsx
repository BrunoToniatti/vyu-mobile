import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Platform, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';

type Props = { navigation: StackNavigationProp<RootStackParamList, 'Onboarding'> };

export default function OnboardingScreen({ navigation }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  async function handleYes() {
    navigation.replace('Preferences');
  }

  async function handleNo() {
    await AsyncStorage.setItem('onboarding_done', 'true');
    navigation.replace('Restaurants');
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a237e" />

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Animated.Text style={[styles.emoji, { transform: [{ scale: scaleAnim }] }]}>🍽️</Animated.Text>

        <Text style={styles.title}>Podemos te{'\n'}conhecer melhor?</Text>
        <Text style={styles.subtitle}>
          Conte-nos seus gostos e mostraremos{'\n'}restaurantes que você vai amar!
        </Text>

        <View style={styles.buttons}>
          <TouchableOpacity style={styles.btnYes} onPress={handleYes} activeOpacity={0.85}>
            <Text style={styles.btnYesText}>✨ Sim, quero personalizar!</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnNo} onPress={handleNo} activeOpacity={0.7}>
            <Text style={styles.btnNoText}>Não, talvez mais tarde</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a237e',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  content: { alignItems: 'center', width: '100%' },
  emoji: { fontSize: 80, marginBottom: 32 },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 40,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 15,
    color: '#c5cae9',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 48,
  },
  buttons: { width: '100%', gap: 12 },
  btnYes: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  btnYesText: { color: '#1a237e', fontWeight: '700', fontSize: 16 },
  btnNo: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnNoText: { color: 'rgba(255,255,255,0.55)', fontSize: 14 },
});
