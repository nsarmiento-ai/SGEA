import React, { useState, useEffect } from 'react';
import { supabase, logAction, logResourceHistory } from '../lib/supabase';
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
  PlusCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { addDays, format, isWithinInterval, parseISO, isAfter } from 'date-fns';
import { MATERIAS } from '../constants';

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
  
  const [formData, setFormData] = useState({
    alumno_nombre: '',
    alumno_dni: '',
    alumno_que_retira: '', // New optional field
    materia: '',
    aula: '',
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
    const resMateria = params.get('materia');
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
        materia: resMateria || '',
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
      supabase.from('equipamiento').select('*').eq('estado', 'Disponible'),
      supabase.from('reservas').select('*')
    ]);
    
    if (!eqRes.error && eqRes.data) setEquipments(eqRes.data);
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
    
    // Check for conflicts
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
      if (reservationId) {
        // Update existing reservation/loan
        const { data: existingRes } = await supabase.from('reservas').select('*').eq('id', reservationId).single();
        
        if (existingRes) {
          const newEquiposIds = Array.from(new Set([...(existingRes.equipos_ids || []), ...selectedIds]));
          await supabase.from('reservas').update({ equipos_ids: newEquiposIds }).eq('id', reservationId);
          
          // If it was already delivered, we might need to update the loan too
          const { data: existingLoan } = await supabase.from('prestamos').select('*').eq('estado', 'Activo').contains('equipos_ids', existingRes.equipos_ids).single();
          if (existingLoan) {
             await supabase.from('prestamos').update({ equipos_ids: newEquiposIds }).eq('id', existingLoan.id);
          }

          // Update equipment status to 'Prestado'
          await supabase
            .from('equipamiento')
            .update({ estado: 'Prestado' })
            .in('id', selectedIds);

          // Log Resource History
          for (const id of selectedIds) {
            await logResourceHistory({
              recurso_id: id,
              usuario_responsable: existingRes.docente_nombre,
              materia: existingRes.materia,
              accion: 'Préstamo',
              estado_detalle: 'Añadido a pedido existente',
              pañolero_turno: activeResponsable!
            });
          }
        }
      } else {
        // 1. Create Loan
        const loanData: any = {
          alumno_nombre: formData.alumno_nombre,
          alumno_dni: formData.alumno_dni,
          alumno_que_retira: formData.alumno_que_retira || null,
          materia: formData.materia,
          aula_asignada: formData.aula || null,
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
        await supabase
          .from('equipamiento')
          .update({ estado: 'Prestado' })
          .in('id', selectedIds);
        
        // 2.2 Log Resource History
        for (const id of selectedIds) {
          await logResourceHistory({
            recurso_id: id,
            usuario_responsable: formData.docente_responsable,
            materia: formData.materia,
            accion: 'Préstamo',
            estado_detalle: 'Entregado para uso',
            pañolero_turno: activeResponsable!
          });
        }

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
      }

      alert('Operación realizada con éxito.');
      navigate('/');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al procesar la operación.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = (equipments || []).filter(e => 
    (e.nombre || '').toLowerCase().includes((search || '').toLowerCase()) ||
    (e.modelo || '').toLowerCase().includes((search || '').toLowerCase())
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-200">
            <PlusCircle className="w-6 h-6 text-amber-500" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Despacho de Equipos</h1>
        </div>
        <div className="flex items-center gap-4 mt-4">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all",
                step === s ? "bg-amber-500 text-white shadow-lg shadow-amber-200 scale-110" : 
                step > s ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-400"
              )}>
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              <span className={cn(
                "text-[10px] font-black uppercase tracking-widest",
                step === s ? "text-slate-900" : "text-slate-400"
              )}>
                {s === 1 ? 'Equipos' : 'Responsables'}
              </span>
              {s === 1 && <div className="w-8 h-px bg-slate-200 mx-2" />}
            </div>
          ))}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Selección de Equipos</h2>
                <p className="text-slate-500 text-sm">Seleccione los elementos para el despacho inmediato.</p>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="text"
                  placeholder="Buscar equipo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-[2rem] p-2 border border-slate-100">
              <div className="max-h-[450px] overflow-y-auto pr-2 custom-scrollbar space-y-1 p-2">
                {loading ? (
                  <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-amber-500 w-10 h-10" /></div>
                ) : (filtered || []).map(eq => {
                  const isSelected = (selectedIds || []).includes(eq.id);
                  const isReservedNow = (reservations || []).some(r => 
                    (r.equipos_ids || []).includes(eq.id) &&
                    isWithinInterval(new Date(), {
                      start: parseISO(r.fecha_inicio),
                      end: parseISO(r.fecha_fin)
                    })
                  );
                  const conflict = conflicts[eq.id];
                  
                  return (
                    <div 
                      key={eq.id}
                      onClick={() => !isReservedNow && !conflict && toggleSelect(eq.id)}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-2xl transition-all cursor-pointer border",
                        isSelected ? "bg-amber-50 border-amber-200 shadow-sm" : "bg-white border-transparent hover:border-slate-200",
                        (isReservedNow || conflict) && "opacity-50 cursor-not-allowed bg-red-50 border-red-100"
                      )}
                    >
                      <div className={cn(
                        "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors",
                        isSelected ? "bg-amber-500 border-amber-500 text-white" : "border-slate-200"
                      )}>
                        {isSelected && <Check className="w-4 h-4" />}
                      </div>
                      
                      <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden border border-slate-100 flex-shrink-0">
                        <img src={eq.foto_url || 'https://picsum.photos/seed/gear/100/100'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{eq.nombre}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{eq.categoria} • S/N: {eq.numero_serie}</p>
                      </div>

                      {isReservedNow && (
                        <div className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Ocupado
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-900 p-6 rounded-[2rem] text-white shadow-xl shadow-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-xl font-black">{selectedIds.length} Ítems</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Listos para despachar</p>
                </div>
              </div>
              <button 
                disabled={selectedIds.length === 0}
                onClick={() => setStep(2)}
                className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:text-slate-500 text-white px-8 py-4 rounded-2xl font-black text-sm transition-all flex items-center gap-3 group"
              >
                CONTINUAR
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div>
              <h2 className="text-2xl font-black text-slate-900">Datos del Préstamo</h2>
              <p className="text-slate-500 text-sm">Complete la información del docente y alumno.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
                  <div className="space-y-4">
                    <label className="block relative">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Docente Responsable</span>
                      <div className="relative mt-2">
                        <input 
                          type="text"
                          placeholder="Escriba o seleccione un docente..."
                          value={formData.docente_responsable}
                          onChange={(e) => setFormData({...formData, docente_responsable: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-slate-700"
                        />
                        {formData.docente_responsable && !docentes.find(d => d.nombre === formData.docente_responsable) && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[8px] font-black rounded uppercase">Nuevo</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Suggestions list */}
                      {formData.docente_responsable && !docentes.find(d => d.nombre === formData.docente_responsable) && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-100 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                          {docentes
                            .filter(d => d.nombre.toLowerCase().includes(formData.docente_responsable.toLowerCase()))
                            .map(d => (
                              <button
                                key={d.id}
                                onClick={() => setFormData({...formData, docente_responsable: d.nombre})}
                                className="w-full text-left px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                              >
                                {d.nombre}
                              </button>
                            ))
                          }
                        </div>
                      )}
                    </label>

                    <label className="block">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Materia</span>
                      <select 
                        value={formData.materia}
                        onChange={(e) => setFormData({...formData, materia: e.target.value})}
                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-slate-700"
                      >
                        <option value="">Seleccione Materia</option>
                        {Object.entries(MATERIAS).map(([group, list]) => (
                          <optgroup key={group} label={group}>
                            {list.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Aula Asignada (Opcional)</span>
                      <select 
                        value={formData.aula || ''}
                        onChange={(e) => setFormData({...formData, aula: e.target.value})}
                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-slate-700"
                      >
                        <option value="">No asignar aula</option>
                        {['Aula A', 'Aula B', 'Aula C', 'Aula D', 'Aula E', 'Aula F', 'Aula G', 'SET'].map(a => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha/Hora Devolución</span>
                      <input 
                        type="datetime-local"
                        value={formData.fechaDevolucion}
                        onChange={(e) => setFormData({...formData, fechaDevolucion: e.target.value})}
                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-slate-700"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
                  <div className="space-y-4">
                    <label className="block">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre del Alumno Responsable</span>
                      <input 
                        type="text"
                        placeholder="Ej: Juan Pérez"
                        value={formData.alumno_nombre}
                        onChange={(e) => setFormData({...formData, alumno_nombre: e.target.value})}
                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-slate-700"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">DNI del Alumno Responsable</span>
                      <input 
                        type="text"
                        placeholder="Sin puntos ni espacios"
                        value={formData.alumno_dni}
                        onChange={(e) => setFormData({...formData, alumno_dni: e.target.value})}
                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-slate-700"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alumno que retira (Opcional)</span>
                      <input 
                        type="text"
                        placeholder="Si es distinto al responsable"
                        value={formData.alumno_que_retira}
                        onChange={(e) => setFormData({...formData, alumno_que_retira: e.target.value})}
                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-slate-700"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observaciones de Entrega</span>
                      <textarea 
                        placeholder="Ej: Trípode con detalle en zapata..."
                        value={formData.comentarios}
                        onChange={(e) => setFormData({...formData, comentarios: e.target.value})}
                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-slate-700 h-24 resize-none"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-6 rounded-[2rem] border border-slate-200">
              <button 
                onClick={() => setStep(1)}
                className="flex items-center gap-2 px-6 py-4 text-slate-500 font-black text-sm hover:text-slate-900 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                VOLVER
              </button>
              <button 
                disabled={!isFormValid() || submitting}
                onClick={handleFinish}
                className="bg-slate-900 hover:bg-amber-500 disabled:bg-slate-300 text-white px-10 py-4 rounded-2xl font-black text-sm transition-all flex items-center gap-3 shadow-xl shadow-slate-200"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                FINALIZAR Y DESPACHAR
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
