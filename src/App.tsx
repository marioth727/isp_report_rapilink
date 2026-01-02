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
import { Pipeline } from './pages/Pipeline';

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.user_metadata?.role === 'admin') {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
  };

  if (isAdmin === null) return <div>Verificando permisos...</div>;
  return isAdmin ? children : <Navigate to="/" />;
};

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
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/historial" element={<InteractionHistory />} />
          <Route path="/gestion/cerrar" element={<DailyReportGenerator />} />
          <Route
            path="/configuracion"
            element={
              <AdminRoute>
                <Configuration />
              </AdminRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
