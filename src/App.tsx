import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { AuthPage } from './components/auth/AuthPage';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { DailyReportsList } from './pages/DailyReportsList';
import { WeeklyReport } from './pages/WeeklyReport';
import { InteractionLog } from './pages/InteractionLog';
import { InteractionHistory } from './pages/InteractionHistory';
import { DailyReportGenerator } from './pages/DailyReportGenerator';
import { Configuration } from './pages/Configuration';
import { CampaignManager } from './pages/CampaignManager';
import { OperativeDashboard } from './pages/OperativeDashboard';
import { OperationsDashboard } from './pages/OperationsDashboard';
import { TechnicianAnalytics } from './pages/TechnicianAnalytics';
import { OperationsHub } from './pages/OperationsHub';
import { OperationsProductivity } from './pages/OperationsProductivity';
import { OperationsMyTasks } from './pages/OperationsMyTasks';
import { OperationsSupervision } from './pages/OperationsSupervision';
import { Pipeline } from './pages/Pipeline';


function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-background text-foreground">Cargando...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <AuthPage /> : <Navigate to="/" />} />

        <Route element={session ? <Layout /> : <Navigate to="/login" />}>
          <Route path="/" element={<Dashboard />} />

          <Route path="/reportes/semanal" element={<WeeklyReport />} />

          {/* Historical Viewer Routes */}
          <Route path="/reportes/diario" element={<DailyReportsList />} />
          <Route path="/reportes/diario/view" element={<DailyReportGenerator />} />

          <Route path="/gestion" element={<InteractionLog />} />
          <Route path="/campanas" element={<CampaignManager />} />
          <Route path="/operaciones" element={<OperativeDashboard />} />
          <Route path="/operaciones/hub" element={<OperationsHub />} />
          <Route path="/operaciones/productividad" element={<OperationsProductivity />} />
          <Route path="/operaciones/mis-tareas" element={<OperationsMyTasks />} />
          <Route path="/operaciones/supervision" element={<OperationsSupervision />} />
          <Route path="/operaciones/tecnicos" element={<TechnicianAnalytics />} />
          <Route path="/operaciones/trazabilidad" element={<OperationsDashboard />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/historial" element={<InteractionHistory />} />
          <Route path="/gestion/cerrar" element={<DailyReportGenerator />} />
          <Route path="/configuracion" element={<Configuration />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
