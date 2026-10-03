// Every story level in play order.
import { CHAPTER1 } from './ch1';
import { CHAPTER2 } from './ch2';
import type { LevelDef } from '../sim/level';

export const CHAPTERS: { id: number; title: string; paper: string; levels: LevelDef[] }[] = [
  { id: 1, title: "It's Alive", paper: 'cream', levels: CHAPTER1 },
  { id: 2, title: 'Boing', paper: 'graph', levels: CHAPTER2 },
];
export const ALL_LEVELS: LevelDef[] = CHAPTERS.flatMap((c) => c.levels);
