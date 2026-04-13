import React, { useState, useEffect } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { Reservation, Equipment, EquipmentStatus } from '../types';
import { useApp } from '../context/AppContext';
import { Link } from 'react-router-dom';
import { 
  Calendar, 
  Search, 
  Clock, 
  XCircle, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  Star,
  Filter,
  ShoppingCart,
  Plus,
  Trash2,
  Info,
  LayoutGrid,
  List,
  CheckSquare,
  Square,
  BookOpen,
  Lock,
  MapPin,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { parseISO, areIntervalsOverlapping } from 'date-fns';
import { generateReservationPDF } from '../lib/pdf';
import { MATERIAS_CATEGORIES } from '../constants';

const mapStatus = (status: string | null | undefined): EquipmentStatus => {
  if (!status) return 'Disponible';
  const s = String(status).toLowerCase();
  if (s === 'roto' || s === 'en reparación' || s === 'perdido' || s === 'mantenimiento' || s === 'incompleto' || s === 'fuera de servicio') {
    return 'Fuera de Servicio';
  }
  if (s === 'eliminado' || s === 'archivado') return 'Archivado';
  if (s === 'disponible') return 'Disponible';
  if (s === 'prestado') return 'Prestado';
  return status as EquipmentStatus;
};

export const Reservations: React.FC = () => {
  const { activeResponsable, profile, toggleFavorite } = useApp();
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');
  const [showFavorites, setShowFavorites] = useState(false);
  const [activeTab, setActiveTab] = useState<'catalogo' | 'mis-reservas'>('catalogo');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [cart, setCart] = useState<Equipment[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fecha_inicio: '',
    fecha_fin: '',
    materia: '',
    aula: '',
    alumno_nombre: ''
  });

  const categories = ['Todas', 'Cámaras', 'Sonido', 'Iluminación', 'Grip', 'Accesorios', 'Espacio', 'Otros'];

  useEffect(() => {
    fetchData();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
      setAuthLoading(false);
    }).catch((err) => {
      console.error("Error fetching user:", err);
      setCurrentUser(null);
      setAuthLoading(false);
    });
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Iniciando fetch de equipos (tabla equipamiento) y reservas (tabla reservas)...');
      const [eqData, resData] = await Promise.all([
        supabase.from('equipamiento').select('*').order('nombre', { ascending: true }),
        supabase.from('reservas').select('*').order('fecha_inicio', { ascending: true })
      ]);

      console.log('Respuesta cruda de Supabase (equipamiento):', eqData);
      console.log('Respuesta cruda de Supabase (reservas):', resData);
      
      if (eqData.error) {
        throw new Error(`Error Supabase (equipos): ${eqData.error.message}`);
      }

      if (eqData.data) {
        console.log(`Se recibieron ${eqData.data.length} equipos.`);
        const mappedData = eqData.data.map(eq => ({
          ...eq,
          estado: mapStatus(eq.estado)
        }));
        setEquipments(mappedData);
      } else {
        console.warn('No se recibieron datos de equipos.');
        setEquipments([]);
      }

      if (resData.error) {
        console.error('Error Supabase (reservas):', resData.error);
      }

      if (resData.data) setReservations(resData.data);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(`Error al cargar los datos: ${err.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredEquipments = (equipments || []).filter(eq => {
    const matchesSearch = (eq?.nombre || '').toLowerCase().includes((search || '').toLowerCase()) || 
                         (eq?.modelo || '').toLowerCase().includes((search || '').toLowerCase());
    const matchesCategory = category === 'Todas' || (eq?.categoria || 'Otros') === category;
    const matchesFavorites = showFavorites ? (profile?.favoritos || []).includes(eq?.id) : true;
    return matchesSearch && matchesCategory && matchesFavorites;
  });

  console.log(`Equipos filtrados: ${filteredEquipments.length} de ${equipments.length}`);

  const addToCart = (eq: Equipment) => {
    if (cart.find(item => item.id === eq.id)) return;
    setCart([...cart, eq]);
  };

  const addSelectedToCart = () => {
    const itemsToAdd = equipments.filter(eq => selectedIds.includes(eq.id));
    const newCart = [...cart];
    itemsToAdd.forEach(eq => {
      if (!newCart.find(item => item.id === eq.id)) {
        newCart.push(eq);
      }
    });
    setCart(newCart);
    setSelectedIds([]);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredEquipments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEquipments.map(e => e.id));
    }
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const checkOverlap = (equiposIds: string[], start: string, end: string) => {
    if (!start || !end) return false;
    const newStart = parseISO(start);
    const newEnd = parseISO(end);

    return (reservations || []).some(res => {
      if (!(res.equipos_ids || []).some((id: string) => equiposIds.includes(id))) return false;
      if (res.estado === 'Cancelada') return false;
      
      if (!res.fecha_inicio || !res.fecha_fin) return false;
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

    if (!cart || cart.length === 0) {
      setError('No has seleccionado ningún equipo.');
      alert('No has seleccionado ningún equipo.');
      return;
    }

    if (!formData.fecha_inicio || !formData.fecha_fin) {
      setError('Debe seleccionar fechas de inicio y fin.');
      return;
    }

    if (new Date(formData.fecha_inicio) >= new Date(formData.fecha_fin)) {
      setError('La fecha de inicio debe ser anterior a la fecha de fin.');
      return;
    }

    const equiposIds = (cart || []).map(eq => eq.id);
    if (checkOverlap(equiposIds, formData.fecha_inicio, formData.fecha_fin)) {
      setError('Uno o más equipos ya tienen una reserva en ese rango de fechas.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.');
        window.location.reload();
        return;
      }

      console.log('Intentando reserva con:', { user, carrito: cart });

      const newReservation = {
        equipos_ids: equiposIds,
        usuario_id: user.id,
        fecha_inicio: new Date(formData.fecha_inicio).toISOString(),
        fecha_fin: new Date(formData.fecha_fin).toISOString(),
        docente_nombre: activeResponsable || '',
        materia: formData.materia,
        aula: formData.aula,
        alumno_nombre: formData.alumno_nombre,
        estado: 'Pendiente'
      };

      const { data: insertedData, error: insertError } = await supabase.from('reservas').insert([newReservation]).select().single();
      if (insertError) throw insertError;

      console.log('Reserva guardada con éxito', insertedData);

      await logAction(activeResponsable!, 'NUEVA_RESERVA_PENDIENTE', { 
        equipos: cart.map(eq => eq.nombre),
        inicio: newReservation.fecha_inicio,
        fin: newReservation.fecha_fin
      });

      // Generar PDF
      generateReservationPDF(insertedData || newReservation, cart);

      setIsModalOpen(false);
      setCart([]);
      setFormData({ 
        fecha_inicio: '', 
        fecha_fin: '', 
        materia: '',
        aula: '',
        alumno_nombre: ''
      });
      await fetchData(); // Ensure data is fetched before switching tab
      setActiveTab('mis-reservas');
      alert('Reserva realizada con éxito. Se ha descargado tu comprobante.');
    } catch (err: any) {
      console.error('ERROR DE SUPABASE:', err);
      const errorMsg = err.message || JSON.stringify(err);
      setError(errorMsg);
      alert(`Error al guardar la reserva: ${errorMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
        <p className="text-slate-500 font-medium">Verificando sesión...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="p-8 max-w-3xl mx-auto mt-12">
        <div className="bg-red-50 border border-red-200 rounded-3xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-slate-900 mb-2">Sesión no encontrada</h2>
          <p className="text-slate-600 mb-6">
            No se pudo verificar tu identidad. Por favor, asegúrate de haber iniciado sesión correctamente.
            Si el problema persiste, intenta recargar la página.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold hover:bg-slate-800 transition-colors"
          >
            Recargar Página
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Reservas</h1>
          <p className="text-slate-500">Gestione sus reservas de equipamiento.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="bg-slate-100 p-1 rounded-2xl flex">
            <button
              onClick={() => setActiveTab('catalogo')}
              className={cn(
                "px-6 py-2.5 rounded-xl font-bold text-sm transition-all",
                activeTab === 'catalogo' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Catálogo
            </button>
            <button
              onClick={() => setActiveTab('mis-reservas')}
              className={cn(
                "px-6 py-2.5 rounded-xl font-bold text-sm transition-all",
                activeTab === 'mis-reservas' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Mis Reservas
            </button>
          </div>
          {activeTab === 'catalogo' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-1 flex shadow-sm">
              <button 
                onClick={() => setViewMode('grid')}
                className={cn("p-2 rounded-xl transition-all", viewMode === 'grid' ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600")}
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={cn("p-2 rounded-xl transition-all", viewMode === 'list' ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600")}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          )}
          {activeTab === 'catalogo' && (
            <button 
              onClick={() => setShowFavorites(!showFavorites)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all border shadow-sm",
                showFavorites 
                  ? "bg-amber-500 text-white border-amber-600 shadow-amber-200" 
                  : "bg-white text-slate-600 border-slate-200 hover:border-amber-500"
              )}
            >
              <Star className={cn("w-5 h-5", showFavorites ? "fill-current" : "text-amber-500")} />
              {showFavorites ? 'Viendo habituales' : 'Ver habituales'}
            </button>
          )}
          {activeTab === 'catalogo' && cart.length > 0 && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-slate-200 animate-in fade-in zoom-in"
            >
              <ShoppingCart className="w-5 h-5" />
              Confirmar Reserva ({cart.length})
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-6 rounded-3xl mb-8 flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="w-8 h-8 shrink-0" />
          <div>
            <h3 className="font-bold text-lg">Error al cargar el catálogo</h3>
            <p className="text-sm opacity-90">{error}</p>
            <button 
              onClick={() => fetchData()} 
              className="mt-2 text-xs font-black uppercase tracking-wider bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {activeTab === 'catalogo' ? (
        <>
          {/* Date selection at the top */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-8">
            <div className="flex flex-col md:flex-row items-end gap-6">
              <div className="flex-1 w-full">
                <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-wider">¿Para cuándo necesitas el equipo?</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                      type="datetime-local"
                      value={formData.fecha_inicio}
                      onChange={e => setFormData({...formData, fecha_inicio: e.target.value})}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-medium text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                      type="datetime-local"
                      value={formData.fecha_fin}
                      onChange={e => setFormData({...formData, fecha_fin: e.target.value})}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-medium text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="hidden md:block pb-1">
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100" title="Selecciona fechas para verificar disponibilidad en tiempo real">
                  <Info className="w-5 h-5 text-amber-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar equipo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "px-5 py-2.5 rounded-2xl text-sm font-bold transition-all whitespace-nowrap border shadow-sm",
                    category === cat 
                      ? "bg-slate-900 text-white border-slate-900" 
                      : "bg-white text-slate-600 border-slate-200 hover:border-amber-500"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-4">
              <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 border border-slate-800">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-amber-500" />
                  <span className="font-bold">{selectedIds.length} seleccionados</span>
                </div>
                <div className="h-6 w-px bg-slate-800"></div>
                <div className="flex gap-2">
                  <button 
                    onClick={addSelectedToCart}
                    className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all"
                  >
                    Reservar Seleccionados
                  </button>
                  <button 
                    onClick={() => setSelectedIds([])}
                    className="text-slate-400 hover:text-white text-sm font-bold"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sección Mis Habituales */}
          {!showFavorites && (profile?.favoritos || []).length > 0 && (
            <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-200">
                  <Star className="w-4 h-4 fill-current" />
                </div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Mis Habituales</h2>
                <div className="h-px flex-1 bg-slate-100 ml-4"></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {(equipments || [])
                  .filter(eq => (profile?.favoritos || []).includes(eq.id))
                  .map((eq) => {
                    const isInCart = (cart || []).find(item => item.id === eq.id);
                    const isReservedForDates = checkOverlap([eq.id], formData.fecha_inicio, formData.fecha_fin);
                    const isOutOfService = eq.estado === 'Fuera de Servicio';
                    const isArchived = eq.estado === 'Archivado';
                    const isNoHabilitado = eq.permiso_uso === 'No habilitado';
                    const isUnavailable = isReservedForDates || isOutOfService || isArchived || isNoHabilitado;

                    return (
                      <motion.div
                        layout
                        key={`fav-${eq.id}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={cn(
                          "bg-white rounded-3xl border overflow-hidden shadow-sm hover:shadow-xl transition-all group flex flex-col",
                          isInCart ? "border-amber-500 ring-2 ring-amber-500/20" : "border-slate-200",
                          isUnavailable && !isInCart && "opacity-75 grayscale-[0.5]"
                        )}
                      >
                        <div className="relative h-48 bg-slate-100 overflow-hidden">
                          <img
                            src={eq.foto_url || 'https://picsum.photos/seed/camera/400/300'}
                            alt={eq.nombre}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                          <button 
                            onClick={() => toggleFavorite(eq.id)}
                            className="absolute top-4 right-4 p-2.5 bg-white/90 backdrop-blur-sm rounded-full shadow-lg border border-slate-100 transition-transform active:scale-90"
                          >
                            <Star className={cn("w-5 h-5", (profile?.favoritos || []).includes(eq.id) ? "fill-amber-500 text-amber-500" : "text-slate-400")} />
                          </button>
                          <div className="absolute bottom-4 left-4 flex flex-col gap-2">
                            <span className="px-3 py-1 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-black uppercase rounded-lg tracking-wider w-fit">
                              {eq.categoria}
                            </span>
                          </div>
                        </div>
                        
                        <div className="p-5 flex-1 flex flex-col">
                          <h3 className="font-black text-slate-900 text-base leading-tight mb-1">{eq.nombre}</h3>
                          <p className="text-xs text-slate-500 mb-2">{eq.modelo}</p>

                          {eq.permiso_uso !== 'Libre uso' && (
                            <div className={cn(
                              "mb-4 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border w-fit",
                              eq.permiso_uso === 'Restringido' ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-red-50 text-red-700 border-red-100"
                            )}>
                              <Lock className="w-3 h-3" />
                              {eq.permiso_uso}
                            </div>
                          )}
                          
                          <div className="mt-auto">
                            {isInCart ? (
                              <button 
                                onClick={() => removeFromCart(eq.id)}
                                className="w-full py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                                Quitar
                              </button>
                            ) : (
                              <button 
                                onClick={() => addToCart(eq)}
                                disabled={isUnavailable}
                                className={cn(
                                  "w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md",
                                  isUnavailable 
                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none" 
                                    : "bg-slate-900 text-white hover:bg-amber-500 shadow-slate-200"
                                )}
                              >
                                {isUnavailable ? 'No disponible' : 'Añadir'}
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
              </div>
              <div className="mt-10 mb-6 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                  <Filter className="w-4 h-4" />
                </div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Catálogo Completo</h2>
                <div className="h-px flex-1 bg-slate-100 ml-4"></div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
              <p className="text-slate-500 font-medium">Cargando catálogo...</p>
            </div>
          ) : filteredEquipments.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300">
              <Filter className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900">No se encontraron equipos</h3>
              <p className="text-slate-500">Intente ajustar los filtros o la búsqueda.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {(filteredEquipments || []).map((eq) => {
                const isInCart = (cart || []).find(item => item.id === eq.id);
                const isReservedForDates = checkOverlap([eq.id], formData.fecha_inicio, formData.fecha_fin);
                const isOutOfService = eq.estado === 'Fuera de Servicio';
                const isArchived = eq.estado === 'Archivado';
                const isNoHabilitado = eq.permiso_uso === 'No habilitado';
                const isUnavailable = isReservedForDates || isOutOfService || isArchived || isNoHabilitado;

                return (
                  <motion.div
                    layout
                    key={eq.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      "bg-white rounded-3xl border overflow-hidden shadow-sm hover:shadow-xl transition-all group flex flex-col relative",
                      isInCart ? "border-amber-500 ring-2 ring-amber-500/20" : "border-slate-200",
                      isUnavailable && !isInCart && "opacity-75 grayscale-[0.5]",
                      selectedIds.includes(eq.id) && "ring-2 ring-amber-500 bg-amber-50/30"
                    )}
                  >
                    <button 
                      onClick={() => toggleSelect(eq.id)}
                      className={cn(
                        "absolute top-4 left-4 z-10 p-2 rounded-xl transition-all",
                        selectedIds.includes(eq.id) ? "bg-amber-500 text-white shadow-lg" : "bg-white/80 backdrop-blur-sm text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100"
                      )}
                    >
                      {selectedIds.includes(eq.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </button>

                    <div className="relative h-56 bg-slate-100 overflow-hidden">
                      <img
                        src={eq.foto_url || 'https://picsum.photos/seed/camera/400/300'}
                        alt={eq.nombre}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <button 
                        onClick={() => toggleFavorite(eq.id)}
                        className="absolute top-4 right-4 p-2.5 bg-white/90 backdrop-blur-sm rounded-full shadow-lg border border-slate-100 transition-transform active:scale-90"
                      >
                        <Star className={cn(
                          "w-5 h-5 transition-colors",
                          (profile?.favoritos || []).includes(eq.id) ? "fill-amber-500 text-amber-500" : "text-slate-400"
                        )} />
                      </button>
                      <div className="absolute bottom-4 left-4 flex flex-col gap-2">
                        <span className="px-3 py-1 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-black uppercase rounded-lg tracking-wider w-fit">
                          {eq.categoria}
                        </span>
                        {isUnavailable && (
                          <span className={cn(
                            "px-3 py-1 text-white text-[10px] font-black uppercase rounded-lg tracking-wider w-fit shadow-lg",
                            isArchived ? "bg-slate-600" : isOutOfService ? "bg-red-600" : isNoHabilitado ? "bg-red-800" : "bg-amber-600"
                          )}>
                            {isArchived ? 'Archivado' : isOutOfService ? 'Fuera de Servicio' : isNoHabilitado ? 'No habilitado' : 'Ocupado en estas fechas'}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="p-6 flex-1 flex flex-col">
                      <h3 className="font-black text-slate-900 text-lg leading-tight mb-1">{eq.nombre}</h3>
                      <p className="text-sm text-slate-500 mb-2">{eq.modelo}</p>

                      {eq.permiso_uso !== 'Libre uso' && (
                        <div className={cn(
                          "mb-4 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border w-fit",
                          eq.permiso_uso === 'Restringido' ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-red-50 text-red-700 border-red-100"
                        )}>
                          <Lock className="w-3 h-3" />
                          {eq.permiso_uso}
                        </div>
                      )}
                      
                      <div className="mt-auto space-y-4">
                        <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <Info className="w-4 h-4 text-amber-500" />
                          <span className="truncate">{eq.descripcion || 'Sin descripción.'}</span>
                        </div>
                        
                        {isInCart ? (
                          <button 
                            onClick={() => removeFromCart(eq.id)}
                            className="w-full py-3 bg-red-50 text-red-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                            Quitar de la reserva
                          </button>
                        ) : (
                          <button 
                            onClick={() => addToCart(eq)}
                            disabled={isUnavailable}
                            className={cn(
                              "w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg",
                              isUnavailable 
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none" 
                                : "bg-slate-900 text-white hover:bg-amber-500 shadow-slate-200"
                            )}
                          >
                            {isUnavailable ? (
                              <>
                                <XCircle className="w-5 h-5" />
                                No disponible
                              </>
                            ) : (
                              <>
                                <Plus className="w-5 h-5" />
                                Añadir a la reserva
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-4 w-10">
                      <button onClick={selectAll} className="text-slate-400 hover:text-slate-600">
                        {selectedIds.length === filteredEquipments.length ? <CheckSquare className="w-5 h-5 text-amber-500" /> : <Square className="w-5 h-5" />}
                      </button>
                    </th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Recurso</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Categoría</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEquipments.map(eq => {
                    const isInCart = (cart || []).find(item => item.id === eq.id);
                    const isReservedForDates = checkOverlap([eq.id], formData.fecha_inicio, formData.fecha_fin);
                    const isOutOfService = eq.estado === 'Fuera de Servicio';
                    const isArchived = eq.estado === 'Archivado';
                    const isUnavailable = isReservedForDates || isOutOfService || isArchived;

                    return (
                      <tr key={eq.id} className={cn("hover:bg-slate-50 transition-colors group", selectedIds.includes(eq.id) && "bg-amber-50/30")}>
                        <td className="p-4">
                          <button onClick={() => toggleSelect(eq.id)} className={cn("transition-all", selectedIds.includes(eq.id) ? "text-amber-500" : "text-slate-300 group-hover:text-slate-400")}>
                            {selectedIds.includes(eq.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                          </button>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                              <img src={eq.foto_url || 'https://picsum.photos/seed/gear/100/100'} className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{eq.nombre}</p>
                              <p className="text-xs text-slate-500">{eq.modelo}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase tracking-wider">
                            {eq.categoria}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border",
                            isUnavailable ? "bg-red-50 text-red-600 border-red-100" : "bg-green-50 text-green-600 border-green-100"
                          )}>
                            {isUnavailable ? 'No Disponible' : 'Disponible'}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          {isInCart ? (
                            <button onClick={() => removeFromCart(eq.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl">
                              <Trash2 className="w-5 h-5" />
                            </button>
                          ) : (
                            <button 
                              onClick={() => addToCart(eq)} 
                              disabled={isUnavailable}
                              className={cn("p-2 rounded-xl transition-all", isUnavailable ? "text-slate-300" : "text-amber-500 hover:bg-amber-50")}
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          {(reservations || []).filter(r => r.docente_nombre === activeResponsable).length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900">No tienes reservas</h3>
              <p className="text-slate-500">Tus reservas aparecerán aquí.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {(reservations || []).filter(r => r.docente_nombre === activeResponsable).map(res => (
                <div key={res.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                        res.estado === 'Pendiente' ? "bg-amber-100 text-amber-700" :
                        res.estado === 'Entregada' ? "bg-green-100 text-green-700" :
                        res.estado === 'Cancelada' ? "bg-red-100 text-red-700" :
                        "bg-blue-100 text-blue-700"
                      )}>
                        {res.estado}
                      </span>
                      <span className="text-sm text-slate-500">
                        {new Date(res.fecha_inicio).toLocaleDateString()} - {new Date(res.fecha_fin).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(res.equipos_ids || []).map(id => {
                        const eq = (equipments || []).find(e => e.id === id);
                        return eq ? (
                          <div key={id} className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                            <span className="text-sm font-bold text-slate-700">{eq.nombre}</span>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                  <div className="flex items-center justify-end">
                    <button 
                      onClick={() => generateReservationPDF(res, (equipments || []).filter(e => (res.equipos_ids || []).includes(e.id)))}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 hover:text-amber-600 bg-slate-50 hover:bg-amber-50 rounded-xl transition-colors"
                    >
                      Descargar Comprobante
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cart Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-200">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Confirmar Pedido</h2>
                    <p className="text-sm text-slate-500">{cart.length} equipos seleccionados</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-white rounded-full transition-colors">
                  <XCircle className="w-7 h-7" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl text-sm flex items-center gap-3 font-medium">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-wider">Materia</label>
                    <div className="relative">
                      <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <select
                        required
                        value={formData.materia}
                        onChange={e => setFormData({...formData, materia: e.target.value})}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-medium appearance-none"
                      >
                        <option value="">Seleccione una materia...</option>
                        {Object.entries(MATERIAS_CATEGORIES).map(([cat, materias]) => (
                          <optgroup key={cat} label={cat}>
                            {materias.map(m => <option key={m} value={m}>{m}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-wider">Aula / Espacio</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <select
                        required
                        value={formData.aula}
                        onChange={e => setFormData({...formData, aula: e.target.value})}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-medium appearance-none"
                      >
                        <option value="">Seleccione aula...</option>
                        <option value="Aula A">Aula A</option>
                        <option value="Aula B">Aula B</option>
                        <option value="Aula C">Aula C</option>
                        <option value="Aula D">Aula D</option>
                        <option value="Aula E">Aula E</option>
                        <option value="Aula F">Aula F</option>
                        <option value="Aula G">Aula G</option>
                        <option value="SET">SET</option>
                        <option value="Exteriores">Exteriores</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-wider">Alumno Responsable</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input
                        required
                        type="text"
                        placeholder="Nombre del alumno"
                        value={formData.alumno_nombre}
                        onChange={e => setFormData({...formData, alumno_nombre: e.target.value})}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-wider">Fecha Desde</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input
                        required
                        type="datetime-local"
                        value={formData.fecha_inicio}
                        onChange={e => setFormData({...formData, fecha_inicio: e.target.value})}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-wider">Fecha Hasta</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input
                        required
                        type="datetime-local"
                        value={formData.fecha_fin}
                        onChange={e => setFormData({...formData, fecha_fin: e.target.value})}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Equipos en el pedido</p>
                  {(cart || []).map(eq => (
                    <div key={eq.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-200 overflow-hidden">
                          <img src={eq.foto_url || 'https://picsum.photos/seed/gear/50/50'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <span className="text-sm font-bold text-slate-700">{eq.nombre}</span>
                      </div>
                      <button type="button" onClick={() => removeFromCart(eq.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="flex-1 px-6 py-4 text-slate-600 font-black uppercase tracking-wider hover:bg-slate-100 rounded-2xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={submitting || !currentUser}
                    className="flex-1 bg-slate-900 text-white font-black uppercase tracking-wider py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-amber-500 transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                    Confirmar Reserva
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
