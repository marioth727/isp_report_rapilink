import { ACHIEVEMENTS } from '../../lib/achievements';
import clsx from 'clsx';
import { Trophy } from 'lucide-react';

interface MedalCaseProps {
    unlockedIds: string[];
}

export function MedalCase({ unlockedIds }: MedalCaseProps) {
    const unlockedCount = unlockedIds.length;
    const totalCount = Object.keys(ACHIEVEMENTS).length;

    return (
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    Vitrina de Trofeos
                </h3>
                <span className="text-xs font-medium bg-secondary px-2 py-1 rounded-full text-muted-foreground">
                    {unlockedCount} / {totalCount} Desbloqueados
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {Object.values(ACHIEVEMENTS).map((achievement) => {
                    const isUnlocked = unlockedIds.includes(achievement.id);

                    return (
                        <div
                            key={achievement.id}
                            className={clsx(
                                "flex flex-col items-center text-center p-4 rounded-lg border transition-all duration-300",
                                isUnlocked
                                    ? `bg-background ${achievement.color} scale-100 opacity-100 shadow-sm`
                                    : "bg-muted/20 border-border opacity-50 grayscale scale-95"
                            )}
                        >
                            <div className="text-4xl mb-3 filter drop-shadow-sm">
                                {achievement.icon}
                            </div>
                            <h4 className={clsx(
                                "font-bold text-sm mb-1",
                                isUnlocked ? "text-foreground" : "text-muted-foreground"
                            )}>
                                {achievement.title}
                            </h4>
                            <p className="text-xs text-muted-foreground leading-tight">
                                {achievement.description}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
