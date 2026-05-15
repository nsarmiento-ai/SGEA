import React, { useState, useEffect } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { Loan, Equipment, LoanStatus, PiezaEstado, EquipmentStatus, Responsable } from '../types';
import { useApp } from '../context/AppContext';
import { generateReturnPDF } from '../lib/pdf';
import { sendAssistedEmail } from '../lib/email';
import { 
  Clock, 
  User, 
  Calendar, 
  Package, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  ArrowRight,
  XCircle,
  Download,
  Mail,
  Check
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatDate } from '../lib/utils';
import { differenceInDays, isPast, format } from 'date-fns';

import { CONTACTS_DATA } from '../lib/contactsData';

export const ActiveLoans: React.FC<{ filterMora?: boolean }> = ({ filterMora = false }) => {
  const { activeResponsable, role } = useApp();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [equipments, setEquipments] = useState<Record<string, Equipment>>({});
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [finishedReturn, setFinishedReturn] = useState<any>(null);
  const [docentes, setDocentes] = useState<Responsable[]>([]);

  useEffect(() => {
    fetchData();
  }, [filterMora]);

  const fetchData = async () => {
    setLoading(true);
    const [loansRes] = await Promise.all([
      supabase
        .from('prestamos')
        .select('id, alumno_nombre, alumno_dni, materia, docente_responsable, responsable_nombre, fecha_salida, fecha_devolucion_estimada, estado, equipos_ids')
        .in('estado', ['Activo', 'Despachado', 'En Mora'])
        .order('fecha_devolucion_estimada', { ascending: true })
    ]);
    
    // Use CONTACTS_DATA for consistency
    const formattedDocentes = CONTACTS_DATA.map(c => ({
      id: c.email,
      nombre_completo: c.nombre,
      email: c.email,
      activo: true,
      creado_at: new Date().toISOString()
    })) as Responsable[];
    setDocentes(formattedDocentes);

    let loansData = loansRes.data;
    let loansError = loansRes.error;
    
    if (!loansError && loansData) {
      const processedLoans = loansData.map(l => ({
        ...l,
        isMora: isPast(new Date(l.fecha_devolucion_estimada))
      }));

      const finalLoans = filterMora ? processedLoans.filter(l => l.isMora) : processedLoans;
      setLoans(finalLoans);

      const eqIds = Array.from(new Set((finalLoans || []).flatMap(l => l.equipos_ids || [])));
      if (eqIds.length > 0) {
        const { data: eqData } = await supabase.from('equipamiento').select('id, nombre, foto_url, categoria, piezas, estado, modelo, numero_serie').in('id', eqIds);
        if (eqData) {
          const eqMap = eqData.reduce((acc, eq) => {
            let parsedPiezas = eq.piezas;
            if (typeof eq.piezas === 'string') {
              try {
                parsedPiezas = JSON.parse(eq.piezas || '[]');
              } catch (e) {
                parsedPiezas = [];
              }
            }
            return { 
              ...acc, 
              [eq.id]: {
                ...eq,
                piezas: parsedPiezas || [],
                estado: (String(eq.estado || '').toLowerCase() === 'roto' || 
                         String(eq.estado || '').toLowerCase() === 'en reparación' || 
                         String(eq.estado || '').toLowerCase() === 'perdido' || 
                         String(eq.estado || '').toLowerCase() === 'incompleto' ||
                         String(eq.estado || '').toLowerCase() === 'fuera de servicio') 
                         ? 'Fuera de Servicio' 
                         : (String(eq.estado || '').toLowerCase() === 'mantenimiento' || String(eq.estado || '').toLowerCase() === 'en mantenimiento') ? 'En Mantenimiento' :
                         (String(eq.estado || '').toLowerCase() === 'en mora' || String(eq.estado || '').toLowerCase() === 'mora') ? 'En Mora' :
                         (String(eq.estado || '').toLowerCase() === 'eliminado' || String(eq.estado || '').toLowerCase() === 'archivado' ? 'Archivado' : 
                          String(eq.estado || '').toLowerCase() === 'disponible' ? 'Disponible' :
                          String(eq.estado || '').toLowerCase() === 'prestado' ? 'Prestado' : eq.estado)
              } 
            };
          }, {});
          setEquipments(eqMap);
        }
      }
    }
    setLoading(false);
  };

  const handleSendEmail = () => {
    if (!finishedReturn) return;
    const { loan, equipments, responsableRecibe, docenteEmail } = finishedReturn;
    
    if (!docenteEmail) {
      alert('No se puede enviar el email: El docente no tiene un correo electrónico registrado.');
      return;
    }
    
    sendAssistedEmail({
      to: docenteEmail,
      subject: `SGEA - Comprobante de Devolución - Escuela de Cine`,
      body: `Hola,\n\nSe ha registrado la devolución del equipamiento audiovisual solicitado.\n\nDocente a Cargo: ${loan.docente_responsable}\nAlumno: ${loan.alumno_nombre}\nFecha Devolución: ${format(new Date(), 'dd/MM/yyyy HH:mm')}\nRecibido por: ${responsableRecibe}\n\nEquipos Recibidos:\n${equipments.map((e: any) => `- ${e.nombre} (${e.modelo})`).join('\n')}\n\nNota: Se adjunta el comprobante en PDF (Favor de adjuntar el archivo descargado manualmente).\n\nSaludos,\nSistema SGEA`
    });
  };

  if (finishedReturn) {
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
          <h2 className="text-2xl md:text-3xl font-display font-bold text-slate-900 mb-2">¡Devolución Completada!</h2>
          <p className="text-sm md:text-base text-slate-500 mb-8 max-w-md mx-auto">
            La devolución ha sido registrada. El comprobante PDF se ha descargado automáticamente.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            <button
              onClick={() => generateReturnPDF(finishedReturn.loan, finishedReturn.equipments, finishedReturn.responsableRecibe, finishedReturn.docenteEmail)}
              className="flex items-center justify-center gap-2 px-6 py-4 border border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition-all text-sm"
            >
              <Download className="w-5 h-5" />
              Bajar PDF
            </button>
            <button
              onClick={handleSendEmail}
              className={cn(
                "flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold transition-all text-sm shadow-lg",
                finishedReturn.docenteEmail 
                  ? "bg-amber-500 text-slate-900 shadow-amber-200 hover:bg-amber-600 font-black" 
                  : "bg-slate-100 text-slate-500 shadow-transparent cursor-not-allowed"
              )}
            >
              <Mail className="w-5 h-5" />
              {finishedReturn.docenteEmail ? 'Enviar Email' : 'Email no disponible'}
            </button>
          </div>
          
          <button
            onClick={() => {
              setFinishedReturn(null);
              fetchData();
            }}
            className="mt-8 text-slate-400 font-bold hover:text-slate-600 text-sm uppercase tracking-widest"
          >
            Continuar
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900 min-h-[32px] md:min-h-[40px]">
          {filterMora ? 'Panel de Mora' : (role === 'Docente' ? 'Mis Préstamos' : 'Devolución de Equipos')}
        </h1>
        <p className="text-sm md:text-base text-slate-700">
          {filterMora ? 'Equipos con fecha de devolución vencida.' : (role === 'Docente' ? 'Seguimiento de sus equipos retirados.' : 'Administración de recepción de equipos.')}
        </p>
      </header>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-500 w-10 h-10" /></div>
      ) : loans.length === 0 ? (
        <div className="bg-white rounded-2xl md:rounded-3xl p-8 md:p-12 text-center border border-dashed border-slate-300">
          <div className="bg-slate-100 w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package aria-hidden="true" className="text-slate-400 w-6 h-6 md:w-8 md:h-8" />
          </div>
          <h3 className="text-base md:text-lg font-bold text-slate-900">No hay préstamos {filterMora ? 'en mora' : 'activos'}</h3>
          <p className="text-xs md:text-sm text-slate-700">Todo el grupo de equipos está en orden.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {loans.map((loan) => {
            const now = new Date();
            const estimatedDate = new Date(loan.fecha_devolucion_estimada);
            const isMora = isPast(estimatedDate);
            
            // Calculate delay days rounding up as requested
            let daysDiff = 0;
            if (isMora) {
              const diffMs = now.getTime() - estimatedDate.getTime();
              daysDiff = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            }

            return (
              <motion.div
                layout
                key={loan.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("bg-white rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden", isMora ? "border-red-200 ring-1 ring-red-100" : "")}
              >
                <div className={cn("p-4 flex justify-between items-center border-b", isMora ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100")}>
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", isMora ? "bg-red-500 text-white" : "bg-amber-500 text-slate-900")}>
                      <User className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 text-sm md:text-base truncate">{loan.alumno_nombre}</h3>
                      <p className="text-[10px] md:text-xs text-slate-700 truncate">DNI: {loan.alumno_dni}</p>
                    </div>
                  </div>
                  {isMora && (
                    <div className="bg-red-600 text-white px-2.5 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase flex items-center gap-1 shrink-0">
                      <AlertCircle className="w-3 h-3" />
                      {daysDiff} {daysDiff === 1 ? 'día' : 'días'} Mora
                    </div>
                  )}
                </div>

                <div className="p-4 md:p-6 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Salida</p>
                        <p className="text-xs md:text-sm font-medium">{formatDate(loan.fecha_salida)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Devolución Estimada</p>
                        <p className={cn("text-xs md:text-sm font-bold", isMora ? "text-red-600" : "text-amber-950")}>
                          {formatDate(loan.fecha_devolucion_estimada)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <ArrowRight className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Responsable</p>
                        <p className="text-xs md:text-sm font-medium">{loan.responsable_nombre}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-wider">Equipos ({(loan.equipos_ids || []).length})</p>
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                      {(loan.equipos_ids || []).map(id => (
                        <div key={id} className="flex items-center gap-2 text-[10px] md:text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <Package className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-medium truncate">{(equipments && equipments[id])?.nombre || 'Cargando...'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {role === 'Administración' && (
                  <div className="p-4 bg-slate-50 border-t border-slate-100 mt-auto">
                    <button
                      onClick={() => setSelectedLoan(loan)}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-amber-500 transition-all shadow-lg shadow-slate-200"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Recibir Equipos
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {selectedLoan && (
        <ReceiveModal 
          loan={selectedLoan} 
          equipmentsMap={equipments} 
          docentes={docentes}
          onClose={() => setSelectedLoan(null)} 
          onSuccess={(details) => {
            setSelectedLoan(null);
            setFinishedReturn(details);
          }} 
        />
      )}
    </div>
  );
};

const ReceiveModal: React.FC<{ loan: Loan, equipmentsMap: Record<string, Equipment>, docentes: Responsable[], onClose: () => void, onSuccess: (details: any) => void }> = ({ loan, equipmentsMap, docentes, onClose, onSuccess }) => {
  const { activeResponsable } = useApp();
  const [loading, setLoading] = useState(false);
  const [observacionesGenerales, setObservacionesGenerales] = useState('');
  
  // Track status per item: 'ok' or 'problem'
  const [itemConditions, setItemConditions] = useState<Record<string, 'ok' | 'problem' | null>>(() => {
    const initial: Record<string, 'ok' | 'problem' | null> = {};
    (loan.equipos_ids || []).forEach(id => {
      initial[id] = null;
    });
    return initial;
  });

  // Track notes per item (only shown if status is 'problem')
  const [itemNotes, setItemNotes] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    (loan.equipos_ids || []).forEach(id => {
      initial[id] = '';
    });
    return initial;
  });

  // Handle equipment returned status (for the database field 'estado')
  const [itemStatuses, setItemStatuses] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    (loan.equipos_ids || []).forEach(id => {
      initial[id] = 'Disponible';
    });
    return initial;
  });
  
  const [equipmentStates, setEquipmentStates] = useState<Record<string, Equipment>>(() => {
    const initialState: Record<string, Equipment> = {};
    (loan.equipos_ids || []).forEach(id => {
      if (equipmentsMap && equipmentsMap[id]) {
        const eq = { ...equipmentsMap[id] };
        if (typeof eq.piezas === 'string') {
          try {
            eq.piezas = JSON.parse(eq.piezas || '[]');
          } catch (e) {
            eq.piezas = [];
          }
        }
        if (!eq.piezas) eq.piezas = [];
        initialState[id] = eq;
      }
    });
    return initialState;
  });

  const isReadyToSubmit = Object.values(itemConditions).every(condition => condition !== null);

  const handleConfirm = async () => {
    if (!isReadyToSubmit) {
      alert('Por favor, verifique todos los artículos antes de finalizar.');
      return;
    }

    setLoading(true);
    try {
      const returnedEquipmentsData: Equipment[] = [];
      const loanItems = (loan.equipos_ids || []);
      
      let compositeNotes = observacionesGenerales ? `[General] ${observacionesGenerales}\n` : '';

      for (const eqId of loanItems) {
        const eq = equipmentStates[eqId];
        const condition = itemConditions[eqId];
        const note = itemNotes[eqId];
        const dbStatus = itemStatuses[eqId] || 'Disponible';
        
        if (condition === 'problem') {
          compositeNotes += `- ${eq.nombre}: ${note || 'Sin detalles'}\n`;
        }

        // Update equipment in DB
        console.log(`[DEBUG] Actualizando equipo ID ${eqId} (${eq.nombre}) a estado: ${dbStatus}`);
        const { error: eqErr } = await supabase
          .from('equipamiento')
          .update({ estado: dbStatus, piezas: eq.piezas })
          .eq('id', eqId);
        
        if (eqErr) throw eqErr;

        // Log History for each item
        await supabase.from('historial_recursos').insert([{
          recurso_id: eqId,
          docente_nombre: loan.docente_responsable,
          materia: loan.materia,
          pañolero_entrega: loan.responsable_nombre,
          pañolero_recibe: activeResponsable!,
          fecha_salida: loan.fecha_salida,
          fecha_entrada: new Date().toISOString(),
          alumno_nombre: loan.alumno_nombre,
          estado_salida: 'Bueno', 
          estado_entrada: condition === 'ok' ? 'Bueno' : 'Con Incidencias',
          observaciones_entrada: note || observacionesGenerales || 'Recibido',
          prestamo_id: loan.id,
          tipo_accion: 'Devolución'
        }]);

        if (eq) {
          returnedEquipmentsData.push({ ...eq, estado: dbStatus as any });
        }
      }

      // Update loan record
      const loanUpdate: any = {
        estado: 'Finalizado',
        observaciones_recepcion: compositeNotes.trim() || 'Recibido OK',
        fecha_devolucion_real: new Date().toISOString()
      };

      const { error: loanError } = await supabase
        .from('prestamos') 
        .update(loanUpdate)
        .eq('id', loan.id);

      if (loanError) throw loanError;

      // Activity Log
      await logAction(activeResponsable!, 'DEVOLUCION_PRESTAMO_DETALLADA', { 
        loanId: loan.id, 
        alumno: loan.alumno_nombre,
        compositeNotes: loanUpdate.observaciones_recepcion
      });

      const targetDocente = docentes.find(d => d.nombre_completo === loan.docente_responsable);
      generateReturnPDF(loan, returnedEquipmentsData, activeResponsable!, targetDocente?.email);

      onSuccess({ 
        loan: { ...loan, ...loanUpdate }, 
        equipments: returnedEquipmentsData, 
        responsableRecibe: activeResponsable!, 
        docenteEmail: targetDocente?.email 
      });
    } catch (error: any) {
      console.error(error);
      alert('Error al procesar la devolución.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl w-full max-w-2xl my-auto flex flex-col overflow-hidden">
        <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center shrink-0 bg-slate-50">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-slate-900">Recepción Detallada</h2>
            <p className="text-xs md:text-sm text-slate-500 font-medium">Verifique artículo por artículo.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2">
            <XCircle className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-4 max-h-[65vh] custom-scrollbar">
          {(loan.equipos_ids || []).map(eqId => {
            const eq = equipmentStates && equipmentStates[eqId];
            if (!eq) return null;
            const condition = itemConditions[eqId];

            return (
              <div key={eqId} className={cn(
                "border rounded-2xl overflow-hidden transition-all duration-300 shadow-sm",
                condition === 'ok' ? "border-green-100 bg-green-50/20" : 
                condition === 'problem' ? "border-red-100 bg-red-50/20" : "border-slate-200 bg-white"
              )}>
                <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-inherit bg-inherit">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                      condition === 'ok' ? "bg-green-100 text-green-600 border-green-200" :
                      condition === 'problem' ? "bg-red-100 text-red-600 border-red-200" : "bg-slate-100 text-slate-400 border-slate-200"
                    )}>
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{eq.nombre}</h4>
                      <p className="text-[10px] text-slate-500 font-medium">{eq.modelo} | SN: {eq.numero_serie}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setItemConditions({...itemConditions, [eqId]: 'ok'})}
                      className={cn(
                        "flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5",
                        condition === 'ok' ? "bg-green-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-green-500"
                      )}
                    >
                      <CheckCircle className="w-3 h-3" />
                      OK
                    </button>
                    <button
                      onClick={() => setItemConditions({...itemConditions, [eqId]: 'problem'})}
                      className={cn(
                        "flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5",
                        condition === 'problem' ? "bg-red-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-red-500"
                      )}
                    >
                      <AlertCircle className="w-3 h-3" />
                      Problema
                    </button>
                  </div>
                </div>

                {condition === 'problem' && (
                  <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Estado en Panel</label>
                        <select
                          value={itemStatuses[eqId]}
                          onChange={(e) => setItemStatuses({...itemStatuses, [eqId]: e.target.value})}
                          className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-red-500"
                        >
                          <option value="En Mantenimiento">Mantenimiento (Leve)</option>
                          <option value="Fuera de Servicio">Fuera de Servicio (Grave/Roto)</option>
                          <option value="Disponible">Disponible (Igual Reportar)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nota del Artículo</label>
                        <input 
                          type="text"
                          value={itemNotes[eqId]}
                          onChange={(e) => setItemNotes({...itemNotes, [eqId]: e.target.value})}
                          placeholder="Ej: Cable pelado, falta tornillo..."
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                {condition === 'ok' && eq.piezas && eq.piezas.length > 0 && (
                  <div className="px-4 py-2 bg-green-50/30 flex flex-wrap gap-1.5">
                    {eq.piezas.map((pieza, idx) => (
                      <span key={idx} className="text-[8px] font-bold text-green-600 uppercase">
                        • {typeof pieza === 'string' ? pieza : (pieza as any).nombre}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="mt-6">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Comentarios Generales (Opcional)</label>
            <textarea
              value={observacionesGenerales}
              onChange={e => setObservacionesGenerales(e.target.value)}
              placeholder="Notas generales sobre la recepción..."
              rows={2}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-slate-900 transition-all text-sm"
            />
          </div>
        </div>

        <div className="p-4 md:p-6 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3 shrink-0 bg-slate-50">
          <button 
            onClick={onClose} 
            className="order-2 sm:order-1 px-6 py-3 text-slate-500 font-bold text-xs uppercase tracking-widest hover:bg-slate-200 rounded-xl transition-all"
          >
            Cerrar
          </button>
          <button 
            onClick={handleConfirm} 
            disabled={loading || !isReadyToSubmit} 
            className={cn(
              "order-1 sm:order-2 px-8 py-3.5 rounded-xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all shadow-lg",
              isReadyToSubmit ? "bg-slate-900 text-white hover:bg-green-600 shadow-slate-200" : "bg-slate-200 text-slate-400 shadow-none cursor-not-allowed"
            )}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            Finalizar Recepción
          </button>
        </div>
      </div>
    </div>
  );
};

