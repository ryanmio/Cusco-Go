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


