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
import { Reservation, Equipment } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export const CalendarPage: React.FC = () => {
  const { profile } = useApp();
  const role = profile?.rol;
  const isPañolero = role === 'Pañolero';

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resData, eqData] = await Promise.all([
        supabase.from('reservas').select('*').in('estado', ['Pendiente', 'Aprobada', 'Entregada']),
        supabase.from('equipamiento').select('*')
      ]);

      if (resData.data) setReservations(resData.data);
      if (eqData.data) setEquipments(eqData.data);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </h1>
          <p className="text-slate-500">Visualización de ocupación y disponibilidad de equipos.</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-4 py-2 text-sm font-bold text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-600"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map((day, i) => (
          <div key={i} className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest py-2">
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
        
        // Find reservations for this day
        const dayReservations = (reservations || []).filter(res => {
          if (!res.fecha_inicio || !res.fecha_fin) return false;
          const start = startOfDay(parseISO(res.fecha_inicio));
          const end = endOfDay(parseISO(res.fecha_fin));
          return isWithinInterval(cloneDay, { start, end });
        });

        days.push(
          <div
            key={day.toString()}
            className={cn(
              "min-h-[120px] bg-white border border-slate-100 p-2 transition-all cursor-pointer hover:bg-slate-50 relative group",
              !isSameMonth(day, monthStart) ? "bg-slate-50/50 text-slate-300" : "text-slate-900",
              isSameDay(day, new Date()) && "ring-2 ring-inset ring-amber-500/20 bg-amber-50/30"
            )}
            onClick={() => {
              setSelectedDate(cloneDay);
              setShowDetail(true);
            }}
          >
            <span className={cn(
              "text-sm font-bold inline-flex items-center justify-center w-7 h-7 rounded-full mb-1",
              isSameDay(day, new Date()) ? "bg-amber-500 text-white" : ""
            )}>
              {formattedDate}
            </span>
            
            <div className="space-y-1 overflow-hidden">
              {dayReservations.slice(0, 3).map((res) => {
                const statusColor = res.estado === 'Pendiente' 
                  ? 'bg-amber-100 text-amber-700 border-amber-200' 
                  : 'bg-blue-100 text-blue-700 border-blue-200';
                
                return (
                  <div 
                    key={res.id} 
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded border truncate font-medium",
                      statusColor
                    )}
                  >
                    {isPañolero ? `${res.docente_nombre}: ` : ''}
                    {(res.equipos_ids || []).map(id => (equipments || []).find(e => e.id === id)?.nombre).filter(Boolean).join(', ')}
                  </div>
                );
              })}
              {dayReservations.length > 3 && (
                <div className="text-[9px] text-slate-400 font-bold pl-1">
                  + {dayReservations.length - 3} más
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
    return <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">{rows}</div>;
  };

  const renderDetailModal = () => {
    if (!selectedDate) return null;

    const dayReservations = (reservations || []).filter(res => {
      const start = startOfDay(parseISO(res.fecha_inicio));
      const end = endOfDay(parseISO(res.fecha_fin));
      return isWithinInterval(selectedDate, { start, end });
    });

    return (
      <AnimatePresence>
        {showDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                    <CalendarIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                    </h2>
                    <p className="text-sm text-slate-500">Detalle de ocupación para este día.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowDetail(false)}
                  className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {dayReservations.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Package className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium">No hay reservas para este día.</p>
                    <p className="text-sm text-slate-400">Todos los equipos están disponibles.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dayReservations.map((res) => (
                      <div key={res.id} className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                              res.estado === 'Pendiente' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                            )}>
                              {res.estado}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            {format(parseISO(res.fecha_inicio), 'HH:mm')} - {format(parseISO(res.fecha_fin), 'HH:mm')}
                          </div>
                        </div>

                        {isPañolero && (
                          <div className="flex items-center gap-3 mb-4 p-3 bg-white rounded-xl border border-slate-100">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                              <User className="w-4 h-4 text-slate-500" />
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Docente</p>
                              <p className="text-sm font-bold text-slate-900">{res.docente_nombre}</p>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-1">Equipos Reservados</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(res.equipos_ids || []).map(id => {
                              const eq = (equipments || []).find(e => e.id === id);
                              return (
                                <div key={id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                  <div className="w-8 h-8 rounded bg-slate-900 overflow-hidden flex-shrink-0">
                                    <img src={eq?.foto_url || 'https://picsum.photos/seed/gear/50/50'} className="w-full h-full object-cover opacity-80" referrerPolicy="no-referrer" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900 truncate">{eq?.nombre || 'Equipo no encontrado'}</p>
                                    <p className="text-[9px] text-slate-500 truncate">{eq?.modelo}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setShowDetail(false)}
                  className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
                >
                  Entendido
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Cargando calendario...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {renderHeader()}
      
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-6 mb-6 text-xs font-bold uppercase tracking-widest text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-400"></div>
            <span>Pendiente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-400"></div>
            <span>Aprobada / Entregada</span>
          </div>
        </div>

        {renderDays()}
        {renderCells()}
      </div>

      {renderDetailModal()}
    </div>
  );
};
