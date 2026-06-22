// Geometry for the pressure-gauge dial. A 270° sweep with the gap at the bottom:
// 0% sits at the lower-left (−135°), 100% at the lower-right (+135°), where angle
// is measured in degrees clockwise from straight up (12 o'clock).

export const GAUGE_START_DEG = -135;
export const GAUGE_SWEEP_DEG = 270;

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Needle angle (deg, 0 = up) for a fraction in [0,1]. */
export function pctToAngle(pct: number): number {
  return GAUGE_START_DEG + clamp01(pct) * GAUGE_SWEEP_DEG;
}

/** Inverse of {@link pctToAngle}; angles in the bottom dead-zone snap to the nearer end. */
export function angleToPct(deg: number): number {
  let rel = ((deg - GAUGE_START_DEG) % 360 + 360) % 360; // 0..360 from the start
  if (rel > GAUGE_SWEEP_DEG) {
    const deadCenter = GAUGE_SWEEP_DEG + (360 - GAUGE_SWEEP_DEG) / 2;
    return rel < deadCenter ? 1 : 0;
  }
  return clamp01(rel / GAUGE_SWEEP_DEG);
}

/** Convert a pointer position (relative to the gauge centre) to a fraction. */
export function pointerToPct(cx: number, cy: number, px: number, py: number): number {
  const deg = (Math.atan2(px - cx, -(py - cy)) * 180) / Math.PI; // 0 = up, clockwise +
  return angleToPct(deg);
}

/** Point on the tick ring for an SVG of the given centre/radius. */
export function tickPoint(pct: number, cx: number, cy: number, r: number): { x: number; y: number } {
  const rad = (pctToAngle(pct) * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}
