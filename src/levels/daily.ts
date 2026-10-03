// Daily Doodle (design §12, levels.md §7): one arena and one modifier a day, the same for
// everyone, from a hash of the date string. First pass: the arenas are the story levels
// that already teach each hazard, retitled; dedicated compact arenas can replace them.
import type { LevelDef } from '../sim/level';
import type { Modifier } from '../sim/daily';
import { L1_3, L1_4, L1_5 } from './ch1';
import { L2_1, L2_2, L2_3, L2_4 } from './ch2';
import { L3_1, L3_3, L3_4 } from './ch3';
import { L4_1 } from './ch4';
import { L5_3 } from './ch5';

export const ARENAS: { name: string; level: LevelDef }[] = [
  { name: 'Ledge', level: L2_1 },
  { name: 'Pit', level: L2_2 },
  { name: 'Bombs', level: L1_4 },
  { name: 'Crushers', level: L1_3 },
  { name: 'Fan', level: L3_1 },
  { name: 'Pool', level: L4_1 },
  { name: 'Hoop', level: L2_3 },
  { name: 'See-saw', level: L3_3 },
  { name: 'Ninja', level: L1_5 },
  { name: 'Spikes', level: L2_4 },
  { name: 'Bridge', level: L3_4 },
  { name: 'Smudgers', level: L5_3 },
];

export const MODIFIERS: { id: Modifier; name: string }[] = [
  { id: 'one-stroke', name: 'One Stroke' },
  { id: 'no-heads', name: 'No Heads' },
  { id: 'worms', name: 'Worms Only' },
  { id: 'giants', name: 'Giants Only' },
  { id: 'tiny', name: 'Tiny Only' },
  { id: 'half-ink', name: 'Half Ink' },
  { id: 'two-friends', name: 'Exactly Two Friends' },
  { id: 'blind', name: 'Blind Draw' },
  { id: 'mirror', name: 'Mirror' },
  { id: 'heavy', name: 'Heavy Ink' },
];

/** Local calendar date as YYYY-MM-DD. */
export function dateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** FNV-1a of the date string: the arena and modifier for that day. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function dailyFor(date: string): { arena: string; mod: (typeof MODIFIERS)[number]; level: LevelDef } {
  const h = hash(date);
  const a = ARENAS[h % ARENAS.length];
  const mod = MODIFIERS[Math.floor(h / ARENAS.length) % MODIFIERS.length];
  const base = a.level;
  return {
    arena: a.name,
    mod,
    level: {
      ...base,
      id: 'daily-' + date,
      title: `${a.name}: ${mod.name}`,
      hint: undefined,
      mod: mod.id,
      ink: mod.id === 'half-ink' ? base.ink * 0.5 : base.ink,
    },
  };
}
