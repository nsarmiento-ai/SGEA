import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Clock, 
  AlertTriangle, 
  History, 
  Camera,
  Calendar,
  ShieldCheck,
  CheckSquare,
  FileText
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { cn, optimizeCloudinaryUrl } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { role } = useApp();
  const navigate = useNavigate();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Inventario', path: '/catalogo' },
    { icon: Calendar, label: 'Calendario Global', path: '/calendario' },
    { icon: Calendar, label: 'Nueva Reserva', path: '/reservas' },
    { icon: CheckSquare, label: 'Gestión de Avales', path: '/autorizar-alumnos' },
    { icon: ShieldCheck, label: 'Panel Dirección', path: '/director' },
    { icon: Clock, label: 'Reservas y Solicitudes', path: '/reservas-pendientes' },
    { icon: AlertTriangle, label: 'Panel de Mora', path: '/mora' },
    { icon: Clock, label: role === 'Docente' ? 'Mis Préstamos' : 'Devolución', path: '/activos' },
    { icon: PlusCircle, label: 'Despacho Directo', path: '/nuevo-prestamo' },
    { icon: FileText, label: 'Archivo Histórico', path: '/archivo-historico' },
    { icon: CheckSquare, label: 'Mis Autorizaciones', path: '/mis-autorizaciones' },
  ].filter(item => {
    // If role is Director
    if (role === 'Director') {
      return ['Calendario Global', 'Panel de Mora', 'Panel Dirección', 'Mis Autorizaciones'].includes(item.label);
    }

    // If role is Docente
    if (role === 'Docente') {
      return ['Calendario Global', 'Nueva Reserva', 'Mis Préstamos', 'Gestión de Avales', 'Mis Autorizaciones'].includes(item.label);
    }

    // If role is Administración
    if (role === 'Administración') {
      const excluded = ['Panel Dirección', 'Gestión de Avales', 'Mis Autorizaciones']; 
      return !excluded.includes(item.label);
    }

    return false;
  });

  return (
    <>
      {/* Sidebar lateral for desktop (hidden on mobile, flex on desktop) */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-slate-900 border-r border-slate-800 text-slate-300 cursor-default shrink-0 min-h-screen">
        <div className="p-6 flex items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg">
              <img 
                src={optimizeCloudinaryUrl("https://res.cloudinary.com/divij23kk/image/upload/v1775522044/Logo-Escuela_clscco_1_pe7ao5.png")} 
                alt="Logo Escuela" 
                width={40}
                height={40}
                className="w-10 h-10 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="font-display font-bold text-white text-xl leading-none">SGEA</h1>
              <span className="text-[10px] uppercase tracking-widest text-amber-400/80 font-black">
                {role === 'Director' ? 'Dirección' : role === 'Docente' ? 'Docente' : 'Administrador'}
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                isActive 
                  ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20 font-bold" 
                  : "text-slate-400 hover:bg-slate-800 hover:text-white font-medium"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Bottom Navigation for mobile (< 1024px) */}
      <nav 
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex items-center shadow-[0_-4px_16px_rgba(0,0,0,0.4)]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)', paddingTop: '0.5rem' }}
      >
        <div className="w-full flex items-center justify-start overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-4 gap-1.5 pb-0.5">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-200 shrink-0 select-none",
                isActive 
                  ? "text-amber-400 font-bold bg-amber-500/10" 
                  : "text-slate-400 hover:text-slate-200 font-medium"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-bold tracking-tight whitespace-nowrap">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
};
