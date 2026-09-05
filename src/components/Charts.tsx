"use client";

import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, Legend } from "recharts";
import { Metric } from "@/data/dashboard";

export function MonthlyChart({ metric }: { metric: Metric }) {
  return (
    <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-soft">
      <div className="mb-5">
        <p className="text-sm font-medium text-slate-500">Perkembangan Bulanan</p>
        <h3 className="text-xl font-semibold text-ink">Target vs Capaian {metric.title}</h3>
      </div>
      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={metric.monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip />
            <Legend />
            <Bar dataKey="target" fill="#FDBA74" radius={[8, 8, 0, 0]} />
            <Bar dataKey="achievement" fill={metric.color} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function RegionalChart({ metric }: { metric: Metric }) {
  return (
    <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-soft">
      <div className="mb-5">
        <p className="text-sm font-medium text-slate-500">Sebaran Wilayah</p>
        <h3 className="text-xl font-semibold text-ink">Distribusi Capaian {metric.shortTitle}</h3>
      </div>
      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={metric.regions} dataKey="value" nameKey="name" innerRadius={72} outerRadius={112} paddingAngle={3}>
              {metric.regions.map((entry, index) => (
                <Cell key={entry.name} fill={[metric.color, "#FB923C", "#FDBA74", "#FED7AA", "#FFEDD5"][index]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
