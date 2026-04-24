import React, { useState, useEffect } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { Equipment, EquipmentStatus, Pieza } from '../types';
import { useApp } from '../context/AppContext';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  History,
  Tag,
  Package,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  Loader2,
  Calendar,
  Star,
  LayoutGrid,
  List,
  CheckSquare,
  Square,
  BookOpen,
  Lock
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { isWithinInterval, parseISO, isAfter } from 'date-fns';
import { Reservation } from '../types';

const statusConfig: Record<EquipmentStatus, { color: string, icon: any, label: string }> = {
  'Disponible': { color: 'text-green-600 bg-green-50 border-green-200', icon: CheckCircle2, label: 'Disponible' },
  'Prestado': { color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Clock, label: 'Prestado' },
  'Fuera de Servicio': { color: 'text-red-600 bg-red-50 border-red-200', icon: XCircle, label: 'Fuera de Servicio' },
  'Archivado': { color: 'text-slate-500 bg-slate-50 border-slate-200', icon: Trash2, label: 'Archivado' },
};

const mapStatus = (status: string | null | undefined): EquipmentStatus => {
  if (!status) return 'Disponible';
  const s = String(status).toLowerCase();
  
  if (s === 'roto' || s === 'en reparación' || s === 'perdido' || s === 'incompleto' || s === 'fuera de servicio' || s === 'mantenimiento') {
    return 'Fuera de Servicio';
  }
  if (s === 'eliminado' || s === 'archivado') return 'Archivado';
  if (s === 'disponible') return 'Disponible';
  if (s === 'prestado') return 'Prestado';
  return status as EquipmentStatus;
};

const InventoryMetrics: React.FC<{ equipments: Equipment[] }> = ({ equipments }) => {
  const stats = {
    disponible: equipments.filter(e => e.estado === 'Disponible').length,
    prestado: equipments.filter(e => e.estado === 'Prestado').length,
    fueraDeServicio: equipments.filter(e => e.estado === 'Fuera de Servicio' || e.estado === 'Mantenimiento').length,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Disponible</p>
          <p className="text-2xl font-black text-slate-900">{stats.disponible}</p>
        </div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
          <Clock className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total en Préstamo</p>
          <p className="text-2xl font-black text-slate-900">{stats.prestado}</p>
        </div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
          <XCircle className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fuera de Servicio</p>
          <p className="text-2xl font-black text-slate-900">{stats.fueraDeServicio}</p>
        </div>
      </div>
    </div>
  );
};

