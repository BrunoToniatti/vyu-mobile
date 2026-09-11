import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TEAL = '#00BCD4';

const ICONS: Record<string, string> = {
  Restaurants: '🍽️',
  Map: '🗺️',
  Profile: '👤',
};

const LABELS: Record<string, string> = {
  Restaurants: 'Restaurantes',
  Map: 'Mapa',
  Profile: 'Perfil',
};

export default function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + 8 }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const isCenter = index === 1;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          if (isCenter) {
            return (
              <TouchableOpacity key={route.key} style={styles.centerWrapper} onPress={onPress} activeOpacity={0.8}>
                <View style={[styles.centerButton, focused && styles.centerButtonFocused]}>
                  <Text style={styles.centerIcon}>{ICONS[route.name]}</Text>
                </View>
                <Text style={[styles.label, focused && styles.labelFocused]}>{LABELS[route.name]}</Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity key={route.key} style={styles.tab} onPress={onPress} activeOpacity={0.7}>
              <Text style={[styles.icon, focused && styles.iconFocused]}>{ICONS[route.name]}</Text>
              <Text style={[styles.label, focused && styles.labelFocused]}>{LABELS[route.name]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#ffffff',
    borderRadius: 32,
    paddingHorizontal: 24,
    paddingVertical: 10,
    width: '88%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: { elevation: 10 },
    }),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  icon: { fontSize: 22, opacity: 0.45 },
  iconFocused: { opacity: 1 },
  label: {
    fontSize: 10,
    marginTop: 2,
    color: '#9e9e9e',
    fontWeight: '500',
  },
  labelFocused: { color: TEAL, fontWeight: '700' },

  // Center elevated button
  centerWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  centerButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    marginTop: -30,
    ...Platform.select({
      ios: {
        shadowColor: TEAL,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  centerButtonFocused: {
    backgroundColor: '#0097A7',
  },
  centerIcon: { fontSize: 26 },
});
