/**
 * Four-pointed shape made of four curves. `pinch` moves the curves between a
 * sharp sparkle (≈0.15) and a near-perfect circle (0.914), which lets the same
 * path morph from a black hole's disc into a star.
 */
export function sparklePath(radius: number, pinch = 0.15): string {
  const r = Math.round(radius * 100) / 100;
  const c = Math.round(radius * pinch * 100) / 100;
  return `M0,${-r}Q${c},${-c} ${r},0Q${c},${c} 0,${r}Q${-c},${c} ${-r},0Q${-c},${-c} 0,${-r}Z`;
}

export const CIRCLE_PINCH = 0.914;
