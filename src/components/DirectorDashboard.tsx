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
  History,
  ChevronDown,
  ChevronUp,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StudentRequestsManager } from './StudentRequestsManager';
import { cn } from '../lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';

export const DirectorDashboard: React.FC = () => {
  const { userEmail } = useApp();
  const [stats, setStats] = useState({
    activeLoans: 0,
    pendingDirection: 0,
    moraCount: 0,
    totalEquipments: 0,
    topEquipment: [] as { name: string, count: number }[],
    usageType: [] as { name: string, value: number }[],
    stockStatus: [] as { name: string, value: number }[],
    availableCount: 0,
    inUseCount: 0,
    outOfService: [] as { id: string, nombre: string, estado: string }[]
  });
  const [loading, setLoading] = useState(true);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [loans, pendingReqs, equipments, allReqs] = await Promise.all([
        supabase.from('prestamos').select('id, estado, equipos_ids'),
        supabase.from('solicitudes_alumnos').select('id').eq('estado', 'Pendiente de Dirección'),
        supabase.from('equipamiento').select('id, nombre, estado'),
        supabase.from('solicitudes_alumnos').select('tipo_uso')
      ]);

      // Calculate Top Equipment
      const eqCounts: Record<string, number> = {};
      loans.data?.forEach(l => {
        l.equipos_ids?.forEach((id: string) => {
          eqCounts[id] = (eqCounts[id] || 0) + 1;
        });
      });

      const topEq = Object.entries(eqCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([id, count]) => ({
          name: equipments.data?.find(e => e.id === id)?.nombre || 'Equipo Desconocido',
          count
        }));

      // Usage Type Data
      const usageCounts = {
        'Uso en Escuela': allReqs.data?.filter(r => r.tipo_uso === 'Uso en Escuela').length || 0,
        'Uso Externo': allReqs.data?.filter(r => r.tipo_uso === 'Uso Externo').length || 0
      };

      // Stock Status Data
      const availableItems = equipments.data?.filter(e => {
        const s = (e.estado || '').toLowerCase();
        return s === 'disponible';
      }) || [];

      const inUseItems = equipments.data?.filter(e => {
        const s = (e.estado || '').toLowerCase();
        return s === 'prestado' || s === 'en mora' || s === 'mora';
      }) || [];

      const maintenanceItems = equipments.data?.filter(e => {
        const s = (e.estado || '').toLowerCase();
        return s === 'mantenimiento' || 
               s === 'en mantenimiento' || 
               s === 'roto' || 
               s === 'en reparación' || 
               s === 'fuera de servicio' || 
               s === 'incompleto' ||
               s === 'baja';
      }) || [];

      const reservedItems = equipments.data?.filter(e => {
        const s = (e.estado || '').toLowerCase();
        return s === 'reservado';
      }) || [];

      const stockCounts = {
        'Disponible': availableItems.length,
        'En Préstamo': inUseItems.length,
        'Mantenimiento': maintenanceItems.length,
        'Reservado': reservedItems.length
      };

      setStats({
        activeLoans: loans.data?.filter(l => l.estado === 'Activo').length || 0,
        pendingDirection: pendingReqs.data?.length || 0,
        moraCount: loans.data?.filter(l => l.estado === 'En Mora').length || 0,
        totalEquipments: equipments.data?.length || 0,
        topEquipment: topEq,
        usageType: Object.entries(usageCounts).map(([name, value]) => ({ name, value })),
        stockStatus: Object.entries(stockCounts).map(([name, value]) => ({ name, value })),
        availableCount: availableItems.length,
        inUseCount: inUseItems.length,
        outOfService: maintenanceItems.map(m => ({ id: m.id, nombre: m.nombre, estado: m.estado || 'Mantenimiento' }))
      });
    } catch (err) {
      console.error('Error fetching director stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#f59e0b', '#450a0a', '#ef4444', '#10b981'];

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
          color="text-amber-800" 
          bgColor="bg-amber-50"
          desc="Solicitudes de Uso Externo"
        />
        <KpiCard 
          icon={Package} 
          label="Recursos Disponibles" 
          value={stats.availableCount} 
          color="text-green-600" 
          bgColor="bg-green-50"
          desc="Equipos listos en pañol"
        />
        <KpiCard 
          icon={TrendingUp} 
          label="Equipos en la Calle" 
          value={stats.inUseCount} 
          color="text-indigo-600" 
          bgColor="bg-indigo-50"
          desc="Actualmente prestados"
        />
        <KpiCard 
          icon={AlertTriangle} 
          label="Fuera de Servicio" 
          value={stats.outOfService.length} 
          color="text-red-600" 
          bgColor="bg-red-50"
          desc="Mantenimiento o Baja"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-10">
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

        {/* Sidebar Info & Mini Alerts */}
        <div className="space-y-6">
          {stats.outOfService.length > 0 && (
            <div className="bg-red-50 p-6 rounded-3xl border border-red-100 animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center gap-2 text-red-600 mb-4">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-xs font-black uppercase tracking-widest">Equipos en Alerta</h3>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {stats.outOfService.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-red-50 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-700 truncate mr-2">{item.nombre}</span>
                    <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-red-100 text-red-600 rounded">
                      {item.estado}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
            <History className="absolute -right-4 -bottom-4 w-32 h-32 text-white/5 rotate-12" />
            <h3 className="text-lg font-black uppercase tracking-widest mb-4">Resumen de Control</h3>
            <div className="space-y-4 relative z-10">
              <div className="flex justify-between items-end border-b border-white/10 pb-2">
                <span className="text-xs font-bold text-slate-400 mt-2">Nivel de Ocupación</span>
                <span className="text-xl font-black text-amber-400">
                  {Math.round((stats.inUseCount / (stats.totalEquipments || 1)) * 100)}%
                </span>
              </div>
              <div className="flex justify-between items-end border-b border-white/10 pb-2">
                <span className="text-xs font-bold text-slate-400 mt-2">Nuevos Pedidos</span>
                <span className="text-xl font-black text-amber-400">{stats.pendingDirection}</span>
              </div>
            </div>
            <button 
              onClick={() => setShowStats(!showStats)}
              className="mt-8 w-full bg-white/10 hover:bg-white/20 transition-all border border-white/10 rounded-2xl py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {showStats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showStats ? 'Ocultar Estadísticas' : 'Ver Gráficos Detallados'}
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

      {/* Advanced Stats Section (Collapsible) */}
      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
              {/* Top Equipment Bar Chart */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-500" />
                  Equipos más solicitados (Top 5)
                </h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.topEquipment} layout="vertical" margin={{ left: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        stroke="#64748b" 
                        fontSize={10} 
                        fontWeight="bold"
                        width={100}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f8fafc' }}
                      />
                      <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Usage Type Pie Chart */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-amber-500" />
                  Estado de Stock (Disponibles vs Mantenimiento)
                </h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.stockStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.stockStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend 
                        layout="horizontal" 
                        verticalAlign="bottom" 
                        align="center"
                        wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: '20px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm mb-10">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-amber-500" />
                  Finalidad de los Pedidos
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.usageType}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.usageType.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#f59e0b'} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
