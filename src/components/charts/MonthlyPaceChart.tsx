'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonthPacePoint } from '@/lib/analytics-types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function MonthlyPaceChart({ data, withoutDates }: { data: MonthPacePoint[]; withoutDates: number }) {
  return (
    <figure className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <figcaption className="mb-4 text-sm font-semibold text-slate-300">
        Finishes per month
        {withoutDates > 0 && (
          <span className="text-slate-500 font-normal"> · {withoutDates} finished without Fecha Fin</span>
        )}
      </figcaption>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <XAxis dataKey="month" stroke="#64748b" tickFormatter={(m: number) => MONTHS[m - 1]} />
            <YAxis allowDecimals={false} stroke="#64748b" />
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
            <Line type="monotone" dataKey="books" name="Books finished" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
