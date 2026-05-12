import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, 
  ShieldCheck, 
  User, 
  ChevronDown,
  Menu
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { TextAnimate } from './ui/TextAnimate';

interface HeaderProps {
  onOpenSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSidebar }) => {
  const { activeResponsable, role, setRole, signOut, isSuperAdmin } = useApp();
  const [isLoggedOutMenuOpen, setIsLoggedOutMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsLoggedOutMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRoleChange = () => {
    setRole(null);
    setIsLoggedOutMenuOpen(false);
    navigate('/select-role');
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            aria-label="Toggle menu"
            onClick={onOpenSidebar}
            className="lg:hidden p-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="hidden sm:block">
            <h2 className="text-sm font-bold text-slate-900 leading-none">Sistema de Gestión de Equipos</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5 font-medium">Escuela Universitaria de Cine, Video y TV</p>
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsLoggedOutMenuOpen(!isLoggedOutMenuOpen)}
            className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 hover:bg-slate-50 rounded-2xl transition-all group"
            aria-label="Menú de usuario"
            aria-expanded={isLoggedOutMenuOpen}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-200">
              <User className="w-4 h-4 sm:w-5 h-5" />
            </div>
            
            <div className="hidden sm:flex flex-col items-start min-w-[100px]">
              <TextAnimate 
                text={activeResponsable || ''} 
                type="fadeIn"
                className="text-sm font-bold text-slate-800 truncate max-w-[150px]" 
              />
              <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider leading-none">
                {role === 'Director' ? 'Dirección' : role === 'Docente' ? 'Docente' : 'Administrador'}
              </span>
            </div>
            
            <ChevronDown className={cn(
              "w-4 h-4 text-slate-400 transition-transform duration-200",
              isLoggedOutMenuOpen && "rotate-180"
            )} />
          </button>

          <AnimatePresence>
            {isLoggedOutMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
              >
                <div className="p-4 border-b border-slate-50 bg-slate-50/50 sm:hidden">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Usuario</p>
                  <p className="font-bold text-slate-900 truncate">{activeResponsable}</p>
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider mt-0.5">
                    {role === 'Director' ? 'Dirección' : role === 'Docente' ? 'Docente' : 'Administrador'}
                  </p>
                </div>

                <div className="p-2">
                  {isSuperAdmin && (
                    <button
                      onClick={handleRoleChange}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors text-sm font-medium"
                    >
                      <ShieldCheck className="w-5 h-5 text-amber-500" />
                      Cambiar Rol
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      setIsLoggedOutMenuOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors text-sm font-bold"
                    aria-label="Cerrar sesión"
                  >
                    <LogOut className="w-5 h-5" />
                    Cerrar Sesión
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
