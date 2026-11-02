'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { CountryStat } from '@/lib/analytics-types';
import { WORLD_COUNTRIES } from '@/lib/world-map';

const WIDTH = 960;
const HEIGHT = 500;

const nf = new Intl.NumberFormat('es-ES');

const project = ([lon, lat]: [number, number]): [number, number] => [
  ((lon + 180) / 360) * WIDTH,
  ((90 - lat) / 180) * HEIGHT,
];

function ringPath(ring: number[][]): string {
  const points = ring.map(([lon, lat]) => project([lon, lat]));
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L${points[i][0]},${points[i][1]}`;
  }
  return d + 'Z';
}

function geometryPath(geometry: number[][][]): string {
  return geometry.map(ringPath).join('');
}

/** Fill by book count — darker means more books from that country. */
function booksFill(books: number): string {
  if (books >= 50) return '#059669';
  if (books >= 10) return '#10b981';
  return '#34d399';
}

type Tip = {
  code: string;
  name: string;
  authors: number;
  books: number;
  x: number;
  y: number;
} | null;

export default function CountryMap({
  data,
  className,
}: {
  data: CountryStat[];
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const byCode = useMemo(
    () => new Map(data.map((d) => [d.country, d])),
    [data]
  );
  const [tip, setTip] = useState<Tip>(null);

  const show = useCallback(
    (e: React.MouseEvent, country: (typeof WORLD_COUNTRIES)[number]) => {
      const stats = byCode.get(country.code);
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setTip({
        code: country.code,
        name: country.name,
        authors: stats?.authors ?? 0,
        books: stats?.books ?? 0,
        x: e.clientX - rect.left + 10,
        y: e.clientY - rect.top + 10,
      });
    },
    [byCode]
  );

  const hide = useCallback(() => setTip(null), []);

  return (
    <div
      ref={containerRef}
      className={`relative ${className ?? ''}`}
      aria-label="Mapa mundi"
    >
      <svg
        role="img"
        aria-label="Authors and books read per author country"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height="100%"
        style={{ display: 'block' }}
      >
        {WORLD_COUNTRIES.map((country) => {
          const stats = byCode.get(country.code);
          const hasData = !!stats;
          return (
            <path
              key={country.code}
              d={geometryPath(country.geometry)}
              fill={hasData ? booksFill(stats.books) : '#334155'}
              stroke="#475569"
              strokeWidth={0.5}
              fillOpacity={hasData ? 1 : 0.55}
              onMouseEnter={(e) => show(e, country)}
              onMouseMove={(e) => show(e, country)}
              onMouseLeave={hide}
            />
          );
        })}
      </svg>
      {tip && (
        <div className="absolute z-50 pointer-events-none" style={{ left: tip.x, top: tip.y }}>
          <div className="rounded bg-slate-900/95 border border-slate-600 px-2.5 py-1.5 text-xs text-slate-100 shadow-lg">
            <div className="flex items-center gap-1.5">
              <img
                src={`https://flagcdn.com/${tip.code.toLowerCase()}.svg`}
                alt=""
                width={16}
                height={11}
                draggable={false}
              />
              <span className="font-semibold">{tip.name}</span>
            </div>
            {tip.books > 0 ? (
              <div className="mt-0.5 text-slate-300">
                {tip.authors} authors · {nf.format(tip.books)} books
              </div>
            ) : (
              <p className="mt-0.5 text-slate-400/80">No books read yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
