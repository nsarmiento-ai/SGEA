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
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

const statusConfig: Record<EquipmentStatus, { color: string, icon: any, label: string }> = {
  'disponible': { color: 'text-green-600 bg-green-50 border-green-200', icon: CheckCircle2, label: 'Disponible' },
  'prestado': { color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Clock, label: 'Prestado' },
  'fuera de servicio': { color: 'text-red-600 bg-red-50 border-red-200', icon: XCircle, label: 'Fuera de Servicio' },
};

const InventoryMetrics: React.FC<{ equipments: Equipment[] }> = ({ equipments }) => {
  const stats = {
    disponible: equipments.filter(e => e.estado === 'disponible').length,
    prestado: equipments.filter(e => e.estado === 'prestado').length,
    fueraDeServicio: equipments.filter(e => e.estado === 'fuera de servicio').length,
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
  const { activeResponsable } = useApp();
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);

  const categories = ['Todas', 'Cámaras', 'Sonido', 'Iluminación', 'Grip', 'Accesorios', 'Otros'];

  useEffect(() => {
    fetchEquipments();
  }, []);

  const fetchEquipments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('equipamiento')
      .select('*')
      .order('nombre', { ascending: true });
    
    if (!error && data) setEquipments(data);
    setLoading(false);
  };

  const filteredEquipments = equipments.filter(eq => {
    const matchesSearch = eq.nombre.toLowerCase().includes(search.toLowerCase()) || 
                         eq.modelo.toLowerCase().includes(search.toLowerCase()) ||
                         eq.numero_serie.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'Todas' || eq.categoria === category;
    return matchesSearch && matchesCategory;
  });

  const handleDelete = async (id: string, name: string) => {
    console.log('Attempting to delete:', name, 'with ID:', id);
    
    console.log('Sending delete request to Supabase...');
    const { error } = await supabase.from('equipamiento').delete().eq('id', id);
    
    if (error) {
      console.error('Error deleting equipment:', error);
      alert(`Error al eliminar: ${error.message}`);
    } else {
      console.log('Deletion successful in Supabase.');
      await logAction(activeResponsable!, 'BAJA_EQUIPO', { id, nombre: name });
      setEquipments(equipments.filter(e => e.id !== id));
      console.log('State updated.');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Catálogo de Equipos</h1>
          <p className="text-slate-500">Gestione el inventario de la escuela.</p>
        </div>
        <button 
          onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
          className="btn-primary flex items-center gap-2 self-start"
        >
          <Plus className="w-5 h-5" />
          Nuevo Equipo
        </button>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredEquipments.map((eq) => (
            <motion.div
              layout
              key={eq.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card group"
            >
              <div className="relative h-48 bg-slate-100 overflow-hidden">
                <img
                  src={eq.foto_url || 'https://picsum.photos/seed/camera/400/300'}
                  alt={eq.nombre}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute top-3 right-3">
                  <div className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shadow-sm",
                    (statusConfig[eq.estado] || { color: 'text-slate-600 bg-slate-50 border-slate-200' }).color
                  )}>
                    {React.createElement((statusConfig[eq.estado] || { icon: AlertCircle }).icon, { className: "w-3.5 h-3.5" })}
                    {(statusConfig[eq.estado] || { label: eq.estado }).label}
                  </div>
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
                    <button 
                      onClick={() => handleDelete(eq.id, eq.nombre)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
                </div>
              </div>
              
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400">
                  {eq.piezas && eq.piezas.length > 0 ? `KIT: ${eq.piezas.length} PIEZAS` : 'SIN PIEZAS'}
                </span>
                <button className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1">
                  <History className="w-3.5 h-3.5" />
                  Historial
                </button>
              </div>
            </motion.div>
          ))}
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
    estado: 'disponible',
    restriccion: false,
    piezas: []
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { piezas, restriccion, ...dataToSave } = formData;
    const action = item ? 'EDICION_EQUIPO' : 'ALTA_EQUIPO';
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
              {['Cámaras', 'Sonido', 'Iluminación', 'Grip', 'Accesorios', 'Otros'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
            <select
              value={formData.estado}
              onChange={e => setFormData({...formData, estado: e.target.value as EquipmentStatus})}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="disponible">Disponible</option>
              <option value="prestado">Prestado</option>
              <option value="fuera de servicio">Fuera de Servicio</option>
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
