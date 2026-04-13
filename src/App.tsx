/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { supabase } from './lib/supabase';
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
import { ResourceHistoryPage } from './components/ResourceHistory';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { activeResponsable, loading, role, profile } = useApp();

  useEffect(() => {
    const seedAulas = async () => {
      const { data: existingAulas } = await supabase
        .from('equipamiento')
        .select('nombre')
        .eq('categoria', 'Espacio/Aula');
      
      const aulaNames = existingAulas?.map(a => a.nombre) || [];
      const aulasToSeed = [
        'Aula A', 'Aula B', 'Aula C', 'Aula D', 'Aula E', 'Aula F', 'Aula G', 'SET'
      ].filter(name => !aulaNames.includes(name));

      if (aulasToSeed.length > 0) {
        const newAulas = aulasToSeed.map(name => ({
          nombre: name,
          categoria: 'Espacio/Aula',
          modelo: 'Espacio Físico',
          estado: 'Disponible',
          ubicacion: 'Escuela de Cine',
          numero_serie: `AULA-${name.replace(' ', '')}`,
          foto_url: 'https://picsum.photos/seed/classroom/400/300'
        }));
        await supabase.from('equipamiento').insert(newAulas);
      }
    };
    seedAulas();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!activeResponsable) {
    return <ResponsableModal />;
  }

  if (activeResponsable && role === null) {
    return <RoleSelectionModal />;
  }

  const isPañolero = role === 'Pañolero';

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <Routes>
          {/* Redirección inicial basada en el rol */}
          <Route 
            path="/" 
            element={isPañolero ? <Navigate to="/nuevo-prestamo" replace /> : <Navigate to="/reservas" replace />} 
          />

          {/* Rutas de Pañolero (Admin) */}
          <Route 
            path="/catalogo" 
            element={isPañolero ? <Catalog /> : <Navigate to="/reservas" replace />} 
          />
          <Route 
            path="/reservas-pendientes" 
            element={isPañolero ? <PendingReservations /> : <Navigate to="/reservas" replace />} 
          />
          <Route 
            path="/nuevo-prestamo" 
            element={isPañolero ? <LoanWizard /> : <Navigate to="/reservas" replace />} 
          />
          <Route 
            path="/historial" 
            element={isPañolero ? <ResourceHistoryPage /> : <Navigate to="/reservas" replace />} 
          />
          <Route 
            path="/auditoria" 
            element={isPañolero ? <AuditLogs /> : <Navigate to="/reservas" replace />} 
          />

          {/* Rutas compartidas o específicas de Docente */}
          <Route 
            path="/reservas" 
            element={!isPañolero ? <Reservations /> : <Navigate to="/activos" replace />} 
          />
          <Route path="/calendario" element={<CalendarPage />} />
          <Route path="/mora" element={isPañolero ? <ActiveLoans filterMora /> : <Navigate to="/activos" replace />} />
          <Route path="/activos" element={<ActiveLoans />} />

          {/* Aliases y Fallbacks */}
          <Route path="/admin" element={<Navigate to={isPañolero ? "/catalogo" : "/reservas"} replace />} />
          <Route path="/configuracion" element={<Navigate to={isPañolero ? "/catalogo" : "/reservas"} replace />} />
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
