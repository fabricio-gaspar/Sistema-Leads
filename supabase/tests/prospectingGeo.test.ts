import { describe, expect, it } from 'vitest';
import { distanceKilometers, filterProspectsByRadius, parseProspectingGeoRadius } from '../functions/_shared/prospectingGeo';

describe('Prospecting map radius', () => {
  it('accepts zero-valued equator coordinates and a bounded radius', () => {
    expect(parseProspectingGeoRadius({ centerLatitude: 0, centerLongitude: 0, raio: 1.5 }))
      .toEqual({ centerLatitude: 0, centerLongitude: 0, raio: 1.5 });
    expect(parseProspectingGeoRadius({})).toBeNull();
    expect(() => parseProspectingGeoRadius({ centerLatitude: 0, raio: 10 })).toThrow('prospecting_radius_invalid');
  });

  it('filters with unrounded Haversine distance and reports unknown coordinates separately', () => {
    const prospects = [
      { id: 'center', latitude: 0, longitude: 0, distance_km: null },
      { id: 'inside', latitude: 0, longitude: 0.05, distance_km: null },
      { id: 'outside', latitude: 0, longitude: 0.1, distance_km: null },
      { id: 'unknown', latitude: null, longitude: null, distance_km: null },
    ];
    const result = filterProspectsByRadius(prospects, { centerLatitude: 0, centerLongitude: 0, raio: 10 });
    expect(result.leads.map((prospect) => prospect.id)).toEqual(['center', 'inside']);
    expect(result.leads[0].distance_km).toBe(0);
    expect(result.leads[1].distance_km).toBeCloseTo(5.56, 2);
    expect(result.diagnostics).toEqual({ rejectedByRadius: 1, missingCoordinates: 1 });
    expect(distanceKilometers(0, 0, 0, 0.1)).toBeGreaterThan(10);
    expect(prospects[0].distance_km).toBeNull();
  });
});
