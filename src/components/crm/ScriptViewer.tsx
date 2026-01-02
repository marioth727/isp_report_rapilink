
import { BookOpen, MessageCircle, ShieldAlert } from 'lucide-react';
import { SALES_SCRIPTS, OBJECTION_HANDLING } from '../../data/salesScripts';

interface ScriptViewerProps {
    category: string;
    objection: string | null;
}

export function ScriptViewer({ category, objection }: ScriptViewerProps) {
    const script = SALES_SCRIPTS[category as keyof typeof SALES_SCRIPTS];
    const objectionData = objection ? OBJECTION_HANDLING[objection as keyof typeof OBJECTION_HANDLING] : null;

    if (!category && !objection) {
        return (
            <div className="bg-muted/30 border border-dashed border-border rounded-xl p-6 text-center text-muted-foreground">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Selecciona una categoría para ver el guión de venta sugerido.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 h-full flex flex-col">
            {/* Objection Handling Card (High Priority if active) */}
            {objectionData && (
                <div className="bg-red-50 dark:bg-red-900/10 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 mb-2 text-red-700 dark:text-red-400 font-bold">
                        <ShieldAlert className="w-5 h-5" />
                        <span>Manejo de Objeción: "{objection}"</span>
                    </div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-600/70">
                        Estrategia: {objectionData.strategy}
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap bg-background/50 p-3 rounded-md border border-red-100 dark:border-red-800 font-medium max-h-[500px] overflow-y-auto custom-scrollbar">
                        {objectionData.response}
                    </p>
                </div>
            )}

            {/* Sales Script Card */}
            {script ? (
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col">
                    <div className="bg-primary/10 p-3 border-b border-border flex items-center justify-between">
                        <h4 className="font-semibold text-primary flex items-center gap-2">
                            <MessageCircle className="w-4 h-4" />
                            Guión: {script.title}
                        </h4>
                    </div>

                    <div className="p-4 space-y-4 overflow-y-auto flex-1">
                        {script.steps.map((step, idx) => (
                            <div key={idx} className="relative pl-4 border-l-2 border-primary/20 hover:border-primary transition-colors group">
                                <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-primary/20 group-hover:bg-primary transition-colors" />
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                                    {step.label}
                                </span>
                                <p className="text-sm text-foreground leading-relaxed">
                                    {step.text}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="bg-muted/30 p-2 text-center border-t border-border">
                        <p className="text-xs text-muted-foreground">🎯 Objetivo: Seguir la estructura pero sonar natural.</p>
                    </div>
                </div>
            ) : (
                !objectionData && (
                    <div className="bg-muted/30 border border-dashed border-border rounded-xl p-6 text-center text-muted-foreground">
                        <p>No hay guión específico para esta categoría.</p>
                    </div>
                )
            )}
        </div>
    );
}
