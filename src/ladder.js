// Tracks and rungs. `requires` lists rung ids that must be mastered first.
// `format` tells the keypad which extra keys to show. `method` is the one-screen card.

const rung = (id, track, title, short, requires, format, method, extra = {}) =>
  ({ id, track, title, short, requires, format: { decimals: false, remainder: false, ...format }, method, ...extra });

const INT = {};
const DEC = { decimals: true };

export const RUNGS = {
  // ---------- Multiplication ----------
  M1: rung('M1', 'mul', 'Times 2, 5 and 10', '×2 ×5 ×10', [], INT, {
    lines: [
      '×2 is doubling. 7 × 2: double 7 = 14.',
      '×10: every digit moves up one place. 7 × 10 = 70.',
      '×5 is half of ×10. 7 × 5: 7 × 10 = 70, halve it = 35.',
    ],
    examples: [{ q: '8 × 5', a: '8 × 10 = 80, half of 80 = 40' }, { q: '12 × 2', a: 'double 12 = 24' }],
  }),
  M2: rung('M2', 'mul', 'Times 4, 3 and 6', '×4 ×3 ×6', ['M1'], INT, {
    lines: [
      '×4 is double, then double again. 7 × 4: 14, then 28.',
      '×3 is double, then add one more. 7 × 3: 14 + 7 = 21.',
      '×6 is ×3, then double. 7 × 6: 21, doubled = 42.',
    ],
    examples: [{ q: '9 × 4', a: '18, then 36' }, { q: '8 × 6', a: '8 × 3 = 24, doubled = 48' }],
  }),
  M3: rung('M3', 'mul', 'Times 9 and 8', '×9 ×8', ['M2'], INT, {
    lines: [
      '×9 is ×10 minus one lot. 7 × 9: 70 − 7 = 63.',
      'Check: the digits of a ×9 answer add to 9 (6 + 3 = 9).',
      '×8 is ×4 doubled. 7 × 8: 28, doubled = 56.',
    ],
    examples: [{ q: '6 × 9', a: '60 − 6 = 54' }, { q: '9 × 8', a: '9 × 4 = 36, doubled = 72' }],
  }),
  M4: rung('M4', 'mul', 'Times 7, 11 and 12', '×7 ×11 ×12', ['M3'], INT, {
    lines: [
      '×7 is ×5 plus ×2. 8 × 7: 40 + 16 = 56.',
      '×11 is ×10 plus one lot. 8 × 11: 80 + 8 = 88.',
      '×12 is ×10 plus ×2. 8 × 12: 80 + 16 = 96.',
    ],
    examples: [{ q: '6 × 7', a: '30 + 12 = 42' }, { q: '7 × 12', a: '70 + 14 = 84' }],
  }),
  M5: rung('M5', 'mul', 'All tables, both ways', 'Mixed', ['M4'], INT, {
    lines: [
      'Every table from 2 to 12, in any order.',
      'Also backwards: "? × 7 = 56". Start from a 7-fact you know and step.',
      '7 × 7 = 49. One more 7 is 56. So the answer is 8.',
      'Or step down from 10: 7 × 10 = 70, 7 × 9 = 63, 7 × 8 = 56. So 56 ÷ 7 = 8.',
    ],
    examples: [{ q: '? × 6 = 42', a: '6 × 5 = 30, 36, 42 — that is 7' }, { q: '12 × 9', a: '120 − 12 = 108' }],
  }),
  M6: rung('M6', 'mul', 'Tens, hundreds, thousands', '×10 ×100', ['M5'], INT, {
    lines: [
      '×10, ×100, ×1000: the digits shift 1, 2 or 3 places. 34 × 100 = 3400.',
      'A number times a multiple of ten: do the small fact, then shift.',
      '6 × 40: 6 × 4 = 24, then × 10 = 240.',
    ],
    examples: [{ q: '7 × 300', a: '7 × 3 = 21, two zeros → 2100' }, { q: '58 × 10', a: '580' }],
  }),
  M7: rung('M7', 'mul', 'Two digits by one digit', '23 × 4', ['M6'], INT, {
    lines: [
      'Split the two-digit number into tens and units.',
      '23 × 4: 20 × 4 = 80, and 3 × 4 = 12.',
      'Add the two parts: 80 + 12 = 92.',
      'Say the tens part out loud first, then add the units part.',
    ],
    examples: [{ q: '17 × 6', a: '60 + 42 = 102' }, { q: '28 × 3', a: '60 + 24 = 84' }],
  }),
  M8: rung('M8', 'mul', 'Two-digit tricks', 'Tricks', ['M7'], INT, {
    lines: [
      '×11: spread the digits and put their sum in the middle. 23 × 11 = 2 (2+3) 3 = 253.',
      '×25: quarter the number, then × 100. 12 × 25: 12 ÷ 4 = 3, so 300.',
      'A pair either side of a round number: 19 × 21 = 20² − 1² = 400 − 1 = 399.',
    ],
    examples: [{ q: '34 × 11', a: '3 (3+4) 4 = 374' }, { q: '18 × 22', a: '400 − 4 = 396' }],
  }, { bonus: true }),

  // ---------- Division ----------
  D1: rung('D1', 'div', 'Halving and quartering', 'Halve', ['M1'], DEC, {
    lines: [
      'Halve the tens, halve the units, add. 46 ÷ 2: 20 + 3 = 23.',
      'Odd numbers end in .5: 47 ÷ 2 = 23.5.',
      'Quarter = halve twice. 68 ÷ 4: 34, then 17.',
    ],
    examples: [{ q: '86 ÷ 2', a: '40 + 3 = 43' }, { q: '52 ÷ 4', a: '26, then 13' }],
  }),
  D2: rung('D2', 'div', 'Division from tables', '56 ÷ 7', ['M5'], INT, {
    lines: [
      'Division is a times-table question in reverse.',
      '56 ÷ 7 means "what × 7 makes 56?". 7 × 8 = 56, so 8.',
      'If you are not sure, start from a fact you know and step up or down.',
    ],
    examples: [{ q: '72 ÷ 9', a: '9 × 8 = 72, so 8' }, { q: '48 ÷ 6', a: '6 × 8 = 48, so 8' }],
  }),
  D3: rung('D3', 'div', 'Dividing by 10, 100, 1000', '÷10 ÷100', ['D2', 'M6'], DEC, {
    lines: [
      'Digits move down 1, 2 or 3 places. 450 ÷ 10 = 45. 450 ÷ 100 = 4.5.',
      'A number smaller than the divisor gives a decimal: 7 ÷ 10 = 0.7.',
      '3 ÷ 100 = 0.03 — fill the gap with a zero.',
    ],
    examples: [{ q: '2300 ÷ 100', a: '23' }, { q: '85 ÷ 1000', a: '0.085' }],
  }),
  D4: rung('D4', 'div', 'Remainders', '23 ÷ 5', ['D2'], { remainder: true }, {
    lines: [
      'Find the biggest table fact that fits, then see what is left.',
      '23 ÷ 5: 5 × 4 = 20 fits. 23 − 20 = 3 left over.',
      'Answer: 4 r 3. Type 4, then r, then 3.',
    ],
    examples: [{ q: '38 ÷ 6', a: '6 × 6 = 36, 2 left → 6 r 2' }, { q: '50 ÷ 7', a: '7 × 7 = 49, 1 left → 7 r 1' }],
  }),

  // ---------- Fractions ----------
  F1: rung('F1', 'frac', 'A fraction of an amount', '1/4 of 60', ['D1', 'M3'], INT, {
    lines: [
      'A unit fraction (1 on top) means divide by the bottom number.',
      '1/4 of 60 = 60 ÷ 4 = 15. 1/5 of 40 = 40 ÷ 5 = 8.',
      '1/8: halve three times. 1/8 of 64: 32, 16, 8.',
    ],
    examples: [{ q: '1/3 of 27', a: '27 ÷ 3 = 9' }, { q: '1/10 of 90', a: '9' }],
  }),
  F2: rung('F2', 'frac', 'Several parts of an amount', '3/5 of 40', ['F1', 'M5'], INT, {
    lines: [
      'Find one part first, then multiply by the top number.',
      '3/5 of 40: 1/5 is 40 ÷ 5 = 8. Then 8 × 3 = 24.',
      'Divide by the bottom, times by the top.',
    ],
    examples: [{ q: '2/3 of 30', a: '30 ÷ 3 = 10, × 2 = 20' }, { q: '5/8 of 48', a: '48 ÷ 8 = 6, × 5 = 30' }],
  }),

  // ---------- Percentages ----------
  P1: rung('P1', 'pct', 'The four building blocks', '50% 25% 10% 1%', ['M3', 'D1'], DEC, {
    lines: [
      '50% is half. 50% of 86 = 43.',
      '25% is half of half. 25% of 60: 30, then 15.',
      '10% is ÷ 10. 10% of 80 = 8.   1% is ÷ 100. 1% of 300 = 3.',
      'Every other percentage is built from these four.',
    ],
    examples: [{ q: '25% of 120', a: '60, then 30' }, { q: '10% of 45', a: '4.5' }],
  }),
  P2: rung('P2', 'pct', 'Build any percentage', '15% 30% 17.5%', ['P1'], DEC, {
    lines: [
      'Start from 10%, then scale. 30% of 80: 10% = 8, × 3 = 24.',
      '5% is half of 10%. 15% = 10% + 5%. 15% of 80: 8 + 4 = 12.',
      '2.5% is half of 5%. 17.5% = 10% + 5% + 2.5%: 8 + 4 + 2 = 14.',
      '75% = 50% + 25%. 75% of 80: 40 + 20 = 60.',
    ],
    examples: [{ q: '40% of 60', a: '10% = 6, × 4 = 24' }, { q: '5% of 140', a: '10% = 14, halve → 7' }],
  }),
  P3: rung('P3', 'pct', 'Fractions and percentages', '3/8 = 37.5%', ['P2', 'F2'], DEC, {
    lines: [
      '1/2 = 50%, 1/4 = 25%, 3/4 = 75%, 1/5 = 20%, 1/10 = 10%.',
      '1/8 is half of 1/4, so 12.5%. 3/8 = 37.5%, 5/8 = 62.5%, 7/8 = 87.5%.',
      'Swap when it is easier: 37.5% of 80 is 3/8 of 80 = 80 ÷ 8 × 3 = 30.',
    ],
    examples: [{ q: '3/5 as a %', a: '1/5 = 20%, × 3 = 60%' }, { q: '62.5% of 40', a: '5/8 of 40 = 5 × 5 = 25' }],
  }),
  P4: rung('P4', 'pct', 'Percentage up or down', '£40 up 20%', ['P3'], DEC, {
    lines: [
      'Work out the percentage, then add it on or take it off.',
      '£40 up 20%: 20% of 40 = 8. 40 + 8 = £48.',
      '£60 down 25%: 25% of 60 = 15. 60 − 15 = £45.',
    ],
    examples: [{ q: 'Increase £80 by 15%', a: '15% = 12, so £92' }, { q: 'Reduce £120 by 10%', a: '10% = 12, so £108' }],
  }),
  P5: rung('P5', 'pct', 'Multipliers', '× 1.2', ['P4', 'M7'], DEC, {
    lines: [
      'Up 20% means 120% of the number: multiply by 1.2.',
      'Down 15% means 85% is left: multiply by 0.85.',
      '40 × 1.2: 40 × 1 = 40, 40 × 0.2 = 8, total 48.',
      'This is the way GCSE papers expect you to show it.',
    ],
    examples: [{ q: 'Multiplier for 35% off', a: '100 − 35 = 65% → 0.65' }, { q: '60 × 1.3', a: '60 + 18 = 78' }],
  }),
  P6: rung('P6', 'pct', 'Reverse percentages', 'Original price', ['P5'], DEC, {
    lines: [
      'The price you are given is NOT 100%. Work out what percent it is.',
      '£60 after 25% off: £60 is 75%.',
      '1% = 60 ÷ 75 = 0.80. 100% = £80.',
      'Or: 75% = 60, so 25% = 20, so 100% = 80.',
    ],
    examples: [{ q: '£90 after 10% off', a: '90 is 90%, 1% = 1, original £100' }, { q: '£66 after a 10% rise', a: '66 is 110%, 1% = 0.60, original £60' }],
  }),
  P7: rung('P7', 'pct', 'One number as a % of another', '18 out of 40', ['P6', 'D2'], DEC, {
    lines: [
      'Scale the bottom number to 100, and do the same to the top.',
      '18 out of 40: 40 → 100 is × 2.5. 18 × 2.5 = 45%.',
      'Out of 20: × 5. Out of 25: × 4. Out of 50: × 2. Out of 200: ÷ 2.',
    ],
    examples: [{ q: '7 out of 20', a: '× 5 → 35%' }, { q: '30 out of 200', a: '÷ 2 → 15%' }],
  }),
};

export const TRACKS = [
  { id: 'mul', title: 'Multiplication', rungs: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8'] },
  { id: 'div', title: 'Division', rungs: ['D1', 'D2', 'D3', 'D4'] },
  { id: 'frac', title: 'Fractions', rungs: ['F1', 'F2'] },
  { id: 'pct', title: 'Percentages', rungs: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'] },
];

/** Global display/scheduling order (used for "lowest-numbered unlocked rung"). */
export const RUNG_ORDER = TRACKS.flatMap((t) => t.rungs);
