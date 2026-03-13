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
import { OperationsDashboard } from './pages/OperationsDashboard';
import { TechnicianAnalytics } from './pages/TechnicianAnalytics';
import { OperationsHub } from './pages/OperationsHub';
import DispatchHub from './pages/DispatchHub';
import { OperationsProductivity } from './pages/OperationsProductivity';
import { OperationsMyTasks } from './pages/OperationsMyTasks';
import { OperationsSupervision } from './pages/OperationsSupervision';
import { Pipeline } from './pages/Pipeline';
import InventoryDashboard from './pages/InventoryDashboard';
import AssetScanner from './pages/AssetScanner';
import InventoryCatalog from './pages/InventoryCatalog';
import InventoryStock from './pages/InventoryStock';
import InventoryAssignment from './pages/InventoryAssignment';
import InventoryKits from './pages/InventoryKits';
import TechnicianStock from './pages/TechnicianStock';
import InventoryRMA from './pages/InventoryRMA';
import InventoryAudit from './pages/InventoryAudit';
import InventoryAnalytics from './pages/InventoryAnalytics';
import InventorySlips from './pages/InventorySlips';
import InventoryMovements from './pages/InventoryMovements';
import { VoiceCampaigns } from './pages/VoiceCampaigns';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Obtener la sesión de forma segura
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) console.error('[App:Auth] ❌ Error al obtener sesión inicial:', error);
        setSession(session);
      })
      .catch(err => {
        console.error('[App:Auth] 💥 Error fatal pidiendo sesión:', err);
      })
      .finally(() => {
        setLoading(false); // Siempre quitar cargando, pase lo que pase
      });

    // 2. Suscribirse a cambios
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log(`[App:Auth] 🔑 Evento: ${event}`, newSession?.user?.email || 'Sin sesión');

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
        if (newSession) setSession(newSession);
      } else if (event === 'SIGNED_OUT') {
        // SEGURIDAD ANTI-500 RELAJADA: Solo retener la memoria si EL TOKEN TODAVÍA EXISTE REALMENTE.
        // Si Supabase lo borró (porque está corrupto o se cerró sesión intencionalmente), cedemos.
        const token = localStorage.getItem('sb-rapilink-auth-token');
        if (!token) {
          console.warn('[App:Auth] 🚪 Cierre de sesión confirmado (token no existe).');
          setSession(null);
        } else {
          console.warn('[App:Auth] 🛡️ Ignorando SIGNED_OUT sospechoso. Token local aún sobrevive.');
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
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
          <Route path="/operaciones/hub" element={<OperationsHub />} />
          <Route path="/operaciones/despacho" element={<DispatchHub />} />
          <Route path="/operaciones/productividad" element={<OperationsProductivity />} />
          <Route path="/operaciones/mis-tareas" element={<OperationsMyTasks />} />
          <Route path="/operaciones/supervision" element={<OperationsSupervision />} />
          <Route path="/operaciones/tecnicos" element={<TechnicianAnalytics />} />
          <Route path="/operaciones/trazabilidad" element={<OperationsDashboard />} />
          <Route path="/operaciones/inventario" element={<InventoryDashboard />} />
          <Route path="/operaciones/inventario/escaner" element={<AssetScanner />} />
          <Route path="/operaciones/inventario/catalogo" element={<InventoryCatalog />} />
          <Route path="/operaciones/inventario/stock" element={<InventoryStock />} />
          <Route path="/operaciones/inventario/asignaciones" element={<InventoryAssignment />} />
          <Route path="/operaciones/inventario/kits" element={<InventoryKits />} />
          <Route path="/operaciones/inventario/tecnicos" element={<TechnicianStock />} />
          <Route path="/operaciones/inventario/rma" element={<InventoryRMA />} />
          <Route path="/operaciones/inventario/auditoria" element={<InventoryAudit />} />
          <Route path="/operaciones/inventario/analiticas" element={<InventoryAnalytics />} />
          <Route path="/operaciones/inventario/actas" element={<InventorySlips />} />
          <Route path="/operaciones/inventario/movimientos" element={<InventoryMovements />} />
          <Route path="/voice-ai" element={<VoiceCampaigns />} />
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
