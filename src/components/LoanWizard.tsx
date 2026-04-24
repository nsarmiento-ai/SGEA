import React, { useState, useEffect } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { Equipment, Loan, Reservation, Responsable } from '../types';
import { useApp } from '../context/AppContext';
import { generateLoanPDF } from '../lib/pdf';
import { sendAssistedEmail } from '../lib/email';
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
  Lock,
  Mail,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { addDays, format, isWithinInterval, parseISO, isAfter } from 'date-fns';
import { MATERIAS_CATEGORIES } from '../constants';

import { useNavigate } from 'react-router-dom';

export const LoanWizard: React.FC = () => {
  const { activeResponsable, profile } = useApp();
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
  const [finishedLoan, setFinishedLoan] = useState<any>(null);
  
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
    try {
      console.log('LoanWizard: Fetching available equipment...');
      const [eqRes, resRes] = await Promise.all([
        supabase.from('equipamiento').select('*'),
        supabase.from('reservas').select('*')
      ]);
      
      if (eqRes.error) throw eqRes.error;
      
      if (eqRes.data) {
        // Strict filter for 'Disponible' items
        const available = eqRes.data.filter(e => 
          String(e.estado || '').toLowerCase() === 'disponible' || e.estado === 'Disponible'
        );
        console.log(`LoanWizard: Found ${available.length} available items out of ${eqRes.data.length} total.`);
        setEquipments(available);
      }
      
      if (resRes.data) setReservations(resRes.data);
    } catch (err) {
      console.error('LoanWizard: Error fetching available equipment:', err);
    } finally {
      setLoading(false);
    }
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
      // Final availability check before creating loan
      const { data: latestStatus } = await supabase
        .from('equipamiento')
        .select('id, nombre, estado')
        .in('id', selectedIds);
      
      const unavailable = latestStatus?.filter(eq => String(eq.estado || '').toLowerCase() !== 'disponible');
      if (unavailable && unavailable.length > 0) {
        throw new Error(`Los siguientes equipos ya no están disponibles: ${unavailable.map(u => u.nombre).join(', ')}`);
      }

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
      const targetDocente = docentes.find(d => d.nombre_completo === formData.docente_responsable);
      generateLoanPDF(loan as Loan, selectedEquipments, targetDocente?.email);

      // 5. Success State
      setFinishedLoan({ loan, equipments: selectedEquipments, docenteEmail: targetDocente?.email });
    } catch (error) {
      console.error('Error al registrar el préstamo:', error);
      alert('Error al registrar el préstamo. Revisa la consola.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendEmail = () => {
    if (!finishedLoan) return;
    const { loan, equipments, docenteEmail } = finishedLoan;
    
    if (!docenteEmail) {
      alert('No se puede enviar el email: El docente no tiene un correo electrónico registrado.');
      return;
    }
    
    sendAssistedEmail({
      to: docenteEmail,
      cc: profile?.email || undefined,
      subject: `SGEA - Comprobante de Préstamo - Escuela de Cine`,
      body: `Hola,\n\nSe ha registrado un préstamo de equipamiento audiovisual.\n\nAlumno: ${loan.alumno_nombre}\nMateria: ${loan.materia}\nFecha de Salida: ${format(parseISO(loan.fecha_salida), 'dd/MM/yyyy HH:mm')}\nFecha de Devolución Estimada: ${format(parseISO(loan.fecha_devolucion_estimada), 'dd/MM/yyyy HH:mm')}\n\nEquipos:\n${equipments.map((e: any) => `- ${e.nombre} (${e.modelo})`).join('\n')}\n\nNota: Se adjunta el comprobante en PDF (Favor de adjuntar el archivo descargado manualmente).\n\nSaludos,\nSistema SGEA`
    });
  };

  if (finishedLoan) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto pt-20">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center text-center"
        >
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
            <Check className="w-10 h-10" />
          </div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-slate-900 mb-2">¡Préstamo Registrado!</h2>
          <p className="text-sm md:text-base text-slate-500 mb-8 max-w-md mx-auto">
            El préstamo se ha guardado correctamente y el comprobante PDF se ha descargado de forma automática.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            <button
              onClick={() => generateLoanPDF(finishedLoan.loan, finishedLoan.equipments, finishedLoan.docenteEmail)}
              className="flex items-center justify-center gap-2 px-6 py-4 border border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition-all text-sm"
            >
              <Download className="w-5 h-5" />
              Bajar PDF
            </button>
            <button
              onClick={handleSendEmail}
              className={cn(
                "flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold transition-all text-sm shadow-lg",
                finishedLoan.docenteEmail 
                  ? "bg-amber-500 text-white shadow-amber-200 hover:bg-amber-600" 
                  : "bg-slate-100 text-slate-400 shadow-transparent cursor-not-allowed"
              )}
            >
              <Mail className="w-5 h-5" />
              {finishedLoan.docenteEmail ? 'Enviar Email' : 'Email no disponible'}
            </button>
          </div>
          
          <button
            onClick={() => navigate('/')}
            className="mt-8 text-slate-400 font-bold hover:text-slate-600 text-sm uppercase tracking-widest"
          >
            Volver al Inicio
          </button>
        </motion.div>
      </div>
    );
  }

  const filtered = (equipments || []).filter(e => 
    (e?.nombre || '').toLowerCase().includes((search || '').toLowerCase()) ||
    (e?.modelo || '').toLowerCase().includes((search || '').toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pt-16 lg:pt-8 text-slate-900">
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900">Despacho de Equipos</h1>
        <p className="text-sm md:text-base text-slate-500">Complete la información del préstamo.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        {/* Left Column: Selection */}
        <div className="lg:col-span-5 order-2 lg:order-1">
          <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[450px] md:h-[600px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm md:text-base">
                  <ShoppingCart className="w-5 h-5 text-amber-500" />
                  Equipos
                </h2>
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-1 rounded-lg">
                  {selectedIds.length} OK
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar equipos..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 custom-scrollbar">
              {loading ? (
                <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-amber-500" /></div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm italic">Sin resultados.</div>
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
                      "w-full flex items-center gap-3 p-2.5 md:p-2 rounded-2xl border transition-all text-left",
                      selectedIds.includes(eq.id) 
                        ? "border-amber-500 bg-amber-50 ring-1 ring-amber-500" 
                        : isDisabled
                          ? "border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed"
                          : "border-slate-100 hover:border-slate-200 bg-white"
                    )}
                  >
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                      <img src={eq.foto_url || 'https://picsum.photos/seed/gear/100/100'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-slate-900 truncate text-xs md:text-sm">{eq.nombre}</p>
                        {eq.permiso_uso === 'Restringido' && <Lock className="w-2.5 h-2.5 text-blue-500" title="Restringido" />}
                      </div>
                      <p className="text-[10px] md:text-xs text-slate-500 truncate">
                        {isReservedNow ? (
                          <span className="text-amber-600 font-bold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Reservado
                          </span>
                        ) : isNoHabilitado ? (
                          <span className="text-red-600 font-bold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Bloqueado
                          </span>
                        ) : nextRes ? (
                          <span className="text-slate-400 font-medium font-mono">
                            Prox: {format(parseISO(nextRes.fecha_inicio), 'dd/MM HH:mm')}
                          </span>
                        ) : eq.modelo}
                      </p>
                    </div>
                    {selectedIds.includes(eq.id) && (
                      <div className="bg-amber-500 rounded-full p-1 shadow-md shadow-amber-200">
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
        <div className="lg:col-span-7 order-1 lg:order-2 space-y-6">
          <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 space-y-6">
            <h2 className="font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4 text-base md:text-lg">
              <FileText className="w-5 h-5 text-amber-500" />
              Datos del Préstamo
            </h2>

            {(Object.entries(conflicts || {}) as [string, Reservation][]).map(([eqId, res]) => {
              const eq = (equipments || []).find(e => e.id === eqId);
              return (
                <div key={res.id} className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-700 text-xs md:text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>
                    <strong className="font-black uppercase tracking-wider">⚠️ Conflicto:</strong> {eq?.nombre} reservado por {res.docente_nombre} el {format(parseISO(res.fecha_inicio), 'dd/MM HH:mm')}.
                  </p>
                </div>
              );
            })}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    <User className="w-3.5 h-3.5 text-amber-500" />
                    Nombre del Alumno
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.alumno_nombre || ''}
                    onChange={e => setFormData({...formData, alumno_nombre: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all text-sm"
                    placeholder="Nombre completo"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    <User className="w-3.5 h-3.5 text-amber-500" />
                    DNI del Estudiante
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.alumno_dni || ''}
                    onChange={e => setFormData({...formData, alumno_dni: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all text-sm"
                    placeholder="Documento"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                    Materia / Proyecto
                  </label>
                  <select
                    required
                    value={formData.materia || ''}
                    onChange={e => setFormData({...formData, materia: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all appearance-none text-sm"
                  >
                    <option value="">Seleccionar...</option>
                    {Object.entries(MATERIAS_CATEGORIES).map(([cat, materias]) => (
                      <optgroup key={cat} label={cat}>
                        {[...materias].sort((a, b) => a.localeCompare(b)).map(m => <option key={m} value={m}>{m}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
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
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all text-sm"
                      placeholder="Buscar docente..."
                    />
                    {showDocenteSuggestions && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-52 overflow-y-auto custom-scrollbar">
                        <div className="p-3 border-b border-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
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
                              className="w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors border-b border-slate-50 last:border-0"
                            >
                              <p className="text-xs font-bold text-slate-700">{d.nombre_completo}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{d.email}</p>
                            </button>
                          ))}
                        <button
                          type="button"
                          onClick={() => setShowDocenteSuggestions(false)}
                          className="w-full text-center px-4 py-2 text-[9px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest bg-slate-50"
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
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                Devolución Estimada
              </label>
              <input
                required
                type="datetime-local"
                value={formData.fechaDevolucion || ''}
                onChange={e => setFormData({...formData, fechaDevolucion: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all text-sm"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                Observaciones / Notas
              </label>
              <textarea
                rows={2}
                value={formData.comentarios}
                onChange={e => setFormData({...formData, comentarios: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all resize-none text-sm placeholder:text-slate-400"
                placeholder="Detalles adicionales del equipo..."
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                disabled={!isFormValid() || submitting}
                onClick={handleFinish}
                className="w-full md:w-auto bg-slate-900 text-white px-10 py-4.5 rounded-2xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-3 hover:bg-amber-500 transition-all shadow-lg shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                Registrar y Generar PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
