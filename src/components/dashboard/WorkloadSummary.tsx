
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface WorkloadSummaryProps {
    tickets: any[];
}

export const WorkloadSummary: React.FC<WorkloadSummaryProps> = ({ tickets }) => {
    // Calcular distribución por técnico
    const techStats: Record<string, number> = {};

    tickets.forEach(t => {
        const tech = t.nombre_tecnico || 'Sin Asignar';
        techStats[tech] = (techStats[tech] || 0) + 1;
    });

    const data = Object.entries(techStats)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    if (data.length === 0) return null;

    // Dynamic height based on number of items (min 150px, +30px per tech)
    const chartHeight = Math.max(150, data.length * 35);

    return (
        <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm p-6">
            <h3 className="font-black text-xs uppercase tracking-[.2em] text-muted-foreground mb-4">
                Carga de Trabajo por Técnico (Total)
            </h3>
            <div style={{ height: `${chartHeight}px` }} className="w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis
                            dataKey="name"
                            type="category"
                            width={100}
                            tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            cursor={{ fill: 'transparent' }}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={12}>
                            {data.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#94a3b8'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
