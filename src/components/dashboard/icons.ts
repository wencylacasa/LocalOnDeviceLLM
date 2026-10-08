import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

/**
 * Icons a generated dashboard may use, keyed by SF Symbol name (what the model
 * is told to write). Each maps to the matching Material Symbol so Android and
 * web show the right glyph instead of one placeholder for everything.
 *
 * The values are typed, so a misspelled name fails `tsc` instead of rendering
 * an empty badge at runtime.
 */
export const ICONS: Record<string, { ios: SFSymbol; android: AndroidSymbol }> = {
  'star.fill': { ios: 'star.fill', android: 'star' },
  'heart.fill': { ios: 'heart.fill', android: 'favorite' },
  'flame.fill': { ios: 'flame.fill', android: 'local_fire_department' },
  'bolt.fill': { ios: 'bolt.fill', android: 'bolt' },
  'figure.walk': { ios: 'figure.walk', android: 'directions_walk' },
  'figure.run': { ios: 'figure.run', android: 'directions_run' },
  'chart.bar.fill': { ios: 'chart.bar.fill', android: 'bar_chart' },
  'chart.line.uptrend.xyaxis': { ios: 'chart.line.uptrend.xyaxis', android: 'trending_up' },
  'dollarsign.circle.fill': { ios: 'dollarsign.circle.fill', android: 'paid' },
  'bitcoinsign.circle.fill': { ios: 'bitcoinsign.circle.fill', android: 'currency_bitcoin' },
  thermometer: { ios: 'thermometer', android: 'thermostat' },
  'drop.fill': { ios: 'drop.fill', android: 'water_drop' },
  'cloud.fill': { ios: 'cloud.fill', android: 'cloud' },
  'sun.max.fill': { ios: 'sun.max.fill', android: 'light_mode' },
  'moon.fill': { ios: 'moon.fill', android: 'dark_mode' },
  wind: { ios: 'wind', android: 'air' },
  'clock.fill': { ios: 'clock.fill', android: 'schedule' },
  'checkmark.circle.fill': { ios: 'checkmark.circle.fill', android: 'check_circle' },
  'list.bullet': { ios: 'list.bullet', android: 'format_list_bulleted' },
  calendar: { ios: 'calendar', android: 'calendar_today' },
  'bell.fill': { ios: 'bell.fill', android: 'notifications' },
  'cart.fill': { ios: 'cart.fill', android: 'shopping_cart' },
  'house.fill': { ios: 'house.fill', android: 'home' },
  'person.fill': { ios: 'person.fill', android: 'person' },
  'map.fill': { ios: 'map.fill', android: 'map' },
  'bed.double.fill': { ios: 'bed.double.fill', android: 'bed' },
  'fork.knife': { ios: 'fork.knife', android: 'restaurant' },
  'music.note': { ios: 'music.note', android: 'music_note' },
  'trophy.fill': { ios: 'trophy.fill', android: 'emoji_events' },
  target: { ios: 'target', android: 'target' },
};

export const DEFAULT_ICON = 'star.fill';

export const isKnownIcon = (name: string) => Object.prototype.hasOwnProperty.call(ICONS, name);
