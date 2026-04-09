import React, { useState, useEffect } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { Reservation, Equipment } from '../types';
import { useApp } from '../context/AppContext';
import { 
  Calendar, 
  Plus, 
  Search, 
  User, 
  Clock, 
  Package, 
  XCircle, 
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../lib/utils';
import { isWithinInterval, parseISO, areIntervalsOverlapping } from 'date-fns';

export const Reservations: React.FC = () => {
  const { activeResponsable } = useApp();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [equipments, setEquipments] = useState<Record<string, Equipment>>({});
  const [allEquipments, setAllEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    equipo_id: '',
    fecha_inicio: '',
    fecha_fin: '',
    docente_nombre: activeResponsable || ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeResponsable && !formData.docente_nombre) {
      setFormData(prev => ({ ...prev, docente_nombre: activeResponsable }));
    }
  }, [activeResponsable]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resData, eqData] = await Promise.all([
        supabase.from('reservas').select('*, equipamiento(nombre, modelo)').order('fecha_inicio', { ascending: true }),
        supabase.from('equipamiento').select('*').neq('estado', 'Archivado')
      ]);

      if (resData.data) setReservations(resData.data as any);
      if (eqData.data) {
        setAllEquipments(eqData.data);
        const eqMap = eqData.data.reduce((acc, eq) => ({ ...acc, [eq.id]: eq }), {});
        setEquipments(eqMap);
      }
    } catch (err) {
      console.error('Error fetching reservations:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkOverlap = (equipoId: string, start: string, end: string) => {
    const newStart = parseISO(start);
    const newEnd = parseISO(end);

    return reservations.some(res => {
      if (res.equipo_id !== equipoId) return false;
      
      const resStart = parseISO(res.fecha_inicio);
      const resEnd = parseISO(res.fecha_fin);

      return areIntervalsOverlapping(
        { start: newStart, end: newEnd },
        { start: resStart, end: resEnd }
      );
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.equipo_id || !formData.fecha_inicio || !formData.fecha_fin || !formData.docente_nombre) {
      setError('Todos los campos son obligatorios.');
      return;
    }

    if (new Date(formData.fecha_inicio) >= new Date(formData.fecha_fin)) {
      setError('La fecha de inicio debe ser anterior a la fecha de fin.');
      return;
    }

    if (checkOverlap(formData.equipo_id, formData.fecha_inicio, formData.fecha_fin)) {
      setError('El equipo ya tiene una reserva en ese rango de fechas.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const dataToInsert = {
        ...formData,
        docente_nombre: formData.docente_nombre || activeResponsable,
        usuario_id: user?.id
      };

      const { error: insertError } = await supabase.from('reservas').insert([dataToInsert]);
      if (insertError) throw insertError;

      await logAction(activeResponsable!, 'NUEVA_RESERVA', { 
        equipo: equipments[formData.equipo_id]?.nombre,
        docente: dataToInsert.docente_nombre,
        inicio: formData.fecha_inicio,
        fin: formData.fecha_fin
      });

      setIsModalOpen(false);
      setFormData({
        equipo_id: '',
        fecha_inicio: '',
        fecha_fin: '',
        docente_nombre: activeResponsable || ''
      });
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Error al guardar la reserva.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de cancelar esta reserva?')) return;
    
    const { error: delError } = await supabase.from('reservas').delete().eq('id', id);
    if (!delError) {
      fetchData();
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Reservas / Agenda</h1>
          <p className="text-slate-500">Gestione las reservas de equipos para docentes.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2 self-start"
        >
          <Plus className="w-5 h-5" />
          Nueva Reserva
        </button>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
          <p className="text-slate-500 font-medium">Cargando agenda...</p>
        </div>
      ) : reservations.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900">No hay reservas programadas</h3>
          <p className="text-slate-500">Comience creando una nueva reserva para un docente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reservations.map((res: any) => {
            const eq = res.equipamiento || equipments[res.equipo_id];
            const isNow = isWithinInterval(new Date(), {
              start: parseISO(res.fecha_inicio),
              end: parseISO(res.fecha_fin)
            });

            return (
              <motion.div
                layout
                key={res.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "bg-white rounded-2xl border p-6 shadow-sm relative overflow-hidden",
                  isNow ? "border-amber-500 ring-1 ring-amber-500" : "border-slate-200"
                )}
              >
                {isNow && (
                  <div className="absolute top-0 right-0 bg-amber-500 text-white px-3 py-1 text-[10px] font-black uppercase rounded-bl-xl">
                    En Curso
                  </div>
                )}
                
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                    <Package className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{eq?.nombre || 'Equipo no encontrado'}</h3>
                    <p className="text-xs text-slate-500 truncate">{eq?.modelo || 'S/M'}</p>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="font-medium">{res.docente_nombre}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Desde</p>
                      <p>{formatDate(res.fecha_inicio)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Hasta</p>
                      <p>{formatDate(res.fecha_fin)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button 
                    onClick={() => handleDelete(res.id)}
                    className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1"
                  >
                    <XCircle className="w-4 h-4" />
                    Cancelar Reserva
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Reservation Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="text-xl font-bold text-slate-900">Nueva Reserva</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Equipo</label>
                  <select
                    required
                    value={formData.equipo_id}
                    onChange={e => setFormData({...formData, equipo_id: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="">Seleccione un equipo...</option>
                    {allEquipments.map(eq => (
                      <option key={eq.id} value={eq.id}>{eq.nombre} ({eq.modelo})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Docente Responsable</label>
                  <input
                    required
                    type="text"
                    value={formData.docente_nombre}
                    onChange={e => setFormData({...formData, docente_nombre: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Nombre del docente"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Fecha Inicio</label>
                    <input
                      required
                      type="datetime-local"
                      value={formData.fecha_inicio}
                      onChange={e => setFormData({...formData, fecha_inicio: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Fecha Fin</label>
                    <input
                      required
                      type="datetime-local"
                      value={formData.fecha_fin}
                      onChange={e => setFormData({...formData, fecha_fin: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="flex-1 px-6 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="flex-1 btn-primary flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Confirmar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
