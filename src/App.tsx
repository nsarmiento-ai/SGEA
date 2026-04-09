/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { ResponsableModal } from './components/ResponsableModal';
import { Catalog } from './components/Catalog';
import { LoanWizard } from './components/LoanWizard';
import { ActiveLoans } from './components/ActiveLoans';
import { AuditLogs } from './components/AuditLogs';
import { Reservations } from './components/Reservations';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { activeResponsable, loading, role } = useApp();

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

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route path="/reservas" element={<Reservations />} />
          <Route path="/mora" element={<ActiveLoans filterMora />} />
          <Route path="/activos" element={<ActiveLoans />} />
          <Route path="/nuevo-prestamo" element={role === 'Pañolero' ? <LoanWizard /> : <Catalog />} />
          <Route path="/historial" element={role === 'Pañolero' ? <AuditLogs /> : <Catalog />} />
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