export const Catalog: React.FC = () => {
  const { activeResponsable, profile, toggleFavorite, role } = useApp();
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');
  const [showArchived, setShowArchived] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const categories = ['Todas', 'Cámaras', 'Sonido', 'Iluminación', 'Grip', 'Accesorios', 'Espacio', 'Otros'];

  useEffect(() => {
    fetchEquipments();
  }, []);

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

  const fetchEquipments = async () => {
    setLoading(true);
    console.log('Catalog: Iniciando fetch de equipos (tabla equipamiento) y reservas (tabla reservas)...');
    const [eqRes, resRes] = await Promise.all([
      supabase.from('equipamiento').select('*').order('nombre', { ascending: true }),
      supabase.from('reservas').select('*')
    ]);
    
    console.log('Catalog: Respuesta cruda de Supabase (equipamiento):', eqRes);
    console.log('Catalog: Respuesta cruda de Supabase (reservas):', resRes);

    if (!eqRes.error && eqRes.data) {
      console.log(`Catalog: Se recibieron ${eqRes.data.length} equipos.`);
      const mappedData = eqRes.data.map(eq => {
        let parsedPiezas = eq.piezas;
        if (typeof eq.piezas === 'string') {
          try {
            parsedPiezas = JSON.parse(eq.piezas || '[]');
          } catch (e) {
            parsedPiezas = [];
          }
        }
        return {
          ...eq,
          piezas: parsedPiezas || [],
          estado: mapStatus(eq.estado)
        };
      });
      setEquipments(mappedData);
    } else if (eqRes.error) {
      console.error('Catalog: Error Supabase (equipos):', eqRes.error);
    }

    if (!resRes.error && resRes.data) {
      setReservations(resRes.data);
    }
    setLoading(false);
  };

  const filteredEquipments = (equipments || []).filter(eq => {
    const matchesSearch = (eq?.nombre || '').toLowerCase().includes((search || '').toLowerCase()) || 
                         (eq?.modelo || '').toLowerCase().includes((search || '').toLowerCase()) ||
                         (eq?.numero_serie || '').toLowerCase().includes((search || '').toLowerCase());
    const matchesCategory = category === 'Todas' || (eq?.categoria || 'Otros') === category;
    const matchesFavorites = showFavorites ? (profile?.favoritos || []).includes(eq?.id) : true;
    
    // For Docente, never show archived. For Admin, depends on showArchived toggle.
    if (role === 'Docente') {
      if (eq?.estado === 'Archivado') return false;
      return matchesSearch && matchesCategory && matchesFavorites;
    }

    const matchesArchived = showArchived ? eq?.estado === 'Archivado' : eq?.estado !== 'Archivado';
    return matchesSearch && matchesCategory && matchesArchived && matchesFavorites;
  });

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Está seguro de archivar "${name}"? No aparecerá en el inventario activo.`)) return;
    
    console.log('Archivando equipo. Valor enviado a Supabase:', 'Archivado');
    const { error } = await supabase
      .from('equipamiento')
      .update({ estado: 'Archivado' })
      .eq('id', id);
    
    if (error) {
      alert(`Error al archivar: ${error.message}`);
    } else {
      await logAction(activeResponsable!, 'BAJA_EQUIPO', { id, nombre: name, motivo: 'Archivado' });
      fetchEquipments();
    }
  };

  const handleRestore = async (id: string, name: string) => {
    console.log('Restaurando equipo. Valor enviado a Supabase:', 'Disponible');
    const { error } = await supabase
      .from('equipamiento')
      .update({ estado: 'Disponible' })
      .eq('id', id);
    
    if (error) {
      alert(`Error al restaurar: ${error.message}`);
    } else {
      await logAction(activeResponsable!, 'RESTAURAR_EQUIPO', { id, nombre: name });
      fetchEquipments();
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pt-16 lg:pt-8">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900">
            {showArchived ? 'Archivo de Equipos (Bajas)' : 'Catálogo de Equipos'}
          </h1>
          <p className="text-sm md:text-base text-slate-500">
            {showArchived ? 'Equipos fuera de servicio permanente o históricos.' : 'Gestione el inventario de la escuela.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <button 
            onClick={() => setShowFavorites(!showFavorites)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 rounded-xl font-bold text-xs md:text-sm transition-all border",
              showFavorites 
                ? "bg-amber-500 text-white border-amber-600" 
                : "bg-white text-slate-600 border-slate-200 hover:border-amber-500"
            )}
          >
            <Star className={cn("w-4 h-4", showFavorites ? "fill-current" : "text-amber-500")} />
            <span className="hidden sm:inline">{showFavorites ? 'Viendo Habituales' : 'Ver Habituales'}</span>
            <span className="sm:hidden">Habituales</span>
          </button>
          {role === 'Pañolero' && (
            <button 
              onClick={() => setShowArchived(!showArchived)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 rounded-xl font-bold text-xs md:text-sm transition-all border",
                showArchived 
                  ? "bg-slate-900 text-white border-slate-900" 
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              )}
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">{showArchived ? 'Ver Activos' : 'Ver Archivados'}</span>
              <span className="sm:hidden">{showArchived ? 'Activos' : 'Archivo'}</span>
            </button>
          )}
          {role === 'Pañolero' && (
            <button 
              onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
              className="btn-primary flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 text-xs md:text-sm"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Nuevo Equipo</span>
              <span className="sm:hidden">Nuevo</span>
            </button>
          )}
        </div>
      </header>

      <InventoryMetrics equipments={equipments} />

      <div className="flex flex-col lg:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nombre, modelo o serie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
          />
        </div>
        <div className="flex gap-2">
          <div className="bg-white border border-slate-200 rounded-xl p-1 flex shadow-sm">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn("p-1.5 rounded-lg transition-all", viewMode === 'grid' ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600")}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn("p-1.5 rounded-lg transition-all", viewMode === 'list' ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600")}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-4 lg:pb-0 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap shadow-sm border",
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
        <div className="fixed bottom-4 md:bottom-8 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-slate-900 text-white px-4 md:px-6 py-3 md:py-4 rounded-2xl shadow-2xl flex flex-col md:flex-row items-center gap-3 md:gap-6 border border-slate-800">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-amber-500" />
              <span className="font-bold whitespace-nowrap">{selectedIds.length} seleccionados</span>
            </div>
            <div className="hidden md:block h-6 w-px bg-slate-800"></div>
            <div className="flex gap-2 w-full md:w-auto">
              <button 
                onClick={() => {
                  window.location.href = `/nuevo-prestamo?equipos=${selectedIds.join(',')}`;
                }}
                className="flex-1 md:flex-none bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all"
              >
                Despachar
              </button>
              <button 
                onClick={() => setSelectedIds([])}
                className="flex-1 md:flex-none bg-slate-800 hover:bg-slate-700 md:bg-transparent text-slate-400 hover:text-white px-4 py-2 md:p-0 rounded-xl md:rounded-none text-sm font-bold"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
          <p className="text-slate-500 font-medium">Cargando inventario...</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {(filteredEquipments || []).map((eq) => {
            const eqReservations = (reservations || []).filter(r => 
              (r.equipos_ids || []).includes(eq.id) && 
              (r.estado === 'Pendiente' || r.estado === 'Activa')
            );
            const isReservedNow = (eqReservations || []).some(r => 
              isWithinInterval(new Date(), {
                start: parseISO(r.fecha_inicio),
                end: parseISO(r.fecha_fin)
              })
            );
            const hasFutureReservations = (eqReservations || []).some(r => 
              isAfter(parseISO(r.fecha_inicio), new Date())
            );

            return (
              <motion.div
                layout
                key={eq.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "card group relative", 
                  isReservedNow && "ring-2 ring-amber-500",
                  selectedIds.includes(eq.id) && "ring-2 ring-amber-500 bg-amber-50/30"
                )}
              >
                <button 
                  onClick={() => toggleSelect(eq.id)}
                  className={cn(
                    "absolute top-3 left-3 z-10 p-1.5 rounded-lg transition-all",
                    selectedIds.includes(eq.id) ? "bg-amber-500 text-white shadow-lg" : "bg-white/80 backdrop-blur-sm text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100"
                  )}
                >
                  {selectedIds.includes(eq.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                </button>

                <div className="relative h-48 bg-slate-100 overflow-hidden">
                  <img
                    src={eq.foto_url || 'https://picsum.photos/seed/camera/400/300'}
                    alt={eq.nombre}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <button 
                    onClick={() => toggleFavorite(eq.id)}
                    className="absolute top-3 right-12 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm border border-slate-100 transition-transform active:scale-90"
                  >
                    <Star className={cn(
                      "w-4 h-4 transition-colors",
                      (profile?.favoritos || []).includes(eq.id) ? "fill-amber-500 text-amber-500" : "text-slate-400"
                    )} />
                  </button>
                  <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                    <div className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shadow-sm",
                      isReservedNow 
                        ? "bg-amber-500 text-white border-amber-600"
                        : (statusConfig[eq.estado] || { color: 'text-slate-600 bg-slate-50 border-slate-200' }).color
                    )}>
                      {isReservedNow ? (
                        <Calendar className="w-3.5 h-3.5" />
                      ) : (
                        React.createElement((statusConfig[eq.estado] || { icon: AlertCircle }).icon, { className: "w-3.5 h-3.5" })
                      )}
                      {isReservedNow ? 'Reservado' : (statusConfig[eq.estado] || { label: eq.estado }).label}
                    </div>
                  </div>
                </div>
              
              <div className="p-4">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-amber-600">{eq.categoria}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setSelectedEquipment(eq); setIsHistoryOpen(true); }}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600"
                        title="Hoja de Vida"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => { setEditingItem(eq); setIsModalOpen(true); }}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {eq.estado === 'Archivado' ? (
                        <button 
                          onClick={() => handleRestore(eq.id, eq.nombre)}
                          className="p-1.5 hover:bg-green-50 rounded-lg text-green-600"
                          title="Restaurar"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleDelete(eq.id, eq.nombre)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
                          title="Archivar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                
                <h3 className="font-bold text-slate-900 leading-tight mb-1">{eq.nombre}</h3>
                <p className="text-xs text-slate-500 mb-2">{eq.modelo}</p>

                {eq.permiso_uso !== 'Libre uso' && (
                  <div className={cn(
                    "mb-3 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border w-fit",
                    eq.permiso_uso === 'Restringido' ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-red-50 text-red-700 border-red-100"
                  )}>
                    <Lock className="w-3 h-3" />
                    {eq.permiso_uso}
                  </div>
                )}
                
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                    <span>S/N: {eq.numero_serie}</span>
                  </div>
                </div>
              </div>
              </motion.div>
            )})}
        </div>
      ) : (
        <div className="space-y-4 lg:space-y-0">
          {/* Mobile Card List */}
          <div className="lg:hidden space-y-4">
            {filteredEquipments.map(eq => (
              <div key={eq.id} className={cn("bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4", selectedIds.includes(eq.id) && "ring-2 ring-amber-500 bg-amber-50/30")}>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleSelect(eq.id)} className={cn("transition-all", selectedIds.includes(eq.id) ? "text-amber-500" : "text-slate-300")}>
                    {selectedIds.includes(eq.id) ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
                  </button>
                  <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                    <img src={eq.foto_url || 'https://picsum.photos/seed/gear/100/100'} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-base truncate">{eq.nombre}</p>
                    <p className="text-xs text-slate-500 truncate">{eq.modelo}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-[10px] uppercase font-bold tracking-wider">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <p className="text-slate-400 mb-0.5">Serie</p>
                    <p className="text-slate-700 truncate">{eq.numero_serie}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <p className="text-slate-400 mb-0.5">Categoría</p>
                    <p className="text-slate-700 truncate">{eq.categoria}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex flex-col gap-1">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border w-fit",
                      (statusConfig[eq.estado] || { color: 'text-slate-600 bg-slate-50 border-slate-200' }).color
                    )}>
                      {eq.estado}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setSelectedEquipment(eq); setIsHistoryOpen(true); }}
                      className="p-2 text-slate-400 hover:text-amber-500 bg-slate-50 rounded-lg"
                    >
                      <History className="w-5 h-5" />
                    </button>
                    <button onClick={() => toggleFavorite(eq.id)} className={cn("p-2 rounded-lg bg-slate-50", (profile?.favoritos || []).includes(eq.id) ? "text-amber-500" : "text-slate-300")}>
                      <Star className={cn("w-5 h-5", (profile?.favoritos || []).includes(eq.id) && "fill-current")} />
                    </button>
                    <button onClick={() => { setEditingItem(eq); setIsModalOpen(true); }} className="p-2 text-slate-400 bg-slate-50 rounded-lg">
                      <Edit2 className="w-5 h-5" />
                    </button>
                    {eq.estado === 'Archivado' ? (
                      <button onClick={() => handleRestore(eq.id, eq.nombre)} className="p-2 text-green-400 bg-green-50 rounded-lg">
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                    ) : (
                      <button onClick={() => handleDelete(eq.id, eq.nombre)} className="p-2 text-red-400 bg-red-50 rounded-lg">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-4 w-10">
                    <button onClick={selectAll} className="text-slate-400 hover:text-slate-600">
                      {selectedIds.length === filteredEquipments.length ? <CheckSquare className="w-5 h-5 text-amber-500" /> : <Square className="w-5 h-5" />}
                    </button>
                  </th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Recurso</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ID / Serie</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Categoría</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEquipments.map(eq => (
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
                    <td className="p-4 text-xs font-medium text-slate-600">{eq.numero_serie}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase tracking-wider">
                        {eq.categoria}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border w-fit",
                          (statusConfig[eq.estado] || { color: 'text-slate-600 bg-slate-50 border-slate-200' }).color
                        )}>
                          {eq.estado}
                        </div>
                        {eq.permiso_uso !== 'Libre uso' && (
                          <div className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold border w-fit",
                            eq.permiso_uso === 'Restringido' ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-red-50 text-red-700 border-red-100"
                          )}>
                            <Lock className="w-2.5 h-2.5" />
                            {eq.permiso_uso}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => { setSelectedEquipment(eq); setIsHistoryOpen(true); }}
                          className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg"
                          title="Hoja de Vida"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button onClick={() => toggleFavorite(eq.id)} className={cn("p-1.5 rounded-lg transition-all", (profile?.favoritos || []).includes(eq.id) ? "text-amber-500" : "text-slate-300 hover:text-slate-400")} title="Favorito">
                          <Star className={cn("w-4 h-4", (profile?.favoritos || []).includes(eq.id) && "fill-current")} />
                        </button>
                        <button onClick={() => { setEditingItem(eq); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg" title="Editar">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {eq.estado === 'Archivado' ? (
                          <button onClick={() => handleRestore(eq.id, eq.nombre)} className="p-1.5 text-green-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Restaurar">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => handleDelete(eq.id, eq.nombre)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Archivar">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Equipment Modal (Simplified for this turn) */}
      {isModalOpen && (
        <EquipmentModal 
          item={editingItem} 
          onClose={() => setIsModalOpen(false)} 
          onSave={fetchEquipments} 
        />
      )}

      {/* History Modal (Hoja de Vida) */}
      {isHistoryOpen && selectedEquipment && (
        <HistoryModal 
          equipment={selectedEquipment} 
          onClose={() => setIsHistoryOpen(false)} 
        />
      )}
    </div>
  );
};

// Sub-component for History Modal
const HistoryModal: React.FC<{ equipment: Equipment, onClose: () => void }> = ({ equipment, onClose }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from('historial_recursos')
        .select('*')
        .eq('recurso_id', equipment.id)
        .order('created_at', { ascending: false });
      
      if (data) setHistory(data);
      setLoading(false);
    };
    fetchHistory();
  }, [equipment.id]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-200">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Hoja de Vida</h2>
              <p className="text-sm text-slate-500 font-bold">{equipment.nombre} - {equipment.modelo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
            <XCircle className="w-6 h-6 text-slate-400" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-500" /></div>
          ) : history.length === 0 ? (
            <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
              <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-bold">No hay historial registrado para este recurso.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((entry, idx) => (
                <div key={entry.id} className="relative pl-8 pb-8 last:pb-0">
                  {idx !== history.length - 1 && (
                    <div className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200"></div>
                  )}
                  <div className="absolute left-0 top-1.5 w-8 h-8 rounded-full bg-white border-2 border-amber-500 flex items-center justify-center z-10">
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                      <div>
                        <p className="text-sm font-black text-slate-900 uppercase tracking-wider mb-1">
                          {entry.docente_nombre} {entry.alumno_nombre && <span className="text-slate-400 font-normal">/ {entry.alumno_nombre}</span>}
                        </p>
                        <p className="text-xs text-slate-500 font-bold flex items-center gap-1">
                          <BookOpen className="w-3 h-3" /> {entry.materia}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{entry.tipo_accion || 'Salida'}</p>
                        <p className="text-sm font-bold text-slate-700">{new Date(entry.fecha_salida).toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Entrega</p>
                        <p className="text-xs font-bold text-slate-700">{entry.pañolero_entrega}</p>
                        <p className="text-[10px] text-slate-500 mt-1">Estado: <span className="text-green-600 font-black">{entry.estado_salida}</span></p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Recepción</p>
                        <p className="text-xs font-bold text-slate-700">{entry.pañolero_recibe || 'Pendiente'}</p>
                        {entry.fecha_entrada && (
                          <p className="text-[10px] text-slate-500 mt-1">Estado: <span className="text-amber-600 font-black">{entry.estado_entrada}</span></p>
                        )}
                      </div>
                    </div>
                    
                    {entry.observaciones_entrada && (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                        <p className="text-[10px] font-black text-amber-600 uppercase mb-1">Observaciones al recibir</p>
                        <p className="text-xs text-slate-700 italic">"{entry.observaciones_entrada}"</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end">
          <button onClick={onClose} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-slate-200">
            Cerrar Hoja de Vida
          </button>
        </div>
      </div>
    </div>
  );
};

// Sub-component for Equipment Modal
const EquipmentModal: React.FC<{ item: Equipment | null, onClose: () => void, onSave: () => void }> = ({ item, onClose, onSave }) => {
  const { activeResponsable } = useApp();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Equipment>>(
    item ? { ...item, piezas: item.piezas || [] } : {
    nombre: '',
    categoria: 'Cámaras',
    modelo: '',
    numero_serie: '',
    ubicacion: '',
    descripcion: '',
    foto_url: '',
    estado: 'Disponible',
    permiso_uso: 'Libre uso',
    piezas: []
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const dataToSave = { ...formData, piezas: formData.piezas || [] };
    const action = item ? 'EDICION_EQUIPO' : 'ALTA_EQUIPO';
    
    console.log(`Guardando equipo (${action}). Datos enviados a Supabase:`, dataToSave);
    
    const { error } = item 
      ? await supabase.from('equipamiento').update(dataToSave).eq('id', item.id)
      : await supabase.from('equipamiento').insert([dataToSave]);

    if (!error) {
      await logAction(activeResponsable!, action, dataToSave);
      onSave();
      onClose();
    } else {
      console.error('Error saving equipment:', error);
      alert(`Error al guardar el equipo: ${error.message || JSON.stringify(error)}`);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xl font-bold">{item ? 'Editar Equipo' : 'Nuevo Equipo'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XCircle className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Equipo</label>
            <input
              required
              type="text"
              value={formData.nombre}
              onChange={e => setFormData({...formData, nombre: e.target.value})}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
            <select
              value={formData.categoria}
              onChange={e => setFormData({...formData, categoria: e.target.value as any})}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
            >
              {['Cámaras', 'Sonido', 'Iluminación', 'Grip', 'Accesorios', 'Espacio', 'Otros'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
            <select
              value={formData.estado}
              onChange={e => setFormData({...formData, estado: e.target.value as EquipmentStatus})}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="Disponible">Disponible</option>
              <option value="Prestado">Prestado</option>
              <option value="Fuera de Servicio">Fuera de Servicio</option>
              <option value="Archivado">Archivado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Permiso de Uso</label>
            <select
              value={formData.permiso_uso}
              onChange={e => setFormData({...formData, permiso_uso: e.target.value as any})}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="Libre uso">Libre uso</option>
              <option value="Restringido">Restringido (Solo Docentes)</option>
              <option value="No habilitado">No habilitado (Mantenimiento)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Modelo</label>
            <input
              type="text"
              value={formData.modelo || ''}
              onChange={e => setFormData({...formData, modelo: e.target.value})}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nº de Serie</label>
            <input
              type="text"
              value={formData.numero_serie || ''}
              onChange={e => setFormData({...formData, numero_serie: e.target.value})}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">URL de Imagen (Cloudinary)</label>
            <input
              type="url"
              value={formData.foto_url || ''}
              onChange={e => setFormData({...formData, foto_url: e.target.value})}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="https://res.cloudinary.com/..."
            />
          </div>

          {/* Dynamic Pieces Section */}
          <div className="md:col-span-2 mt-4 border-t border-slate-200 pt-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-900">Piezas / Accesorios del Kit</h3>
              <button
                type="button"
                onClick={() => {
                  setFormData({ ...formData, piezas: [...(formData.piezas || []), ''] });
                }}
                className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Agregar Pieza
              </button>
            </div>
            
            <div className="space-y-3">
              {(formData.piezas || []).map((pieza, index) => (
                <div key={index} className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <input
                    type="text"
                    value={pieza || ''}
                    onChange={(e) => {
                      const newPiezas = [...(formData.piezas || [])];
                      newPiezas[index] = e.target.value;
                      setFormData({ ...formData, piezas: newPiezas });
                    }}
                    placeholder="Ej: Batería NP-F970"
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-md outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newPiezas = (formData.piezas || []).filter((_, i) => i !== index);
                      setFormData({ ...formData, piezas: newPiezas });
                    }}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {(!formData.piezas || formData.piezas.length === 0) && (
                <p className="text-sm text-slate-500 italic text-center py-2">No hay piezas registradas. El equipo se prestará como una unidad simple.</p>
              )}
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-6 py-2 text-slate-600 font-medium">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary min-w-[120px]">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Guardar Equipo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
