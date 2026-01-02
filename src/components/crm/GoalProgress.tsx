
import { Trophy, Star, Target } from 'lucide-react';
import clsx from 'clsx';
import confetti from 'canvas-confetti';
import { useEffect, useState } from 'react';

interface GoalProgressProps {
    currentSales: number;
    targetSales?: number;
}

export function GoalProgress({ currentSales, targetSales = 5 }: GoalProgressProps) {
    const progress = Math.min((currentSales / targetSales) * 100, 100);
    const [celebrated, setCelebrated] = useState(false);

    useEffect(() => {
        if (progress === 100 && !celebrated) {
            setCelebrated(true);
            try {
                if (typeof confetti === 'function') {
                    confetti({
                        particleCount: 150,
                        spread: 60,
                        origin: { y: 0.7 }
                    });
                }
            } catch (e) {
                console.error("Confetti error", e);
            }
        }
    }, [progress, celebrated]);

    let message = "¡Vamos por la primera!";
    if (progress > 0) message = "¡Bien hecho, sigue así!";
    if (progress >= 50) message = "¡Ya llevas la mitad!";
    if (progress >= 80) message = "¡Casi terminas el objetivo!";
    if (progress === 100) message = "¡OBJETIVO CUMPLIDO! 🏆";

    return (
        <div className="bg-white dark:bg-gradient-to-r dark:from-indigo-900/50 dark:to-purple-900/50 border border-border dark:border-indigo-500/30 rounded-xl p-6 relative overflow-hidden shadow-sm">
            {/* Background decoration (Only Dark Mode) */}
            <div className="absolute top-0 right-0 p-4 opacity-10 hidden dark:block">
                <Trophy className="w-32 h-32 text-indigo-400" />
            </div>

            <div className="relative z-10">
                <div className="flex justify-between items-end mb-2">
                    <div>
                        <h3 className="text-lg font-bold flex items-center gap-2 text-foreground dark:text-indigo-100">
                            <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Meta Diaria
                        </h3>
                        <p className="text-sm text-muted-foreground dark:text-indigo-200">{message}</p>
                    </div>
                    <div className="text-right">
                        <span className="text-3xl font-bold text-foreground dark:text-white">{currentSales}</span>
                        <span className="text-sm text-muted-foreground dark:text-indigo-300"> / {targetSales} Ventas</span>
                    </div>
                </div>

                {/* Progress Bar Container */}
                <div className="h-4 w-full bg-gray-100 dark:bg-black/40 rounded-full overflow-hidden border border-black/5 dark:border-white/5">
                    <div
                        className={clsx(
                            "h-full transition-all duration-1000 ease-out relative",
                            progress === 100 ? "bg-gradient-to-r from-yellow-400 to-orange-500" : "bg-gradient-to-r from-indigo-500 to-blue-500"
                        )}
                        style={{ width: `${progress}%` }}
                    >
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite] -skew-x-12 translate-x-[-100%]" />
                    </div>
                </div>

                {/* Milestones indicators */}
                <div className="mt-2 flex justify-between px-1">
                    {[1, 2, 3, 4, 5].map(step => (
                        <div key={step} className="flex flex-col items-center gap-1">
                            <div className={clsx(
                                "w-1.5 h-1.5 rounded-full transition-colors",
                                currentSales >= step ? "bg-indigo-600 dark:bg-indigo-400" : "bg-gray-200 dark:bg-white/10"
                            )} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
