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
    // Render the glass as a background layer. Apply corner radius and clipping
    // to the wrapper view instead of the GlassView itself to avoid the thin
    // halo that can appear around rounded blur views on iOS.
    return (
      <View style={[styles.wrapper, style]}>
        <GlassView
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject as any, { top: -1, left: -1, right: -1, bottom: -1 }]}
          glassEffectStyle={glassEffectStyle}
          isInteractive={isInteractive}
          tintColor={tintColor}
        />
        <View pointerEvents="box-none">
          {children}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.fallback, style, fallbackStyle]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  fallback: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
});


