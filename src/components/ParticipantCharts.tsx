"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#F97316", "#06B6D4", "#EC4899", "#F59E0B", "#84B83C", "#FF8A00", "#6D3BB5"];
const formatNumber = (value: number) => new Intl.NumberFormat("id-ID").format(value);

type ChartDatum = { name: string; value: number };

export function ParticipantCharts({ programData, asnafData }: { programData: ChartDatum[]; asnafData: ChartDatum[] }) {
  const programTotal = programData.reduce((sum, item) => sum + item.value, 0);
  const asnafTotal = asnafData.reduce((sum, item) => sum + item.value, 0);
  const programsWithPercentage = programData.map((item) => ({ ...item, percentage: programTotal > 0 ? (item.value / programTotal) * 100 : 0 }));
  const asnafWithPercentage = asnafData.map((item) => ({ ...item, percentage: asnafTotal > 0 ? (item.value / asnafTotal) * 100 : 0 }));
  return (
    <div className="grid gap-5 lg:grid-cols-2 xl:col-span-2">
      <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-soft"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#F2662F]">Analisis Program</p><h2 className="mt-1 text-lg font-bold text-ink">Distribusi Peserta per Program</h2></div><div className="h-[290px]"><ResponsiveContainer><PieChart><Pie data={programsWithPercentage} dataKey="value" nameKey="name" innerRadius={62} outerRadius={94} paddingAngle={2} labelLine={false} label={({ percent = 0 }) => Number(percent) >= 0.035 ? `${(Number(percent) * 100).toFixed(1)}%` : ""}>{programsWithPercentage.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => formatNumber(Number(value))} /><Legend align="left" iconSize={8} wrapperStyle={{ fontSize: 10, textAlign: "left", paddingLeft: 8 }} formatter={(value) => { const item = programsWithPercentage.find((candidate) => candidate.name === value); return item ? `${value} (${item.percentage.toFixed(1)}%)` : value; }} /></PieChart></ResponsiveContainer></div></div>
      <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-soft"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#F2662F]">Analisis Asnaf</p><h2 className="mt-1 text-lg font-bold text-ink">Komposisi Peserta berdasarkan Asnaf</h2></div><div className="mt-3 h-[290px]"><ResponsiveContainer><BarChart data={asnafWithPercentage} layout="vertical" margin={{ left: 12, right: 56 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" /><XAxis type="number" tickFormatter={(value) => formatNumber(Number(value))} tick={{ fontSize: 9 }} /><YAxis dataKey="name" type="category" width={82} tick={{ fontSize: 9 }} /><Tooltip formatter={(value) => formatNumber(Number(value))} /><Bar dataKey="value" name="Peserta" fill="#F2662F" radius={[0, 5, 5, 0]}><LabelList dataKey="percentage" position="right" formatter={(value: unknown) => `${Number(value).toFixed(1)}%`} fill="#9A3412" fontSize={10} fontWeight={700} /></Bar></BarChart></ResponsiveContainer></div></div>
    </div>
  );
}
