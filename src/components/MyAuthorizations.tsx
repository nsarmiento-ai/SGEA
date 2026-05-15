import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { StudentRequest, Equipment } from '../types';
import { useApp } from '../context/AppContext';
import { 
  ShieldCheck, 
  Search, 
  Calendar, 
  User, 
  Package,
  FileText,
  Loader2,
  Download,
  AlertCircle,
  FileCheck2,
  XCircle,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate, cn } from '../lib/utils';
import { generateStudentRequestVoucherPDF } from '../lib/pdf';

export const MyAuthorizations: React.FC = () => {
  const { userEmail, role } = useApp();
  const [requests, setRequests] = useState<StudentRequest[]>([]);
  const [equipment, setEquipment] = useState<Record<string, Equipment>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchAuthorizations();
    fetchEquipment();
  }, [userEmail]);

  const fetchAuthorizations = async () => {
    if (!userEmail) return;
    setLoading(true);
    
    try {
      // I will refactor to fetch both and unify.
      const [studentRes, reservationsRes] = await Promise.all([
        (async () => {
          let q = supabase.from('solicitudes_alumnos').select('*');
          if (role === 'Director') {
            q = q.eq('tipo_uso', 'Uso Externo');
          } else {
             q = q.eq('docente_id', userEmail);
          }
          return q.order('created_at', { ascending: false });
        })(),
        (async () => {
          // Director also sees Docente reservations requiring evaluation or already evaluated
          if (role === 'Director') {
            return supabase
              .from('reservas')
              .select('*')
              .in('estado', ['Pendiente', 'Aprobada', 'Entregada', 'Avalada', 'Activa'])
              .ilike('materia', '%[Requiere Aval de Dirección]%')
              .order('created_at', { ascending: false });
          }
          return { data: [] };
        })()
      ]);

      const studentData = studentRes.data || [];
      const resData = reservationsRes.data || [];

      const unified: StudentRequest[] = [
        ...studentData.map(s => ({ ...s, _table: 'solicitudes_alumnos' })),
        ...resData.filter(r => {
          // Include Pendiente Aval OR [Uso Externo] reservations that were handled
          const isExternal = r.materia?.includes('[Uso Externo]');
          const needsDirector = r.materia?.includes('[Requiere Aval de Dirección]');
          return r.estado === 'Pendiente Aval' || (isExternal && (r.estado === 'Avalada' || r.estado === 'Aprobada' || r.estado === 'Entregada' || (r.estado === 'Pendiente' && needsDirector)));
        }).map(r => ({
          id: r.id,
          responsable: r.docente_nombre,
          dni: 'N/A',
          materia: r.materia || 'S/M',
          docente_id: r.usuario_id,
          docente_nombre: r.docente_nombre,
          tipo_uso: 'Uso Externo',
          equipos: r.equipos_ids,
          fecha_inicio: r.fecha_inicio,
          fecha_fin: r.fecha_fin,
          estado: r.estado as any,
          created_at: r.created_at,
          _table: 'reservas'
        } as any))
      ];

      setRequests(unified.sort((a, b) => 
        new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()
      ));
    } catch (err) {
      console.error('Error fetching authorizations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEquipment = async () => {
    const { data } = await supabase.from('equipamiento').select('id, nombre, modelo, categoria, foto_url, estado, piezas, permiso_uso');
    if (data) {
      const eMap: Record<string, Equipment> = {};
      data.forEach(e => eMap[e.id] = e as any);
      setEquipment(eMap);
    }
  };

  const handleDownload = (req: StudentRequest) => {
    const reqEqs = req.equipos.map(id => equipment[id]).filter(Boolean);
    generateStudentRequestVoucherPDF(req, reqEqs);
  };

  const filtered = requests.filter(r => 
    (r.responsable || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.materia || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900">Mis Autorizaciones</h1>
        </div>
        <p className="text-sm md:text-base text-slate-500">
          Registro histórico de avales otorgados para rodajes y prácticas.
        </p>
      </header>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar por alumno o materia..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
            <p className="text-slate-500 font-bold">Consultando registros...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-bold">No se encontraron autorizaciones en su historial.</p>
          </div>
        ) : (
          filtered.map((req) => (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow"
            >
              <div className="p-5 border-b border-slate-100 flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 truncate flex items-center gap-2">
                    {req.responsable}
                    {(req as any)._table === 'reservas' && (
                       <ShieldCheck className="w-3 h-3 text-green-600" title="Aval Docente Incluido" />
                    )}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate">{req.materia}</p>
                </div>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[9px] font-black uppercase border shrink-0",
                  req.estado === 'Entregado' ? "bg-green-50 text-green-700 border-green-200" :
                  req.estado === 'Rechazado' ? "bg-red-50 text-red-700 border-red-200" :
                  "bg-amber-50 text-amber-900 border-amber-200"
                )}>
                  {req.estado}
                </span>
              </div>

              <div className="p-5 flex-1 space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400">Fecha del Pedido</p>
                    <p className="text-xs font-bold text-slate-700">{formatDate(req.created_at!)}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400">Estado Aval</p>
                    <div className="flex flex-col gap-1 mt-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold">
                        {req.autorizado_por_docente ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-slate-300" />
                        )}
                        Aval Docente {req.autorizado_por_docente && 'OK'}
                      </div>
                      {req.tipo_uso === 'Uso Externo' && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold">
                          {req.autorizado_por_direccion ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-slate-300" />
                          )}
                          Aval Dirección {req.autorizado_por_direccion && 'OK'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-[9px] font-black uppercase text-slate-400 mb-2">Equipos Autorizados</p>
                  <div className="flex flex-wrap gap-1.5">
                    {req.equipos.slice(0, 3).map(id => (
                      <span key={id} className="inline-block px-2 py-0.5 bg-slate-50 border border-slate-100 rounded text-[9px] font-bold text-slate-500 truncate max-w-full">
                        {equipment[id]?.nombre || 'Equipo'}
                      </span>
                    ))}
                    {req.equipos.length > 3 && (
                      <span className="text-[9px] font-bold text-slate-400">+{req.equipos.length - 3}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                   ID: {req.id.slice(0, 8)}
                 </span>
                 <button 
                  onClick={() => handleDownload(req)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm"
                 >
                   <Download className="w-3.5 h-3.5" />
                   Comprobante
                 </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
