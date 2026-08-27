import { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { TendenciaPonto } from '@/pages/dashboard/equipe/equipeUtils';

function fmtMoedaCurta(v: number) {
  if (v >= 1000) return `R$ ${Math.round(v / 1000)}k`;
  return `R$ ${v}`;
}

export default function TendenciaVendasChart({ dados }: { dados: TendenciaPonto[] }) {
  const [modo, setModo] = useState<'receita' | 'vendas'>('receita');

  return (
    <div className="bg-background-50 border border-background-200/70 rounded-xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-foreground-800">Tendência de Vendas</h3>
          <p className="text-[10px] text-foreground-400 uppercase tracking-wider mt-0.5">
            Evolução no período selecionado
          </p>
        </div>
        <div className="flex items-center bg-background-100 rounded-full p-1 self-start">
          {(['receita', 'vendas'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className={`px-3 py-1.5 text-[11px] font-semibold cursor-pointer whitespace-nowrap rounded-full transition-colors ${
                modo === m
                  ? 'bg-background-50 text-foreground-900'
                  : 'text-foreground-500 hover:text-foreground-700'
              }`}
            >
              {m === 'receita' ? 'Receita' : 'Vendas'}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {modo === 'receita' ? (
            <AreaChart data={dados} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="tendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(var(--primary-500))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="oklch(var(--primary-500))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="oklch(var(--foreground-200))"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'oklch(var(--foreground-500))' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                tickFormatter={fmtMoedaCurta}
                tick={{ fontSize: 10, fill: 'oklch(var(--foreground-500))' }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Receita']}
                labelStyle={{ fontSize: 11 }}
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 8,
                  border: '1px solid oklch(var(--foreground-200))',
                }}
              />
              <Area
                type="monotone"
                dataKey="receita"
                stroke="oklch(var(--primary-500))"
                strokeWidth={2.5}
                fill="url(#tendGrad)"
              />
            </AreaChart>
          ) : (
            <BarChart data={dados} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="oklch(var(--foreground-200))"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'oklch(var(--foreground-500))' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'oklch(var(--foreground-500))' }}
                axisLine={false}
                tickLine={false}
                width={30}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(value) => [value, 'Vendas']}
                labelStyle={{ fontSize: 11 }}
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 8,
                  border: '1px solid oklch(var(--foreground-200))',
                }}
              />
              <Bar dataKey="vendas" fill="oklch(var(--accent-500))" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}