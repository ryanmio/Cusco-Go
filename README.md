# Cusco Go – Liquid Glass Integration

This app integrates Apple's iOS Liquid Glass design in two ways:
- System-native tab bar using Expo Router Native Tabs (`expo-router/unstable-native-tabs`) so the bottom bar adopts Liquid Glass automatically on iOS 26+.
- Glass surfaces in React Native views using `expo-glass-effect` for cards, filters, and fields.

## Versions

- Expo SDK: 54.x
- React Native: 0.81.x

## Native modules used

- expo-glass-effect (renders native Liquid Glass in RN views)
- Expo Router Native Tabs (ships with Expo Router; no extra install needed)

## Development workflow

1) Start Metro for dev client and Simulator

```bash
npx expo start --dev-client
```

2) iOS device development build (one-time or when native changes)

```bash
eas build -p ios --profile dev
```

Open the build page URL printed by the command on your iPhone (Safari) and tap Install. If installation fails due to device registration, run `npx eas device:create` to add your device and rebuild.

## When to rebuild

- Rebuild required: adding/upgrading native modules, changing plugins, iOS deployment target, Info.plist, entitlements, or Expo SDK major upgrades.
- No rebuild: JS/TS-only edits, styles, navigation, component changes, and tweaking `GlassSurface` props.

Optional JS updates sharing:

```bash
eas update --branch dev --message "UI tweaks to GlassSurface"
```

## Using Liquid Glass in code

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

## Add a new screen with GlassSurface

1) Create a new file under `app/(tabs)/new-screen.tsx`.
2) Add a new trigger in `app/(tabs)/_layout.tsx`:
```tsx
<NativeTabs.Trigger name="new-screen">
  <Icon sf={{ default: 'star', selected: 'star.fill' }} />
  <Label>New</Label>
</NativeTabs.Trigger>
```

## Build profiles

`eas.json` includes `development`, `preview`, and `production` profiles. For sharing builds internally, use:

```bash
eas build -p ios --profile preview
eas install -p ios
```

## Notes

- Liquid Glass is available only on supported iOS versions and devices. The wrapper checks `isLiquidGlassAvailable()` to decide between native effect and fallback.
- Keep the Simulator useful: the fallback preserves layout and interaction.

## References

- Expo GlassEffect docs: https://docs.expo.dev/versions/latest/sdk/glass-effect/
- Expo blog: Liquid Glass: https://expo.dev/blog/liquid-glass-app-with-expo-ui-and-swiftui


