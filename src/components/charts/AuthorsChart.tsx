'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AuthorRank } from '@/lib/analytics-types';

export default function AuthorsChart({ data }: { data: AuthorRank[] }) {
  return (
    <figure className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <figcaption className="mb-4 text-sm font-semibold text-slate-300">Most-read authors (top 10)</figcaption>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <XAxis type="number" allowDecimals={false} stroke="#64748b" />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              stroke="#64748b"
              tickFormatter={(n: string) => (n.length > 20 ? `${n.slice(0, 19)}…` : n)}
            />
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} cursor={{ fill: 'rgba(51,65,85,0.4)' }} />
            <Bar dataKey="books" name="Books" fill="#60a5fa" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
