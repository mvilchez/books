'use client';

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RatingDistribution } from '@/lib/analytics-types';

export default function RatingChart({ data }: { data: RatingDistribution }) {
  return (
    <figure className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <figcaption className="mb-4 text-sm font-semibold text-slate-300">
        Rating distribution (0–10)
        <span className="text-slate-500 font-normal"> · {data.unrated} unrated</span>
      </figcaption>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.buckets} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <XAxis dataKey="rating" stroke="#64748b" />
            <YAxis allowDecimals={false} stroke="#64748b" />
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} cursor={{ fill: 'rgba(51,65,85,0.4)' }} />
            <Bar dataKey="books" name="Books" fill="#f59e0b" radius={[3, 3, 0, 0]}>
              {data.buckets.map((b) => (
                <Cell key={b.rating} fill={b.rating >= 8 ? '#34d399' : b.rating >= 6 ? '#f59e0b' : '#f87171'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
