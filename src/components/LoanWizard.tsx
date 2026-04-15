import React, { useState, useEffect } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { Equipment, Loan, Reservation, Responsable } from '../types';
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
  AlertCircle,
  BookOpen,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { addDays, format, isWithinInterval, parseISO, isAfter } from 'date-fns';
import { MATERIAS_CATEGORIES } from '../constants';

import { useNavigate } from 'react-router-dom';

export const LoanWizard: React.FC = () => {
  const { activeResponsable } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [docentes, setDocentes] = useState<Responsable[]>([]);
  const [showDocenteSuggestions, setShowDocenteSuggestions] = useState(false);
  
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
    const resId = params.get('resId');
    const resDocente = params.get('docente');
    const resEquipos = params.get('equipos');
    const resFin = params.get('fin');

    if (preselectedId) {
      setSelectedIds([preselectedId]);
    }

    if (resId && resEquipos) {
      setSelectedIds(resEquipos.split(','));
      setFormData(prev => ({
        ...prev,
        docente_responsable: resDocente || '',
        fechaDevolucion: resFin ? format(parseISO(resFin), "yyyy-MM-dd'T'HH:mm") : prev.fechaDevolucion
      }));
      // Store resId in a ref or state if needed to update it later
      setReservationId(resId);
    }
  }, []);

  const [reservationId, setReservationId] = useState<string | null>(null);

  const fetchDocentes = async () => {
    const { data } = await supabase.from('responsables').select('*').eq('activo', true);
    if (data) setDocentes(data);
  };

  const fetchAvailable = async () => {
    setLoading(true);
    const [eqRes, resRes] = await Promise.all([
      supabase.from('equipamiento').select('*').ilike('estado', 'disponible'),
      supabase.from('reservas').select('*')
    ]);
    
    if (!eqRes.error && eqRes.data) {
      console.log(`LoanWizard: Se encontraron ${eqRes.data.length} equipos disponibles.`);
      setEquipments(eqRes.data);
    }
    if (!resRes.error && resRes.data) setReservations(resRes.data);
    setLoading(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      (prev || []).includes(id) ? prev.filter(i => i !== id) : [...(prev || []), id]
    );
  };

  const [conflicts, setConflicts] = useState<Record<string, Reservation>>({});

  useEffect(() => {
    const newConflicts: Record<string, Reservation> = {};
    const returnDate = parseISO(formData.fechaDevolucion);
    const salidaDate = new Date();

    (selectedIds || []).forEach(id => {
      const conflictRes = (reservations || []).find(r => 
        (r.equipos_ids || []).includes(id) && 
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
    
    for (const id of (selectedIds || [])) {
      const conflictRes = (reservations || []).find(r => 
        (r.equipos_ids || []).includes(id) && 
        r.estado === 'Activa' &&
        isAfter(returnDate, parseISO(r.fecha_inicio)) &&
        isAfter(parseISO(r.fecha_fin), salidaDate)
      );
      
      if (conflictRes) {
        const eq = (equipments || []).find(e => e.id === id);
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

      if (loanError || !loan) {
        throw new Error(loanError?.message || 'No se pudo crear el registro del préstamo.');
      }

      // 2. Update Equipments
      console.log('Actualizando equipos a "Prestado". IDs:', selectedIds);
      const { error: eqError } = await supabase
        .from('equipamiento')
        .update({ estado: 'Prestado' })
        .in('id', selectedIds);

      if (eqError) throw eqError;

      // 2.5 Update Reservation if exists
      if (reservationId) {
        const { error: resError } = await supabase
          .from('reservas')
          .update({ estado: 'Entregada' })
          .eq('id', reservationId);
        if (resError) console.error('Error updating reservation status:', resError);
      }

      // 2.6 Log to Resource History (Hoja de Vida)
      const historyEntries = selectedIds.map(id => ({
        recurso_id: id,
        docente_nombre: formData.docente_responsable,
        alumno_nombre: formData.alumno_nombre,
        materia: formData.materia,
        pañolero_entrega: activeResponsable!,
        fecha_salida: new Date().toISOString(),
        estado_salida: 'Bueno', // Default or from equipment state
        prestamo_id: loan.id,
        tipo_accion: 'Salida'
      }));

      const { error: historyError } = await supabase
        .from('historial_recursos')
        .insert(historyEntries);
      
      if (historyError) console.error('Error logging resource history:', historyError);

      // 3. Log Action
      await logAction(activeResponsable!, 'NUEVO_PRESTAMO', { 
        loanId: loan.id, 
        alumno_nombre: formData.alumno_nombre,
        alumno_dni: formData.alumno_dni,
        equipos: selectedIds 
      });

      // 4. Generate PDF
      const selectedEquipments = (equipments || []).filter(e => (selectedIds || []).includes(e.id));
      generateLoanPDF(loan as Loan, selectedEquipments);

      // 5. Reset
      alert('Préstamo registrado con éxito. El comprobante se ha descargado.');
      navigate('/');
    } catch (error) {
      console.error('Error al registrar el préstamo:', error);
      alert('Error al registrar el préstamo. Revisa la consola.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = (equipments || []).filter(e => 
    (e?.nombre || '').toLowerCase().includes((search || '').toLowerCase()) ||
    (e?.modelo || '').toLowerCase().includes((search || '').toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-900">Despacho de Equipos</h1>
        <p className="text-slate-500">Complete la información para registrar el préstamo.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Selection */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-amber-500" />
                  Selección de Equipos
                </h2>
                <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-lg">
                  {selectedIds.length} seleccionados
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar equipos disponibles..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading ? (
                <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-amber-500" /></div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm italic">No se encontraron equipos disponibles.</div>
              ) : filtered.map(eq => {
                const isReservedNow = (reservations || []).some(r => 
                  (r.equipos_ids || []).includes(eq.id) &&
                  (r.estado === 'Pendiente' || r.estado === 'Activa') &&
                  isWithinInterval(new Date(), {
                    start: parseISO(r.fecha_inicio),
                    end: parseISO(r.fecha_fin)
                  })
                );
                const nextRes = (reservations || [])
                  .filter(r => (r.equipos_ids || []).includes(eq.id) && (r.estado === 'Pendiente' || r.estado === 'Activa') && isAfter(parseISO(r.fecha_inicio), new Date()))
                  .sort((a, b) => parseISO(a.fecha_inicio).getTime() - parseISO(b.fecha_inicio).getTime())[0];

                const isNoHabilitado = eq.permiso_uso === 'No habilitado';
                const isDisabled = isReservedNow || isNoHabilitado;

                return (
                  <button
                    key={eq.id}
                    disabled={isDisabled}
                    onClick={() => toggleSelect(eq.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-xl border transition-all text-left",
                      selectedIds.includes(eq.id) 
                        ? "border-amber-500 bg-amber-50 ring-1 ring-amber-500" 
                        : isDisabled
                          ? "border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed"
                          : "border-slate-100 hover:border-slate-200 bg-white"
                    )}
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                      <img src={eq.foto_url || 'https://picsum.photos/seed/gear/100/100'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-slate-900 truncate text-xs">{eq.nombre}</p>
                        {eq.permiso_uso === 'Restringido' && <Lock className="w-2.5 h-2.5 text-blue-500" title="Restringido" />}
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">
                        {isReservedNow ? (
                          <span className="text-amber-600 font-bold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Reservado
                          </span>
                        ) : isNoHabilitado ? (
                          <span className="text-red-600 font-bold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            No habilitado
                          </span>
                        ) : nextRes ? (
                          <span className="text-slate-400 font-medium">
                            Prox: {format(parseISO(nextRes.fecha_inicio), 'dd/MM HH:mm')}
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
          </div>
        </div>

        {/* Right Column: Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
            <h2 className="font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
              <FileText className="w-5 h-5 text-amber-500" />
              Datos del Préstamo
            </h2>

            {(Object.entries(conflicts || {}) as [string, Reservation][]).map(([eqId, res]) => {
              const eq = (equipments || []).find(e => e.id === eqId);
              return (
                <div key={res.id} className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-700 text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>
                    <strong>⚠️ Conflicto:</strong> {eq?.nombre} reservado por {res.docente_nombre} el {format(parseISO(res.fecha_inicio), 'dd/MM HH:mm')}.
                  </p>
                </div>
              );
            })}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    <User className="w-3.5 h-3.5 text-amber-500" />
                    Nombre del Alumno
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.alumno_nombre || ''}
                    onChange={e => setFormData({...formData, alumno_nombre: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all text-sm"
                    placeholder="Nombre completo"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    <User className="w-3.5 h-3.5 text-amber-500" />
                    DNI
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.alumno_dni || ''}
                    onChange={e => setFormData({...formData, alumno_dni: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all text-sm"
                    placeholder="Número de documento"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                    Materia
                  </label>
                  <select
                    required
                    value={formData.materia || ''}
                    onChange={e => setFormData({...formData, materia: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all appearance-none text-sm"
                  >
                    <option value="">Seleccionar materia...</option>
                    {Object.entries(MATERIAS_CATEGORIES).map(([cat, materias]) => (
                      <optgroup key={cat} label={cat}>
                        {[...materias].sort((a, b) => a.localeCompare(b)).map(m => <option key={m} value={m}>{m}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    <User className="w-3.5 h-3.5 text-amber-500" />
                    Docente Responsable
                  </label>
                  <div className="relative">
                    <input
                      required
                      type="text"
                      value={formData.docente_responsable || ''}
                      onChange={e => setFormData({...formData, docente_responsable: e.target.value})}
                      onFocus={() => setShowDocenteSuggestions(true)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all text-sm"
                      placeholder="Buscar o ingresar docente..."
                    />
                    {showDocenteSuggestions && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                        <div className="p-2 border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Sugerencias
                        </div>
                        {(docentes || [])
                          .filter(d => d.nombre_completo.toLowerCase().includes((formData.docente_responsable || '').toLowerCase()))
                          .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo))
                          .map(d => (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => {
                                setFormData({...formData, docente_responsable: d.nombre_completo});
                                setShowDocenteSuggestions(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-amber-50 hover:text-amber-700 transition-colors border-b border-slate-50 last:border-0"
                            >
                              {d.nombre_completo}
                            </button>
                          ))}
                        <button
                          type="button"
                          onClick={() => setShowDocenteSuggestions(false)}
                          className="w-full text-center px-4 py-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest bg-slate-50"
                        >
                          Cerrar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                Devolución Estimada
              </label>
              <input
                required
                type="datetime-local"
                value={formData.fechaDevolucion || ''}
                onChange={e => setFormData({...formData, fechaDevolucion: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all text-sm"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                Observaciones
              </label>
              <textarea
                rows={2}
                value={formData.comentarios}
                onChange={e => setFormData({...formData, comentarios: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all resize-none text-sm"
                placeholder="Detalles adicionales..."
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                disabled={!isFormValid() || submitting}
                onClick={handleFinish}
                className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                Registrar Préstamo y Generar PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
