import React, { useState, useEffect } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { Equipment, Loan, Reservation, Responsable, StudentRequest } from '../types';
import { useApp } from '../context/AppContext';
import { CONTACTS_DATA } from '../lib/contactsData';
import { generateLoanPDF } from '../lib/pdf';
import { sendAssistedEmail } from '../lib/email';
import { 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  ShoppingCart, 
  User, 
  Users,
  Calendar, 
  FileText,
  Loader2,
  Search,
  X,
  AlertCircle,
  BookOpen,
  Lock,
  Mail,
  Download,
  Clock,
  ExternalLink
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
  const [studentRequests, setStudentRequests] = useState<StudentRequest[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [docentes, setDocentes] = useState<Responsable[]>([]);
  const [showDocenteSuggestions, setShowDocenteSuggestions] = useState(false);
  const [finishedLoan, setFinishedLoan] = useState<any>(null);
  const [selectedStudentRequestId, setSelectedStudentRequestId] = useState<string | null>(null);
  const [authorizedEquipmentsIds, setAuthorizedEquipmentsIds] = useState<string[]>([]);
  const [syncConflict, setSyncConflict] = useState<{ nombre: string, estado: string, id: string }[] | null>(null);
  
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
    fetchStudentRequests();
    
    const params = new URLSearchParams(window.location.search);
    const preselectedId = params.get('id');
    const resId = params.get('resId');
    const resDocente = params.get('docente');
    const resEquipos = params.get('equipos');
    const resFin = params.get('fin');
    const studentReqId = params.get('studentReqId');
    const resAlumno = params.get('alumno');
    const resDni = params.get('dni');
    const resMateria = params.get('materia');

    if (preselectedId) {
      setSelectedIds([preselectedId]);
    }

    if (resId && resEquipos) {
      setSelectedIds(resEquipos.split(','));
      setFormData(prev => ({
        ...prev,
        docente_responsable: resDocente || '',
        alumno_nombre: resAlumno || '',
        materia: resMateria || '',
        fechaDevolucion: resFin ? format(parseISO(resFin), "yyyy-MM-dd'T'HH:mm") : prev.fechaDevolucion
      }));
      setReservationId(resId);
    }

    if (studentReqId) {
      setSelectedStudentRequestId(studentReqId);
      if (resEquipos) setSelectedIds(resEquipos.split(','));
      setFormData(prev => ({
        ...prev,
        alumno_nombre: resAlumno || '',
        alumno_dni: resDni || '',
        docente_responsable: resDocente || '',
        materia: resMateria || '',
        fechaDevolucion: resFin ? format(parseISO(resFin), "yyyy-MM-dd'T'HH:mm") : prev.fechaDevolucion
      }));
    }
  }, []);

  const [reservationId, setReservationId] = useState<string | null>(null);

  const fetchStudentRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('solicitudes_alumnos')
        .select('id, responsable, docente_nombre, materia, equipos, fecha_fin, dni, observaciones')
        .neq('estado', 'Entregado')
        .neq('estado', 'Rechazado')
        .neq('estado', 'Cancelado');
      if (error) throw error;
      if (data) setStudentRequests(data);
    } catch (e) {
      console.warn('Error fetching solicitudes_alumnos:', e);
      setStudentRequests([]);
    }
  };

  const selectStudentRequest = (req: StudentRequest) => {
    setSelectedStudentRequestId(req.id);
    setSelectedIds(req.equipos);
    setAuthorizedEquipmentsIds(req.equipos);
    setFormData({
      alumno_nombre: req.responsable,
      alumno_dni: req.dni,
      materia: req.materia,
      docente_responsable: req.docente_nombre,
      fechaDevolucion: format(parseISO(req.fecha_fin), "yyyy-MM-dd'T'HH:mm"),
      comentarios: req.observaciones || ''
    });
  };

  const currentStudentRequest = studentRequests.find(r => r.id === selectedStudentRequestId);
  const isAuthorized = !selectedStudentRequestId || currentStudentRequest?.estado === 'Autorizado para Despacho';

  const fetchDocentes = async () => {
    // We use CONTACTS_DATA now for consistency
    const formatted = CONTACTS_DATA.map(c => ({
      id: c.email,
      nombre_completo: c.nombre,
      email: c.email,
      activo: true,
      creado_at: new Date().toISOString()
    })) as Responsable[];
    setDocentes(formatted);
  };

  const fetchAvailable = async () => {
    setLoading(true);
    try {
      console.log('LoanWizard: Fetching available equipment...');
      const [eqRes, resRes] = await Promise.all([
        supabase.from('equipamiento').select('id, nombre, modelo, category, foto_url, estado, piezas, permiso_uso'),
        supabase.from('reservas').select('id, docente_nombre, alumno_nombre, equipos_ids, fecha_fin, materia')
      ]);
      
      if (eqRes.error) throw eqRes.error;
      
      if (eqRes.data) {
        console.log(`LoanWizard: Fetched ${eqRes.data.length} total items.`);
        setEquipments(eqRes.data);
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
      isAuthorized &&
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
      // Logic for tracking added equipment
      const equipos_autorizados = selectedIds.filter(id => authorizedEquipmentsIds.includes(id));
      const equipos_adicionales = selectedIds.filter(id => !authorizedEquipmentsIds.includes(id));
      const hasAddedEquipment = equipos_adicionales.length > 0;

      // Final availability check before creating loan
      const { data: latestStatus } = await supabase
        .from('equipamiento')
        .select('id, nombre, estado')
        .in('id', selectedIds);
      
      const unavailable = latestStatus?.filter(eq => {
        const estado = String(eq.estado || '').toLowerCase();
        if (estado === 'disponible') return false; // Is available
        if (estado === 'reservado' && selectedStudentRequestId && authorizedEquipmentsIds.includes(eq.id)) {
          return false; // Valid because it was reserved for this exact student request
        }
        return true; // Not available
      });
      
      if (unavailable && unavailable.length > 0) {
        setSyncConflict(unavailable.map(u => ({ nombre: u.nombre, estado: u.estado || 'Desconocido', id: u.id })));
        setSubmitting(false);
        return;
      }

      let createdLoanId: string | null = null;
      let equipmentsUpdated = false;

      try {
        // 1. Create Loan
        const loanData: any = {
          alumno_nombre: formData.alumno_nombre,
          alumno_dni: formData.alumno_dni,
          materia: formData.materia,
          docente_responsable: formData.docente_responsable,
          responsable_nombre: activeResponsable!,
          fecha_salida: new Date().toISOString(),
          fecha_devolucion_estimada: new Date(formData.fechaDevolucion).toISOString(),
          estado: 'Activo',
          equipos_ids: selectedIds,
          comentarios: formData.comentarios,
          equipos_autorizados: equipos_autorizados,
          equipos_adicionales: equipos_adicionales
        };

        const { data: loan, error: loanError } = await supabase
          .from('prestamos')
          .insert([loanData])
          .select()
          .single();

        if (loanError || !loan) {
          throw new Error(loanError?.message || 'No se pudo crear el registro del préstamo.');
        }
        createdLoanId = loan.id;

        // 2. Update Equipments
        console.log('Actualizando equipos a "Prestado". IDs:', selectedIds);
        const { error: eqError } = await supabase
          .from('equipamiento')
          .update({ estado: 'Prestado' })
          .in('id', selectedIds);

        if (eqError) throw eqError;
        equipmentsUpdated = true;

        // 2.5 Update Reservation if exists
        if (reservationId) {
          const { error: resErr } = await supabase
            .from('reservas')
            .update({ estado: 'Entregada' })
            .eq('id', reservationId);
          if (resErr) throw resErr;
        }

        // 2.5b Update Student Request if exists
        if (selectedStudentRequestId) {
          const newState = hasAddedEquipment ? 'Entregado (Modificado)' : 'Entregado';
          const { error: reqErr } = await supabase
            .from('solicitudes_alumnos')
            .update({ 
              estado: newState,
              observaciones: `${formData.comentarios}${hasAddedEquipment ? '\nModificado en Despacho: Se agregaron equipos extra.' : ''}`.trim()
            } as any)
            .eq('id', selectedStudentRequestId);
          if (reqErr) throw reqErr;
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
        
        if (historyError) throw historyError;

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
        generateLoanPDF(loan as Loan, selectedEquipments, targetDocente?.email, authorizedEquipmentsIds);

        // 5. Success State
        setFinishedLoan({ loan, equipments: selectedEquipments, docenteEmail: targetDocente?.email, authorizedIds: authorizedEquipmentsIds });

      } catch (innerError) {
        // Rollback block
        console.error("Initiating rollback due to error:", innerError);
        
        if (equipmentsUpdated) {
          await supabase.from('equipamiento').update({ estado: 'Disponible' }).in('id', selectedIds);
        }
        if (createdLoanId) {
          await supabase.from('prestamos').delete().eq('id', createdLoanId);
        }
        
        throw innerError;
      }

    } catch (error: any) {
      console.error('Error al registrar el préstamo:', error);
      alert(`Error al registrar el préstamo: ${error.message || 'Revisa la consola'}`);
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
      subject: `SGEA - Comprobante de Préstamo - Escuela de Cine`,
      body: `Hola,\n\nSe ha registrado un préstamo de equipamiento audiovisual.\n\nAlumno: ${loan.alumno_nombre}\nMateria: ${loan.materia}\nFecha de Salida: ${format(parseISO(loan.fecha_salida), 'dd/MM/yyyy HH:mm')}\nFecha de Devolución Estimada: ${format(parseISO(loan.fecha_devolucion_estimada), 'dd/MM/yyyy HH:mm')}\n\nEquipos:\n${equipments.map((e: any) => `- ${e.nombre} (${e.modelo})`).join('\n')}\n\nNota: Se adjunta el comprobante en PDF (Favor de adjuntar el archivo descargado manualmente).\n\nSaludos,\nSistema SGEA`
    });
  };

  const handleSyncAndRetry = async () => {
    if (!syncConflict) return;
    setSubmitting(true);
    try {
      const conflictIds = syncConflict.map(c => c.id);
      const { error } = await supabase
        .from('equipamiento')
        .update({ estado: 'Disponible' })
        .in('id', conflictIds);
      
      if (error) throw error;
      
      setSyncConflict(null);
      await handleFinish(); // Retry
    } catch (e) {
      console.error("Error syncing equipment:", e);
      alert("Error al sincronizar equipos. Inténtelo nuevamente.");
      setSubmitting(false);
    }
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
          <p className="text-sm md:text-base text-slate-700 mb-8 max-w-md mx-auto">
            El préstamo se ha guardado correctamente y el comprobante PDF se ha descargado de forma automática.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            <button
              onClick={() => generateLoanPDF(finishedLoan.loan, finishedLoan.equipments, finishedLoan.docenteEmail, finishedLoan.authorizedIds)}
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
                  ? "bg-amber-500 text-slate-900 shadow-amber-200 hover:bg-amber-600 font-black" 
                  : "bg-slate-100 text-slate-500 shadow-transparent cursor-not-allowed"
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
        <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900 min-h-[32px] md:min-h-[40px]">Despacho de Equipos</h1>
        <p className="text-sm md:text-base text-slate-700">Complete la información del préstamo.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 relative">
        <AnimatePresence>
          {syncConflict && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
            >
              <div className="bg-white p-6 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200">
                <div className="flex items-center gap-3 mb-4 text-red-600">
                  <AlertCircle className="w-8 h-8" aria-hidden="true" />
                  <h2 className="text-lg font-black uppercase tracking-wider">Conflicto de Inventario</h2>
                </div>
                <p className="text-sm font-medium text-slate-600 mb-6 leading-relaxed">
                  Los siguientes equipos no figuran como "Disponible" en la base de datos debido a préstamos previos o errores de sincronización:
                </p>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-6 space-y-2">
                  {syncConflict.map(c => (
                    <div key={c.id} className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-900">{c.nombre}</span>
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded uppercase tracking-widest">{c.estado}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mb-6">
                  Si el equipo está físicamente en el Pañol, presiona <strong>Sincronizar y Reintentar</strong> para corregir el estado e intentar el despacho nuevamente.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSyncConflict(null)}
                    className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSyncAndRetry}
                    className="flex-[2] bg-amber-500 text-slate-900 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-amber-600 shadow-lg shadow-amber-200"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Sincronizar y Reintentar'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Left Column: Selection */}
        <div className="lg:col-span-5 order-2 lg:order-1 space-y-6">
          {studentRequests.length > 0 && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                  Solicitudes de Alumnos
                </h2>
              </div>
              <div className="p-3 max-h-48 overflow-y-auto space-y-2">
                  {studentRequests.map(req => (
                    <div key={req.id}>
                      <button
                        onClick={() => selectStudentRequest(req)}
                        className={cn(
                          "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left mb-2",
                          selectedStudentRequestId === req.id 
                            ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" 
                            : "border-slate-100 bg-slate-50 hover:border-slate-200"
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{req.responsable}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{req.materia}</p>
                        </div>
                        <div className={cn(
                          "text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border",
                          req.estado === 'Autorizado para Despacho' 
                            ? "bg-green-50 text-green-600 border-green-200" 
                            : "bg-amber-50 text-amber-950 border-amber-200"
                        )}>
                          {req.estado === 'Autorizado para Despacho' ? 'Autorizado' : 'Pendiente'}
                        </div>
                      </button>

                      {selectedStudentRequestId === req.id && (
                        <div className="mx-2 mb-4 p-3 bg-white rounded-xl border border-indigo-100 space-y-2 animate-in slide-in-from-top-1">
                          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                            <Users className="w-3 h-3 text-indigo-500" />
                            Integrantes del Grupo
                          </div>
                          <p className="text-xs font-medium text-slate-600 leading-tight">
                            {req.integrantes || 'No especificados'}
                          </p>
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <div className="text-[8px] font-black uppercase text-slate-400">Docente a Cargo</div>
                              <div className="text-[10px] font-bold text-slate-700">{req.docente_nombre}</div>
                            </div>
                            <div>
                              <div className="text-[8px] font-black uppercase text-slate-400">Materia</div>
                              <div className="text-[10px] font-bold text-slate-700">{req.materia}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[450px] md:h-[600px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm md:text-base">
                  <ShoppingCart className="w-5 h-5 text-amber-500" />
                  Equipos
                </h2>
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-950 px-2 py-1 rounded-lg">
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

            <div className="bg-slate-50 border-b border-slate-100 px-4 py-2 flex items-center gap-4">
              <span className="w-10"></span>
              <span className="flex-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Equipo</span>
              <span className="w-16 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</span>
              <span className="w-8"></span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-amber-500" /></div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm italic">Sin resultados.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filtered.map(eq => {
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
                    const isNotAvailable = String(eq.estado || '').toLowerCase() !== 'disponible';
                    
                    const isDisabled = (isReservedNow || isNoHabilitado || isNotAvailable) && !selectedIds.includes(eq.id);

                    return (
                      <div
                        key={eq.id}
                        className={cn(
                          "flex items-center gap-4 px-4 py-3 transition-colors cursor-pointer group",
                          selectedIds.includes(eq.id) ? "bg-amber-50/50" : "hover:bg-slate-50",
                          isDisabled && "opacity-50 grayscale bg-slate-50/50"
                        )}
                        onClick={() => !isDisabled && toggleSelect(eq.id)}
                      >
                        <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                          <img src={eq.foto_url || 'https://picsum.photos/seed/gear/100/100'} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt={eq.nombre} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 truncate text-[11px] md:text-xs leading-tight">{eq.nombre}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase truncate mt-0.5">{eq.categoria}</p>
                        </div>

                        <div className="w-16 flex flex-col items-center">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border",
                            eq.estado === 'Disponible' && !isDisabled 
                              ? "bg-green-50 text-green-600 border-green-200" 
                              : "bg-red-50 text-red-600 border-red-200"
                          )}>
                            {isReservedNow ? 'Res' : isNoHabilitado ? 'Bloq' : eq.estado.slice(0, 4)}
                          </span>
                        </div>

                        <div className="w-8 flex justify-center">
                          <div className={cn(
                            "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all",
                            selectedIds.includes(eq.id)
                              ? "bg-amber-500 border-amber-500 text-slate-900 font-bold"
                              : "border-slate-200 text-transparent group-hover:border-slate-300"
                          )}>
                            <Check className="w-3.5 h-3.5" strokeWidth={3} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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

            {currentStudentRequest && (
              <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-2xl animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 mb-4">
                  <Users className="w-4 h-4" />
                  Resumen de Solicitud Autorizada
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Integrantes</span>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed">
                      {currentStudentRequest.integrantes || 'Sin integrantes especificados'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Materia / Proyecto</span>
                    <p className="text-xs font-bold text-slate-700">{currentStudentRequest.materia}</p>
                  </div>
                </div>
              </div>
            )}

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
                  <select
                    required
                    value={formData.docente_responsable || ''}
                    onChange={e => setFormData({...formData, docente_responsable: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all appearance-none text-sm"
                  >
                    <option value="">Seleccionar Docente...</option>
                    {([...CONTACTS_DATA]).sort((a, b) => a.nombre.localeCompare(b.nombre)).map(docente => (
                      <option key={docente.email} value={docente.nombre}>{docente.nombre}</option>
                    ))}
                  </select>
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

            <div className="pt-4 border-t border-slate-100 flex flex-col gap-4 items-end">
              {!isAuthorized && selectedStudentRequestId && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-700 text-xs flex items-start gap-3 w-full animate-in fade-in slide-in-from-right-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="font-black uppercase tracking-wider mb-1">No se puede entregar</p>
                    <p className="font-medium">
                      {currentStudentRequest?.estado === 'Pendiente de Aval Docente' 
                        ? 'Pendiente de aprobación del docente' 
                        : 'Pendiente de aprobación de Dirección'}
                    </p>
                  </div>
                </div>
              )}
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
