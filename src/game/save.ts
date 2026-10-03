// Save data (design.md §16): one versioned schema in localStorage, every read and
// write wrapped; the game runs fine with storage empty or unavailable.
const KEY = 'drew-save';
const VERSION = 1;
const HALL_CAP = 300;

export interface Hero {
  name: string;
  kind: string;
  level: string;
  strokes: { x: number; y: number }[][];
  at: number; // Date.now()
  epitaph?: string;
}

export interface SaveData {
  v: number;
  cleared: Record<string, boolean>;
  badges: Record<string, string[]>; // level id → hero kinds it was cleared with (max 3)
  fails: Record<string, number>; // consecutive fails (adaptive ghost hint)
  hall: Hero[];
  settings: { sound: number; music: number; intentLines: boolean; gentle: boolean; reducedMotion: boolean; haptics: boolean; leftHanded: boolean };
}

const fresh = (): SaveData => ({
  v: VERSION,
  cleared: {},
  badges: {},
  fails: {},
  hall: [],
  settings: { sound: 1, music: 0.7, intentLines: true, gentle: false, reducedMotion: false, haptics: true, leftHanded: false },
});

let cache: SaveData | null = null;

export function load(): SaveData {
  if (cache) return cache;
  let d = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      if (parsed && parsed.v === VERSION) d = { ...d, ...parsed, settings: { ...d.settings, ...(parsed.settings ?? {}) } };
    }
  } catch {
    /* storage unavailable: play without saving */
  }
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches && !d.cleared.__rmSet) d.settings.reducedMotion = true;
  return (cache = d);
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(load()));
  } catch {
    /* ignore */
  }
}

/** Record a clear. Returns the badge kinds that are new. */
export function recordWin(levelId: string, kinds: string[], hero: Hero | null): string[] {
  const d = load();
  d.cleared[levelId] = true;
  d.fails[levelId] = 0;
  const have = (d.badges[levelId] ??= []);
  const fresh: string[] = [];
  for (const k of kinds) if (have.length < 3 && !have.includes(k)) (have.push(k), fresh.push(k));
  if (hero) {
    d.hall.unshift(hero);
    d.hall.length = Math.min(d.hall.length, HALL_CAP);
  }
  save();
  return fresh;
}

export function recordFail(levelId: string): number {
  const d = load();
  d.fails[levelId] = (d.fails[levelId] ?? 0) + 1;
  save();
  return d.fails[levelId];
}
