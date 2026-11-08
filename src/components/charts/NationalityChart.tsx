'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CountryStat } from '@/lib/analytics-types';

const PALETTE = ['#34d399', '#60a5fa', '#f59e0b', '#a78bfa', '#f472b6', '#38bdf8', '#fb923c'];

// Regional indicator symbols for flag emojis (ISO 3166-1 alpha-2 codes)
// A=🇦, B=🇧, C=🇨, D=🇩, E=🇪, F=🇫, G=🇭, H=🇮, I=🇯, J=🇰, K=🇱, L=🇲, M=🇳, N=🇴, O=🇵, P=🇵, Q=🇶, R=🇷, S=🇸, T=🇹, U=🇺, V=🇻, W=🇽, X=🇾, Y=🇿
// Flag emoji = regional_indicator_1 + regional_indicator_2
const getFlagEmoji = (countryCode: string) => {
  const base = '\uD83C\uDDEA';
  const letters: Record<string, string> = {
    A: '\uD83C\uDDEA', B: '\uD83C\uDDE7', C: '\uD83C\uDDE8', D: '\uD83C\uDDE9',
    E: '\uD83C\uDDEA', F: '\uD83C\uDDEB', G: '\uD83C\uDDEC', H: '\uD83C\uDDED',
    I: '\uD83C\uDDEE', J: '\uD83C\uDDEF', K: '\uD83C\uDDF0', L: '\uD83C\uDDF1',
    M: '\uD83C\uDDF2', N: '\uD83C\uDDF3', O: '\uD83C\uDDF4', P: '\uD83C\uDDF5',
    Q: '\uD83C\uDDF6', R: '\uD83C\uDDF7', S: '\uD83C\uDDF8', T: '\uD83C\uDDF9',
    U: '\uD83C\uDDEA', V: '\uD83C\uDDEA', W: '\uD83C\uDDEA', X: '\uD83C\uDDEA', Y: '\uD83C\uDDEA', Z: '\uD83C\uDDEA',
  };
  const upper = countryCode.toUpperCase();
  if (upper.length === 2 && letters[upper[0]] && letters[upper[1]]) {
    return letters[upper[0]] + letters[upper[1]];
  }
  return countryCode;
};

export interface NationalityChartData {
  country: string;
  authors: number;
  flagEmoji?: string;
}

export default function NationalityChart({ data }: { data: CountryStat[] }) {
  const slices = data.map((d) => ({
    name: `${getFlagEmoji(d.country)} ${d.country}`,
    books: d.authors,
  }));

  return (
    <figure className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <figcaption className="mb-4 text-sm font-semibold text-slate-300">
        Authors by nationality
      </figcaption>
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