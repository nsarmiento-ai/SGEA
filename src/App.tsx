/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { ResponsableModal } from './components/ResponsableModal';
import { RoleSelectionModal } from './components/RoleSelectionModal';
import { Loader2, Menu } from 'lucide-react';
import { useEffect, useState, useRef, Suspense, lazy } from 'react';
import { supabase } from './lib/supabase';

// Lazy loading of route components
const Catalog = lazy(() => import('./components/Catalog').then(m => ({ default: m.Catalog })));
const LoanWizard = lazy(() => import('./components/LoanWizard').then(m => ({ default: m.LoanWizard })));
const ActiveLoans = lazy(() => import('./components/ActiveLoans').then(m => ({ default: m.ActiveLoans })));
const AuditLogs = lazy(() => import('./components/AuditLogs').then(m => ({ default: m.AuditLogs })));
const Reservations = lazy(() => import('./components/Reservations').then(m => ({ default: m.Reservations })));
const PendingReservations = lazy(() => import('./components/PendingReservations').then(m => ({ default: m.PendingReservations })));
const CalendarPage = lazy(() => import('./components/CalendarPage').then(m => ({ default: m.CalendarPage })));
const PublicView = lazy(() => import('./components/PublicView').then(m => ({ default: m.PublicView })));
const StudentRequestsManager = lazy(() => import('./components/StudentRequestsManager').then(m => ({ default: m.StudentRequestsManager })));
const DirectorDashboard = lazy(() => import('./components/DirectorDashboard').then(m => ({ default: m.DirectorDashboard })));
const StudentRequestView = lazy(() => import('./components/StudentRequestView').then(m => ({ default: m.StudentRequestView })));

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
    </div>
  );
}

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
    <Suspense fallback={<LoadingFallback />}>
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
    </Suspense>
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
        aria-label="Abrir menú"
        onClick={() => setIsSidebarOpen(true)}
        className="fixed top-4 left-4 z-30 p-2 bg-slate-900 text-white rounded-lg lg:hidden shadow-lg"
      >
        <Menu className="w-6 h-6" />
      </button>

      <main className="flex-1 w-full overflow-x-hidden">
        <Suspense fallback={<LoadingFallback />}>
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
        </Suspense>
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
