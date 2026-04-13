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
  const [materiaFilter, setMateriaFilter] = useState('Todas');

  useEffect(() => {
    fetchData();
  }, [filterMora, profile, materiaFilter, search]);

  const fetchData = async () => {
    setLoading(true);
    let query = supabase
      .from('prestamos')
      .select('*')
      .eq('estado', 'Activo')
      .order('fecha_devolucion_estimada', { ascending: true });
    
    if (role === 'Docente' && profile?.id) {
      query = query.eq('docente_responsable', activeResponsable);
    }

    if (materiaFilter !== 'Todas') {
      query = query.eq('materia', materiaFilter);
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
        l.id.includes(search)
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

  const allMaterias = Array.from(new Set(loans.map(l => l.materia)));

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-200">
              <Package className="w-6 h-6 text-amber-500" />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
              {filterMora ? 'Panel de Mora' : (role === 'Docente' ? 'Mis Préstamos' : 'Consola de Despacho')}
            </h1>
          </div>
          <p className="text-slate-500 font-medium">
            {filterMora ? 'Equipos con fecha de devolución vencida.' : (role === 'Docente' ? 'Seguimiento de sus equipos retirados.' : 'Gestión ágil de préstamos activos y devoluciones.')}
          </p>
        </div>

        {role === 'Pañolero' && !filterMora && (
          <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
            <button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider">Activos</button>
            <button onClick={() => window.location.href='/mora'} className="px-4 py-2 text-slate-400 hover:text-slate-600 text-xs font-black uppercase tracking-wider">En Mora</button>
          </div>
        )}
      </header>

      {/* Advanced Filters */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text"
            placeholder="Buscar por alumno, DNI o folio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium"
          />
        </div>
        <div className="flex gap-2">
          <select 
            value={materiaFilter}
            onChange={(e) => setMateriaFilter(e.target.value)}
            className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-sm text-slate-700 min-w-[200px]"
          >
            <option value="Todas">Todas las Materias</option>
            {allMaterias.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button 
            onClick={fetchData}
            className="p-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-colors"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-500 w-10 h-10" /></div>
      ) : loans.length === 0 ? (
        <div className="bg-white rounded-[2rem] p-20 text-center border border-dashed border-slate-300">
          <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="text-slate-300 w-10 h-10" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-2">No hay préstamos {filterMora ? 'en mora' : 'activos'}</h3>
          <p className="text-slate-500 max-w-md mx-auto">Todo el equipamiento está en el pañol o los filtros no coinciden.</p>
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
                className={cn(
                  "bg-white rounded-[2rem] border overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col group",
                  isMora ? "border-red-200 ring-4 ring-red-50" : "border-slate-200"
                )}
              >
                <div className={cn(
                  "p-6 flex justify-between items-center border-b", 
                  isMora ? "bg-red-50/50 border-red-100" : "bg-slate-50/50 border-slate-100"
                )}>
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center shadow-md", 
                      isMora ? "bg-red-600 text-white" : "bg-slate-900 text-white"
                    )}>
                      <User className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 leading-tight">{loan.alumno_nombre}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DNI: {loan.alumno_dni}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Folio: {loan.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  </div>
                  {isMora && (
                    <div className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 animate-pulse shadow-lg shadow-red-200">
                      <AlertCircle className="w-4 h-4" />
                      {daysDiff} Días de Mora
                    </div>
                  )}
                </div>

                <div className="p-8 flex-1 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-3">Detalles del Préstamo</p>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                            <Clock className="w-4 h-4 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 leading-none mb-1">Salida</p>
                            <p className="text-xs font-black text-slate-700">{formatDate(loan.fecha_salida)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                            <Calendar className="w-4 h-4 text-amber-500" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 leading-none mb-1">Devolución</p>
                            <p className={cn("text-xs font-black", isMora ? "text-red-600" : "text-amber-600")}>
                              {formatDate(loan.fecha_devolucion_estimada)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 px-2">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Docente Responsable</p>
                        <p className="text-sm font-bold text-slate-900">{loan.docente_responsable}</p>
                        <p className="text-[10px] font-bold text-amber-600 uppercase">{loan.materia}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Equipamiento ({(loan.equipos_ids || []).length})</p>
                      <Package className="w-4 h-4 text-slate-300" />
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {(loan.equipos_ids || []).map(id => (
                        <div key={id} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 group-hover:border-amber-100 transition-colors">
                          <div className="w-10 h-10 rounded-lg bg-white overflow-hidden flex-shrink-0 border border-slate-100">
                            <img src={equipments[id]?.foto_url || 'https://picsum.photos/seed/gear/50/50'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-700 truncate">{(equipments && equipments[id])?.nombre || 'Cargando...'}</p>
                            <p className="text-[10px] font-bold text-slate-400 truncate">S/N: {(equipments && equipments[id])?.numero_serie}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {role === 'Pañolero' && (
                  <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex gap-4">
                    <button 
                      className="flex-1 px-4 py-3 border-2 border-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-white transition-all"
                    >
                      Imprimir Ticket
                    </button>
                    <button
                      onClick={() => setSelectedLoan(loan)}
                      className="flex-[2] flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-500 transition-all shadow-xl shadow-slate-200 group/btn"
                    >
                      <CheckCircle className="w-5 h-5 text-amber-500 group-hover/btn:text-white transition-colors" />
                      RECIBIR EQUIPOS
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
