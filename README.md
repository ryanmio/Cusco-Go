# Cusco Go

This is an offline scavenger hunt app for travelers in Peru, built for iOS using React Native. Players collect cultural and ecological items by taking photos during their trip — animals such as condors and llamas, plants like orchids and coca, and Inca ruins including terraces, fountains, and astronomy stones.

The app uses location-based bonuses to make visits to Machu Picchu, Cusco, the Sacred Valley, Lake Titicaca, and the Amazon feel more rewarding. It is fully offline and optimized for travel, so it works in remote areas without draining battery.

The goal is to help visitors notice the details that define Peru’s heritage and ecosystems — wildlife, plants, and ruins — and make them part of the travel experience.

Although this version is built for Peru, the app is designed to be adaptable and rethemable for other destinations. By swapping in new cultural items, ecological features, and bonus zones, it can be customized to create scavenger hunts for any region or theme.

## Versions

- Expo SDK: 54.x
- React Native: 0.81.x


## Liquid Glass Integration

This app integrates Apple's iOS Liquid Glass design in two ways:
- System-native tab bar using Expo Router Native Tabs (`expo-router/unstable-native-tabs`) so the bottom bar adopts Liquid Glass automatically on iOS 26+.
- Glass surfaces in React Native views using `expo-glass-effect` for cards, filters, and fields.

### Using Liquid Glass in code

- System tab bar: `app/(tabs)/_layout.tsx` uses `NativeTabs` with triggers. No custom bar; this is the platform UITabBar that adopts Liquid Glass on iOS 26+.
- RN views: use `components/GlassSurface.tsx` to wrap views (e.g., Hunt search field, filter chips, capture cards). It falls back to a styled View on unsupported platforms.

```tsx
import GlassSurface from '@/components/GlassSurface';

<GlassSurface style={{ borderRadius: 16, padding: 16 }} glassEffectStyle="regular" isInteractive tintColor="#ffffff">
  {/* children */}
</GlassSurface>
```

### Points screen Liquid Glass (pie chart)

The points screen (`app/points.tsx`) renders the pie chart inside a native Liquid Glass card using `GlassSurface`:

- The glass card is absolutely positioned at the top so the list scrolls underneath it (overlay effect).
- Uses `glassEffectStyle="regular"` with no tint for a true frosted look on iOS.
- Non-interactive overlay via `pointerEvents="none"` so scroll gestures reach the list.
- The card has radius 12 and uses native `tintColor` for subtle definition.
- On unsupported platforms or when Liquid Glass isn't available, the wrapper falls back to a translucent view.

Adjust the card's padding or `tintColor` directly on the `GlassSurface` style in `app/points.tsx`.

### Implementing glass cards elsewhere

1) Wrap your content with `GlassSurface`.
2) Prefer `glassEffectStyle="regular"` and use `tintColor` for subtle density instead of borders.
3) Keep the glass as the immediate wrapper (avoid extra parent wrappers that can flatten the backdrop).
4) **Avoid custom borders and shadows** - they create non-native outlines that fight the liquid glass effect.
5) **iOS blur halo fix**: If you see a 1px light outline around rounded glass cards on iOS, pass `useHaloFix={true}` to `GlassSurface` to render the blur as a background layer instead of applying styles directly to `GlassView`. This disables the native interactive highlight but eliminates the halo.
6) Use `tintColor` for definition: `rgba(255,255,255,0.10-0.16)` for light mode, `rgba(255,255,255,0.08-0.14)` for dark mode.
7) If overlaying other content, absolutely position and (optionally) set `pointerEvents="none"` so interactions pass through.

Example:

```tsx
<GlassSurface
  style={{ borderRadius: 12, padding: 14 }}
  glassEffectStyle="regular"
  isInteractive
  tintColor="rgba(255,255,255,0.16)"
>
  {/* your content */}
  {children}
  {/* ... */}
 </GlassSurface>
```

**Important**: Don't add `borderWidth`, `borderColor`, `shadowColor`, `shadowOpacity`, etc. to glass surfaces. These create artificial outlines that break the native liquid glass appearance. Use `tintColor` instead for subtle definition.

### Add a new screen with GlassSurface

1) Create a new file under `app/(tabs)/new-screen.tsx`.
2) Add a new trigger in `app/(tabs)/_layout.tsx`:
```tsx
<NativeTabs.Trigger name="new-screen">
  <Icon sf={{ default: 'star', selected: 'star.fill' }} />
  <Label>New</Label>
</NativeTabs.Trigger>
```

### References

- Expo GlassEffect docs: https://docs.expo.dev/versions/latest/sdk/glass-effect/
- Expo blog: Liquid Glass: https://expo.dev/blog/liquid-glass-app-with-expo-ui-and-swiftui


