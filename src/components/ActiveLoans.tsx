import React, { useState, useEffect } from 'react';
import { supabase, logAction, logResourceHistory } from '../lib/supabase';
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
  AlertTriangle,
  Loader2,
  ArrowRight,
  XCircle,
  Download,
  Search
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
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, [filterMora, search]);

  const fetchData = async () => {
    setLoading(true);
    let query = supabase
      .from('prestamos')
      .select('*')
      .eq('estado', 'Activo')
      .order('fecha_devolucion_estimada', { ascending: true });
    
    if (role === 'Docente' && activeResponsable) {
      query = query.eq('docente_responsable', activeResponsable);
    }
    
    const { data: loansData, error: loansError } = await query;
    
    if (!loansError && loansData) {
      const processedLoans = loansData.map(l => ({
        ...l,
        isMora: isPast(new Date(l.fecha_devolucion_estimada))
      }));

      const finalLoans = filterMora ? processedLoans.filter(l => l.isMora) : processedLoans;
      
      // Client-side search filter
      const searchedLoans = finalLoans.filter(l => 
        l.alumno_nombre.toLowerCase().includes(search.toLowerCase()) ||
        l.alumno_dni.includes(search) ||
        l.docente_responsable.toLowerCase().includes(search.toLowerCase()) ||
        l.materia.toLowerCase().includes(search.toLowerCase())
      );

      setLoans(searchedLoans);

      const eqIds = Array.from(new Set((searchedLoans || []).flatMap(l => l.equipos_ids || [])));
      if (eqIds.length > 0) {
        const { data: eqData } = await supabase.from('equipamiento').select('*').in('id', eqIds);
        if (eqData) {
          const eqMap = eqData.reduce((acc, eq) => ({ 
            ...acc, 
            [eq.id]: eq
          }), {});
          setEquipments(eqMap);
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200",
            filterMora ? "bg-red-600" : "bg-slate-900"
          )}>
            {filterMora ? <AlertTriangle className="w-6 h-6 text-white" /> : <Package className="w-6 h-6 text-amber-500" />}
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            {filterMora ? 'Panel de Mora' : 'Préstamos Activos'}
          </h1>
        </div>
        <p className="text-slate-500 font-medium">
          {filterMora ? 'Lista de equipos con devolución vencida.' : 'Seguimiento de equipos actualmente fuera del pañol.'}
        </p>
      </header>

      <div className="mb-8 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input 
          type="text"
          placeholder="Buscar por alumno, docente, materia o DNI..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 shadow-sm font-medium"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-500 w-10 h-10" /></div>
      ) : loans.length === 0 ? (
        <div className="bg-white rounded-[2rem] p-20 text-center border border-dashed border-slate-300">
          <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-slate-300 w-10 h-10" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-2">Sin préstamos {filterMora ? 'en mora' : 'activos'}</h3>
          <p className="text-slate-500">No se encontraron registros que coincidan con la búsqueda.</p>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Alumno / DNI</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Docente / Materia</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Equipos</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Vencimiento</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loans.map((loan) => {
                  const isMora = isPast(new Date(loan.fecha_devolucion_estimada));
                  return (
                    <tr key={loan.id} className={cn("hover:bg-slate-50 transition-colors", isMora && "bg-red-50/30")}>
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900">{loan.alumno_nombre}</p>
                        <p className="text-[10px] font-bold text-slate-400">DNI: {loan.alumno_dni}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900">{loan.docente_responsable}</p>
                        <p className="text-[10px] font-bold text-amber-600 uppercase">{loan.materia}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex -space-x-2">
                          {(loan.equipos_ids || []).slice(0, 3).map(id => (
                            <div key={id} className="w-8 h-8 rounded-lg border-2 border-white bg-slate-100 overflow-hidden" title={equipments[id]?.nombre}>
                              <img src={equipments[id]?.foto_url || 'https://picsum.photos/seed/gear/50/50'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                          ))}
                          {(loan.equipos_ids || []).length > 3 && (
                            <div className="w-8 h-8 rounded-lg border-2 border-white bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">
                              +{(loan.equipos_ids || []).length - 3}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border",
                          isMora ? "bg-red-100 text-red-700 border-red-200" : "bg-blue-100 text-blue-700 border-blue-200"
                        )}>
                          <Clock className="w-3 h-3" />
                          {formatDate(loan.fecha_devolucion_estimada)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => setSelectedLoan(loan)}
                            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-amber-500 transition-all shadow-md"
                          >
                            Recibir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
  const [observation, setObservation] = useState('');
  
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
    setLoading(true);
    try {
      // 1. Update loan status
      await supabase.from('prestamos').update({ estado: 'Finalizado' }).eq('id', loan.id);

      // 2. Update each equipment
      for (const eqId of loan.equipos_ids) {
        const eq = equipmentStates[eqId];
        if (!eq) continue;

        let newEqStatus: EquipmentStatus = 'Disponible';
        let hasIssues = false;
        let issueDetails = [];

        if (eq.piezas && eq.piezas.length > 0) {
          const hasMissing = eq.piezas.some(p => p.estado === 'Faltante');
          const hasDamaged = eq.piezas.some(p => p.estado === 'Dañado');
          
          if (hasMissing || hasDamaged) {
            newEqStatus = 'Fuera de Servicio';
            hasIssues = true;
          }

          if (hasIssues) {
            issueDetails = eq.piezas.filter(p => p.estado !== 'OK').map(p => `${p.nombre} (${p.estado})`);
          }
        }

        console.log(`Actualizando equipo ${eqId} tras devolución. Nuevo estado:`, newEqStatus);
        await supabase.from('equipamiento').update({ 
          estado: newEqStatus,
          piezas: eq.piezas 
        }).eq('id', String(eqId));

        // Log Resource History
        await logResourceHistory({
          recurso_id: eqId,
          usuario_responsable: loan.alumno_nombre,
          materia: loan.materia,
          accion: 'Devolución',
          estado_detalle: observation,
          pañolero_turno: activeResponsable!
        });

        if (hasIssues) {
          await logAction(activeResponsable!, 'INCIDENCIA_EQUIPO', { 
            equipoId: eqId, 
            equipoNombre: eq.nombre, 
            loanId: loan.id,
            alumno_nombre: loan.alumno_nombre,
            alumno_dni: loan.alumno_dni,
            detalles: `Problemas detectados al recibir: ${issueDetails.join(', ')}` 
          });
        }
      }

      // 3. Log the general return action
      await logAction(activeResponsable!, 'DEVOLUCION_PRESTAMO', { loanId: loan.id, alumno: `${loan.alumno_nombre} (${loan.alumno_dni})` });
      
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
          <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl">
            <label className="block text-xs font-black text-amber-700 mb-2 uppercase tracking-wider">Observación de Estado (Obligatorio)</label>
            <textarea
              required
              rows={3}
              value={observation}
              onChange={e => setObservation(e.target.value)}
              placeholder="Ej: Perfecto estado / Llega con el trípode flojo..."
              className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-medium resize-none text-sm"
            />
          </div>

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
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 shrink-0 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="px-6 py-2 text-slate-600 font-medium">Cancelar</button>
          <button 
            onClick={handleConfirm} 
            disabled={loading || !observation.trim()} 
            className="btn-primary min-w-[150px] flex justify-center disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Recepción'}
          </button>
        </div>
      </div>
    </div>
  );
};
