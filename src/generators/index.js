import { genM1, genM2, genM3, genM4, genM5 } from './tables.js';
import { genM6, genM7, genM8 } from './multiples.js';
import { genD1, genD2, genD3, genD4 } from './division.js';
import { genF1, genF2 } from './fractions.js';
import { genP1, genP2, genP3, genP4, genP5, genP6, genP7 } from './percent.js';

const GENERATORS = {
  M1: genM1, M2: genM2, M3: genM3, M4: genM4, M5: genM5, M6: genM6, M7: genM7, M8: genM8,
  D1: genD1, D2: genD2, D3: genD3, D4: genD4,
  F1: genF1, F2: genF2,
  P1: genP1, P2: genP2, P3: genP3, P4: genP4, P5: genP5, P6: genP6, P7: genP7,
};

/** Produce one Question for a rung. rng: () => [0,1). */
export function generate(rungId, rng) {
  const g = GENERATORS[rungId];
  if (!g) throw new Error(`No generator for rung ${rungId}`);
  return g(rng);
}
