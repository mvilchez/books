'use client';

import {
  Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { YearlyTrendPoint } from '@/lib/analytics-types';

const nf = new Intl.NumberFormat('es-ES'); // Spanish source data: 327.490
const PRE_2008 = 2007; // PRE_TAB_READING_YEAR_SENTINEL

export default function YearTrendChart({ data }: { data: YearlyTrendPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-400">No books imported yet.</p>;
  }
  return (
    <figure className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <figcaption className="mb-4 text-sm font-semibold text-slate-300">
        Books &amp; pages per reading year
      </figcaption>
      {/* Fixed height is mandatory: ResponsiveContainer measures its parent. */}
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <XAxis
              dataKey="readingYear"
              tickFormatter={(y: number) => (y === PRE_2008 ? '≤2007' : String(y))}
              stroke="#64748b"
            />
            <YAxis yAxisId="books" allowDecimals={false} stroke="#64748b" />
            <YAxis yAxisId="pages" orientation="right" stroke="#64748b" tickFormatter={(n) => nf.format(Number(n))} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(value, key) => (key === 'pages' ? nf.format(Number(value)) : value)}
            />
            <Bar yAxisId="books" dataKey="books" name="Books" fill="#34d399" radius={[3, 3, 0, 0]} />
            <Line yAxisId="pages" dataKey="pages" name="Pages" stroke="#60a5fa" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
