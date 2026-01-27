import { Activity, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { WorkflowService } from '../../lib/workflowService';
import clsx from 'clsx';

interface OperationsHeaderProps {
    title: string;
    description: string;
    onSyncComplete?: () => void;
    customAction?: React.ReactNode;
}

export function OperationsHeader({ title, description, onSyncComplete, customAction }: OperationsHeaderProps) {
    const [isSyncing, setIsSyncing] = useState(false);

    const handleAutoSync = async (forceFull: boolean = false) => {
        setIsSyncing(true);
        try {
            await WorkflowService.syncWithWispHub(forceFull);
            if (onSyncComplete) onSyncComplete();
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-zinc-100 pb-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-3">
                    <Activity className="text-zinc-900" size={24} />
                    {title}
                </h1>
                <p className="text-zinc-500 text-sm font-medium ml-9">{description}</p>
            </div>
            <div className="flex gap-3 items-center ml-9 md:ml-0">
                {customAction}
                <button
                    onClick={() => handleAutoSync(false)}
                    disabled={isSyncing}
                    className={clsx(
                        "px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wide flex items-center gap-2 transition-all border",
                        isSyncing ? "bg-zinc-100 text-zinc-400 border-zinc-200" : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 shadow-sm"
                    )}
                    title="Sincronización rápida (últimos 7 días)"
                >
                    <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
                    {isSyncing ? "Sincronizando..." : "Rápida (7d)"}
                </button>
                <button
                    onClick={() => handleAutoSync(true)}
                    disabled={isSyncing}
                    className={clsx(
                        "px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wide flex items-center gap-2 transition-all shadow-sm hover:shadow",
                        isSyncing ? "bg-zinc-100 text-zinc-400" : "bg-zinc-900 text-white hover:bg-black"
                    )}
                    title="Sincronización TOTAL (Sin límite de fecha - Trae TODO el historial)"
                >
                    <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
                    {isSyncing ? "Descargando..." : "Total (∞)"}
                </button>
            </div>
        </header>
    );
}
