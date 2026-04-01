// Pure scoring functions — no I/O, no side effects

export function getProximityScore(driveTimeMinutes: number): number {
  if (driveTimeMinutes <= 5) return 100
  if (driveTimeMinutes <= 10) return 80
  if (driveTimeMinutes <= 15) return 60
  if (driveTimeMinutes <= 20) return 40
  if (driveTimeMinutes <= 30) return 20
  return 0
}

export function getTypeScore(urgency: string, ambulanceType: string): number {
  const t = ambulanceType?.toUpperCase()
  if (urgency === 'Critical') {
    if (t === 'ALS') return 100
    if (t === 'BLS') return 20
    return 0
  }
  if (urgency === 'Urgent') {
    if (t === 'ALS') return 100
    if (t === 'BLS') return 80
    return 30
  }
  // Scheduled — any type works
  return 100
}

export function getDriverRatingScore(overallScore: number | null): number {
  return overallScore ?? 70
}

export function getFatigueScore(ridesInLast4Hours: number): number {
  if (ridesInLast4Hours === 0) return 100
  if (ridesInLast4Hours === 1) return 90
  if (ridesInLast4Hours === 2) return 75
  if (ridesInLast4Hours === 3) return 55
  if (ridesInLast4Hours === 4) return 30
  return 10
}

export function calculateMatchScore({
  proximityScore,
  typeScore,
  driverRatingScore,
  fatigueScore,
}: {
  proximityScore: number
  typeScore: number
  driverRatingScore: number
  fatigueScore: number
}): number {
  return (
    proximityScore * 0.4 +
    typeScore * 0.3 +
    driverRatingScore * 0.2 +
    fatigueScore * 0.1
  )
}

// Haversine fallback when Distance Matrix is unavailable
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Estimate drive time from straight-line distance (assume ~30 km/h average)
export function estimateDriveTime(km: number): number {
  return Math.max(1, Math.ceil((km / 30) * 60))
}
