import { OperationsHeader } from '../components/operations/OperationsHeader';
import { TechnicianAnalytics } from './TechnicianAnalytics';
import { useState } from 'react';

export function OperationsProductivity() {
    const [refreshKey, setRefreshKey] = useState(0);

    return (
        <div className="space-y-6">
            <OperationsHeader
                title="Productividad"
                description="Métricas y rendimiento del equipo técnico."
                onSyncComplete={() => setRefreshKey(prev => prev + 1)}
            />
            <div className="animate-in fade-in duration-500">
                <TechnicianAnalytics key={refreshKey} />
            </div>
        </div>
    );
}
