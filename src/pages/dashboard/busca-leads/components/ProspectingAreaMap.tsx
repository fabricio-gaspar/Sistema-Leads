import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { projectMapPoint } from './prospectingMapGeometry';

export interface ProspectingAreaCenter {
  latitude: number;
  longitude: number;
}

interface ProspectingAreaMapProps {
  center: ProspectingAreaCenter | null;
  radiusKm: number;
  onCenterChange: (center: ProspectingAreaCenter) => void;
}

const TILE_SIZE = 256;
const BRAZIL_CENTER = { latitude: -15.8, longitude: -47.9 };
const INITIAL_ZOOM = 4;
const MIN_ZOOM = 3;
const MAX_ZOOM = 15;

function validCenter(center: ProspectingAreaCenter | null): center is ProspectingAreaCenter {
  return center !== null
    && Number.isFinite(center.latitude)
    && Number.isFinite(center.longitude)
    && Math.abs(center.latitude) <= 85
    && Math.abs(center.longitude) <= 180;
}

// eslint-disable-next-line react-refresh/only-export-components -- Pure map geometry is exercised directly by the focused tests.
export function unprojectMapPoint(x: number, y: number, zoom: number): ProspectingAreaCenter {
  const scale = TILE_SIZE * 2 ** zoom;
  const longitude = (((x / scale) * 360) % 360 + 360) % 360 - 180;
  const latitude = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale))) * 180 / Math.PI;
  return {
    latitude: Math.max(-85, Math.min(85, latitude)),
    longitude,
  };
}

// eslint-disable-next-line react-refresh/only-export-components -- Pure map geometry is exercised directly by the focused tests.
export function radiusKmToPixels(radiusKm: number, latitude: number, zoom: number): number {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) return 0;
  const latitudeRadians = Math.max(-85, Math.min(85, latitude)) * Math.PI / 180;
  const circumferenceKm = 40075.016686 * Math.max(0.08, Math.cos(latitudeRadians));
  return radiusKm * TILE_SIZE * 2 ** zoom / circumferenceKm;
}

