import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useColorScheme } from '@/components/useColorScheme';

export type GlassSurfaceProps = {
  style?: StyleProp<ViewStyle>;
  glassEffectStyle?: 'regular' | 'clear';
  isInteractive?: boolean;
  tintColor?: string;
  children?: React.ReactNode;
  fallbackStyle?: StyleProp<ViewStyle>;
  // When true, render blur as a background layer to avoid iOS halo
  // around rounded corners. Disables native interactive highlight.
  useHaloFix?: boolean;
};

export default function GlassSurface(props: GlassSurfaceProps) {
  const { style, glassEffectStyle = 'regular', isInteractive = false, tintColor, children, fallbackStyle, useHaloFix = false } = props;

  const canUseLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const colorScheme = useColorScheme();
  const isDark = (colorScheme ?? 'light') === 'dark';

  if (canUseLiquidGlass) {
    if (useHaloFix) {
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
          {!isDark && (
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFillObject as any, { backgroundColor: 'rgba(0,0,0,0.28)' }]}
            />
          )}
          <View pointerEvents="box-none">
            {children}
          </View>
        </View>
      );
    }
    // Default: return interactive GlassView directly (native shine enabled)
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
  wrapper: {
    overflow: 'hidden',
  },
  fallback: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
});


