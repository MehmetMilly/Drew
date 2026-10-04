// npx tsx tools/qa/repro.ts review/qa/<file>.json : replays a saved repro and prints findings.
import { readFileSync } from 'node:fs';
import { runScenario } from './lib';
const { finding, scenario } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const r = runScenario(scenario);
console.log('expected:', finding);
console.log('got:', r.findings, { result: r.result, cause: r.cause, endT: r.endT, hash: r.hash });
