import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Equipment, EquipmentStatus, Reservation, Loan } from '../types';
import { 
  Search, 
  LayoutGrid, 
  Calendar as CalendarIcon, 
  Package, 
  Clock, 
  XCircle, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Image as ImageIcon,
  LogOut
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate, optimizeCloudinaryUrl } from '../lib/utils';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  addMonths, 
  subMonths,
  isWithinInterval,
  startOfDay,
  endOfDay,
  parseISO
} from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const statusConfig: Record<EquipmentStatus, { color: string, icon: any, label: string }> = {
  'Disponible': { color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: Package, label: 'Disponible' },
  'Prestado': { color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Clock, label: 'En uso' },
  'Fuera de Servicio': { color: 'text-red-600 bg-red-50 border-red-200', icon: XCircle, label: 'Mantenimiento' },
  'Archivado': { color: 'text-slate-500 bg-slate-50 border-slate-200', icon: XCircle, label: 'No disponible' },
  'Mantenimiento': { color: 'text-amber-950 bg-amber-50 border-amber-200', icon: AlertCircle, label: 'Mantenimiento' },
  'En Mora': { color: 'text-purple-600 bg-purple-50 border-purple-200', icon: AlertCircle, label: 'Retrasado' },
};

export const PublicView: React.FC = () => {
  const navigate = useNavigate();
  const { activeResponsable, signOut } = useApp();
  const [activeTab, setActiveTab] = useState<'catalog' | 'calendar'>('catalog');
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedDayEvents, setSelectedDayEvents] = useState<{
    date: Date;
    events: { type: 'reserva' | 'prestamo', equipmentNames: string[], time: string }[]
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: eqData } = await supabase
        .from('equipamiento')
        .select('id, nombre, modelo, categoria, foto_url, estado, piezas, permiso_uso')
        .neq('estado', 'Archivado')
        .order('nombre', { ascending: true });

      const [resData, loanData, studentReqsRes] = await Promise.all([
        supabase.from('reservas').select('id, fecha_inicio, fecha_fin, equipos_ids, estado').in('estado', ['Aprobada', 'Pendiente', 'Activa', 'Avalada', 'Pendiente Aval']),
        supabase.from('prestamos').select('id, fecha_salida, fecha_devolucion_estimada, equipos_ids, estado').in('estado', ['Activo', 'Despachado', 'En Mora']),
        supabase.from('solicitudes_alumnos').select('id, fecha_inicio, fecha_fin, equipos, estado').not('estado', 'in', '("Rechazado","Cancelado","Entregado","Entregado (Modificado)")')
      ]);

      if (eqData) setEquipments(eqData as any);
      if (resData.data) setReservations(resData.data as any);
      if (loanData.data) setLoans(loanData.data as any);
      
      // Merge student requests into reservations for availability view
      if (studentReqsRes.data) {
        const mappedReqs = (studentReqsRes.data as any[]).map(req => ({
          id: req.id,
          fecha_inicio: req.fecha_inicio,
          fecha_fin: req.fecha_fin,
          equipos_ids: req.equipos,
          estado: 'Solicitud'
        }));
        setReservations(prev => [...prev, ...mappedReqs as any]);
      }
    } catch (error) {
      console.error('Error fetching public data:', error);
    }
    setLoading(false);
  };

  const handleDayClick = (day: Date) => {
    const dayReservations = reservations.filter(r => {
      const start = startOfDay(parseISO(r.fecha_inicio));
      const end = endOfDay(parseISO(r.fecha_fin));
      return isWithinInterval(day, { start, end });
    });

    const dayLoans = loans.filter(l => {
      const start = startOfDay(parseISO(l.fecha_salida));
      const end = endOfDay(parseISO(l.fecha_devolucion_estimada));
      return isWithinInterval(day, { start, end });
    });

    const events = [
      ...dayReservations.map(r => ({
        type: 'reserva' as const,
        equipmentNames: r.equipos_ids.map(id => equipments.find(e => e.id === id)?.nombre || 'Equipo no identificado'),
        time: `${format(parseISO(r.fecha_inicio), 'HH:mm')} - ${format(parseISO(r.fecha_fin), 'HH:mm')}`
      })),
      ...dayLoans.map(l => ({
        type: 'prestamo' as const,
        equipmentNames: l.equipos_ids.map(id => equipments.find(e => e.id === id)?.nombre || 'Equipo no identificado'),
        time: `${format(parseISO(l.fecha_salida), 'HH:mm')} - ${format(parseISO(l.fecha_devolucion_estimada), 'HH:mm')}`
      }))
    ];

    if (events.length > 0) {
      setSelectedDayEvents({ date: day, events });
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const categories = ['Todas', ...Array.from(new Set(equipments.map(e => e.categoria || 'Otros')))];

  const filteredEquipments = equipments.filter(eq => {
    const matchesSearch = (eq?.nombre || '').toLowerCase().includes(search.toLowerCase()) || 
                          (eq?.modelo || '').toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'Todas' || eq.categoria === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img 
              src={optimizeCloudinaryUrl("https://res.cloudinary.com/divij23kk/image/upload/v1775522044/Logo-Escuela_clscco_1_pe7ao5.png")} 
              alt="Logo Escuela de Cine" 
              width={40}
              height={40}
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              className="h-10 w-auto object-contain bg-white p-0.5 rounded shadow-sm border border-slate-100"
            />
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight text-slate-900 min-h-[28px]">SGEA</h1>
              <p className="text-[10px] uppercase font-black tracking-widest text-slate-700">Escuela Universitaria de Cine - UNT</p>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              aria-label="Ver catálogo"
              onClick={() => setActiveTab('catalog')}
              className={cn(
                "flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                activeTab === 'catalog' ? "bg-white text-slate-900 shadow-sm" : "text-slate-700 hover:text-slate-900"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              Catálogo
            </button>
            <button
              aria-label="Ver agenda"
              onClick={() => setActiveTab('calendar')}
              className={cn(
                "flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                activeTab === 'calendar' ? "bg-white text-slate-900 shadow-sm" : "text-slate-700 hover:text-slate-900"
              )}
            >
              <CalendarIcon className="w-4 h-4" />
              Agenda
            </button>
          </div>

          {activeResponsable ? (
            <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                <p className="text-xs font-bold text-slate-900">{activeResponsable}</p>
                <p className="text-[9px] font-black uppercase text-amber-600 tracking-wider">Sesión Alumno</p>
              </div>
              <button 
                onClick={signOut}
                className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors flex items-center gap-1.5 py-2 px-3 hover:bg-red-50 rounded-xl"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Salir</span>
              </button>
            </div>
          ) : (
            <button 
              onClick={() => navigate('/login')}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors hidden md:block"
            >
              Acceso Docentes →
            </button>
          )}
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'catalog' ? (
            <motion.div
              key="catalog"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Filters */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o modelo..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide min-h-[48px]">
                  <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shrink-0",
                        category === cat ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <h2 className="sr-only">Catálogo de Equipamiento</h2>

              {/* Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="aspect-[4/5] bg-white rounded-3xl animate-pulse" />
                  ))
                ) : filteredEquipments.length === 0 ? (
                  <div className="col-span-full py-20 text-center">
                    <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-700 font-bold">No se encontraron equipos</p>
                  </div>
                ) : (
                  filteredEquipments.map((eq, index) => {
                    const config = statusConfig[eq.estado as EquipmentStatus] || statusConfig['Disponible'];
                    const Icon = config.icon;

                    return (
                      <motion.div
                        layout
                        key={eq.id}
                        className="bg-white rounded-3xl border border-slate-200 overflow-hidden group hover:shadow-xl hover:shadow-slate-200/50 transition-all flex flex-col"
                      >
                        <div className="aspect-[4/3] relative overflow-hidden bg-slate-100 italic flex items-center justify-center">
                          {eq.foto_url ? (
                            <img 
                              src={optimizeCloudinaryUrl(eq.foto_url, index === 0)} 
                              alt={eq.nombre}
                              width={400}
                              height={300}
                              loading={index === 0 ? "eager" : "lazy"}
                              {...(index === 0 ? { fetchPriority: "high" } : {})}
                              decoding={index === 0 ? "sync" : "async"}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              referrerPolicy="no-referrer"
                              crossOrigin="anonymous"
                            />
                          ) : (
                            <ImageIcon className="w-12 h-12 text-slate-300" />
                          )}
                          <div className={cn(
                            "absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 shadow-sm backdrop-blur-md",
                            config.color
                          )}>
                            <Icon className="w-3 h-3" />
                            {config.label}
                          </div>
                        </div>
                        <div className="p-5 flex-1 flex flex-col">
                          <p className="text-[10px] font-black text-amber-950 uppercase tracking-widest mb-1">{eq.categoria}</p>
                          <h2 className="text-base font-bold text-slate-900 group-hover:text-slate-700 transition-colors mb-1">{eq.nombre}</h2>
                          <p className="text-xs text-slate-700 font-medium">{eq.modelo}</p>
                          
                          {eq.piezas && eq.piezas.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-50">
                              <p className="text-[9px] font-black text-slate-300 uppercase tracking-wider mb-2">Incluye</p>
                              <div className="flex flex-wrap gap-1">
                                {eq.piezas.map((p, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-slate-50 text-[9px] font-bold text-slate-700 rounded-md border border-slate-100">
                                    {typeof p === 'string' ? p : (p as any).nombre}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="mt-auto pt-5">
                            <button
                              onClick={() => toggleSelection(eq.id)}
                              disabled={eq.estado !== 'Disponible'}
                              className={cn(
                                "w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                selectedIds.includes(eq.id)
                                  ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20"
                                  : eq.estado === 'Disponible'
                                    ? "bg-white text-slate-600 border-slate-200 hover:border-slate-900 hover:text-slate-900"
                                    : "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                              )}
                            >
                              {selectedIds.includes(eq.id) ? 'Seleccionado' : eq.estado === 'Disponible' ? 'Añadir a Pedido' : 'No Disponible'}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Simplified Calendar Header */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-bold capitalize min-h-[28px]">
                    {format(currentMonth, 'MMMM yyyy', { locale: es })}
                  </h2>
                  <div className="flex gap-1">
                    <button 
                      aria-label="Mes anterior"
                      onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} 
                      className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5"/>
                    </button>
                    <button 
                      aria-label="Mes siguiente"
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} 
                      className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-5 h-5"/>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
                  <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div> Reservado</span>
                  <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> En Uso</span>
                </div>
              </div>

              {/* Grid Calendar - Simplified */}
              <div className="grid grid-cols-7 gap-1">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                  <div key={d} className="bg-white py-3 border border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">
                    {d}
                  </div>
                ))}
                {renderCalendarCells(currentMonth, reservations, loans, handleDayClick)}
              </div>
              
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700 leading-relaxed font-medium">
                  <strong>Nota para alumnos:</strong> Este calendario es solo informativo. Para solicitar equipos, debes contactar al docente de tu cátedra, quien gestionará la reserva formal a través del sistema.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Action Button for selection */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40"
          >
            <button
              onClick={() => navigate(`/solicitud?items=${selectedIds.join(',')}`)}
              className="bg-slate-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-4 hover:scale-105 transition-transform group"
            >
              <div className="flex flex-col items-start">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Equipos Seleccionados</span>
                <span className="text-sm font-bold">{selectedIds.length} {selectedIds.length === 1 ? 'Equipo' : 'Equipos'}</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors border border-white/10">
                <ChevronRight className="w-5 h-5" />
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="py-12 border-t border-slate-200 text-center">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-[0.2em] mb-4">Escuela Universitaria de Cine, Video y Televisión - UNT</p>
        <button 
          onClick={() => navigate('/login')}
          className="px-6 py-2 border border-slate-200 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-colors"
        >
          Panel Administrativo
        </button>
      </footer>

      {/* Event Detail Modal (Public) */}
      <AnimatePresence>
        {selectedDayEvents && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Agenda del día</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                    {format(selectedDayEvents.date, "EEEE d 'de' MMMM", { locale: es })}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedDayEvents(null)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {selectedDayEvents.events.map((ev, i) => (
                  <div key={i} className="flex gap-4 items-start p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                      ev.type === 'reserva' ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                    )}>
                      {ev.type === 'reserva' ? <CalendarIcon className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Reserva Confirmada
                        </span>
                        <span className="text-[10px] font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {ev.time}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {ev.equipmentNames.map((name, j) => (
                          <div key={j} className="flex items-center gap-2 text-xs font-bold text-slate-700">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                            {name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Escuela Universitaria de Cine, Video y TV
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const renderCalendarCells = (currentMonth: Date, reservations: any[], loans: any[], onDayClick: (day: Date) => void) => {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = [];
  let day = startDate;

  while (day <= endDate) {
    const cloneDay = day;
    
    // Check occupancy (Anonymized)
    const hasReservation = reservations.some(r => {
      const start = startOfDay(parseISO(r.fecha_inicio));
      const end = endOfDay(parseISO(r.fecha_fin));
      return isWithinInterval(cloneDay, { start, end });
    });

    const hasLoan = loans.some(l => {
      const start = startOfDay(parseISO(l.fecha_salida));
      const end = endOfDay(parseISO(l.fecha_devolucion_estimada));
      return isWithinInterval(cloneDay, { start, end });
    });

    const isInteractable = hasReservation || hasLoan;

    days.push(
      <button
        key={day.toString()}
        onClick={() => isInteractable && onDayClick(cloneDay)}
        disabled={!isInteractable}
        className={cn(
          "min-h-[60px] md:min-h-[100px] bg-white border border-slate-100 p-2 transition-all relative flex flex-col items-start w-full text-left",
          !isSameMonth(day, monthStart) ? "bg-slate-50/50 text-slate-200" : "text-slate-900",
          isInteractable ? "hover:bg-amber-50/30 cursor-pointer" : "cursor-default"
        )}
      >
        <span className="text-[10px] font-bold mb-1">{format(day, 'd')}</span>
        <div className="w-full flex-1 flex flex-col gap-1 overflow-hidden pointer-events-none">
          {hasLoan && (
             <div className="h-1.5 md:h-5 bg-emerald-500 bg-opacity-10 border border-emerald-500/20 rounded flex items-center px-1.5">
               <span className="hidden md:inline text-[9px] font-bold text-emerald-700 uppercase tracking-tighter">Ocupado</span>
             </div>
          )}
          {hasReservation && (
             <div className="h-1.5 md:h-5 bg-amber-400 bg-opacity-10 border border-amber-400/20 rounded flex items-center px-1.5">
               <span className="hidden md:inline text-[9px] font-bold text-amber-700 uppercase tracking-tighter">Reservado</span>
             </div>
          )}
        </div>
      </button>
    );
    day = addDays(day, 1);
  }

  return days;
};
