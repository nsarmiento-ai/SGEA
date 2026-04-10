import React, { useState, useEffect } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { Reservation, Equipment } from '../types';
import { useApp } from '../context/AppContext';
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
  ChevronRight,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { parseISO, areIntervalsOverlapping, format } from 'date-fns';

export const Reservations: React.FC = () => {
  const { activeResponsable, profile, toggleFavorite } = useApp();
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');
  const [showFavorites, setShowFavorites] = useState(false);
  
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fecha_inicio: '',
    fecha_fin: '',
  });

  const categories = ['Todas', 'Cámaras', 'Sonido', 'Iluminación', 'Grip', 'Accesorios', 'Otros'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [eqData, resData] = await Promise.all([
        supabase.from('equipamiento').select('*').neq('estado', 'Archivado').order('nombre', { ascending: true }),
        supabase.from('reservas').select('*').order('fecha_inicio', { ascending: true })
      ]);

      if (eqData.data) setEquipments(eqData.data);
      if (resData.data) setReservations(resData.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredEquipments = equipments.filter(eq => {
    const matchesSearch = eq.nombre.toLowerCase().includes(search.toLowerCase()) || 
                         eq.modelo.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'Todas' || eq.categoria === category;
    const matchesFavorites = showFavorites ? profile?.favoritos?.includes(eq.id) : true;
    return matchesSearch && matchesCategory && matchesFavorites;
  });

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

  const handleOpenReserve = (eq: Equipment) => {
    setSelectedEquipment(eq);
    setIsModalOpen(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedEquipment || !formData.fecha_inicio || !formData.fecha_fin) {
      setError('Todos los campos son obligatorios.');
      return;
    }

    if (new Date(formData.fecha_inicio) >= new Date(formData.fecha_fin)) {
      setError('La fecha de inicio debe ser anterior a la fecha de fin.');
      return;
    }

    if (checkOverlap(selectedEquipment.id, formData.fecha_inicio, formData.fecha_fin)) {
      setError('El equipo ya tiene una reserva en ese rango de fechas.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.id) {
        throw new Error('No se pudo obtener el ID del usuario autenticado.');
      }

      const newReservation = {
        equipo_id: selectedEquipment.id,
        usuario_id: user.id,
        fecha_inicio: formData.fecha_inicio,
        fecha_fin: formData.fecha_fin,
        docente_nombre: activeResponsable || '',
        estado: 'Activa'
      };

      const { error: insertError } = await supabase.from('reservas').insert([newReservation]);
      if (insertError) throw insertError;

      await logAction(activeResponsable!, 'NUEVA_RESERVA', { 
        equipo: selectedEquipment.nombre,
        inicio: newReservation.fecha_inicio,
        fin: newReservation.fecha_fin
      });

      setIsModalOpen(false);
      setFormData({ fecha_inicio: '', fecha_fin: '' });
      fetchData();
      alert('Reserva confirmada con éxito.');
    } catch (err: any) {
      setError(err.message || 'Error al guardar la reserva.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Catálogo de Reservas</h1>
          <p className="text-slate-500">Solicite equipos para sus clases o proyectos.</p>
        </div>
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
          {showFavorites ? 'Viendo mis habituales' : 'Ver mis habituales'}
        </button>
      </header>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar equipo para reservar..."
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredEquipments.map((eq) => (
            <motion.div
              layout
              key={eq.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all group flex flex-col"
            >
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
                    profile?.favoritos?.includes(eq.id) ? "fill-amber-500 text-amber-500" : "text-slate-400"
                  )} />
                </button>
                <div className="absolute bottom-4 left-4">
                  <span className="px-3 py-1 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-black uppercase rounded-lg tracking-wider">
                    {eq.categoria}
                  </span>
                </div>
              </div>
              
              <div className="p-6 flex-1 flex flex-col">
                <h3 className="font-black text-slate-900 text-lg leading-tight mb-1">{eq.nombre}</h3>
                <p className="text-sm text-slate-500 mb-4">{eq.modelo}</p>
                
                <div className="mt-auto space-y-4">
                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <Info className="w-4 h-4 text-amber-500" />
                    <span>{eq.descripcion || 'Sin descripción adicional.'}</span>
                  </div>
                  
                  <button 
                    onClick={() => handleOpenReserve(eq)}
                    className="w-full py-3 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-amber-500 transition-colors shadow-lg shadow-slate-200"
                  >
                    <Calendar className="w-5 h-5" />
                    Reservar Equipo
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Reservation Modal */}
      <AnimatePresence>
        {isModalOpen && selectedEquipment && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-200">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Confirmar Reserva</h2>
                    <p className="text-sm text-slate-500">{selectedEquipment.nombre}</p>
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

                <div className="grid grid-cols-1 gap-6">
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
                    disabled={submitting}
                    className="flex-1 bg-amber-500 text-white font-black uppercase tracking-wider py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-amber-600 transition-all shadow-lg shadow-amber-200 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
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
