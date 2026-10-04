// Every story level in play order.
import { CHAPTER1 } from './ch1';
import { CHAPTER2 } from './ch2';
import { CHAPTER3 } from './ch3';
import { CHAPTER4 } from './ch4';
import { CHAPTER5 } from './ch5';
import type { LevelDef } from '../sim/level';

export const CHAPTERS: { id: number; title: string; paper: string; levels: LevelDef[] }[] = [
  { id: 1, title: "It's Alive", paper: 'cream', levels: CHAPTER1 },
  { id: 2, title: 'Boing', paper: 'graph', levels: CHAPTER2 },
  { id: 3, title: 'Heavy Stuff', paper: 'kraft', levels: CHAPTER3 },
  { id: 4, title: 'Wet Paper', paper: 'wash', levels: CHAPTER4 },
  { id: 5, title: 'The Eraser', paper: 'crumpled', levels: CHAPTER5 },
];
export const ALL_LEVELS: LevelDef[] = CHAPTERS.flatMap((c) => c.levels);
