'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CumulativePoint } from '@/lib/analytics-types';

const nf = new Intl.NumberFormat('es-ES');
const PRE_2008 = 2007;

export default function CumulativeTrendChart({ data }: { data: CumulativePoint[] }) {
  if (data.length === 0) return <p className="text-sm text-slate-400">No data.</p>;
  return (
    <figure className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <figcaption className="mb-4 text-sm font-semibold text-slate-300">Cumulative books &amp; pages</figcaption>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="readingYear" tickFormatter={(y: number) => (y === PRE_2008 ? '≤2007' : String(y))} stroke="#64748b" />
            <YAxis yAxisId="books" allowDecimals={false} stroke="#64748b" />
            <YAxis yAxisId="pages" orientation="right" stroke="#64748b" tickFormatter={(n) => nf.format(Number(n))} />
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
            <Area yAxisId="books" dataKey="cumulativeBooks" name="Books" stroke="#34d399" fill="#34d39933" />
            <Area yAxisId="pages" dataKey="cumulativePages" name="Pages" stroke="#60a5fa" fill="#60a5fa33" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}