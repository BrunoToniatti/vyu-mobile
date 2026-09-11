import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

const TEAL = '#00BCD4';
const INACTIVE = '#9e9e9e';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const ICONS: Record<string, IconName> = {
  Restaurants: 'restaurant',
  Map: 'map',
  Profile: 'person',
};

const LABELS: Record<string, string> = {
  Restaurants: 'Restaurantes',
  Map: 'Mapa',
  Profile: 'Perfil',
};

export default function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
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
                  <MaterialIcons name={ICONS[route.name]} size={28} color="#fff" />
                </View>
                <Text style={[styles.label, focused && styles.labelFocused]}>{LABELS[route.name]}</Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity key={route.key} style={styles.tab} onPress={onPress} activeOpacity={0.7}>
              <MaterialIcons
                name={ICONS[route.name]}
                size={24}
                color={focused ? TEAL : INACTIVE}
              />
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
  label: {
    fontSize: 10,
    marginTop: 3,
    color: INACTIVE,
    fontWeight: '500',
  },
  labelFocused: { color: TEAL, fontWeight: '700' },

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
});
