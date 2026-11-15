/** Contour lines, like a course map: rings around a point, each with a slow wobble. */
export function contours(cx: number, cy: number, rings: number, gap: number, phase: number): string[] {
  return Array.from({ length: rings }, (_, k) => {
    const r = (k + 1) * gap;
    const points = Array.from({ length: 73 }, (_, n) => {
      const a = (n / 72) * Math.PI * 2;
      const w = 1 + 0.09 * Math.sin(3 * a + k * 0.6 + phase) + 0.05 * Math.sin(5 * a + k * 1.1 + phase * 2);
      return `${(cx + Math.cos(a) * r * w).toFixed(1)},${(cy + Math.sin(a) * r * w * 0.86).toFixed(1)}`;
    });
    return points.join(" ");
  });
}
