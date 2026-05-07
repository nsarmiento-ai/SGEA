import React, { useState, useEffect } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { Reservation, Equipment, StudentRequest } from '../types';
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
  AlertCircle,
  ShieldCheck,
  BookOpen,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';

type UnifiedRequest = 
  | { type: 'standard'; data: Reservation }
  | { type: 'student'; data: StudentRequest };

export const PendingReservations: React.FC = () => {
  const { activeResponsable, role, userEmail } = useApp();
  const [unifiedRequests, setUnifiedRequests] = useState<UnifiedRequest[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const isDireccion = userEmail === 'jveiga@cine.unt.edu.ar' || userEmail === 'n.sarmiento@cine.unt.edu.ar';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resData, studentData, eqData] = await Promise.all([
        supabase.from('reservas').select('*').eq('estado', 'Pendiente').order('fecha_inicio', { ascending: true }),
        supabase.from('solicitudes_alumnos')
          .select('*')
          .in('estado', ['Pendiente de Aval Docente', 'Pendiente de Dirección', 'Autorizado para Despacho'])
          .order('created_at', { ascending: false }),
        supabase.from('equipamiento').select('*')
      ]);

      const unified: UnifiedRequest[] = [
        ...(resData.data || []).map(r => ({ type: 'standard' as const, data: r })),
        ...(studentData.data || []).map(s => ({ type: 'student' as const, data: s }))
      ];

      setUnifiedRequests(unified);
      if (eqData.data) setEquipments(eqData.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelStandard = async (id: string) => {
    if (!confirm('¿Está seguro de cancelar esta reserva?')) return;
    try {
      const { error } = await supabase.from('reservas').update({ estado: 'Cancelada' }).eq('id', id);
      if (error) throw error;
      await logAction(activeResponsable!, 'CANCELAR_RESERVA', { reservationId: id });
      fetchData();
    } catch (err) {
      console.error('Error cancelling reservation:', err);
    }
  };

  const handleCancelStudent = async (id: string) => {
    if (!confirm('¿Está seguro de cancelar esta solicitud?')) return;
    try {
      const { error } = await supabase.from('solicitudes_alumnos').update({ estado: 'Cancelado' }).eq('id', id);
      if (error) throw error;
      await logAction(activeResponsable!, 'CANCELAR_SOLICITUD_ALUMNO', { requestId: id });
      fetchData();
    } catch (err) {
      console.error('Error cancelling student request:', err);
    }
  };

  const handleDeliver = (req: UnifiedRequest) => {
    const params = new URLSearchParams();
    if (req.type === 'standard') {
      const res = req.data;
      params.set('resId', res.id);
      params.set('docente', res.docente_nombre);
      params.set('alumno', res.alumno_nombre || '');
      params.set('equipos', res.equipos_ids.join(','));
      params.set('fin', res.fecha_fin);
      params.set('materia', res.materia || '');
    } else {
      const student = req.data;
      params.set('studentReqId', student.id);
      params.set('docente', student.docente_nombre);
      params.set('alumno', student.responsable);
      params.set('dni', student.dni);
      params.set('equipos', student.equipos.join(','));
      params.set('fin', student.fecha_fin);
      params.set('materia', student.materia);
    }
    navigate(`/nuevo-prestamo?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
        <p className="text-slate-500 font-medium">Cargando solicitudes pendientes...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto pt-16 lg:pt-8 text-slate-900">
      {/* Visual Identity Headers */}
      {role === 'Administración' && (
        <div className="mb-6 bg-slate-100 text-slate-900 px-6 py-3 rounded-2xl flex items-center justify-between border border-slate-200">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-slate-500" />
            <span className="text-xs font-black uppercase tracking-widest">Panel de Administración</span>
          </div>
          <span className="text-[10px] font-bold opacity-60 uppercase">{userEmail}</span>
        </div>
      )}

      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900">Reservas y Solicitudes</h1>
        <p className="text-sm md:text-base text-slate-500 font-medium">Gestione todas las peticiones unificadas para el despacho de equipos.</p>
      </header>

      {unifiedRequests.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-slate-200">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold">Todo al día</h3>
          <p className="text-slate-500">No hay reservas ni solicitudes pendientes en este momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <AnimatePresence>
            {unifiedRequests.map((req) => {
              const id = req.type === 'standard' ? req.data.id : req.data.id;
              const isStudent = req.type === 'student';
              const status = isStudent ? (req.data as StudentRequest).estado : 'Pendiente';
              const canDeliver = !isStudent || status === 'Autorizado para Despacho';
              
              const displayName = isStudent ? (req.data as StudentRequest).responsable : (req.data as Reservation).docente_nombre;
              const displaySub = isStudent ? `DNI: ${(req.data as StudentRequest).dni}` : (req.data as Reservation).alumno_nombre ? `Para: ${(req.data as Reservation).alumno_nombre}` : 'Reserva Docente';
              const fechaInicio = isStudent ? (req.data as StudentRequest).fecha_inicio : (req.data as Reservation).fecha_inicio;
              const fechaFin = isStudent ? (req.data as StudentRequest).fecha_fin : (req.data as Reservation).fecha_fin;
              const equipos = isStudent ? (req.data as StudentRequest).equipos : (req.data as Reservation).equipos_ids;
              const materia = isStudent ? (req.data as StudentRequest).materia : (req.data as Reservation).materia;

              return (
                <motion.div
                  key={`${req.type}-${id}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    "bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col lg:flex-row hover:shadow-xl hover:border-amber-200 transition-all",
                    isStudent && status !== 'Autorizado para Despacho' && "opacity-75 grayscale-[0.5]"
                  )}
                >
                  <div className="p-6 lg:w-1/3 bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-100 relative">
                    {isStudent && (
                      <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                        <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-200 shadow-sm">
                          Alumno
                        </span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border shadow-sm",
                          status === 'Autorizado para Despacho' ? "bg-green-100 text-green-700 border-green-200" : "bg-slate-100 text-slate-500 border-slate-200"
                        )}>
                          {status}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3 mb-6">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
                        isStudent ? "bg-amber-500 text-white" : "bg-slate-900 text-white"
                      )}>
                        {isStudent ? <User className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {isStudent ? 'Responsable' : 'Docente'}
                        </p>
                        <p className="font-black text-slate-900 truncate text-lg leading-tight">{displayName}</p>
                        <p className="text-xs font-bold text-slate-500">{displaySub}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <div className="flex flex-col">
                          <span>{format(parseISO(fechaInicio), 'dd/MM/yy HH:mm')}</span>
                          <span className="text-[10px] text-slate-400">al {format(parseISO(fechaFin), 'dd/MM/yy HH:mm')}</span>
                        </div>
                      </div>
                      {materia && (
                        <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                          <BookOpen className="w-4 h-4 text-slate-400" />
                          <span>{materia}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                      <Package className="w-4 h-4 text-amber-500" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Equipamiento Solicitado ({equipos.length})</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
                      {equipos.slice(0, 6).map(eqId => {
                        const eq = (equipments || []).find(e => e.id === eqId);
                        return (
                          <div key={eqId} className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 group/item">
                            <div className="w-10 h-10 rounded-xl bg-slate-200 overflow-hidden flex-shrink-0 shadow-sm">
                              <img 
                                src={eq?.foto_url || 'https://picsum.photos/seed/gear/50/50'} 
                                className="w-full h-full object-cover grayscale-[0.3] group-hover/item:grayscale-0 transition-all" 
                                referrerPolicy="no-referrer" 
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-700 truncate">{eq?.nombre || 'Equipo desconocido'}</span>
                          </div>
                        );
                      })}
                      {equipos.length > 6 && (
                        <div className="flex items-center justify-center p-3 rounded-2xl bg-slate-100 border border-dashed border-slate-300 text-[10px] font-black text-slate-400 uppercase">
                          + {equipos.length - 6} más
                        </div>
                      )}
                    </div>

                    <div className="mt-auto flex flex-col sm:flex-row gap-4">
                      <button 
                        onClick={() => isStudent ? handleCancelStudent(id) : handleCancelStandard(id)}
                        className="flex-1 px-6 py-4 border-2 border-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Rechazar / Cancelar
                      </button>
                      <button 
                        disabled={!canDeliver}
                        onClick={() => handleDeliver(req)}
                        className={cn(
                          "flex-[2] px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl",
                          canDeliver 
                            ? "bg-slate-900 text-white hover:bg-amber-500 shadow-slate-200" 
                            : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                        )}
                      >
                        {isStudent && !canDeliver ? (
                          <>
                            <Clock className="w-4 h-4" />
                            Esperando Autorización
                          </>
                        ) : (
                          <>
                            <ArrowRight className="w-4 h-4" />
                            Proceder al Despacho (DNI)
                          </>
                        )}
                      </button>
                    </div>
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
