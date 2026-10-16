/** Format a float without binary noise, e.g. 0.085 not 0.08499999. */
export const clean = (x) => String(Number(Number(x).toFixed(6)));
