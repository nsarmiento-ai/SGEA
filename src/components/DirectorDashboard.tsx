import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { StudentRequest, Equipment } from '../types';
import { useApp } from '../context/AppContext';
import { 
  ShieldCheck, 
  TrendingUp, 
  Package, 
  Users, 
  Clock, 
  Loader2, 
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  XCircle,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StudentRequestsManager } from './StudentRequestsManager';
import { cn } from '../lib/utils';

export const DirectorDashboard: React.FC = () => {
  const { userEmail } = useApp();
  const [stats, setStats] = useState({
    activeLoans: 0,
    pendingDirection: 0,
    moraCount: 0,
    totalEquipments: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [loans, pendingReqs, equipments] = await Promise.all([
        supabase.from('prestamos').select('id, estado'),
        supabase.from('solicitudes_alumnos').select('id').eq('estado', 'Pendiente de Dirección'),
        supabase.from('equipamiento').select('id, estado')
      ]);

      setStats({
        activeLoans: loans.data?.filter(l => l.estado === 'Activo').length || 0,
        pendingDirection: pendingReqs.data?.length || 0,
        moraCount: loans.data?.filter(l => l.estado === 'En Mora').length || 0,
        totalEquipments: equipments.data?.length || 0
      });
    } catch (err) {
      console.error('Error fetching director stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pt-16 lg:pt-8 text-slate-900">
      {/* Visual Identity Header */}
      <div className="mb-8 bg-[#450a0a] text-white px-6 py-4 rounded-3xl flex items-center justify-between shadow-xl border-l-8 border-amber-500">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400/80">Dirección</span>
            <h1 className="text-2xl font-black tracking-tight leading-none mt-1">Panel de Control Estratégico</h1>
          </div>
        </div>
        <div className="hidden md:block text-right">
          <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">{userEmail}</p>
          <p className="text-xs font-bold text-amber-400">Escuela Universitaria de Cine - UNT</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <KpiCard 
          icon={Clock} 
          label="Pendientes Firma" 
          value={stats.pendingDirection} 
          color="text-amber-600" 
          bgColor="bg-amber-50"
          desc="Solicitudes de Uso Externo"
        />
        <KpiCard 
          icon={Package} 
          label="Préstamos Activos" 
          value={stats.activeLoans} 
          color="text-indigo-600" 
          bgColor="bg-indigo-50"
          desc="Equipos fuera de pañol"
        />
        <KpiCard 
          icon={AlertTriangle} 
          label="Panel de Mora" 
          value={stats.moraCount} 
          color="text-red-600" 
          bgColor="bg-red-50"
          desc="Devoluciones retrasadas"
        />
        <KpiCard 
          icon={TrendingUp} 
          label="Inventario Total" 
          value={stats.totalEquipments} 
          color="text-green-600" 
          bgColor="bg-green-50"
          desc="Activos registrados"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Approval Area */}
        <div className="xl:col-span-2">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                Cola de Autorización de Rodajes
              </h2>
            </div>
            <div className="max-h-[800px] overflow-y-auto">
              <StudentRequestsManager filterDireccion />
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
            <History className="absolute -right-4 -bottom-4 w-32 h-32 text-white/5 rotate-12" />
            <h3 className="text-lg font-black uppercase tracking-widest mb-4">Resumen Semanal</h3>
            <div className="space-y-4 relative z-10">
              <div className="flex justify-between items-end border-b border-white/10 pb-2">
                <span className="text-xs font-bold text-slate-400 mt-2">Nivel de Ocupación</span>
                <span className="text-xl font-black text-amber-400">74%</span>
              </div>
              <div className="flex justify-between items-end border-b border-white/10 pb-2">
                <span className="text-xs font-bold text-slate-400 mt-2">Nuevos Pedidos</span>
                <span className="text-xl font-black text-amber-400">{stats.pendingDirection}</span>
              </div>
            </div>
            <button className="mt-8 w-full bg-white/10 hover:bg-white/20 transition-all border border-white/10 rounded-2xl py-3 text-xs font-black uppercase tracking-widest">
              Ver Gráficos Detallados
            </button>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Ayuda de Dirección</h4>
            <div className="space-y-3">
              <GuideItem text="Solo autorice si el aval docente es visible." />
              <GuideItem text="Uso externo requiere seguro de equipos (verificable)." />
              <GuideItem text="Rodajes autorizados aparecen en Calendario." />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const KpiCard = ({ icon: Icon, label, value, color, bgColor, desc }: any) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
    <div className="flex items-center justify-between mb-4">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-sm", bgColor)}>
        <Icon className={cn("w-6 h-6", color)} />
      </div>
      <span className={cn("text-3xl font-black", color)}>{value}</span>
    </div>
    <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
    <p className="text-[10px] font-bold text-slate-400 opacity-60 leading-tight">{desc}</p>
  </div>
);

const GuideItem = ({ text }: { text: string }) => (
  <div className="flex items-start gap-3">
    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
    <p className="text-xs font-medium text-slate-600 leading-tight">{text}</p>
  </div>
);
