import React, { useState, useEffect } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { Equipment, EquipmentStatus, Pieza, ResourceHistory } from '../types';
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
  ArrowRight,
  LayoutGrid,
  List,
  CheckSquare,
  Square
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

const mapStatus = (status: string): EquipmentStatus => {
  const s = status.toLowerCase();
  if (s === 'roto' || s === 'en reparación' || s === 'perdido' || s === 'mantenimiento' || s === 'incompleto' || s === 'fuera de servicio') {
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
    fueraDeServicio: equipments.filter(e => e.estado === 'Fuera de Servicio').length,
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
  const { activeResponsable, profile, toggleFavorite } = useApp();
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');
  const [showArchived, setShowArchived] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [historyItem, setHistoryItem] = useState<Equipment | null>(null);

  const categories = ['Todas', 'Cámaras', 'Sonido', 'Iluminación', 'Grip', 'Accesorios', 'Espacio/Aula', 'Otros'];

  useEffect(() => {
    fetchEquipments();
  }, []);

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
      const mappedData = eqRes.data.map(eq => ({
        ...eq,
        estado: mapStatus(eq.estado)
      }));
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
    const matchesSearch = (eq.nombre || '').toLowerCase().includes((search || '').toLowerCase()) || 
                         (eq.modelo || '').toLowerCase().includes((search || '').toLowerCase()) ||
                         (eq.numero_serie || '').toLowerCase().includes((search || '').toLowerCase());
    const matchesCategory = category === 'Todas' || (eq.categoria || 'Otros') === category;
    const matchesArchived = showArchived ? eq.estado === 'Archivado' : eq.estado !== 'Archivado';
    const matchesFavorites = showFavorites ? (profile?.favoritos || []).includes(eq.id) : true;
    return matchesSearch && matchesCategory && matchesArchived && matchesFavorites;
  });

  const favoriteEquipments = filteredEquipments.filter(eq => (profile?.favoritos || []).includes(eq.id));
  const otherEquipments = filteredEquipments.filter(eq => !(profile?.favoritos || []).includes(eq.id));

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkReserve = () => {
    // This will be handled by adding to a global cart or navigating to reservations
    // For now, let's assume we want to "Add to Cart"
    const selectedItems = equipments.filter(eq => selectedIds.has(eq.id));
    // We need access to the cart from Reservations.tsx or a global state.
    // Since cart is local to Reservations.tsx, we might need to move it to AppContext or use a custom event.
    // Let's use a custom event for now or just alert.
    window.dispatchEvent(new CustomEvent('add-to-cart-bulk', { detail: selectedItems }));
    setSelectedIds(new Set());
    alert(`${selectedItems.length} equipos añadidos al carrito.`);
  };

  const renderEquipmentItem = (eq: Equipment) => {
    const eqReservations = (reservations || []).filter(r => (r.equipos_ids || []).includes(eq.id));
    const isReservedNow = (eqReservations || []).some(r => 
      isWithinInterval(new Date(), {
        start: parseISO(r.fecha_inicio),
        end: parseISO(r.fecha_fin)
      })
    );
    const hasFutureReservations = (eqReservations || []).some(r => 
      isAfter(parseISO(r.fecha_inicio), new Date())
    );
    const isSelected = selectedIds.has(eq.id);

    if (viewMode === 'list') {
      return (
        <motion.div
          layout
          key={eq.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            "bg-white rounded-2xl border border-slate-200 p-3 flex items-center gap-4 hover:border-amber-500 transition-all group",
            isSelected && "bg-amber-50 border-amber-200 ring-1 ring-amber-100",
            isReservedNow && "opacity-75"
          )}
        >
          <button 
            onClick={() => toggleSelection(eq.id)}
            className="flex-shrink-0 text-slate-300 hover:text-amber-500 transition-colors"
          >
            {isSelected ? <CheckSquare className="w-6 h-6 text-amber-500" /> : <Square className="w-6 h-6" />}
          </button>

          <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-100">
            <img 
              src={eq.foto_url || 'https://picsum.photos/seed/camera/100/100'} 
              alt={eq.nombre} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-black text-amber-600 uppercase tracking-tighter">{eq.categoria}</span>
              <span className="text-[10px] font-bold text-slate-400">ID: {eq.numero_serie}</span>
            </div>
            <h3 className="font-bold text-slate-900 truncate">{eq.nombre}</h3>
            <p className="text-xs text-slate-500 truncate">{eq.modelo}</p>
          </div>

          <div className="hidden md:flex flex-col items-end gap-1 px-4 border-l border-slate-100">
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase border",
              isReservedNow 
                ? "bg-amber-500 text-white border-amber-600"
                : (statusConfig[eq.estado] || { color: 'text-slate-600 bg-slate-50 border-slate-200' }).color
            )}>
              {isReservedNow ? 'Reservado' : (statusConfig[eq.estado] || { label: eq.estado }).label}
            </div>
            <span className="text-[10px] font-bold text-slate-400">{eq.ubicacion}</span>
          </div>

          <div className="flex items-center gap-1">
            <button 
              onClick={() => toggleFavorite(eq.id)}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <Star className={cn("w-4 h-4", (profile?.favoritos || []).includes(eq.id) ? "fill-amber-500 text-amber-500" : "text-slate-300")} />
            </button>
            <button 
              onClick={() => {
                setHistoryItem(eq);
                setIsHistoryOpen(true);
              }}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-amber-600 transition-colors"
            >
              <History className="w-4 h-4" />
            </button>
            <div className="relative group/menu">
              <button className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
                <MoreVertical className="w-4 h-4" />
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 py-2 w-40 z-20 hidden group-hover/menu:block">
                <button 
                  onClick={() => { setEditingItem(eq); setIsModalOpen(true); }}
                  className="w-full px-4 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Editar
                </button>
                {eq.estado === 'Archivado' ? (
                  <button 
                    onClick={() => handleRestore(eq.id, eq.nombre)}
                    className="w-full px-4 py-2 text-left text-xs font-bold text-green-600 hover:bg-green-50 flex items-center gap-2"
                  >
                    <History className="w-3.5 h-3.5" /> Restaurar
                  </button>
                ) : (
                  <button 
                    onClick={() => handleDelete(eq.id, eq.nombre)}
                    className="w-full px-4 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Archivar
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        layout
        key={eq.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "card group relative", 
          isReservedNow && "ring-2 ring-amber-500",
          isSelected && "ring-2 ring-amber-400 bg-amber-50/30"
        )}
      >
        <div className="relative h-48 bg-slate-100 overflow-hidden">
          <img
            src={eq.foto_url || 'https://picsum.photos/seed/camera/400/300'}
            alt={eq.nombre}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          
          {/* Checkbox Overlay */}
          <button 
            onClick={() => toggleSelection(eq.id)}
            className={cn(
              "absolute top-3 right-3 p-2 rounded-xl backdrop-blur-md transition-all z-10",
              isSelected ? "bg-amber-500 text-white shadow-lg" : "bg-white/80 text-slate-400 opacity-0 group-hover:opacity-100"
            )}
          >
            {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
          </button>

          <button 
            onClick={() => toggleFavorite(eq.id)}
            className="absolute top-3 left-3 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm border border-slate-100 transition-transform active:scale-90 z-10"
          >
            <Star className={cn(
              "w-4 h-4 transition-colors",
              (profile?.favoritos || []).includes(eq.id) ? "fill-amber-500 text-amber-500" : "text-slate-400"
            )} />
          </button>

          <div className="absolute bottom-3 right-3 flex flex-col gap-2 items-end">
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
            {hasFutureReservations && !isReservedNow && (
              <div className="bg-white/90 backdrop-blur-sm text-slate-900 p-1.5 rounded-full shadow-sm border border-slate-200" title="Tiene reservas futuras">
                <Calendar className="w-4 h-4 text-amber-500" />
              </div>
            )}
          </div>
        </div>
      
      <div className="p-4">
        <div className="flex justify-between items-start mb-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-amber-600">{eq.categoria}</span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => { setEditingItem(eq); setIsModalOpen(true); }}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            {eq.estado === 'Archivado' ? (
              <button 
                onClick={() => handleRestore(eq.id, eq.nombre)}
                className="p-1.5 hover:bg-green-50 rounded-lg text-green-600"
                title="Restaurar"
              >
                <History className="w-4 h-4" />
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
        <p className="text-xs text-slate-500 mb-3">{eq.modelo}</p>
        
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            <span>S/N: {eq.numero_serie}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span>{eq.ubicacion}</span>
          </div>
          {eq.last_observation && (
            <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-[10px] font-black text-amber-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Última Observación
              </p>
              <p className="text-[10px] text-amber-700 italic line-clamp-2">"{eq.last_observation}"</p>
            </div>
          )}
        </div>
      </div>
      
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400">
              {eq.piezas && eq.piezas.length > 0 ? `KIT: ${eq.piezas.length} PIEZAS` : 'SIN PIEZAS'}
            </span>
            {isReservedNow && (
              <span className="text-[10px] font-black text-amber-600 uppercase">Reservado Hoy</span>
            )}
          </div>
          <button 
            onClick={() => {
              setHistoryItem(eq);
              setIsHistoryOpen(true);
            }}
            className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1"
          >
            <History className="w-3.5 h-3.5" />
            Historial
          </button>
        </div>
      </motion.div>
    );
  };

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
    console.log('Restaurando equipo. Valor enviado a Supabase:', 'Fuera de Servicio');
    const { error } = await supabase
      .from('equipamiento')
      .update({ estado: 'Fuera de Servicio' })
      .eq('id', id);
    
    if (error) {
      alert(`Error al restaurar: ${error.message}`);
    } else {
      await logAction(activeResponsable!, 'RESTAURAR_EQUIPO', { id, nombre: name });
      fetchEquipments();
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Catálogo de Equipos</h1>
          <p className="text-slate-500">Gestione el inventario de la escuela.</p>
        </div>
        <div className="flex gap-2 self-start">
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 mr-2">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn("p-2 rounded-lg transition-all", viewMode === 'grid' ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600")}
              title="Vista Cuadrícula"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn("p-2 rounded-lg transition-all", viewMode === 'list' ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600")}
              title="Vista Lista Compacta"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button 
            onClick={() => setShowFavorites(!showFavorites)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border",
              showFavorites 
                ? "bg-amber-500 text-white border-amber-600" 
                : "bg-white text-slate-600 border-slate-200 hover:border-amber-500"
            )}
          >
            <Star className={cn("w-4 h-4", showFavorites ? "fill-current" : "text-amber-500")} />
            {showFavorites ? 'Viendo Habituales' : 'Ver Habituales'}
          </button>
          <button 
            onClick={() => setShowArchived(!showArchived)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border",
              showArchived 
                ? "bg-slate-900 text-white border-slate-900" 
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            )}
          >
            <Trash2 className="w-4 h-4" />
            {showArchived ? 'Ver Activos' : 'Ver Archivados'}
          </button>
          <button 
            onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nuevo Equipo
          </button>
        </div>
      </header>

      <InventoryMetrics equipments={equipments} />

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nombre, modelo o serie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {selectedIds.size > 0 && (
            <button 
              onClick={handleBulkReserve}
              className="bg-amber-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-amber-200 flex items-center gap-2 animate-in fade-in slide-in-from-right-4"
            >
              <CheckSquare className="w-4 h-4" />
              Reservar Seleccionados ({selectedIds.size})
            </button>
          )}
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                category === cat 
                  ? "bg-slate-900 text-white shadow-md" 
                  : "bg-white text-slate-600 border border-slate-200 hover:border-amber-500"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
          <p className="text-slate-500 font-medium">Cargando inventario...</p>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Favorites Section */}
          {favoriteEquipments.length > 0 && !showFavorites && (
            <section>
              <div className="flex items-center gap-2 mb-6">
                <Star className="w-5 h-5 text-amber-500 fill-current" />
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Mis Favoritos / Habituales</h2>
                <div className="h-px bg-slate-100 flex-1 ml-4" />
              </div>
              <div className={cn(
                viewMode === 'grid' 
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                  : "flex flex-col gap-3"
              )}>
                {favoriteEquipments.map(eq => renderEquipmentItem(eq))}
              </div>
            </section>
          )}

          {/* Main Inventory Section */}
          <section>
            {(favoriteEquipments.length > 0 && !showFavorites) && (
              <div className="flex items-center gap-2 mb-6">
                <Package className="w-5 h-5 text-slate-400" />
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Resto del Inventario</h2>
                <div className="h-px bg-slate-100 flex-1 ml-4" />
              </div>
            )}
            <div className={cn(
              viewMode === 'grid' 
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                : "flex flex-col gap-3"
            )}>
              {otherEquipments.map(eq => renderEquipmentItem(eq))}
            </div>
            {filteredEquipments.length === 0 && (
              <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-medium">No se encontraron equipos con los filtros actuales.</p>
              </div>
            )}
          </section>
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

      {/* History Modal */}
      {isHistoryOpen && historyItem && (
        <HistoryModal 
          item={historyItem} 
          onClose={() => {
            setIsHistoryOpen(false);
            setHistoryItem(null);
          }} 
        />
      )}
    </div>
  );
};

