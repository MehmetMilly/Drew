import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { classifyStroke, partSummary } from '../src/sim/classify';
import { generateFixtures } from './fixtures/synth';
import { scoreFixtures } from '../tools/fixtures';

describe('classifier', () => {
  it('agrees with ≥95% of synthetic fixtures', () => {
    const fx = generateFixtures(1234, 30);
    const r = scoreFixtures(fx);
    if (r.rate < 0.95) console.log(r.table);
    expect(r.rate).toBeGreaterThanOrEqual(0.95);
  });

  it('agrees with ≥95% of human fixtures (when present)', () => {
    const dir = 'tests/fixtures/human';
    if (!existsSync(dir)) return;
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    if (!files.length) return;
    const fx = files.flatMap((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')).strokes);
    const r = scoreFixtures(fx);
    if (r.rate < 0.95) console.log(r.table);
    expect(r.rate).toBeGreaterThanOrEqual(0.95);
  });

  it('reads a plain circle as one loop and a stick as one line', () => {
    const circle = Array.from({ length: 60 }, (_, i) => ({ x: 100 + 40 * Math.cos((i / 60) * 6.4), y: 100 + 40 * Math.sin((i / 60) * 6.4) }));
    expect(partSummary(classifyStroke(circle))).toEqual(['loop']);
    const stick = Array.from({ length: 30 }, (_, i) => ({ x: 100, y: 100 + i * 5 }));
    expect(partSummary(classifyStroke(stick))).toEqual(['line']);
  });
});
