
import { Sparkles, Medal, Shield, Crown } from 'lucide-react';
import clsx from 'clsx';

interface AgentLevelBadgeProps {
    sales: number;
    nps: number;
}

export function AgentLevelBadge({ sales, nps }: AgentLevelBadgeProps) {
    let level = 'Novato';
    let icon = Shield;
    let color = 'text-gray-400';
    let bg = 'bg-gray-500/10';
    let border = 'border-gray-500/30';
    let description = "Sigue mejorando tus métricas";

    // Logic for levels based on Sales AND NPS
    // Master: High Sales + High NPS
    if (sales >= 7 && nps >= 80) {
        level = 'LEYENDA';
        icon = Crown;
        color = 'text-yellow-400';
        bg = 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20';
        border = 'border-yellow-500/50';
        description = "¡Eres un referente para el equipo!";
    } else if (sales >= 5 && nps >= 60) {
        level = 'MASTER';
        icon = Crown;
        color = 'text-purple-400';
        bg = 'bg-purple-500/10';
        border = 'border-purple-500/30';
        description = "Excelente rendimiento y calidad";
    } else if (sales >= 3 && nps >= 40) {
        level = 'PROFESIONAL';
        icon = Medal;
        color = 'text-blue-400';
        bg = 'bg-blue-500/10';
        border = 'border-blue-500/30';
        description = "Buen trabajo constante";
    } else {
        // Novato
        level = 'NOVATO';
        icon = Sparkles;
        color = 'text-slate-400';
        bg = 'bg-slate-500/10';
        border = 'border-slate-500/30';
        description = "Enfócate en subir tus ventas y calidad";
    }

    const Icon = icon;

    return (
        <div className={clsx(
            "flex items-center gap-3 px-4 py-2 rounded-xl border backdrop-blur-sm transition-all animate-in fade-in zoom-in-95",
            bg,
            border
        )}>
            <div className={clsx("p-2 rounded-full bg-black/20", color)}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nivel Actual</p>
                <h3 className={clsx("text-lg font-black tracking-widest", color)}>
                    {level}
                </h3>
                <p className="text-[10px] text-muted-foreground/80 mt-0.5 whitespace-nowrap">{description}</p>
            </div>
        </div>
    );
}
