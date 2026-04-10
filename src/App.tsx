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
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { activeResponsable, loading, role, profile } = useApp();

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

  if (profile && profile.rol === null) {
    return <RoleSelectionModal />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route path="/reservas" element={<Reservations />} />
          <Route path="/reservas-pendientes" element={<PendingReservations />} />
          <Route path="/mora" element={<ActiveLoans filterMora />} />
          <Route path="/activos" element={<ActiveLoans />} />
          <Route path="/nuevo-prestamo" element={<LoanWizard />} />
          <Route path="/historial" element={<AuditLogs />} />
          <Route path="/admin" element={<Catalog />} />
          <Route path="/configuracion" element={<Catalog />} />
          <Route path="*" element={<Catalog />} />
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
