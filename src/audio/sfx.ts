// Sim-event sounds (audio.md). The toy page feeds every new world event here once.
// Owned by the audio work: fill in per event type.
import type { SimEvent, World } from '../sim/world';

export function sfxEvent(_e: SimEvent, _w: World, _timeScale: number) {}

/** Called once per rendered frame for continuous layers (rolling, wind, music ducking). */
export function sfxFrame(_w: World, _timeScale: number) {}
