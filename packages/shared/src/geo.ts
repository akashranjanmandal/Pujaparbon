export interface Point { lat: number; lng: number }
export interface Fence extends Point { radiusM: number }

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle (haversine) distance in metres. */
export function distanceMeters(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type GeofenceReason = "OK" | "OUTSIDE_GEOFENCE" | "LOW_ACCURACY";

export function checkGeofence(
  pos: Point & { accuracyM: number },
  fence: Fence,
): { allowed: boolean; distanceM: number; reason: GeofenceReason } {
  const distanceM = Math.round(distanceMeters(pos, fence));
  if (pos.accuracyM > fence.radiusM) return { allowed: false, distanceM, reason: "LOW_ACCURACY" };
  if (distanceM > fence.radiusM) return { allowed: false, distanceM, reason: "OUTSIDE_GEOFENCE" };
  return { allowed: true, distanceM, reason: "OK" };
}