// Sub-component for History Modal
const HistoryModal: React.FC<{ item: Equipment, onClose: () => void }> = ({ item, onClose }) => {
  const [history, setHistory] = useState<ResourceHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from('historial_recursos')
        .select('*')
        .eq('recurso_id', item.id)
        .order('fecha_movimiento', { ascending: false });
      
      if (!error && data) {
        setHistory(data);
      }
      setLoading(false);
    };
    fetchHistory();
  }, [item.id]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
      >
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Hoja de Vida: {item.nombre}</h2>
              <p className="text-sm text-slate-500">S/N: {item.numero_serie}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XCircle className="w-7 h-7" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-amber-500 w-8 h-8" /></div>
          ) : history.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-slate-400 italic">No hay registros históricos para este recurso.</p>
            </div>
          ) : (
            <div className="space-y-6 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
              {history.map((entry) => (
                <div key={entry.id} className="relative pl-12">
                  <div className={cn(
                    "absolute left-0 top-1 w-10 h-10 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10",
                    entry.accion === 'Préstamo' ? "bg-blue-500 text-white" :
                    entry.accion === 'Devolución' ? "bg-green-500 text-white" :
                    entry.accion === 'Reserva' ? "bg-amber-500 text-white" : "bg-slate-500 text-white"
                  )}>
                    {entry.accion === 'Préstamo' ? <ArrowRight className="w-4 h-4" /> :
                     entry.accion === 'Devolución' ? <CheckCircle2 className="w-4 h-4" /> :
                     entry.accion === 'Reserva' ? <Calendar className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-2">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                        {new Date(entry.fecha_movimiento).toLocaleString()}
                      </span>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                        entry.accion === 'Préstamo' ? "bg-blue-100 text-blue-700" :
                        entry.accion === 'Devolución' ? "bg-green-100 text-green-700" :
                        entry.accion === 'Reserva' ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-700"
                      )}>
                        {entry.accion}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Docente / Responsable</p>
                        <p className="text-sm font-bold text-slate-800">{entry.usuario_responsable}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Materia</p>
                        <p className="text-sm font-bold text-slate-800">{entry.materia}</p>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Observación de Estado</p>
                      <p className="text-sm text-slate-700 italic">"{entry.estado_detalle}"</p>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold">
                        {entry.pañolero_turno.charAt(0)}
                      </div>
                      <p className="text-[10px] font-medium text-slate-500">Atendido por: <span className="font-bold">{entry.pañolero_turno}</span></p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-amber-500 transition-all shadow-lg shadow-slate-200">
            Cerrar Historial
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// Sub-component for Equipment Modal
const EquipmentModal: React.FC<{ item: Equipment | null, onClose: () => void, onSave: () => void }> = ({ item, onClose, onSave }) => {
  const { activeResponsable } = useApp();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Equipment>>(item || {
    nombre: '',
    categoria: 'Cámaras',
    modelo: '',
    numero_serie: '',
    ubicacion: '',
    descripcion: '',
    foto_url: '',
    estado: 'Disponible',
    restriccion: false,
    piezas: []
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { piezas, restriccion, ...dataToSave } = formData;
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
              onChange={e => setFormData({...formData, categoria: e.target.value})}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
            >
              {['Cámaras', 'Sonido', 'Iluminación', 'Grip', 'Accesorios', 'Espacio/Aula', 'Otros'].map(c => <option key={c} value={c}>{c}</option>)}
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
                  const newPieza: Pieza = { id: crypto.randomUUID(), nombre: '', estado: 'OK', obligatorio: true };
                  setFormData({ ...formData, piezas: [...(formData.piezas || []), newPieza] });
                }}
                className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Agregar Pieza
              </button>
            </div>
            
            <div className="space-y-3">
              {(formData.piezas || []).map((pieza, index) => (
                <div key={pieza.id} className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <input
                    type="text"
                    value={pieza.nombre || ''}
                    onChange={(e) => {
                      const newPiezas = [...(formData.piezas || [])];
                      newPiezas[index].nombre = e.target.value;
                      setFormData({ ...formData, piezas: newPiezas });
                    }}
                    placeholder="Ej: Batería NP-F970"
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-md outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={pieza.obligatorio}
                      onChange={(e) => {
                        const newPiezas = [...(formData.piezas || [])];
                        newPiezas[index].obligatorio = e.target.checked;
                        setFormData({ ...formData, piezas: newPiezas });
                      }}
                      className="rounded text-amber-500 focus:ring-amber-500"
                    />
                    Obligatorio
                  </label>
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
