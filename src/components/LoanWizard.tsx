import React, { useState, useEffect } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { Equipment, Loan, Reservation } from '../types';
import { useApp } from '../context/AppContext';
import { generateLoanPDF } from '../lib/pdf';
import { 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  ShoppingCart, 
  User, 
  Calendar, 
  FileText,
  Loader2,
  Search,
  X,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { addDays, format, isWithinInterval, parseISO, isAfter } from 'date-fns';

export const LoanWizard: React.FC = () => {
  const { activeResponsable } = useApp();
  const [step, setStep] = useState(1);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [docentes, setDocentes] = useState<Responsable[]>([]);
  
  const [formData, setFormData] = useState({
    alumno_nombre: '',
    alumno_dni: '',
    materia: '',
    docente_responsable: '',
    fechaDevolucion: format(addDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
    comentarios: ''
  });

  useEffect(() => {
    fetchAvailable();
    fetchDocentes();
    const params = new URLSearchParams(window.location.search);
    const preselectedId = params.get('id');
    if (preselectedId) {
      setSelectedIds([preselectedId]);
    }
  }, []);

  const fetchDocentes = async () => {
    const { data } = await supabase.from('responsables').select('*').eq('activo', true);
    if (data) setDocentes(data);
  };

  const fetchAvailable = async () => {
    setLoading(true);
    const [eqRes, resRes] = await Promise.all([
      supabase.from('equipamiento').select('*').eq('estado', 'Disponible'),
      supabase.from('reservas').select('*')
    ]);
    
    if (!eqRes.error && eqRes.data) setEquipments(eqRes.data);
    if (!resRes.error && resRes.data) setReservations(resRes.data);
    setLoading(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const [conflicts, setConflicts] = useState<Record<string, Reservation>>({});

  useEffect(() => {
    const newConflicts: Record<string, Reservation> = {};
    const returnDate = parseISO(formData.fechaDevolucion);
    const salidaDate = new Date();

    selectedIds.forEach(id => {
      const conflictRes = reservations.find(r => 
        r.equipo_id === id && 
        r.estado === 'Activa' &&
        isAfter(returnDate, parseISO(r.fecha_inicio)) &&
        isAfter(parseISO(r.fecha_fin), salidaDate)
      );
      
      if (conflictRes) {
        newConflicts[id] = conflictRes;
      }
    });

    setConflicts(newConflicts);
  }, [selectedIds, formData.fechaDevolucion, reservations]);

  const isFormValid = () => {
    const valid = !!(
      formData.alumno_nombre && 
      formData.alumno_dni && 
      formData.materia &&
      formData.docente_responsable &&
      selectedIds.length > 0 && 
      activeResponsable &&
      Object.keys(conflicts).length === 0
    );
    return valid;
  };

  const handleFinish = async () => {
    const returnDate = parseISO(formData.fechaDevolucion);
    const salidaDate = new Date();
    
    for (const id of selectedIds) {
      const conflictRes = reservations.find(r => 
        r.equipo_id === id && 
        r.estado === 'Activa' &&
        isAfter(returnDate, parseISO(r.fecha_inicio)) &&
        isAfter(parseISO(r.fecha_fin), salidaDate)
      );
      
      if (conflictRes) {
        const eq = equipments.find(e => e.id === id);
        alert(`Error: El equipo ${eq?.nombre} no puede prestarse hasta el ${format(parseISO(conflictRes.fecha_inicio), 'dd/MM')} porque tiene una reserva de ${conflictRes.docente_nombre} el día ${format(parseISO(conflictRes.fecha_inicio), 'dd/MM')}.`);
        return;
      }
    }

    if (!isFormValid()) return;
    setSubmitting(true);

    try {
      // 1. Create Loan
      const loanData: Partial<Loan> = {
        alumno_nombre: formData.alumno_nombre,
        alumno_dni: formData.alumno_dni,
        materia: formData.materia,
        docente_responsable: formData.docente_responsable,
        responsable_nombre: activeResponsable!,
        fecha_salida: new Date().toISOString(),
        fecha_devolucion_estimada: new Date(formData.fechaDevolucion).toISOString(),
        estado: 'Activo',
        equipos_ids: selectedIds,
        comentarios: formData.comentarios
      };

      const { data: loan, error: loanError } = await supabase
        .from('prestamos')
        .insert([loanData])
        .select()
        .single();

      if (loanError) throw loanError;

      // 2. Update Equipments
      console.log('Actualizando equipos a "Prestado". IDs:', selectedIds);
      const { error: eqError } = await supabase
        .from('equipamiento')
        .update({ estado: 'Prestado' })
        .in('id', selectedIds);

      if (eqError) throw eqError;

      // 3. Log Action
      await logAction(activeResponsable!, 'NUEVO_PRESTAMO', { 
        loanId: loan.id, 
        alumno_nombre: formData.alumno_nombre,
        alumno_dni: formData.alumno_dni,
        equipos: selectedIds 
      });

      // 4. Generate PDF
      const selectedEquipments = equipments.filter(e => selectedIds.includes(e.id));
      generateLoanPDF(loan as Loan, selectedEquipments);

      // 5. Reset
      alert('Préstamo registrado con éxito. El comprobante se ha descargado.');
      window.location.href = '/';
    } catch (error) {
      console.error('Error al registrar el préstamo:', error);
      alert('Error al registrar el préstamo. Revisa la consola.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = equipments.filter(e => 
    e.nombre.toLowerCase().includes(search.toLowerCase()) ||
    e.modelo.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-900">Nuevo Préstamo</h1>
        <div className="flex items-center gap-4 mt-4">
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all",
            step === 1 ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-500"
          )}>
            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
            Selección de Equipos
          </div>
          <ChevronRight className="text-slate-300 w-5 h-5" />
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all",
            step === 2 ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-500"
          )}>
            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
            Registro de Alumno
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center gap-4 bg-slate-50">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Filtrar equipos disponibles..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="text-sm font-bold text-slate-500">
                  {selectedIds.length} seleccionados
                </div>
              </div>

              <div className="max-h-[500px] overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {loading ? (
                  <div className="col-span-full py-10 flex justify-center"><Loader2 className="animate-spin text-amber-500" /></div>
                ) : filtered.map(eq => {
                  const isReservedNow = reservations.some(r => 
                    r.equipo_id === eq.id &&
                    isWithinInterval(new Date(), {
                      start: parseISO(r.fecha_inicio),
                      end: parseISO(r.fecha_fin)
                    })
                  );
                  const nextRes = reservations
                    .filter(r => r.equipo_id === eq.id && r.estado === 'Activa' && isAfter(parseISO(r.fecha_inicio), new Date()))
                    .sort((a, b) => parseISO(a.fecha_inicio).getTime() - parseISO(b.fecha_inicio).getTime())[0];

                  return (
                    <button
                      key={eq.id}
                      disabled={isReservedNow}
                      onClick={() => toggleSelect(eq.id)}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-xl border transition-all text-left relative",
                        selectedIds.includes(eq.id) 
                          ? "border-amber-500 bg-amber-50 ring-1 ring-amber-500" 
                          : isReservedNow
                            ? "border-slate-200 bg-slate-50 opacity-75 cursor-not-allowed"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                      )}
                    >
                      <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                        <img src={eq.foto_url || 'https://picsum.photos/seed/gear/100/100'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 truncate text-sm">{eq.nombre}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {isReservedNow ? (
                            <span className="text-amber-600 font-bold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Reservado por Docente
                            </span>
                          ) : nextRes ? (
                            <span className="text-slate-400 font-medium">
                              Próxima reserva: {format(parseISO(nextRes.fecha_inicio), 'dd/MM HH:mm')}
                            </span>
                          ) : eq.modelo}
                        </p>
                      </div>
                      {selectedIds.includes(eq.id) && (
                        <div className="bg-amber-500 rounded-full p-1">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  disabled={selectedIds.length === 0}
                  onClick={() => setStep(2)}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente paso
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
                {(Object.values(conflicts) as Reservation[]).map(res => {
                  const eq = equipments.find(e => e.id === res.equipo_id);
                  return (
                    <div key={res.id} className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-700 text-sm flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <p>
                        <strong>⚠️ Conflicto de Reserva:</strong> El equipo {eq?.nombre} está reservado por el docente {res.docente_nombre} a partir del {format(parseISO(res.fecha_inicio), 'dd/MM HH:mm')}. Debes ajustar la fecha de devolución para que sea previa a este compromiso.
                      </p>
                    </div>
                  );
                })}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                        <User className="w-4 h-4 text-amber-500" />
                        Nombre del Alumno
                      </label>
                      <input
                        required
                        type="text"
                        value={formData.alumno_nombre || ''}
                        onChange={e => setFormData({...formData, alumno_nombre: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                        placeholder="Ej: Nicolás Sarmiento"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                        <User className="w-4 h-4 text-amber-500" />
                        DNI
                      </label>
                      <input
                        required
                        type="text"
                        value={formData.alumno_dni || ''}
                        onChange={e => setFormData({...formData, alumno_dni: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                        placeholder="Ej: 38.123.456"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                        <FileText className="w-4 h-4 text-amber-500" />
                        Materia
                      </label>
                      <input
                        required
                        type="text"
                        value={formData.materia || ''}
                        onChange={e => setFormData({...formData, materia: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                        placeholder="Ej: Dirección de Cine"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                        <User className="w-4 h-4 text-amber-500" />
                        Docente Responsable
                      </label>
                      <select
                        required
                        value={formData.docente_responsable || ''}
                        onChange={e => setFormData({...formData, docente_responsable: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                      >
                        <option value="">Seleccionar docente...</option>
                        {docentes.map(d => (
                          <option key={d.id} value={d.nombre_completo}>{d.nombre_completo}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                      <Calendar className="w-4 h-4 text-amber-500" />
                      Fecha de Devolución Estimada
                    </label>
                    <input
                      required
                      type="datetime-local"
                      value={formData.fechaDevolucion || ''}
                      onChange={e => setFormData({...formData, fechaDevolucion: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                      <FileText className="w-4 h-4 text-amber-500" />
                      Comentarios / Observaciones
                    </label>
                    <textarea
                      rows={3}
                      value={formData.comentarios}
                      onChange={e => setFormData({...formData, comentarios: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all resize-none"
                      placeholder="Estado de las baterías, accesorios extra, etc."
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 px-6 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Volver a selección
                </button>
                <button
                  disabled={!isFormValid()}
                  onClick={handleFinish}
                  className="btn-primary flex items-center gap-2 px-8 py-3 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                  Finalizar y Generar PDF
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-4">
                  <ShoppingCart className="w-5 h-5 text-amber-500" />
                  <h2 className="font-bold">Resumen de Equipos</h2>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {equipments.filter(e => selectedIds.includes(e.id)).map(eq => (
                    <div key={eq.id} className="flex items-center gap-3 group">
                      <div className="w-10 h-10 rounded-lg bg-slate-800 overflow-hidden flex-shrink-0">
                        <img src={eq.foto_url || 'https://picsum.photos/seed/gear/100/100'} className="w-full h-full object-cover opacity-80" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{eq.nombre}</p>
                        <p className="text-[10px] text-slate-500 truncate">{eq.modelo}</p>
                      </div>
                      <button 
                        onClick={() => toggleSelect(eq.id)}
                        className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800 text-center">
                  <p className="text-xs text-slate-500">Total de ítems: <span className="text-amber-500 font-bold">{selectedIds.length}</span></p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
