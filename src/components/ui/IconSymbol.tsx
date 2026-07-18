import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

// The single emoji→vector mapping for UI chrome. Emoji that are CONTENT
// (celebration toasts, coach messages, session-type badges) may stay emoji;
// emoji used as chrome (buttons, list glyphs, settings) must come from here.
// Add names as screens migrate — keep this union the only icon vocabulary.
const ICONS = {
  // was 🏆
  trophy: { family: 'ion', glyph: 'trophy' },
  // was 💪
  flex: { family: 'mci', glyph: 'arm-flex' },
  // was 🔥
  fire: { family: 'mci', glyph: 'fire' },
  // was ⚡
  flash: { family: 'ion', glyph: 'flash' },
  // was 📷
  camera: { family: 'ion', glyph: 'camera' },
  // was 💬
  comment: { family: 'ion', glyph: 'chatbubble-outline' },
  // was ✏️
  edit: { family: 'ion', glyph: 'pencil' },
  // was 📌
  pin: { family: 'mci', glyph: 'pin' },
  // was ⚙️
  settings: { family: 'ion', glyph: 'settings-sharp' },
  // was 🏋️
  lift: { family: 'mci', glyph: 'weight-lifter' },
  // was 🎯
  target: { family: 'mci', glyph: 'bullseye-arrow' },
  // was ⏱ / rest timer
  timer: { family: 'ion', glyph: 'timer-outline' },
  // was ❤️ / like
  heart: { family: 'ion', glyph: 'heart' },
  heartOutline: { family: 'ion', glyph: 'heart-outline' },
  // was 🔒
  lock: { family: 'ion', glyph: 'lock-closed' },
  // was 🔓
  unlock: { family: 'ion', glyph: 'lock-open' },
  // was 👥 / friends
  people: { family: 'ion', glyph: 'people' },
  // was ➕
  add: { family: 'ion', glyph: 'add' },
  close: { family: 'ion', glyph: 'close' },
  check: { family: 'ion', glyph: 'checkmark' },
  checkCircle: { family: 'ion', glyph: 'checkmark-circle' },
  chevronRight: { family: 'ion', glyph: 'chevron-forward' },
  chevronDown: { family: 'ion', glyph: 'chevron-down' },
  chevronUp: { family: 'ion', glyph: 'chevron-up' },
  ellipsis: { family: 'ion', glyph: 'ellipsis-horizontal' },
  calendar: { family: 'ion', glyph: 'calendar' },
  chart: { family: 'ion', glyph: 'stats-chart' },
  search: { family: 'ion', glyph: 'search' },
  share: { family: 'ion', glyph: 'share-outline' },
  trash: { family: 'ion', glyph: 'trash-outline' },
  note: { family: 'ion', glyph: 'document-text-outline' },
  qr: { family: 'ion', glyph: 'qr-code' },
  crown: { family: 'mci', glyph: 'crown' },
  medal: { family: 'ion', glyph: 'medal' },
  repeat: { family: 'ion', glyph: 'repeat' },
  play: { family: 'ion', glyph: 'play' },
} as const;

export type IconName = keyof typeof ICONS;

interface IconSymbolProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function IconSymbol({ name, size = 18, color = Colors.text }: IconSymbolProps) {
  const def = ICONS[name];
  if (def.family === 'ion') {
    return <Ionicons name={def.glyph as any} size={size} color={color} />;
  }
  return <MaterialCommunityIcons name={def.glyph as any} size={size} color={color} />;
}
