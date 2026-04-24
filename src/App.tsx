/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import { Loader2, Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

function AppContent() {
  const { activeResponsable, loading, role, profile } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
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
      if (profile?.rol === 'Pañolero') {
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

    const seedDocentesIfNeeded = async () => {
      if (profile?.rol === 'Pañolero') {
        try {
          const { data: existing } = await supabase.from('responsables').select('nombre_completo, email');
          const existingMap = new Map((existing || []).map(r => [r.nombre_completo, r.email]));
          
          const { CONTACTS_DATA } = await import('./lib/contactsData');
          
          // Identify new ones to insert
          const toInsert = CONTACTS_DATA
            .filter(c => !existingMap.has(c.nombre))
            .map(c => ({ nombre_completo: c.nombre, email: c.email, activo: true }));

          // Identify ones to update (missing email but name exists)
          const toUpdate = CONTACTS_DATA
            .filter(c => existingMap.has(c.nombre) && !existingMap.get(c.nombre))
            .map(c => ({ nombre_completo: c.nombre, email: c.email }));

          if (toInsert.length > 0) {
            await supabase.from('responsables').insert(toInsert);
            console.log(`Seeded ${toInsert.length} new docentes`);
          }

          if (toUpdate.length > 0) {
            for (const item of toUpdate) {
              await supabase.from('responsables')
                .update({ email: item.email })
                .eq('nombre_completo', item.nombre_completo);
            }
            console.log(`Updated ${toUpdate.length} docentes with emails`);
          }
        } catch (e) {
          console.error('Failed to seed/update docentes:', e);
        }
      }
    };

    refreshSchema();
    seedAulasIfNeeded();
    seedDocentesIfNeeded();
  }, [profile?.rol]);

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
            element={isPañolero ? <Navigate to="/catalogo" replace /> : <Navigate to="/reservas" replace />} 
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
            element={isPañolero ? <AuditLogs /> : <Navigate to="/reservas" replace />} 
          />

          {/* Rutas compartidas o específicas de Docente */}
          <Route path="/reservas" element={<Reservations />} />
          <Route path="/calendario" element={<CalendarPage />} />
          <Route path="/mora" element={<ActiveLoans filterMora />} />
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
