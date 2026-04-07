import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AuditLog } from '../types';
import { 
  History, 
  Search, 
  Calendar, 
  User, 
  Activity,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { formatDate, cn } from '../lib/utils';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) setLogs(data);
    setLoading(false);
  };

  const filteredLogs = logs.filter(log => 
    log.responsable_nombre.toLowerCase().includes(search.toLowerCase()) ||
    log.accion.toLowerCase().includes(search.toLowerCase()) ||
    JSON.stringify(log.detalles).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-900">Historial de Auditoría</h1>
        <p className="text-slate-500">Registro inmutable de todas las acciones realizadas en el sistema.</p>
      </header>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar en el log por responsable, acción o detalles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Fecha y Hora</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Responsable</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Acción</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Detalles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-2" />
                    <span className="text-slate-500 font-medium">Cargando registros...</span>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    No se encontraron registros que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      {formatDate(log.created_at)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
                        {log.responsable_nombre.charAt(0)}
                      </div>
                      <span className="text-sm font-bold text-slate-900">{log.responsable_nombre}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-black uppercase border",
                      log.accion.includes('ALTA') ? "bg-green-50 text-green-700 border-green-200" :
                      log.accion.includes('BAJA') ? "bg-red-50 text-red-700 border-red-200" :
                      log.accion.includes('PRESTAMO') ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-blue-50 text-blue-700 border-blue-200"
                    )}>
                      {log.accion.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-xs overflow-hidden">
                      <pre className="text-[10px] text-slate-500 font-mono bg-slate-50 p-2 rounded border border-slate-100 overflow-x-auto">
                        {JSON.stringify(log.detalles, null, 2)}
                      </pre>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
