import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputInstance, TextInputProps, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fonts, gradients } from '../theme';
import { ease, shake, shakeX, tween } from '../motion';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  icon?: React.ComponentProps<typeof MaterialIcons>['name'];
  error?: string | null;
  secure?: boolean;
  style?: StyleProp<ViewStyle>;
  multiline?: boolean;
};

/** Glass input with a floating label and a gradient halo that ignites on focus. */
const Field = forwardRef<TextInputInstance, Props>(function Field(
  { label, icon, error, secure, style, value, onFocus, onBlur, multiline, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secure);
  const glow = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(value ? 1 : 0)).current;
  const jolt = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    tween(glow, focused ? 1 : 0, { duration: 380, easing: ease.out3 }).start();
  }, [focused, glow]);

  useEffect(() => {
    tween(float, focused || !!value ? 1 : 0, { duration: 320, easing: ease.outBack }).start();
  }, [focused, value, float]);

  useEffect(() => {
    if (error) shake(jolt).start();
  }, [error, jolt]);

  const height = multiline ? 108 : 60;

  return (
    <Animated.View style={[{ transform: [{ translateX: shakeX(jolt) }] }, style]}>
      <View style={{ borderRadius: 20 }}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.halo, { opacity: glow }]}>
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 21 }} />
        </Animated.View>
        <View
          style={[
            styles.box,
            { minHeight: height },
            multiline && { alignItems: 'flex-start', paddingTop: 6 },
            error ? styles.boxError : null,
          ]}
        >
          {icon && (
            <MaterialIcons
              name={icon}
              size={20}
              color={error ? colors.danger : focused ? colors.cyan : colors.textHint}
              style={multiline ? { marginTop: 18 } : undefined}
            />
          )}
          <View style={{ flex: 1, justifyContent: 'center', minHeight: height - 2 }}>
            <Animated.Text
              pointerEvents="none"
              numberOfLines={1}
              style={[
                styles.label,
                {
                  color: error ? colors.danger : focused ? colors.cyan : colors.textHint,
                  transform: [
                    { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [multiline ? 12 : 0, multiline ? -2 : -13] }) },
                    { scale: float.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] }) },
                  ],
                },
                multiline && { position: 'absolute', top: 10 },
              ]}
            >
              {label}
            </Animated.Text>
            <TextInput
              ref={ref}
              {...rest}
              value={value}
              multiline={multiline}
              secureTextEntry={hidden}
              placeholder={undefined}
              placeholderTextColor={colors.textHint}
              selectionColor={colors.cyan}
              cursorColor={colors.cyan}
              onFocus={(e) => { setFocused(true); onFocus?.(e); }}
              onBlur={(e) => { setFocused(false); onBlur?.(e); }}
              style={[
                styles.input,
                multiline ? { minHeight: 70, paddingTop: 30, textAlignVertical: 'top' } : { paddingTop: 16 },
              ]}
            />
          </View>
          {secure && (
            <Pressable hitSlop={12} onPress={() => setHidden(h => !h)}>
              <MaterialIcons name={hidden ? 'visibility' : 'visibility-off'} size={20} color={colors.textHint} />
            </Pressable>
          )}
        </View>
      </View>
      {!!error && (
        <View style={styles.errorRow}>
          <MaterialIcons name="error-outline" size={14} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </Animated.View>
  );
});

export default Field;

const styles = StyleSheet.create({
  halo: { margin: -1.5, borderRadius: 21 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#150E33',
    borderWidth: 1,
    borderColor: colors.glassLine,
  },
  boxError: { borderColor: colors.danger },
  label: {
    position: 'absolute',
    left: 0,
    fontFamily: fonts.bodyMed,
    fontSize: 15,
    transformOrigin: 'left center',
  },
  input: {
    fontFamily: fonts.bodyMed,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 0,
    paddingBottom: 0,
    outlineStyle: 'none',
  } as any,
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginLeft: 8 },
  errorText: { fontFamily: fonts.bodyMed, fontSize: 12, color: colors.danger },
});
