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

import { useApp } from '../context/AppContext';

export const AuditLogs: React.FC = () => {
  const { profile } = useApp();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleReset = async () => {
    if (!confirm('⚠️ ATENCIÓN: Esto eliminará TODOS los préstamos, reservas e historiales. Esta acción no se puede deshacer. ¿Desea continuar?')) return;
    
    setLoading(true);
    try {
      await Promise.all([
        supabase.from('prestamos').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('reservas').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('historial_recursos').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      ]);
      alert('Sistema reseteado con éxito.');
      fetchLogs();
    } catch (err: any) {
      alert('Error al resetear: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) setLogs(data);
    setLoading(false);
  };

  const filteredLogs = (logs || []).filter(log => 
    (log.responsable_nombre || '').toLowerCase().includes((search || '').toLowerCase()) ||
    (log.accion || '').toLowerCase().includes((search || '').toLowerCase()) ||
    JSON.stringify(log.detalles || {}).toLowerCase().includes((search || '').toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pt-16 lg:pt-8">
      <header className="mb-8 flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900">Historial de Auditoría</h1>
          <p className="text-sm md:text-base text-slate-500">Registro inmutable de todas las acciones.</p>
        </div>
        {profile?.rol === 'Pañolero' && (
          <button 
            onClick={handleReset}
            className="w-full sm:w-auto px-4 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-red-100 transition-colors shadow-sm"
          >
            Resetear Sistema
          </button>
        )}
      </header>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar responsable, acción..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none shadow-sm text-sm"
        />
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
            <Loader2 className="w-10 h-10 animate-spin text-amber-500 mx-auto mb-4" />
            <p className="text-slate-500 font-bold">Cargando registros...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
            <p className="text-slate-500 font-bold">No se encontraron registros.</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-4">
              {filteredLogs.map((log) => (
                <div key={log.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {log.responsable_nombre.charAt(0)}
                      </div>
                      <span className="text-sm font-bold text-slate-900 truncate">{log.responsable_nombre}</span>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-black uppercase border shrink-0",
                      log.accion.includes('ALTA') ? "bg-green-50 text-green-700 border-green-200" :
                      log.accion.includes('BAJA') ? "bg-red-50 text-red-700 border-red-200" :
                      log.accion.includes('PRESTAMO') ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-blue-50 text-blue-700 border-blue-200"
                    )}>
                      {log.accion.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(log.created_at)}
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 overflow-x-auto custom-scrollbar">
                    <pre className="text-[9px] text-slate-500 font-mono">
                      {JSON.stringify(log.detalles, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider">Fecha y Hora</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider">Responsable</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider">Acción</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider">Detalles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            {formatDate(log.created_at)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold">
                              {log.responsable_nombre.charAt(0)}
                            </div>
                            <span className="text-xs font-bold text-slate-900">{log.responsable_nombre}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-[9px] font-black uppercase border",
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
                            <pre className="text-[9px] text-slate-500 font-mono bg-slate-50 p-2 rounded border border-slate-100 overflow-x-auto transition-all group-hover:bg-white shadow-inner">
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
          </>
        )}
      </div>
    </div>
  );
};
