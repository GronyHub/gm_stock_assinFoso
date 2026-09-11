// Grony Multimedia, Assin Fosu -- GhanaPostGPS CR-0008-0496
export const SHOP_LAT = 5.69648
export const SHOP_LNG = -1.27541
export const ALLOWED_RADIUS_METERS = 150
// A device's own GPS fix comes with a self-reported accuracy radius
// (GeolocationPosition.coords.accuracy, in meters) -- a weak/indoor fix can
// easily be 100-200m off, which was rejecting staff genuinely standing at
// the shop with "too far away" on phones with a poor lock. Capped so a
// wildly inaccurate fix (an IP-based fallback can report accuracy in the
// thousands of meters) can't blow the geofence open entirely.
export const ACCURACY_TOLERANCE_CAP_METERS = 100

/** Distance in meters between two lat/lng points (Haversine formula). */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Allowed distance for a clock-in, widened by the device's reported GPS accuracy (capped). */
export function allowedRadiusMeters(accuracy: number | null | undefined): number {
  const tolerance = typeof accuracy === 'number' && isFinite(accuracy) && accuracy > 0
    ? Math.min(accuracy, ACCURACY_TOLERANCE_CAP_METERS)
    : 0
  return ALLOWED_RADIUS_METERS + tolerance
}
