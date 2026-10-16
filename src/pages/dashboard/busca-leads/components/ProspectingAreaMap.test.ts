import { describe, expect, it } from 'vitest';

describe('prospecting search area map geometry', () => {
  it('converts a clicked map pixel to latitude and longitude at the current zoom', async () => {
    const { unprojectMapPoint } = await import('./ProspectingAreaMap');
    expect(unprojectMapPoint(2304, 2048, 4)).toEqual({ latitude: 0, longitude: 22.5 });
  });

  it('draws a geographic radius using latitude and zoom, not a fixed screen size', async () => {
    const { radiusKmToPixels } = await import('./ProspectingAreaMap');
    expect(radiusKmToPixels(10, 0, 10)).toBeCloseTo(65.41, 1);
    expect(radiusKmToPixels(10, 60, 10)).toBeCloseTo(130.83, 1);
  });
});
