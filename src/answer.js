const REM = /^\s*(\d+)\s*r\s*(\d+)\s*$/i;

function parseNumber(s) {
  const t = s.trim();
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  if (/\.$/.test(t)) return null;
  return Number(t);
}

/** answer: canonical string from a generator. input: what the user typed. */
export function checkAnswer(answer, input) {
  const rem = answer.match(REM);
  if (rem) {
    const m = String(input).match(REM);
    return !!m && m[1] === rem[1] && m[2] === rem[2];
  }
  const a = Number(answer);
  const b = parseNumber(String(input));
  return b !== null && Math.abs(a - b) < 1e-9;
}

/** Human display of a canonical answer with prefix/suffix. Money gets 2dp when fractional. */
export function formatAnswer(answer, prefix = '', suffix = '') {
  if (REM.test(answer)) return answer;
  let body = answer;
  if (prefix === '£' && !Number.isInteger(Number(answer))) body = Number(answer).toFixed(2);
  return `${prefix}${body}${suffix}`;
}

