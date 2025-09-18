import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

export type GlassSurfaceProps = {
  style?: StyleProp<ViewStyle>;
  glassEffectStyle?: 'regular' | 'clear';
  isInteractive?: boolean;
  tintColor?: string;
  children?: React.ReactNode;
  fallbackStyle?: StyleProp<ViewStyle>;
};

export default function GlassSurface(props: GlassSurfaceProps) {
  const { style, glassEffectStyle = 'regular', isInteractive = false, tintColor, children, fallbackStyle } = props;

  const canUseLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

  if (canUseLiquidGlass) {
    return (
      <GlassView style={style} glassEffectStyle={glassEffectStyle} isInteractive={isInteractive} tintColor={tintColor}>
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[styles.fallback, style, fallbackStyle]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
});


