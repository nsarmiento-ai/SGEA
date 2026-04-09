import React from 'react';
import { useApp } from '../context/AppContext';
import { User, Shield } from 'lucide-react';

export const RoleSelectionModal: React.FC = () => {
  const { setRole, userEmail } = useApp();

  const isCine = userEmail?.endsWith('@cine.unt.edu.ar');

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Selecciona tu Rol</h2>
        <p className="text-slate-600 mb-8 text-center">
          Para configurar tu acceso, por favor selecciona cómo utilizarás el sistema.
        </p>
        
        <div className="space-y-4">
          {isCine && (
            <button
              onClick={() => setRole('Pañolero')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50 transition-all"
            >
              <Shield className="w-8 h-8 text-amber-500" />
              <div className="text-left">
                <p className="font-bold text-slate-900">Pañolero</p>
                <p className="text-sm text-slate-500">Acceso administrativo total</p>
              </div>
            </button>
          )}
          <button
            onClick={() => setRole('Docente')}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50 transition-all"
          >
            <User className="w-8 h-8 text-slate-500" />
            <div className="text-left">
              <p className="font-bold text-slate-900">Docente</p>
              <p className="text-sm text-slate-500">Acceso a reservas y préstamos</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
