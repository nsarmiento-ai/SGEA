import React from 'react';
import { useApp } from '../context/AppContext';
import { User, Shield, ShieldCheck, Box, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const RoleSelectionModal: React.FC = () => {
  const { setRole, userEmail, isSuperAdmin, signOut } = useApp();
  const navigate = useNavigate();

  const handleSelectRole = (role: any) => {
    console.log('Cambiando a rol:', role);
    setRole(role);
    navigate('/');
  };

  const isCine = userEmail?.endsWith('@cine.unt.edu.ar');

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-200">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Selecciona tu Rol</h2>
          <p className="text-slate-500 mt-2 font-medium">
            Personaliza tu experiencia de trabajo para hoy.
          </p>
        </div>
        
        <div className="grid gap-4">
          {(isCine || isSuperAdmin) && (
            <button
              onClick={() => handleSelectRole('Administración')}
              className="group w-full flex items-center gap-5 p-5 rounded-2xl border-2 border-slate-100 hover:border-amber-500 hover:bg-amber-50 transition-all text-left"
            >
              <div className="w-14 h-14 rounded-xl bg-slate-50 group-hover:bg-white flex items-center justify-center transition-colors">
                <Box className="w-7 h-7 text-slate-400 group-hover:text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="font-black text-slate-900 uppercase tracking-wider text-sm">Modo Administrador</p>
                <p className="text-xs text-slate-500 font-bold mt-0.5 leading-relaxed">Gestión de stock, despacho directo y control de devoluciones (Administrador).</p>
              </div>
            </button>
          )}

          <button
            onClick={() => handleSelectRole('Docente')}
            className="group w-full flex items-center gap-5 p-5 rounded-2xl border-2 border-slate-100 hover:border-amber-500 hover:bg-amber-50 transition-all text-left"
          >
            <div className="w-14 h-14 rounded-xl bg-slate-50 group-hover:bg-white flex items-center justify-center transition-colors">
              <User className="w-7 h-7 text-slate-400 group-hover:text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="font-black text-slate-900 uppercase tracking-wider text-sm">Modo Docente</p>
              <p className="text-xs text-slate-500 font-bold mt-0.5 leading-relaxed">Gestión de avales académicos para sus alumnos y reservas propias.</p>
            </div>
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => handleSelectRole('Director')}
              className="group w-full flex items-center gap-5 p-5 rounded-2xl border-2 border-slate-100 hover:border-[#450a0a] hover:bg-red-50 transition-all text-left"
            >
              <div className="w-14 h-14 rounded-xl bg-slate-50 group-hover:bg-white flex items-center justify-center transition-colors">
                <Shield className="w-7 h-7 text-slate-400 group-hover:text-[#450a0a]" />
              </div>
              <div className="flex-1">
                <p className="font-black text-[#450a0a] uppercase tracking-wider text-sm">Modo Director</p>
                <p className="text-xs text-slate-500 font-bold mt-0.5 leading-relaxed">Autorización de rodajes externos y supervisión global del sistema.</p>
              </div>
            </button>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col gap-4">
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 text-red-500 font-bold text-xs uppercase tracking-widest hover:text-red-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión (Google)
          </button>
          
          <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            SGEA - Sistema de Gestión de Equipamiento Audiovisual
          </p>
        </div>
      </div>
    </div>
  );
};
