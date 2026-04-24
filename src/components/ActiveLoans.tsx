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

export const ActiveLoans: React.FC<{ filterMora?: boolean }> = ({ filterMora = false }) => {
  const { activeResponsable, profile, role } = useApp();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [equipments, setEquipments] = useState<Record<string, Equipment>>({});
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [finishedReturn, setFinishedReturn] = useState<any>(null);
  const [docentes, setDocentes] = useState<Responsable[]>([]);

  useEffect(() => {
    fetchData();
  }, [filterMora, profile]);

  const fetchData = async () => {
    setLoading(true);
    const [loansRes, docentesRes] = await Promise.all([
      supabase
        .from('prestamos')
        .select('*')
        .eq('estado', 'Activo')
        .order('fecha_devolucion_estimada', { ascending: true }),
      supabase.from('responsables').select('*')
    ]);
    
    if (docentesRes.data) setDocentes(docentesRes.data);

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
        const { data: eqData } = await supabase.from('equipamiento').select('*').in('id', eqIds);
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
                         String(eq.estado || '').toLowerCase() === 'mantenimiento' || 
                         String(eq.estado || '').toLowerCase() === 'incompleto' ||
                         String(eq.estado || '').toLowerCase() === 'fuera de servicio') 
                         ? 'Fuera de Servicio' 
                         : (String(eq.estado || '').toLowerCase() === 'eliminado' || String(eq.estado || '').toLowerCase() === 'archivado' ? 'Archivado' : 
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
    
    sendAssistedEmail({
      to: docenteEmail || '',
      cc: profile?.email || undefined,
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
              className="flex items-center justify-center gap-2 px-6 py-4 bg-amber-500 text-white rounded-2xl font-bold shadow-lg shadow-amber-200 hover:bg-amber-600 transition-all text-sm"
            >
              <Mail className="w-5 h-5" />
              Enviar Email
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
    <div className="p-4 md:p-8 max-w-7xl mx-auto pt-16 lg:pt-8">
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900">
          {filterMora ? 'Panel de Mora' : (role === 'Docente' ? 'Mis Préstamos' : 'Devolución de Equipos')}
        </h1>
        <p className="text-sm md:text-base text-slate-500">
          {filterMora ? 'Equipos con fecha de devolución vencida.' : (role === 'Docente' ? 'Seguimiento de sus equipos retirados.' : 'Gestión de recepción de equipos.')}
        </p>
      </header>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-500 w-10 h-10" /></div>
      ) : loans.length === 0 ? (
        <div className="bg-white rounded-2xl md:rounded-3xl p-8 md:p-12 text-center border border-dashed border-slate-300">
          <div className="bg-slate-100 w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="text-slate-400 w-6 h-6 md:w-8 md:h-8" />
          </div>
          <h3 className="text-base md:text-lg font-bold text-slate-900">No hay préstamos {filterMora ? 'en mora' : 'activos'}</h3>
          <p className="text-xs md:text-sm text-slate-500">Todo el grupo de equipos está en orden.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {loans.map((loan) => {
            const daysDiff = differenceInDays(new Date(), new Date(loan.fecha_devolucion_estimada));
            const isMora = isPast(new Date(loan.fecha_devolucion_estimada));

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
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", isMora ? "bg-red-500 text-white" : "bg-amber-500 text-white")}>
                      <User className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 text-sm md:text-base truncate">{loan.alumno_nombre}</h3>
                      <p className="text-[10px] md:text-xs text-slate-500 truncate">DNI: {loan.alumno_dni}</p>
                    </div>
                  </div>
                  {isMora && (
                    <div className="bg-red-600 text-white px-2.5 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase flex items-center gap-1 shrink-0">
                      <AlertCircle className="w-3 h-3" />
                      {daysDiff}d Mora
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
                        <p className={cn("text-xs md:text-sm font-bold", isMora ? "text-red-600" : "text-amber-600")}>
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

                {role === 'Pañolero' && (
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
  const [observaciones, setObservaciones] = useState('');
  const [hasDamage, setHasDamage] = useState(false);
  
  // State to track the status of each equipment
  const [equipmentStates, setEquipmentStates] = useState<Record<string, Equipment>>(() => {
    const initialState: Record<string, Equipment> = {};
    (loan.equipos_ids || []).forEach(id => {
      if (equipmentsMap && equipmentsMap[id]) {
        const eq = { ...equipmentsMap[id] };
        
        // Safeguard: If piezas comes as a string from DB, parse it
        if (typeof eq.piezas === 'string') {
          try {
            eq.piezas = JSON.parse(eq.piezas || '[]');
          } catch (e) {
            eq.piezas = [];
          }
        }
        
        // Ensure it's at least an empty array
        if (!eq.piezas) eq.piezas = [];
        
        initialState[id] = eq;
      }
    });
    return initialState;
  });

  const handleConfirm = async () => {
    if (!observaciones.trim()) {
      alert('Por favor, ingrese las observaciones de la devolución.');
      return;
    }

    setLoading(true);
    try {
      // 1. Update loan status
      const { error: loanError } = await supabase
        .from('prestamos') 
        .update({ 
          estado: 'Finalizado',
          observaciones_recepcion: observaciones,
          fecha_devolucion_real: new Date().toISOString()
        })
        .eq('id', loan.id);

      if (loanError) throw loanError;

      // 2. Update each equipment
      for (const eqId of loan.equipos_ids) {
        const eq = equipmentStates[eqId];
        if (!eq) continue;

        let newEqStatus: string = hasDamage ? 'Fuera de Servicio' : 'Disponible';
        
        // Only update the necessary fields to avoid conflicts with complex types
        const updateData: any = { estado: newEqStatus };
        
        if (eq.piezas) {
          updateData.piezas = eq.piezas;
        }

        const { error: eqUpdateError } = await supabase
          .from('equipamiento')
          .update(updateData)
          .eq('id', String(eqId));

        if (eqUpdateError) throw eqUpdateError;

        // 2.6 Log to Resource History (Hoja de Vida) - DEVOLUCION
        const { error: historyError } = await supabase
          .from('historial_recursos')
          .insert([{
            recurso_id: eqId,
            docente_nombre: loan.docente_responsable,
            materia: loan.materia,
            pañolero_entrega: loan.responsable_nombre,
            pañolero_recibe: activeResponsable!,
            fecha_salida: loan.fecha_salida,
            fecha_entrada: new Date().toISOString(),
            alumno_nombre: loan.alumno_nombre,
            estado_salida: 'Bueno', 
            estado_entrada: newEqStatus === 'Disponible' ? 'Bueno' : 'Con Incidencias',
            observaciones_entrada: observaciones,
            prestamo_id: loan.id,
            tipo_accion: 'Devolución'
          }]);

        if (historyError) console.error('Error logging resource history:', historyError);

        if (hasDamage) {
          await logAction(activeResponsable!, 'INCIDENCIA_EQUIPO', { 
            equipoId: eqId, 
            equipoNombre: eq.nombre, 
            loanId: loan.id,
            alumno_nombre: loan.alumno_nombre,
            alumno_dni: loan.alumno_dni,
            detalles: `Problemas detectados al recibir. Obs: ${observaciones}` 
          });
        }
      }

      await logAction(activeResponsable!, 'DEVOLUCION_PRESTAMO', { 
        loanId: loan.id, 
        alumno: `${loan.alumno_nombre} (${loan.alumno_dni})`,
        observaciones 
      });
      
      const returnedEquipments = Object.values(equipmentStates) as Equipment[];
      const targetDocente = docentes.find(d => d.nombre_completo === loan.docente_responsable);
      generateReturnPDF(loan, returnedEquipments, activeResponsable!, targetDocente?.email);

      onSuccess({ loan, equipments: returnedEquipments, responsableRecibe: activeResponsable!, docenteEmail: targetDocente?.email });
    } catch (error) {
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
            <h2 className="text-lg md:text-xl font-bold text-slate-900">Checklist de Recepción</h2>
            <p className="text-xs md:text-sm text-slate-500 font-medium">Verifique el estado de los equipos.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2">
            <XCircle className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-6 max-h-[60vh] custom-scrollbar">
          {(loan.equipos_ids || []).map(eqId => {
            const eq = equipmentStates && equipmentStates[eqId];
            if (!eq) return null;

            return (
              <div key={eqId} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-bold text-slate-800 flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-amber-500" />
                  {eq.nombre}
                </div>
                
                {(!eq.piezas || eq.piezas.length === 0) ? (
                  <div className="p-4 text-[10px] md:text-xs text-slate-500 italic">
                    Sin piezas registradas. Se recibe como unidad completa.
                  </div>
                ) : (
                  <div className="p-4 space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Piezas del Kit</p>
                    <div className="flex flex-wrap gap-2">
                      {eq.piezas.map((pieza, idx) => (
                        <div key={idx} className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 flex items-center gap-2 shadow-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                          {typeof pieza === 'string' ? pieza : (pieza as any).nombre}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div>
              <label className="flex items-center gap-2 text-xs font-black text-slate-500 mb-2 uppercase tracking-wider">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Observaciones de Devolución
              </label>
              <textarea
                required
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all resize-none text-sm placeholder:text-slate-400"
                placeholder="Describa el estado en que se recibe el equipo..."
                rows={3}
              />
            </div>

            <label className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer group active:bg-slate-100 transition-colors">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0",
                  hasDamage ? "bg-red-500 text-white" : "bg-slate-200 text-slate-500"
                )}>
                  <XCircle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">¿Rotura o Faltante?</p>
                  <p className="text-[10px] text-slate-500 font-medium">Marcando esta opción el equipo quedará Fuera de Servicio.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={hasDamage}
                onChange={e => setHasDamage(e.target.checked)}
                className="w-6 h-6 rounded-lg border-slate-300 text-amber-500 focus:ring-amber-500 h-5 w-5 md:h-6 md:w-6 transition-all"
              />
            </label>
          </div>
        </div>

        <div className="p-4 md:p-6 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3 shrink-0 bg-slate-50">
          <button 
            onClick={onClose} 
            className="order-2 sm:order-1 px-6 py-3 text-slate-600 font-black uppercase tracking-wider text-xs hover:bg-slate-200 rounded-xl transition-all"
          >
            Cancelar
          </button>
          <button 
            onClick={handleConfirm} 
            disabled={loading} 
            className="order-1 sm:order-2 bg-slate-900 text-white px-8 py-3.5 rounded-xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 hover:bg-amber-500 transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            Confirmar Devolución
          </button>
        </div>
      </div>
    </div>
  );
};

