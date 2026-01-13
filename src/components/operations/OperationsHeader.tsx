import { Activity, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { WorkflowService } from '../../lib/workflowService';
import clsx from 'clsx';

interface OperationsHeaderProps {
    title: string;
    description: string;
    onSyncComplete?: () => void;
}

export function OperationsHeader({ title, description, onSyncComplete }: OperationsHeaderProps) {
    const [isSyncing, setIsSyncing] = useState(false);

    const handleAutoSync = async () => {
        setIsSyncing(true);
        try {
            await WorkflowService.syncWithWispHub();
            if (onSyncComplete) onSyncComplete();
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                    <Activity className="text-primary" size={32} />
                    {title}
                </h1>
                <p className="text-muted-foreground font-medium">{description}</p>
            </div>
            <button
                onClick={handleAutoSync}
                disabled={isSyncing}
                className={clsx(
                    "px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all",
                    isSyncing ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground hover:shadow-lg hover:shadow-primary/20 active:scale-95"
                )}
            >
                <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
                {isSyncing ? 'Sincronizando...' : 'Sincronizar WispHub'}
            </button>
        </header>
    );
}
