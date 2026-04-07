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

function AppContent() {
  const { activeResponsable } = useApp();

  if (!activeResponsable) {
    return <ResponsableModal />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route path="/nuevo-prestamo" element={<LoanWizard />} />
          <Route path="/activos" element={<ActiveLoans />} />
          <Route path="/mora" element={<ActiveLoans filterMora />} />
          <Route path="/historial" element={<AuditLogs />} />
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
