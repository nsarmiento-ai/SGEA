/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { ResponsableModal } from './components/ResponsableModal';
import { RoleSelectionModal } from './components/RoleSelectionModal';
import { Catalog } from './components/Catalog';
import { LoanWizard } from './components/LoanWizard';
import { ActiveLoans } from './components/ActiveLoans';
import { AuditLogs } from './components/AuditLogs';
import { Reservations } from './components/Reservations';
import { PendingReservations } from './components/PendingReservations';
import { CalendarPage } from './components/CalendarPage';
import { PublicView } from './components/PublicView';
import { StudentRequestsManager } from './components/StudentRequestsManager';
import { DirectorDashboard } from './components/DirectorDashboard';
import { StudentRequestView } from './components/StudentRequestView';
import { Loader2, Menu } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { supabase } from './lib/supabase';

function AppContent() {
  const { activeResponsable, loading, role } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Force PostgREST schema refresh after DB updates
    const refreshSchema = async () => {
      try {
        await supabase.from('reservas').select('materia, aula, alumno_nombre').limit(1);
        await supabase.from('prestamos').select('materia, alumno_nombre, alumno_dni, estado, fecha_devolucion_real, observaciones_recepcion').limit(1);
        await supabase.from('historial_recursos').select('*').limit(1);
        await supabase.from('equipamiento').select('piezas').limit(1);
        console.log('Schema refresh triggered');
      } catch (e) {
        console.error('Schema refresh failed (expected if columns not yet added):', e);
      }
    };

    const seedAulasIfNeeded = async () => {
      // If we don't have a role yet, we can't seed.
      // We will check again once role is set.
      if (role === 'Administración') {
        try {
          const { data: existing } = await supabase.from('equipamiento').select('nombre').eq('categoria', 'Espacio');
          const existingNames = (existing || []).map(e => e.nombre);
          
          const { AULAS } = await import('./constants');
          // Filter existing
          const toInsert = AULAS
            .filter(a => !existingNames.includes(a.nombre));

          if (toInsert.length > 0) {
            await supabase.from('equipamiento').insert(toInsert);
            console.log('Aulas seeded internally');
          }
        } catch (e) {
          console.error('Failed to seed aulas:', e);
        }
      }
    };

    refreshSchema();
    seedAulasIfNeeded();
  }, [role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
      </div>
    );
  }

  // Handle Public Routes without Auth
  return (
    <Routes>
      <Route path="/catalogo-publico" element={<PublicView />} />
      <Route path="/solicitud" element={<StudentRequestView />} />
      
      {/* Protected routes below */}
      <Route 
        path="*" 
        element={
          !activeResponsable ? (
            <ResponsableModal />
          ) : (
            <ProtectedRoute />
          )
        } 
      />
    </Routes>
  );
}

function ProtectedRoute() {
  const { role, isSuperAdmin } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  // If super admin hasn't picked a role yet, force role selection via route
  if (isSuperAdmin && !role && location.pathname !== '/select-role') {
    return <Navigate to="/select-role" replace />;
  }

  // Fallback for regular users or if they are already on select-role
  if (!role && location.pathname !== '/select-role') {
    return <Navigate to="/select-role" replace />;
  }

  return (
    <div className="flex min-h-screen relative">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      {/* Mobile Toggle Button */}
      <button 
        onClick={() => setIsSidebarOpen(true)}
        className="fixed top-4 left-4 z-30 p-2 bg-slate-900 text-white rounded-lg lg:hidden shadow-lg"
      >
        <Menu className="w-6 h-6" />
      </button>

      <main className="flex-1 w-full overflow-x-hidden">
        <Routes>
          {/* Redirección inicial basada en el rol */}
          <Route 
            path="/" 
            element={
              role === 'Administración' ? <Navigate to="/catalogo" replace /> :
              role === 'Director' ? <Navigate to="/director" replace /> :
              <Navigate to="/reservas" replace />
            } 
          />

          {/* Rutas de Administración */}
          <Route 
            path="/catalogo" 
            element={role === 'Administración' ? <Catalog /> : role === 'Director' ? <Navigate to="/director" replace /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/reservas-pendientes" 
            element={role === 'Administración' ? <PendingReservations /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/nuevo-prestamo" 
            element={role === 'Administración' ? <LoanWizard /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/historial" 
            element={role === 'Administración' ? <AuditLogs /> : <Navigate to="/" replace />} 
          />

          {/* Rutas compartidas o específicas de Docente */}
          <Route path="/autorizar-alumnos" element={<StudentRequestsManager />} />
          <Route 
            path="/director" 
            element={role === 'Director' ? <DirectorDashboard /> : <Navigate to="/" replace />} 
          />
          <Route path="/reservas" element={<Reservations />} />
          <Route path="/calendario" element={<CalendarPage />} />
          <Route path="/mora" element={<ActiveLoans filterMora />} />
          <Route path="/activos" element={<ActiveLoans />} />

          {/* Aliases y Fallbacks */}
          <Route path="/admin" element={<Navigate to="/catalogo" replace />} />
          <Route path="/docente" element={<Navigate to="/reservas" replace />} />
          <Route path="/configuracion" element={<Navigate to="/" replace />} />
          <Route path="/select-role" element={<RoleSelectionModal />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}


export default function App() {
  return (
    <AppProvider>
      <Router>
        <AppContent />
      </Router>
    </AppProvider>
  );
}
