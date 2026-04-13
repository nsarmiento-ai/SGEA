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
        supabase.from('reservas').select('*').eq('estado', 'Pendiente').order('fecha_inicio', { ascending: true }),
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
    params.set('equipos', res.equipos_ids.join(','));
    params.set('fin', res.fecha_fin);
    navigate(`/nuevo-prestamo?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
        <p className="text-slate-500 font-medium">Cargando reservas pendientes...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-900">Reservas Pendientes</h1>
        <p className="text-slate-500">Gestione las solicitudes de los docentes para su despacho.</p>
      </header>

      {reservations.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900">No hay reservas pendientes</h3>
          <p className="text-slate-500">Todo el despacho está al día.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <AnimatePresence>
            {reservations.map((res) => (
              <motion.div
                key={res.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row"
              >
                <div className="p-6 md:w-1/3 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Docente</p>
                      <p className="font-bold text-slate-900">{res.docente_nombre}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>Desde: {format(parseISO(res.fecha_inicio), 'dd/MM/yyyy HH:mm')}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>Hasta: {format(parseISO(res.fecha_fin), 'dd/MM/yyyy HH:mm')}</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="w-4 h-4 text-amber-500" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Equipamiento Solicitado</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
                    {(res.equipos_ids || []).map(id => {
                      const eq = (equipments || []).find(e => e.id === id);
                      return (
                        <div key={id} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <div className="w-8 h-8 rounded-lg bg-slate-200 overflow-hidden flex-shrink-0">
                            <img src={eq?.foto_url || 'https://picsum.photos/seed/gear/50/50'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <span className="text-xs font-bold text-slate-700 truncate">{eq?.nombre || 'Equipo desconocido'}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-auto flex gap-3">
                    <button 
                      onClick={() => handleCancel(res.id)}
                      className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Cancelar
                    </button>
                    <button 
                      onClick={() => handleDeliver(res)}
                      className="flex-[2] bg-slate-900 text-white px-4 py-3 rounded-2xl font-bold text-sm hover:bg-amber-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200"
                    >
                      <ArrowRight className="w-4 h-4" />
                      Entregar Equipos
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
