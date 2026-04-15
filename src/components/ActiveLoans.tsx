import React, { useState, useEffect } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { Loan, Equipment, LoanStatus, PiezaEstado, EquipmentStatus } from '../types';
import { useApp } from '../context/AppContext';
import { generateReturnPDF } from '../lib/pdf';
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
  Download
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatDate } from '../lib/utils';
import { differenceInDays, isPast } from 'date-fns';

export const ActiveLoans: React.FC<{ filterMora?: boolean }> = ({ filterMora = false }) => {
  const { activeResponsable, profile, role } = useApp();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [equipments, setEquipments] = useState<Record<string, Equipment>>({});
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  useEffect(() => {
    fetchData();
  }, [filterMora, profile]);

  const fetchData = async () => {
    setLoading(true);
    let query = supabase
      .from('prestamos')
      .select('*')
      .eq('estado', 'Activo')
      .order('fecha_devolucion_estimada', { ascending: true });
    
    if (role === 'Docente' && profile?.id) {
      // Assuming there's a way to link loans to users. 
      // The user mentioned "Mis Préstamos" for Docentes.
      // If the loan table doesn't have usuario_id, we might need to filter by docente_responsable name or add the field.
      // Let's assume we filter by docente_responsable matching profile email or name for now, 
      // but ideally we should have usuario_id in prestamos too.
      // For now, let's use docente_responsable as a proxy if usuario_id is missing.
      query = query.eq('docente_responsable', activeResponsable);
    }
    
    const { data: loansData, error: loansError } = await query;
    
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
          const eqMap = eqData.reduce((acc, eq) => ({ 
            ...acc, 
            [eq.id]: {
              ...eq,
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
          }), {});
          setEquipments(eqMap);
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-900">
          {filterMora ? 'Panel de Mora' : (role === 'Docente' ? 'Mis Préstamos' : 'Devolución de Equipos')}
        </h1>
        <p className="text-slate-500">
          {filterMora ? 'Equipos con fecha de devolución vencida.' : (role === 'Docente' ? 'Seguimiento de sus equipos retirados.' : 'Gestión de recepción de equipos.')}
        </p>
      </header>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-500 w-10 h-10" /></div>
      ) : loans.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
          <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="text-slate-400 w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No hay préstamos {filterMora ? 'en mora' : 'activos'}</h3>
          <p className="text-slate-500">Todo el equipo está en orden.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {loans.map((loan) => {
            const daysDiff = differenceInDays(new Date(), new Date(loan.fecha_devolucion_estimada));
            const isMora = isPast(new Date(loan.fecha_devolucion_estimada));

            return (
              <motion.div
                layout
                key={loan.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("card flex flex-col", isMora ? "border-red-200 ring-1 ring-red-100" : "")}
              >
                <div className={cn("p-4 flex justify-between items-center border-b", isMora ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100")}>
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", isMora ? "bg-red-500 text-white" : "bg-amber-500 text-white")}>
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{loan.alumno_nombre}</h3>
                      <p className="text-xs text-slate-500">DNI: {loan.alumno_dni}</p>
                      <p className="text-[10px] uppercase font-bold text-slate-500">Folio: {loan.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  {isMora && (
                    <div className="bg-red-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 animate-pulse">
                      <AlertCircle className="w-3 h-3" />
                      {daysDiff} Días de Mora
                    </div>
                  )}
                </div>

                <div className="p-6 flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Salida</p>
                        <p className="text-sm font-medium">{formatDate(loan.fecha_salida)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Devolución Estimada</p>
                        <p className={cn("text-sm font-bold", isMora ? "text-red-600" : "text-amber-600")}>
                          {formatDate(loan.fecha_devolucion_estimada)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <ArrowRight className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Responsable</p>
                        <p className="text-sm font-medium">{loan.responsable_nombre}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Equipos ({(loan.equipos_ids || []).length})</p>
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                      {(loan.equipos_ids || []).map(id => (
                        <div key={id} className="flex items-center gap-2 text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <Package className="w-3 h-3 text-slate-400" />
                          <span className="font-medium truncate">{(equipments && equipments[id])?.nombre || 'Cargando...'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {role === 'Pañolero' && (
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => setSelectedLoan(loan)}
                      className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all"
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
          onClose={() => setSelectedLoan(null)} 
          onSuccess={() => {
            setSelectedLoan(null);
            fetchData();
          }} 
        />
      )}
    </div>
  );
};

const ReceiveModal: React.FC<{ loan: Loan, equipmentsMap: Record<string, Equipment>, onClose: () => void, onSuccess: () => void }> = ({ loan, equipmentsMap, onClose, onSuccess }) => {
  const { activeResponsable } = useApp();
  const [loading, setLoading] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [hasDamage, setHasDamage] = useState(false);
  
  // State to track the status of each piece of each equipment
  const [equipmentStates, setEquipmentStates] = useState<Record<string, Equipment>>(() => {
    const initialState: Record<string, Equipment> = {};
    (loan.equipos_ids || []).forEach(id => {
      if (equipmentsMap && equipmentsMap[id]) {
        // Deep copy to avoid mutating the original map
        initialState[id] = JSON.parse(JSON.stringify(equipmentsMap[id]));
      }
    });
    return initialState;
  });

  const handlePieceStatusChange = (eqId: string, pieceId: string, newStatus: PiezaEstado) => {
    setEquipmentStates(prev => {
      const eq = { ...prev[eqId] };
      const pieceIndex = eq.piezas.findIndex(p => p.id === pieceId);
      if (pieceIndex !== -1) {
        eq.piezas[pieceIndex].estado = newStatus;
      }
      return { ...prev, [eqId]: eq };
    });
  };

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

        let newEqStatus: string = hasDamage ? 'Mantenimiento' : 'Disponible';
        let hasIssues = hasDamage;
        let issueDetails = [];

        // piezas is now string[], so we don't have per-piece status in DB
        if (hasIssues) {
          issueDetails = ['Daños reportados en la recepción'];
        }

        console.log(`Actualizando equipo ${eqId} tras devolución. Nuevo estado:`, newEqStatus);
        const { error: eqUpdateError } = await supabase.from('equipamiento').update({ 
          estado: newEqStatus,
          piezas: eq.piezas || []
        }).eq('id', String(eqId));

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

        if (hasIssues) {
          await logAction(activeResponsable!, 'INCIDENCIA_EQUIPO', { 
            equipoId: eqId, 
            equipoNombre: eq.nombre, 
            loanId: loan.id,
            alumno_nombre: loan.alumno_nombre,
            alumno_dni: loan.alumno_dni,
            detalles: `Problemas detectados al recibir: ${issueDetails.join(', ')}. Obs: ${observaciones}` 
          });
        }
      }

      // 3. Log the general return action
      await logAction(activeResponsable!, 'DEVOLUCION_PRESTAMO', { 
        loanId: loan.id, 
        alumno: `${loan.alumno_nombre} (${loan.alumno_dni})`,
        observaciones 
      });
      
      // 4. Generate Return PDF
      const returnedEquipments = Object.values(equipmentStates) as Equipment[];
      generateReturnPDF(loan, returnedEquipments, activeResponsable!);

      onSuccess();
    } catch (error) {
      console.error(error);
      alert('Error al procesar la devolución.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold">Checklist de Recepción</h2>
            <p className="text-sm text-slate-500">Verifique el estado de los equipos y sus piezas.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XCircle className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {(loan.equipos_ids || []).map(eqId => {
            const eq = equipmentStates && equipmentStates[eqId];
            if (!eq) return null;

            return (
              <div key={eqId} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-bold text-slate-800 flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-500" />
                  {eq.nombre}
                </div>
                
                {(!eq.piezas || eq.piezas.length === 0) ? (
                  <div className="p-4 text-sm text-slate-500 italic">
                    Este equipo no tiene piezas registradas. Se recibirá como unidad completa.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {eq.piezas.map(pieza => (
                      <div key={pieza.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-slate-700">{pieza.nombre}</span>
                          {pieza.obligatorio && <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold rounded uppercase">Obligatorio</span>}
                        </div>
                        <div className="flex gap-2">
                          {(['OK', 'Dañado', 'Faltante'] as PiezaEstado[]).map(estado => (
                            <button
                              key={estado}
                              onClick={() => handlePieceStatusChange(eqId, pieza.id, estado)}
                              className={cn(
                                "px-3 py-1.5 text-xs font-bold rounded-lg border transition-all",
                                pieza.estado === estado 
                                  ? estado === 'OK' ? "bg-green-500 text-white border-green-600" :
                                    estado === 'Dañado' ? "bg-orange-500 text-white border-orange-600" :
                                    "bg-red-500 text-white border-red-600"
                                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                              )}
                            >
                              {estado}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Observaciones de Devolución (Obligatorio)
              </label>
              <textarea
                required
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all resize-none"
                placeholder="Describa el estado en que se recibe el equipo..."
                rows={3}
              />
            </div>

            <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                  hasDamage ? "bg-red-100 text-red-600" : "bg-slate-200 text-slate-500"
                )}>
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">¿Faltante o Rotura?</p>
                  <p className="text-xs text-slate-500">Marque si el equipo requiere mantenimiento o tiene piezas faltantes.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={hasDamage}
                onChange={e => setHasDamage(e.target.checked)}
                className="w-6 h-6 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
              />
            </label>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 shrink-0 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="px-6 py-2 text-slate-600 font-medium">Cancelar</button>
          <button 
            onClick={handleConfirm} 
            disabled={loading} 
            className="btn-primary min-w-[150px] flex justify-center"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Recepción'}
          </button>
        </div>
      </div>
    </div>
  );
};
