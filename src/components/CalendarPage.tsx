import React, { useState, useEffect } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  parseISO, 
  isWithinInterval,
  startOfDay,
  endOfDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Info, 
  X,
  Clock,
  User,
  Package,
  Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { Reservation, Equipment, Loan, StudentRequest } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn, optimizeCloudinaryThumb } from '../lib/utils';

const EquipmentThumbnail: React.FC<{ url?: string; id: string; name?: string }> = ({ url, id, name }) => {
  const [error, setError] = useState(false);
  
  if (!url || error) {
    return (
      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
        <Package className="w-5 h-5 text-slate-400" />
      </div>
    );
  }

  return (
    <img 
      src={optimizeCloudinaryThumb(url)} 
      alt={name || 'Equipo'} 
      className="w-10 h-10 rounded-lg object-cover shrink-0 border border-slate-100 shadow-sm"
      onError={() => setError(true)}
      crossOrigin="anonymous"
      referrerPolicy="no-referrer"
    />
  );
};

export const CalendarPage: React.FC = () => {
  const { userEmail, role: activeRole, isSuperAdmin } = useApp();
  const isAdministracion = activeRole === 'Administración';
  const isDocente = activeRole === 'Docente';
  const isDirector = activeRole === 'Director';

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [studentRequests, setStudentRequests] = useState<StudentRequest[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Usamos consultas individuales para que si una falla (ej: tabla no existe) las demás sigan funcionando
      const res = await supabase.from('reservas').select('id, docente_nombre, alumno_nombre, fecha_inicio, fecha_fin, equipos_ids, materia, aula, estado').in('estado', ['Pendiente', 'Aprobada']);
      if (res.data) setReservations(res.data);

      const loansRes = await supabase.from('prestamos').select('id, alumno_nombre, docente_responsable, fecha_salida, fecha_devolucion_estimada, equipos_ids, estado').eq('estado', 'Activo');
      if (loansRes.data) setLoans(loansRes.data);

      const eqRes = await supabase.from('equipamiento').select('id, nombre, modelo, foto_url');
      if (eqRes.data) setEquipments(eqRes.data);

      try {
        const studentRes = await supabase.from('solicitudes_alumnos').select('id, responsable, docente_nombre, fecha_inicio, fecha_fin, equipos, estado, materia').not('estado', 'in', '("Rechazado","Cancelado","Entregado")');
        if (studentRes.error) throw studentRes.error;
        if (studentRes.data) setStudentRequests(studentRes.data);
      } catch (e) {
        console.warn('Error al cargar solicitudes_alumnos (puede que la tabla no exista o no tenga permisos aún):', e);
        setStudentRequests([]);
      }
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
    }
  };  const renderHeader = () => {
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900 capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </h1>
          <p className="text-sm md:text-base text-slate-500">Ocupación y disponibilidad de equipos.</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-600 flex-1 sm:flex-none flex justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-4 py-2 text-xs md:text-sm font-bold text-amber-950 hover:bg-amber-50 rounded-lg transition-colors flex-1 sm:flex-none flex justify-center"
          >
            Hoy
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-600 flex-1 sm:flex-none flex justify-center"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    const fullDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return (
      <div className="grid grid-cols-7 mb-2">
        {(window.innerWidth < 640 ? days : fullDays).map((day, i) => (
          <div key={i} className="text-center text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest py-2">
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, "d");
        const cloneDay = day;
        
        const dayReservations = (reservations || []).filter(res => {
          if (!res.fecha_inicio || !res.fecha_fin) return false;
          const start = startOfDay(parseISO(res.fecha_inicio));
          const end = endOfDay(parseISO(res.fecha_fin));
          return isWithinInterval(cloneDay, { start, end });
        });

        const dayLoans = (loans || []).filter(loan => {
          if (!loan.fecha_salida || !loan.fecha_devolucion_estimada) return false;
          const start = startOfDay(parseISO(loan.fecha_salida));
          const end = endOfDay(parseISO(loan.fecha_devolucion_estimada));
          return isWithinInterval(cloneDay, { start, end });
        });

        const dayRequests = (studentRequests || []).filter(req => {
          if (!req.fecha_inicio || !req.fecha_fin) return false;
          const start = startOfDay(parseISO(req.fecha_inicio));
          const end = endOfDay(parseISO(req.fecha_fin));
          return isWithinInterval(cloneDay, { start, end });
        });

        const totalEvents = [
          ...dayReservations.map(r => ({ ...r, type: 'reservation' })), 
          ...dayLoans.map(l => ({ ...l, type: 'loan' })),
          ...dayRequests.map(r => ({ ...r, type: 'student_request' }))
        ];

        days.push(
          <div
            key={day.toString()}
            className={cn(
              "min-h-[80px] md:min-h-[120px] bg-white border border-slate-100 p-1 md:p-2 transition-all cursor-pointer hover:bg-slate-50 relative group text-left",
              !isSameMonth(day, monthStart) ? "bg-slate-50/50 text-slate-300" : "text-slate-900",
              isSameDay(day, new Date()) && "ring-2 ring-inset ring-amber-500/20 bg-amber-50/30"
            )}
            onClick={() => {
              setSelectedDate(cloneDay);
              setShowDetail(true);
            }}
          >
            <span className={cn(
              "text-xs md:text-sm font-bold inline-flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-full mb-1",
              isSameDay(day, new Date()) ? "bg-amber-500 text-white" : ""
            )}>
              {formattedDate}
            </span>
            
            <div className="space-y-1 overflow-hidden">
              {totalEvents.slice(0, 3).map((event: any) => {
                const isLoan = event.type === 'loan';
                const isStudent = event.type === 'student_request';
                const isAuthorized = event.estado === 'Autorizado para Despacho' || isLoan;
                
                let statusColor = isLoan ? 'bg-emerald-500' : (event.estado === 'Pendiente' ? 'bg-amber-400' : 'bg-blue-500');
                if (isStudent) {
                  statusColor = isAuthorized ? 'bg-indigo-500' : 'bg-slate-300';
                }

                const label = isLoan 
                  ? (event.alumno_nombre || event.docente_responsable) 
                  : (isStudent ? (event.responsable || event.docente_nombre) : (event.alumno_nombre || event.docente_nombre));
                
                const finalLabel = label || 'Reserva sin asignar';
                
                return (
                  <div 
                    key={`${event.type}-${event.id}`} 
                    className="flex md:block"
                  >
                    <div className={cn(
                      "w-1.5 h-1.5 md:w-auto md:h-auto rounded-full md:rounded md:px-1.5 md:py-0.5 md:border md:truncate md:text-[10px] md:font-semibold", 
                      statusColor, 
                      "md:bg-opacity-10 md:border-opacity-20 md:text-slate-700",
                      isStudent && !isAuthorized && "md:border-dashed md:border-slate-400"
                    )}>
                      <span className="hidden md:inline">
                        {isAdministracion ? `${finalLabel.split(' ')[0]}: ` : ''}
                        {(isStudent ? event.equipos : (event.equipos_ids || [])).map((id: string) => (equipments || []).find(e => e.id === id)?.nombre).filter(Boolean).slice(0, 2).join(', ')}
                        {(isStudent ? event.equipos : (event.equipos_ids || [])).length > 2 && '...'}
                      </span>
                    </div>
                  </div>
                );
              })}
              {totalEvents.length > 3 && (
                <div className="text-[8px] md:text-[9px] text-slate-400 font-black pl-1 uppercase">
                  + {totalEvents.length - 3} items
                </div>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="rounded-xl md:rounded-2xl border border-slate-200 overflow-hidden shadow-sm">{rows}</div>;
  };

  const renderDetailModal = () => {
    if (!selectedDate) return null;

    const dayReservations = (reservations || []).filter(res => {
      if (!res.fecha_inicio || !res.fecha_fin) return false;
      const start = startOfDay(parseISO(res.fecha_inicio));
      const end = endOfDay(parseISO(res.fecha_fin));
      return isWithinInterval(selectedDate, { start, end });
    });

    const dayLoans = (loans || []).filter(loan => {
      if (!loan.fecha_salida || !loan.fecha_devolucion_estimada) return false;
      const start = startOfDay(parseISO(loan.fecha_salida));
      const end = endOfDay(parseISO(loan.fecha_devolucion_estimada));
      return isWithinInterval(selectedDate, { start, end });
    });

    const dayRequests = (studentRequests || []).filter(req => {
      if (!req.fecha_inicio || !req.fecha_fin) return false;
      const start = startOfDay(parseISO(req.fecha_inicio));
      const end = endOfDay(parseISO(req.fecha_fin));
      return isWithinInterval(selectedDate, { start, end });
    });

    const totalEvents = [
      ...dayReservations.map(r => ({ ...r, type: 'reservation' })), 
      ...dayLoans.map(l => ({ ...l, type: 'loan' })),
      ...dayRequests.map(r => ({ ...r, type: 'student_request' }))
    ];

    return (
      <AnimatePresence>
        {showDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden my-auto"
            >
              <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-900/20 shrink-0">
                    <CalendarIcon className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg md:text-xl font-bold text-slate-900 truncate">
                      {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                    </h2>
                    <p className="text-xs md:text-sm text-slate-500">Cronograma de movimientos.</p>
                  </div>
                </div>
                <button 
                   onClick={() => setShowDetail(false)}
                   className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-4 md:p-6 max-h-[65vh] overflow-y-auto space-y-4 custom-scrollbar">
                {totalEvents.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Package className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-bold">Sin actividad programada</p>
                    <p className="text-xs text-slate-400">No hay préstamos ni reservas para este día.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {totalEvents.map((event: any) => {
                      const isLoan = event.type === 'loan';
                      const isStudent = event.type === 'student_request';
                      const start = isLoan ? event.fecha_salida : event.fecha_inicio;
                      const end = isLoan ? event.fecha_devolucion_estimada : event.fecha_fin;
                      
                      const label = isLoan 
                        ? (event.alumno_nombre || event.docente_responsable) 
                        : (isStudent ? (event.responsable || event.docente_nombre) : (event.alumno_nombre || event.docente_nombre));
                      
                      const finalLabel = label || 'Reserva sin asignar';

                      let subLabel = isLoan ? 'Préstamo Activo' : (isStudent ? 'Solicitud Alumno' : `Reserva ${event.estado}`);
                      if (isStudent) {
                        subLabel = `Solicitud: ${event.estado}`;
                      }
                      
                      return (
                        <div key={`${event.type}-${event.id}`} className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-sm">
                          <div className="flex items-center justify-between mb-4">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                              isLoan ? "bg-emerald-50 text-emerald-600 border-emerald-200" : (isStudent ? "bg-indigo-50 text-indigo-600 border-indigo-200" : (event.estado === 'Pendiente' ? "bg-amber-50 text-amber-950 border-amber-200" : "bg-blue-50 text-blue-600 border-blue-200"))
                            )}>
                              {subLabel}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-500 font-bold">
                              <Clock className="w-4 h-4" />
                              {format(parseISO(start), 'HH:mm')} - {format(parseISO(end), 'HH:mm')}
                            </div>
                          </div>

                          <div className={cn(
                            "flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100",
                            isStudent && event.estado !== 'Autorizado para Despacho' && "border-dashed border-slate-300"
                          )}>
                             <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                               <User className="w-4 h-4 text-slate-500" />
                             </div>
                             <div className="min-w-0">
                               <p className="text-[10px] text-slate-400 font-black uppercase tracking-tight">
                                 {isStudent ? 'Responsable Alumno' : 'Docente / Responsable'}
                               </p>
                               <p className="text-sm font-bold text-slate-900 truncate">{finalLabel}</p>
                             </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-tight mb-2">Equipamiento Asociado</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {(isStudent ? event.equipos : (event.equipos_ids || [])).map((id: string) => {
                                const eq = (equipments || []).find(e => e.id === id);
                                return (
                                  <div key={id} className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-amber-200 transition-colors">
                                    <EquipmentThumbnail 
                                      url={eq?.foto_url} 
                                      id={id} 
                                      name={eq?.nombre} 
                                    />
                                    <div className="min-w-0">
                                      <p className="text-[11px] font-bold text-slate-900 truncate">{eq?.nombre || 'General'}</p>
                                      <p className="text-[9px] text-slate-500 truncate font-medium uppercase tracking-wider">{eq?.modelo || 'SGEA'}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setShowDetail(false)}
                  className="w-full sm:w-auto px-8 py-3 bg-slate-900 text-white font-black uppercase tracking-wider text-xs rounded-xl hover:bg-amber-500 transition-all shadow-lg shadow-slate-200"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-slate-500 font-bold">Iniciando Calendario...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Visual Identity Headers */}
      {isDirector && (
        <div className="mb-6 bg-[#450a0a] text-white px-6 py-3 rounded-2xl flex items-center justify-between shadow-xl border-l-4 border-amber-500">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="text-xs font-black uppercase tracking-[0.2em]">Panel de Dirección</span>
          </div>
          <span className="text-[10px] font-bold opacity-60 uppercase">{userEmail}</span>
        </div>
      )}

      {isDocente && (
        <div className="mb-6 bg-amber-50 text-amber-900 px-6 py-3 rounded-2xl flex items-center justify-between border border-amber-100">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-amber-500" />
            <span className="text-xs font-black uppercase tracking-widest">Panel Docente: Gestión de Avales</span>
          </div>
        </div>
      )}

      {isAdministracion && (
        <div className="mb-6 bg-slate-100 text-slate-900 px-6 py-3 rounded-2xl flex items-center justify-between border border-slate-200">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-slate-500" />
            <span className="text-xs font-black uppercase tracking-widest">Panel de Administración</span>
          </div>
        </div>
      )}

      {renderHeader()}
      
      <div className="bg-white p-3 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-slate-200">
        <div className="flex flex-wrap items-center gap-4 md:gap-6 mb-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-400"></div>
            <span>Reserva Pendiente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>Reserva Aprobada</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span>Préstamo en Curso</span>
          </div>
        </div>

        {renderDays()}
        {renderCells()}
      </div>

      {renderDetailModal()}
    </div>
  );
};
