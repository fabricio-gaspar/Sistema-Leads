import { useEffect, useMemo, useRef, useState } from 'react';
import { fitProspectingMap, projectMapPoint as project } from './prospectingMapGeometry';

export interface ProspectingMapLead {
  id: string;
  nome: string;
  empresa: string;
  localidade: string;
  score: number;
  duplicado: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

interface ProspectingMapProps {
  leads: ProspectingMapLead[];
  selectedIds: string[];
  onSelect: (lead: ProspectingMapLead) => void;
}

const TILE_SIZE = 256;
const MAP_HEIGHT = 360;

function hasCoordinates(lead: ProspectingMapLead): lead is ProspectingMapLead & { latitude: number; longitude: number } {
  return Number.isFinite(lead.latitude) && Number.isFinite(lead.longitude)
    && Math.abs(Number(lead.latitude)) <= 85 && Math.abs(Number(lead.longitude)) <= 180;
}

export default function ProspectingMap({ leads, selectedIds, onSelect }: ProspectingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapWidth, setMapWidth] = useState(720);
  const points = useMemo(() => leads.filter(hasCoordinates), [leads]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const updateWidth = () => setMapWidth(Math.max(280, Math.round(container.clientWidth)));
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [points.length]);

  const map = useMemo(() => {
    if (!points.length) return null;
    const { zoom, centerPixel } = fitProspectingMap(points, mapWidth, MAP_HEIGHT)!;
    const firstTileX = Math.floor((centerPixel.x - mapWidth / 2) / TILE_SIZE);
    const firstTileY = Math.floor((centerPixel.y - MAP_HEIGHT / 2) / TILE_SIZE);
    const columns = Math.ceil(mapWidth / TILE_SIZE) + 1;
    const rows = Math.ceil(MAP_HEIGHT / TILE_SIZE) + 1;
    const tiles = Array.from({ length: columns * rows }, (_, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = firstTileX + column;
      const y = firstTileY + row;
      const world = 2 ** zoom;
      return {
        key: `${zoom}-${x}-${y}`,
        left: x * TILE_SIZE - (centerPixel.x - mapWidth / 2),
        top: y * TILE_SIZE - (centerPixel.y - MAP_HEIGHT / 2),
        src: `https://tile.openstreetmap.org/${zoom}/${((x % world) + world) % world}/${y}.png`,
      };
    });
    return { centerPixel, tiles, zoom };
  }, [mapWidth, points]);

  return (
    <section className="overflow-hidden rounded-xl border border-background-200/70 bg-white">
      <header className="flex items-start justify-between gap-3 border-b border-background-200/70 px-4 py-3">
        <div>
          <h3 className="font-heading text-sm font-bold text-foreground-900">Mapa dos resultados</h3>
          <p className="mt-0.5 text-xs text-foreground-500">
            {points.length ? `${points.length} de ${leads.length} leads com localização exata` : 'A fonte não retornou coordenadas para estes leads'}
          </p>
        </div>
        <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700">Dados da busca</span>
      </header>

      {map ? (
        <div ref={containerRef} className="relative h-[360px] overflow-hidden bg-background-100" aria-label="Mapa dos leads encontrados">
          {map.tiles.map((tile) => (
            <img
              key={tile.key}
              src={tile.src}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute h-64 w-64 max-w-none select-none"
              style={{ left: tile.left, top: tile.top }}
            />
          ))}
          {points.map((lead) => {
            const pixel = project(lead.latitude, lead.longitude, map.zoom);
            const left = pixel.x - map.centerPixel.x + mapWidth / 2;
            const top = pixel.y - map.centerPixel.y + MAP_HEIGHT / 2;
            const selected = selectedIds.includes(lead.id);
            return (
              <button
                key={lead.id}
                type="button"
                onClick={() => onSelect(lead)}
                title={`${lead.empresa} · ${lead.localidade}`}
                className={`absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-[11px] font-bold shadow-md transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                  lead.duplicado
                    ? 'border-background-50 bg-accent-500 text-background-50'
                    : selected
                      ? 'border-background-50 bg-primary-600 text-background-50'
                      : 'border-primary-600 bg-background-50 text-primary-700'
                }`}
                style={{ left, top }}
                aria-label={`Abrir ${lead.empresa}, ${lead.localidade}`}
              >
                {lead.score}
              </button>
            );
          })}
          <div className="absolute bottom-2 left-2 rounded bg-background-50/90 px-2 py-1 text-[10px] text-foreground-600 shadow-sm">
            Marcadores exibem o score. Clique para abrir o lead.
          </div>
          <a className="absolute bottom-2 right-2 rounded bg-background-50/90 px-2 py-1 text-[10px] text-foreground-600 shadow-sm" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            © OpenStreetMap
          </a>
        </div>
      ) : (
        <div className="flex h-[360px] flex-col items-center justify-center bg-[linear-gradient(135deg,rgba(16,185,129,.08),rgba(255,255,255,.9))] px-6 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-700"><i className="ri-map-pin-line text-xl" /></div>
          <p className="text-sm font-semibold text-foreground-800">Localização indisponível nesta resposta</p>
          <p className="mt-1 max-w-xs text-xs leading-5 text-foreground-500">Os resultados sem latitude e longitude continuam disponíveis na lista para revisão e importação.</p>
        </div>
      )}
    </section>
  );
}
