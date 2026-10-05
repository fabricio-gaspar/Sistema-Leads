import { describe, expect, it } from 'vitest';
import { fitProspectingMap, projectMapPoint } from './prospectingMapGeometry';

describe('prospecting map geometry', () => {
  const points = [
    { latitude: -23.58, longitude: -46.68 },
    { latitude: -23.49, longitude: -46.52 },
    { latitude: -23.61, longitude: -46.69 },
  ];

  it('fits city results instead of collapsing markers at continent zoom', () => {
    const map = fitProspectingMap(points, 720, 360)!;
    expect(map.zoom).toBeGreaterThanOrEqual(10);
    const first = projectMapPoint(points[0].latitude, points[0].longitude, map.zoom);
    const second = projectMapPoint(points[1].latitude, points[1].longitude, map.zoom);
    expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThan(32);
  });

  it('keeps every point within padding on narrow and wide screens', () => {
    for (const width of [280, 720, 1600]) {
      const map = fitProspectingMap(points, width, 360)!;
      for (const point of points) {
        const pixel = projectMapPoint(point.latitude, point.longitude, map.zoom);
        expect(Math.abs(pixel.x - map.centerPixel.x)).toBeLessThanOrEqual(width / 2 - 48);
        expect(Math.abs(pixel.y - map.centerPixel.y)).toBeLessThanOrEqual(180 - 48);
      }
    }
  });

  it('supports empty, single and identical coordinates without invalid geometry', () => {
    expect(fitProspectingMap([], 720, 360)).toBeNull();
    expect(fitProspectingMap([points[0]], 720, 360)?.zoom).toBe(12);
    expect(fitProspectingMap([points[0], points[0]], 720, 360)?.zoom).toBe(15);
  });
});
