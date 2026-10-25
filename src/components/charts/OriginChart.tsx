'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { OriginShare } from '@/lib/analytics-types';

const PALETTE = ['#34d399', '#60a5fa', '#f59e0b', '#a78bfa', '#f472b6', '#38bdf8', '#fb923c'];

export default function OriginChart({ data }: { data: OriginShare[] }) {
  const slices = data.map((d) => ({ name: d.origin, books: d.books }));
  return (
    <figure className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <figcaption className="mb-4 text-sm font-semibold text-slate-300">Origin mix (completed)</figcaption>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="books" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
              {slices.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}