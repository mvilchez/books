"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { getAuthorsWithNationality } from "@/lib/books";

type MapDataPoint = {
  country: string;
  countryName: string;
  flag: string;
  bookCount: number;
};

export default function MapPage() {
  const [mapData, setMapData] = useState<MapDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMapData() {
      setLoading(true);
      try {
        const data = await getAuthorsWithNationality();
        setMapData(data);
      } catch (err) {
        setError("Failed to load map data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadMapData();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <p role="status" className="text-sm text-slate-400">Loading map data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-rose-400">
        <p>Error loading map data: {error}</p>
      </div>
    );
  }

  return (
    <DashboardShell
      title="Mapa mundi"
      subtitle="Countries of authors whose books have been read"
      search=""
      userName=""
    >
      <main className="p-6 md:p-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-extrabold text-white mb-6">Mapa mundi</h1>

          {mapData.length === 0 ? (
            <p className="text-slate-400">No author nationality data available yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mapData.map((point) => (
                <div
                  key={point.country}
                  className="group rounded-lg border border-slate-700 bg-slate-800 p-6 hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <img
                      src={point.flag}
                      alt={`Flag: ${point.countryName}`}
                      width={24}
                      height={24}
                      className="shrink-0"
                    />
                    <span className="text-sm font-medium text-slate-200">{point.countryName}</span>
                  </div>
                  <div className="text-3xl font-bold text-white">{point.bookCount}</div>
                  <p className="text-slate-400 mt-1">books</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
            >
              ← Dashboard
            </Link>
          </div>
        </div>
      </main>
    </DashboardShell>
  );
}