export default function ProspectingAreaMap({ center, radiusKm, onCenterChange }: ProspectingAreaMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedCenter = validCenter(center) ? center : null;
  const selectedLatitude = selectedCenter?.latitude;
  const selectedLongitude = selectedCenter?.longitude;
  const [viewCenter, setViewCenter] = useState<ProspectingAreaCenter>(selectedCenter ?? BRAZIL_CENTER);
  const [zoom, setZoom] = useState(selectedCenter ? 10 : INITIAL_ZOOM);
  const [dimensions, setDimensions] = useState({ width: 720, height: 320 });

  useEffect(() => {
    if (selectedLatitude !== undefined && selectedLongitude !== undefined) {
      setViewCenter({ latitude: selectedLatitude, longitude: selectedLongitude });
    } else {
      setViewCenter(BRAZIL_CENTER);
      setZoom(INITIAL_ZOOM);
    }
  }, [selectedLatitude, selectedLongitude]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;
    const updateDimensions = () => {
      const width = Math.max(1, Math.round(element.clientWidth));
      const height = Math.max(1, Math.round(element.clientHeight));
      setDimensions((current) => current.width === width && current.height === height ? current : { width, height });
    };
    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const map = useMemo(() => {
    const worldTiles = 2 ** zoom;
    const centerPixel = projectMapPoint(viewCenter.latitude, viewCenter.longitude, zoom);
    const left = centerPixel.x - dimensions.width / 2;
    const top = centerPixel.y - dimensions.height / 2;
    const firstTileX = Math.floor(left / TILE_SIZE);
    const firstTileY = Math.floor(top / TILE_SIZE);
    const columns = Math.ceil(dimensions.width / TILE_SIZE) + 2;
    const rows = Math.ceil(dimensions.height / TILE_SIZE) + 2;
    const tiles = Array.from({ length: columns * rows }, (_, index) => {
      const tileX = firstTileX + index % columns;
      const tileY = firstTileY + Math.floor(index / columns);
      if (tileY < 0 || tileY >= worldTiles) return null;
      return {
        key: `${zoom}-${tileX}-${tileY}`,
        left: tileX * TILE_SIZE - left,
        top: tileY * TILE_SIZE - top,
        src: `https://tile.openstreetmap.org/${zoom}/${((tileX % worldTiles) + worldTiles) % worldTiles}/${tileY}.png`,
      };
    }).filter((tile): tile is NonNullable<typeof tile> => tile !== null);
    return { centerPixel, tiles };
  }, [dimensions.height, dimensions.width, viewCenter.latitude, viewCenter.longitude, zoom]);

  const marker = useMemo(() => {
    if (selectedLatitude === undefined || selectedLongitude === undefined) return null;
    const point = projectMapPoint(selectedLatitude, selectedLongitude, zoom);
    const worldPixels = TILE_SIZE * 2 ** zoom;
    const horizontalOffset = ((point.x - map.centerPixel.x + worldPixels * 1.5) % worldPixels) - worldPixels / 2;
    return {
      left: dimensions.width / 2 + horizontalOffset,
      top: dimensions.height / 2 + point.y - map.centerPixel.y,
      radiusPixels: radiusKmToPixels(radiusKm, selectedLatitude, zoom),
    };
  }, [dimensions.height, dimensions.width, map.centerPixel.x, map.centerPixel.y, radiusKm, selectedLatitude, selectedLongitude, zoom]);

  const selectAtPixel = (x: number, y: number, magnify: boolean) => {
    const next = unprojectMapPoint(
      map.centerPixel.x + x - dimensions.width / 2,
      map.centerPixel.y + y - dimensions.height / 2,
      zoom,
    );
    setViewCenter(next);
    onCenterChange(next);
    if (magnify) setZoom((current) => current < 10 ? Math.min(10, current + 2) : current);
  };

  const handleMapClick = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    selectAtPixel(event.clientX - bounds.left, event.clientY - bounds.top, true);
  };

  const handleMapKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectAtPixel(dimensions.width / 2, dimensions.height / 2, true);
      return;
    }
    const distance = event.shiftKey ? 1 : 10;
    const offsets: Record<string, [number, number]> = {
      ArrowUp: [0, -distance],
      ArrowDown: [0, distance],
      ArrowLeft: [-distance, 0],
      ArrowRight: [distance, 0],
    };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    const current = selectedCenter
      ? projectMapPoint(selectedCenter.latitude, selectedCenter.longitude, zoom)
      : map.centerPixel;
    const next = unprojectMapPoint(current.x + offset[0], current.y + offset[1], zoom);
    setViewCenter(next);
    onCenterChange(next);
  };

  const changeZoom = (direction: -1 | 1) => {
    setZoom((current) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current + direction)));
    if (selectedCenter) setViewCenter(selectedCenter);
  };

  return (
    <section className="overflow-hidden rounded-xl border border-background-200/70 bg-white" aria-label="Área geográfica da busca">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-background-200/70 px-4 py-3">
        <div>
          <h3 className="font-heading text-sm font-bold text-foreground-900">Centro e raio da busca</h3>
          <p id="prospecting-area-map-instructions" className="mt-0.5 text-xs leading-5 text-foreground-600">
            Clique no mapa para marcar o centro. Clique novamente para ajustar; use +/− e as setas do teclado para refinar.
          </p>
        </div>
        <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700">Raio: {radiusKm} km</span>
      </header>
      <div ref={containerRef} className="relative h-[280px] overflow-hidden bg-background-100 sm:h-[340px]">
        <div
          role="button"
          tabIndex={0}
          aria-label="Selecionar o centro da busca no mapa"
          aria-describedby="prospecting-area-map-instructions"
          onClick={handleMapClick}
          onKeyDown={handleMapKeyDown}
          className="absolute inset-0 cursor-crosshair overflow-hidden focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
        >
          {map.tiles.map((tile) => (
            <img key={tile.key} src={tile.src} alt="" aria-hidden="true" draggable={false} className="pointer-events-none absolute h-64 w-64 max-w-none select-none" style={{ left: tile.left, top: tile.top }} />
          ))}
          {marker && <>
            <span aria-hidden="true" className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary-700 bg-primary-500/20" style={{ left: marker.left, top: marker.top, width: marker.radiusPixels * 2, height: marker.radiusPixels * 2 }} />
            <span aria-hidden="true" className="pointer-events-none absolute z-10 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-primary-700 text-white shadow-sm" style={{ left: marker.left, top: marker.top }}><i className="ri-map-pin-fill text-sm" /></span>
          </>}
        </div>
        <div className="absolute right-3 top-3 z-20 flex flex-col overflow-hidden rounded-lg border border-background-300 bg-white shadow-sm" aria-label="Controles do mapa">
          <button type="button" onClick={() => changeZoom(1)} disabled={zoom >= MAX_ZOOM} aria-label="Aproximar mapa" className="h-10 w-10 text-lg font-semibold text-foreground-800 hover:bg-background-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 disabled:opacity-40">+</button>
          <button type="button" onClick={() => changeZoom(-1)} disabled={zoom <= MIN_ZOOM} aria-label="Afastar mapa" className="h-10 w-10 border-t border-background-200 text-lg font-semibold text-foreground-800 hover:bg-background-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 disabled:opacity-40">−</button>
        </div>
        <button type="button" onClick={() => { setViewCenter(BRAZIL_CENTER); setZoom(INITIAL_ZOOM); }} className="absolute bottom-3 left-3 z-20 rounded-lg border border-background-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-foreground-700 shadow-sm hover:bg-background-100 focus:outline-none focus:ring-2 focus:ring-primary-500">Ver Brasil</button>
        <a className="absolute bottom-3 right-3 z-20 rounded bg-white/95 px-2 py-1 text-[10px] text-foreground-600" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
      </div>
      <p className="border-t border-background-200/70 px-4 py-2 text-xs text-foreground-600" role="status">
        {selectedCenter ? `Centro selecionado manualmente: ${selectedCenter.latitude.toFixed(4)}, ${selectedCenter.longitude.toFixed(4)}. O círculo mostra aproximadamente ${radiusKm} km; o filtro será validado no servidor.` : 'Nenhum centro selecionado. Marque um ponto antes de buscar por raio.'}
      </p>
    </section>
  );
}
