import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Clock, 
  AlertTriangle, 
  History, 
  LogOut,
  Camera,
  Calendar
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

export const Sidebar: React.FC = () => {
  const { activeResponsable, profile } = useApp();
  const role = profile?.rol;

  const menuItems = [
    // Docente Items
    { icon: LayoutDashboard, label: 'Catálogo y Reservas', path: '/reservas', role: 'Docente' },
    { icon: Calendar, label: 'Calendario', path: '/calendario', role: 'Docente' },
    { icon: Clock, label: 'Mis Préstamos', path: '/activos', role: 'Docente' },

    // Pañolero Items
    { icon: LayoutDashboard, label: 'Consola de Despacho', path: '/activos', role: 'Pañolero' },
    { icon: Clock, label: 'Reservas Pendientes', path: '/reservas-pendientes', role: 'Pañolero' },
    { icon: PlusCircle, label: 'Préstamo Rápido', path: '/nuevo-prestamo', role: 'Pañolero' },
    { icon: Camera, label: 'Inventario', path: '/catalogo', role: 'Pañolero' },
    { icon: History, label: 'Hoja de Vida', path: '/historial', role: 'Pañolero' },
    { icon: AlertTriangle, label: 'Auditoría', path: '/auditoria', role: 'Pañolero' },
  ].filter(item => item.role === role);

  return (
    <aside className="w-64 bg-slate-900 h-screen sticky top-0 flex flex-col text-slate-300">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <div className="p-2 rounded-lg">
          <img 
            src="https://res.cloudinary.com/divij23kk/image/upload/v1775522044/Logo-Escuela_clscco_1_pe7ao5.png" 
            alt="Logo Escuela" 
            className="w-10 h-10 object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <div>
          <h1 className="font-display font-bold text-white text-xl leading-none">SGEA</h1>
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Pañol Abierto</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
              isActive 
                ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" 
                : "hover:bg-slate-800 hover:text-white"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800/50 rounded-xl p-4 mb-4">
          <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Responsable de Turno</p>
          <p className="text-sm font-semibold text-white truncate">{activeResponsable}</p>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors font-medium"
        >
          <LogOut className="w-5 h-5" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
};
