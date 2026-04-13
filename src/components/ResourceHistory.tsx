import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ResourceHistory, Equipment } from '../types';
import { 
  History, 
  Search, 
  Filter,
  Package,
  User,
  Calendar,
  Loader2,
  AlertCircle,
  ArrowRight,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../lib/utils';

export const ResourceHistoryPage: React.FC = () => {
  const [history, setHistory] = useState<ResourceHistory[]>([]);
  const [equipments, setEquipments] = useState<Record<string, Equipment>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('Todas');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [histData, eqData] = await Promise.all([
        supabase
          .from('historial_recursos')
          .select('*')
          .order('fecha_movimiento', { ascending: false }),
        supabase.from('equipamiento').select('*')
      ]);

      if (histData.data) setHistory(histData.data);
      if (eqData.data) {
        const eqMap = eqData.data.reduce((acc, eq) => ({ ...acc, [eq.id]: eq }), {});
        setEquipments(eqMap);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = (history || []).filter(item => {
    const eq = equipments[item.recurso_id];
    const matchesSearch = 
      (eq?.nombre || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.usuario_responsable || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.materia || '').toLowerCase().includes(search.toLowerCase());
    const matchesAction = actionFilter === 'Todas' || item.accion === actionFilter;
    return matchesSearch && matchesAction;
  });

  const actions = ['Todas', 'Reserva', 'Préstamo', 'Devolución', 'Service'];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-200">
              <History className="w-6 h-6 text-amber-500" />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Hoja de Vida</h1>
          </div>
          <p className="text-slate-500 font-medium">Trazabilidad completa y deslinde de responsabilidades por recurso.</p>
        </div>
      </header>

      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text"
            placeholder="Buscar por equipo, docente o materia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium"
          />
        </div>
        <div className="flex gap-2">
          {actions.map(action => (
            <button
              key={action}
              onClick={() => setActionFilter(action)}
              className={cn(
                "px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border",
                actionFilter === action 
                  ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200" 
                  : "bg-white text-slate-500 border-slate-200 hover:border-amber-500"
              )}
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-500 w-10 h-10" /></div>
      ) : filteredHistory.length === 0 ? (
        <div className="bg-white rounded-[2rem] p-20 text-center border border-dashed border-slate-300">
          <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <History className="text-slate-300 w-10 h-10" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-2">Sin movimientos registrados</h3>
          <p className="text-slate-500 max-w-md mx-auto">No se han encontrado registros que coincidan con los criterios.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {filteredHistory.map((item) => {
              const eq = equipments[item.recurso_id];
              return (
                <motion.div
                  layout
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col lg:flex-row lg:items-center gap-6 hover:shadow-xl transition-all group"
                >
                  <div className="flex items-center gap-4 lg:w-1/4">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden border border-slate-100 flex-shrink-0">
                      <img 
                        src={eq?.foto_url || 'https://picsum.photos/seed/gear/100/100'} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-tighter">{eq?.categoria}</p>
                      <h3 className="font-black text-slate-900 truncate">{eq?.nombre || 'Equipo Desconocido'}</h3>
                      <p className="text-[10px] font-bold text-slate-400">S/N: {eq?.numero_serie}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 lg:w-1/4 border-l border-slate-100 pl-6">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0",
                      item.accion === 'Reserva' ? "bg-blue-50 text-blue-600" :
                      item.accion === 'Préstamo' ? "bg-amber-50 text-amber-600" :
                      item.accion === 'Devolución' ? "bg-green-50 text-green-600" :
                      "bg-red-50 text-red-600"
                    )}>
                      {item.accion === 'Reserva' ? <Calendar className="w-6 h-6" /> :
                       item.accion === 'Préstamo' ? <ArrowRight className="w-6 h-6" /> :
                       item.accion === 'Devolución' ? <Package className="w-6 h-6" /> :
                       <AlertCircle className="w-6 h-6" />}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Acción</p>
                      <p className="font-black text-slate-900">{item.accion}</p>
                      <p className="text-[10px] font-bold text-slate-500">{formatDate(item.fecha_movimiento)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 lg:w-1/4 border-l border-slate-100 pl-6">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsable</p>
                      <p className="text-sm font-bold text-slate-900 truncate">{item.usuario_responsable}</p>
                      <p className="text-[10px] font-bold text-amber-600 uppercase truncate">{item.materia}</p>
                    </div>
                  </div>

                  <div className="flex-1 border-l border-slate-100 pl-6 bg-slate-50/50 p-4 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado / Observaciones</p>
                      <span className="text-[10px] font-bold text-slate-400">Pañolero: {item.pañolero_turno}</span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium italic">
                      "{item.estado_detalle || 'Sin observaciones registradas.'}"
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
