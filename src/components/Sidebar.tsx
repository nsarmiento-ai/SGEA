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

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { activeResponsable, profile } = useApp();
  const role = profile?.rol;

  const menuItems = [
    { icon: LayoutDashboard, label: 'Catálogo General', path: '/catalogo', adminOnly: true },
    { icon: Calendar, label: 'Calendario', path: '/calendario' },
    { icon: Calendar, label: 'Nueva Reserva', path: '/reservas' },
    { icon: Clock, label: 'Reservas Pendientes', path: '/reservas-pendientes', adminOnly: true },
    { icon: AlertTriangle, label: 'Panel de Mora', path: '/mora' },
    { icon: Clock, label: role === 'Docente' ? 'Mis Préstamos' : 'Devolución', path: '/activos' },
    { icon: PlusCircle, label: 'Nuevo Préstamo', path: '/nuevo-prestamo', adminOnly: true },
    { icon: History, label: 'Historial Global', path: '/historial', adminOnly: true },
  ].filter(item => {
    if (role === 'Docente') {
      return ['Calendario', 'Nueva Reserva', 'Panel de Mora', 'Mis Préstamos'].includes(item.label);
    }
    return true;
  });

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col text-slate-300 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 cursor-default",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
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
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => {
                if (window.innerWidth < 1024) onClose();
              }}
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
    </>
  );
};
