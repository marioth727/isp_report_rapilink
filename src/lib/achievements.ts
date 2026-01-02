import type { CRMInteraction } from '../types';

export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string; // Emoji for simplicity or Lucide icon name
    color: string;
}

export const ACHIEVEMENTS: Record<string, Achievement> = {
    FIRST_BLOOD: {
        id: 'FIRST_BLOOD',
        title: 'Primera Sangre',
        description: 'Realizaste tu primera venta del día.',
        icon: '🩸',
        color: 'text-red-500 bg-red-500/10 border-red-500/20'
    },
    DAILY_GOAL: {
        id: 'DAILY_GOAL',
        title: 'Misión Cumplida',
        description: 'Alcanzaste tu meta diaria de ventas.',
        icon: '🎯',
        color: 'text-green-500 bg-green-500/10 border-green-500/20'
    },
    SNIPER: {
        id: 'SNIPER',
        title: 'Francotirador',
        description: 'Más de 5 llamadas con >50% de efectividad.',
        icon: '🦅',
        color: 'text-blue-500 bg-blue-500/10 border-blue-500/20'
    },
    // Future expansion
    // STREAK_3: { ... } 
};

export function calculateAchievements(interactions: CRMInteraction[], dailyGoal: number): string[] {
    const unlocked: string[] = [];

    const sales = interactions.filter(i => i.result === 'Aceptó Migración');
    const totalCalls = interactions.length;

    // 1. First Blood
    if (sales.length >= 1) {
        unlocked.push('FIRST_BLOOD');
    }

    // 2. Daily Goal
    if (sales.length >= dailyGoal) {
        unlocked.push('DAILY_GOAL');
    }

    // 3. Sniper
    // Effective definition matches Dashboard logic roughly: Sales / Total (simplified for this achievement)
    // Or we can use the strict definition if we passed effective count. 
    // Let's stick to Sales / Total interactions for "Sniper" as it implies high precision on *any* shot.
    if (totalCalls >= 5) {
        const conversion = (sales.length / totalCalls);
        if (conversion >= 0.5) {
            unlocked.push('SNIPER');
        }
    }

    return unlocked;
}
