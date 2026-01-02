
import { AlertCircle, CheckCircle, Smartphone, TrendingUp, UserMinus, RotateCcw, Activity, DollarSign } from 'lucide-react';
import clsx from 'clsx';


interface Threshold {
    optimal: number;
    alert: number;
}

interface TrafficLightConfig {
    dailyContacts: Threshold;
    conversionRate: Threshold;
    churnRate: Threshold;
    recoveryRate: Threshold;
    npsScore: Threshold;
    arpu: Threshold;
}

interface MetricsProps {
    dailyCount: number;
    salesCount: number;
    churnCount: number;
    recoverySales: number;
    recoveryAttempts: number;
    npsScores: number[];
    arpu?: number;
    effectiveCount?: number;
    thresholds?: TrafficLightConfig; // Optional config
}

const DEFAULT_THRESHOLDS: TrafficLightConfig = {
    dailyContacts: { optimal: 40, alert: 30 },
    conversionRate: { optimal: 75, alert: 65 },
    churnRate: { optimal: 10, alert: 15 },
    recoveryRate: { optimal: 50, alert: 40 },
    npsScore: { optimal: 60, alert: 45 },
    arpu: { optimal: 70000, alert: 60000 }
};

export function PerformanceTrafficLight({
    dailyCount,
    salesCount,
    churnCount,
    recoverySales,
    recoveryAttempts,
    npsScores,
    arpu = 0,
    effectiveCount, // New optional prop for real contact conversion
    thresholds = DEFAULT_THRESHOLDS
}: MetricsProps) {

    // --- CALCULATIONS ---
    // Use effectiveCount if provided (Option 2), otherwise fallback to dailyCount (Option 1)
    const calculationBase = effectiveCount !== undefined ? effectiveCount : dailyCount;
    const conversionRate = calculationBase > 0 ? (salesCount / calculationBase) * 100 : 0;

    const churnRate = dailyCount > 0 ? (churnCount / dailyCount) * 100 : 0;
    const recoveryRate = recoveryAttempts > 0 ? (recoverySales / recoveryAttempts) * 100 : 0;

    // NPS Calculation
    const totalNps = npsScores.length;
    const promoters = npsScores.filter(s => s >= 9).length;
    const detractors = npsScores.filter(s => s <= 6).length;
    const nps = totalNps > 0 ? ((promoters - detractors) / totalNps) * 100 : 0;

    // ARPU Estimate (Requires plan data, for now using dummy placeholder if not passed, or removing if not critical yet)
    // Note: To fully implement ARPU visualization here we'd need average plan price data passed in.
    // For now, I'll keep it simple and stick to the requested explicit KPIs, but structure supports adding it easily.

    // --- HELPER FOR STATUS ---
    const getStatus = (value: number, type: keyof TrafficLightConfig) => {
        const t = thresholds[type];

        // Special Logic: Churn (Lower is better)
        if (type === 'churnRate') {
            if (value < t.optimal) return 'optimal';
            if (value <= t.alert) return 'alert';
            return 'critical';
        }

        // Standard Logic (Higher is better)
        if (value > t.optimal) return 'optimal';
        if (value >= t.alert) return 'alert';
        return 'critical';
    };

    const metrics = [
        {
            label: 'Contactos Efectivos',
            val: calculationBase,
            display: calculationBase,
            type: 'dailyContacts',
            icon: Smartphone
        },
        {
            label: 'Tasa Conversión',
            val: conversionRate,
            display: `${conversionRate.toFixed(1)}%`,
            type: 'conversionRate',
            icon: TrendingUp
        },
        {
            label: 'Churn (Bajas)',
            val: churnRate,
            display: `${churnRate.toFixed(1)}%`,
            type: 'churnRate',
            icon: UserMinus
        },
        {
            label: 'Recuperación',
            val: recoveryRate,
            display: `${recoveryRate.toFixed(1)}%`,
            type: 'recoveryRate',
            icon: RotateCcw
        },
        {
            label: 'NPS (Satisf.)',
            val: nps,
            display: nps.toFixed(1),
            type: 'npsScore',
            icon: Activity
        },
        {
            label: 'ARPU (Ticket)',
            val: arpu,
            display: `$${arpu.toLocaleString()}`,
            type: 'arpu',
            icon: DollarSign
        }
    ];

    return (
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                    <Activity className="w-5 h-5 text-indigo-500" />
                </div>
                Semáforo de Rendimiento Crítico
            </h3>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border text-muted-foreground">
                            <th className="text-left font-medium py-3 px-2">KPI</th>
                            <th className="text-right font-medium py-3 px-2">Resultado</th>
                            <th className="text-center font-medium py-3 px-2">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {metrics.map((m: any) => {
                            const status = getStatus(m.val, m.type);
                            return (
                                <tr key={m.label} className="group hover:bg-muted/30 transition-colors">
                                    <td className="py-4 px-2">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-background border border-border text-muted-foreground group-hover:text-foreground transition-colors">
                                                <m.icon className="w-4 h-4" />
                                            </div>
                                            <span className="font-medium">{m.label}</span>
                                        </div>
                                    </td>
                                    <td className="text-right font-bold text-lg py-4 px-2">
                                        {m.display}
                                    </td>
                                    <td className="py-4 px-2">
                                        <div className="flex justify-center">
                                            <StatusBadge status={status} />
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 flex gap-4 justify-center text-xs text-muted-foreground">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Óptimo</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500"></div> Alerta</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Crítico</div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const config = {
        optimal: { bg: 'bg-green-500', text: 'text-green-500', label: 'ÓPTIMO' },
        alert: { bg: 'bg-yellow-500', text: 'text-yellow-500', label: 'ALERTA' },
        critical: { bg: 'bg-red-500', text: 'text-red-500', label: 'CRÍTICO' },
    };

    const current = config[status as keyof typeof config];

    return (
        <span className={clsx(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
            current.text.replace('text-', 'border-').replace('500', '200'),
            current.text.replace('text-', 'bg-').replace('500', '10') // Very light bg
        )}>
            <div className={clsx("w-1.5 h-1.5 rounded-full mr-1.5", current.bg)} />
            {current.label}
        </span>
    );
}

/* 
Logic Reference from Image:
KPI             Meta    Optimo  Alerta  Critico
Contactos       40-50   >40     30-40   <30
Conversion      >75%    >75%    65-75%  <65%
Churn           <15%    <10%    10-15%  >15%
Recuperacion    >45%    >50%    40-50%  <40%
NPS             >50     >60     45-60   <45
*/
