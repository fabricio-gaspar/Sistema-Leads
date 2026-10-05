export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export function projectMapPoint(latitude: number, longitude: number, zoom: number) {
  const scale = 256 * 2 ** zoom;
  const radians = (Math.max(-85, Math.min(85, latitude)) * Math.PI) / 180;
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + Math.sin(radians)) / (1 - Math.sin(radians))) / (4 * Math.PI)) * scale,
  };
}

export function fitProspectingMap(points: MapCoordinate[], width: number, height: number, padding = 48) {
  if (!points.length) return null;
  const projected = points.map((point) => projectMapPoint(point.latitude, point.longitude, 0));
  const minX = Math.min(...projected.map((point) => point.x));
  const maxX = Math.max(...projected.map((point) => point.x));
  const minY = Math.min(...projected.map((point) => point.y));
  const maxY = Math.max(...projected.map((point) => point.y));
  // Both spans are already pixels at zoom zero: do not multiply by the tile size again.
  const zoomX = Math.log2(Math.max(1, width - padding * 2) / Math.max(0.00001, maxX - minX));
  const zoomY = Math.log2(Math.max(1, height - padding * 2) / Math.max(0.00001, maxY - minY));
  const zoom = points.length === 1 ? 12 : Math.max(0, Math.min(15, Math.floor(Math.min(zoomX, zoomY))));
  const scale = 2 ** zoom;
  return { zoom, centerPixel: { x: ((minX + maxX) / 2) * scale, y: ((minY + maxY) / 2) * scale } };
}
