export type ProspectingGeoRadius = { centerLatitude: number; centerLongitude: number; raio: number };

type LocatedProspect = { latitude?: number | null; longitude?: number | null; distance_km?: number | null };

const validCoordinate = (value: unknown, limit: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;

export function parseProspectingGeoRadius(input: Record<string, unknown>, rejectPartial = true): ProspectingGeoRadius | null {
  const supplied = ['centerLatitude', 'centerLongitude', 'raio'].some((key) => input[key] !== undefined);
  if (!supplied) return null;
  const latitude = input.centerLatitude, longitude = input.centerLongitude, radius = input.raio;
  const valid = validCoordinate(latitude, 90) && validCoordinate(longitude, 180)
    && typeof radius === 'number' && Number.isFinite(radius) && radius >= 1 && radius <= 200;
  if (!valid) {
    if (rejectPartial) throw new Error('prospecting_radius_invalid');
    return null;
  }
  return { centerLatitude: latitude, centerLongitude: longitude, raio: radius };
}

export function distanceKilometers(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (latitudeB - latitudeA) * radians;
  const longitudeDelta = (longitudeB - longitudeA) * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA * radians) * Math.cos(latitudeB * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function filterProspectsByRadius<T extends LocatedProspect>(prospects: T[], geo: ProspectingGeoRadius) {
  let rejectedByRadius = 0, missingCoordinates = 0;
  const leads: T[] = [];
  for (const prospect of prospects) {
    if (!validCoordinate(prospect.latitude, 90) || !validCoordinate(prospect.longitude, 180)) {
      missingCoordinates += 1;
      continue;
    }
    const distance = distanceKilometers(geo.centerLatitude, geo.centerLongitude, prospect.latitude, prospect.longitude);
    if (distance > geo.raio) {
      rejectedByRadius += 1;
      continue;
    }
    leads.push({ ...prospect, distance_km: Math.round(distance * 100) / 100 });
  }
  return { leads, diagnostics: { rejectedByRadius, missingCoordinates } };
}
