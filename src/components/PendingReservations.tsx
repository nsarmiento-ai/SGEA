import React, { useState, useEffect } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { Reservation, Equipment } from '../types';
import { useApp } from '../context/AppContext';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Calendar,
  User,
  Package,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export const PendingReservations: React.FC = () => {
  const { activeResponsable } = useApp();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resData, eqData] = await Promise.all([
        supabase
          .from('reservas')
          .select('*')
          .eq('estado', 'Pendiente')
          .order('created_at', { ascending: true }),
        supabase.from('equipamiento').select('*')
      ]);

      if (resData.data) setReservations(resData.data);
      if (eqData.data) setEquipments(eqData.data);
    } catch (err) {
      console.error('Error fetching reservations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('¿Está seguro de cancelar esta reserva?')) return;
    
    try {
      const { error } = await supabase
        .from('reservas')
        .update({ estado: 'Cancelada' })
        .eq('id', id);
      
      if (error) throw error;
      await logAction(activeResponsable!, 'CANCELAR_RESERVA', { reservationId: id });
      fetchData();
    } catch (err) {
      console.error('Error cancelling reservation:', err);
      alert('Error al cancelar la reserva.');
    }
  };

  const handleDeliver = (res: Reservation) => {
    // Redirect to LoanWizard with reservation data
    const params = new URLSearchParams();
    params.set('resId', res.id);
    params.set('docente', res.docente_nombre);
    params.set('materia', res.materia);
    params.set('equipos', res.equipos_ids.join(','));
    params.set('fin', res.fecha_fin);
    navigate(`/nuevo-prestamo?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
        <p className="text-slate-500 font-medium">Cargando consola de reservas...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-200">
              <Clock className="w-6 h-6 text-amber-500" />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Consola de Reservas</h1>
          </div>
          <p className="text-slate-500 font-medium">Gestione las solicitudes remotas por orden de prioridad.</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 px-4 py-2 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <p className="text-xs font-bold text-amber-800">Prioridad determinada por horario de registro</p>
        </div>
      </header>

      {reservations.length === 0 ? (
        <div className="bg-white rounded-[2rem] p-20 text-center border border-dashed border-slate-300">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-2">Sin reservas pendientes</h3>
          <p className="text-slate-500 max-w-md mx-auto">No hay solicitudes remotas que requieran atención en este momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <AnimatePresence>
            {reservations.map((res, index) => (
              <motion.div
                key={res.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col lg:flex-row group"
              >
                {/* Priority Indicator */}
                <div className={cn(
                  "lg:w-2 flex-shrink-0",
                  index === 0 ? "bg-amber-500" : "bg-slate-200"
                )} />

                <div className="p-8 lg:w-1/3 bg-slate-50/50 border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-white shadow-md border border-slate-100 flex items-center justify-center text-slate-900">
                      <User className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Docente Solicitante</p>
                      <p className="text-xl font-black text-slate-900 leading-tight">{res.docente_nombre}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-black rounded uppercase">
                          {res.materia}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 mt-auto">
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Horario de Registro</p>
                      <div className="flex items-center gap-3 text-slate-900">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <span className="font-bold text-sm">
                          {res.created_at ? format(parseISO(res.created_at), 'dd/MM HH:mm:ss') : 'N/A'}
                        </span>
                      </div>
                      {index === 0 && (
                        <p className="text-[10px] text-amber-600 font-bold mt-2 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Primera en cola de prioridad
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3 text-xs text-slate-600">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span>Retiro: <strong className="text-slate-900">{format(parseISO(res.fecha_inicio), 'dd/MM HH:mm')}</strong></span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-600">
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                        <span>Devolución: <strong className="text-slate-900">{format(parseISO(res.fecha_fin), 'dd/MM HH:mm')}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-amber-500" />
                      <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Equipamiento a Preparar</h3>
                    </div>
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-black rounded-full">
                      {(res.equipos_ids || []).length} Ítems
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                    {(res.equipos_ids || []).map(id => {
                      const eq = (equipments || []).find(e => e.id === id);
                      return (
                        <div key={id} className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 group-hover:border-amber-200 transition-colors">
                          <div className="w-12 h-12 rounded-xl bg-white overflow-hidden flex-shrink-0 border border-slate-100 shadow-sm">
                            <img src={eq?.foto_url || 'https://picsum.photos/seed/gear/100/100'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-900 truncate">{eq?.nombre || 'Equipo desconocido'}</p>
                            <p className="text-[10px] font-bold text-slate-400 truncate">{eq?.modelo}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-auto flex flex-col sm:flex-row gap-4">
                    <button 
                      onClick={() => handleCancel(res.id)}
                      className="flex-1 px-6 py-4 border-2 border-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-5 h-5" />
                      RECHAZAR / CANCELAR
                    </button>
                    <button 
                      onClick={() => handleDeliver(res)}
                      className="flex-[2] bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-sm hover:bg-amber-500 transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-200 group/btn"
                    >
                      <CheckCircle2 className="w-5 h-5 text-amber-500 group-hover/btn:text-white transition-colors" />
                      ENTREGAR EQUIPOS
                      <ArrowRight className="w-5 h-5 opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
