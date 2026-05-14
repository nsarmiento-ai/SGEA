import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loan, Equipment } from '../types';
import { 
  Search, 
  Calendar, 
  User, 
  Package,
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertCircle,
  Clock,
  History
} from 'lucide-react';
import { motion } from 'motion/react';
import { formatDate, cn } from '../lib/utils';
import { generateLoanPDF, generateReturnPDF } from '../lib/pdf';
import { CONTACTS_DATA } from '../lib/contactsData';

export const LoanHistory: React.FC = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [equipments, setEquipments] = useState<Record<string, Equipment>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchHistory();
    fetchEquipments();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('prestamos')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) setLoans(data);
    setLoading(false);
  };

  const fetchEquipments = async () => {
    const { data } = await supabase.from('equipamiento').select('id, nombre, modelo, numero_serie, categoria, foto_url, estado, piezas, permiso_uso');
    if (data) {
      const eMap: Record<string, Equipment> = {};
      data.forEach(e => eMap[e.id] = e as any);
      setEquipments(eMap);
    }
  };

  const filtered = loans.filter(l => 
    (l.alumno_nombre || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.docente_responsable || '').toLowerCase().includes(search.toLowerCase()) ||
    l.equipos_ids.some(id => (equipments[id]?.nombre || '').toLowerCase().includes(search.toLowerCase()))
  );

  const handleDownloadPDF = (loan: any) => {
    const loanEqs = loan.equipos_ids.map((id: string) => equipments[id]).filter(Boolean);
    const targetDocente = CONTACTS_DATA.find(c => c.nombre === loan.docente_responsable);
    
    if (loan.estado === 'Finalizado') {
      generateReturnPDF(loan, loanEqs, loan.responsable_nombre, targetDocente?.email);
    } else {
      generateLoanPDF(loan, loanEqs, targetDocente?.email, []);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg">
            <History className="w-5 h-5" />
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900">Archivo Histórico de Préstamos</h1>
        </div>
        <p className="text-sm md:text-base text-slate-500">Consulta exhaustiva de todos los movimientos y autorizaciones pasadas.</p>
      </header>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar por alumno, docente o equipo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none shadow-sm text-sm"
        />
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider">Operación / Fecha</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider">Alumno / Materia</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider">Autorizó (Docente)</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-amber-500 mx-auto mb-4" />
                    <p className="text-slate-500 font-bold">Cargando archivo histórico...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-medium">
                    No se encontraron registros en el historial.
                  </td>
                </tr>
              ) : (
                filtered.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-900 mb-1">#{loan.id.slice(0, 8).toUpperCase()}</span>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                          <Calendar className="w-3 h-3" />
                          {formatDate(loan.fecha_salida)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900">{loan.alumno_nombre}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{loan.materia}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-medium text-slate-700">{loan.docente_responsable}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[9px] font-black uppercase border",
                        loan.estado === 'Finalizado' ? "bg-green-50 text-green-700 border-green-200" :
                        loan.estado === 'En Mora' ? "bg-red-50 text-red-700 border-red-200" :
                        "bg-blue-50 text-blue-700 border-blue-200"
                      )}>
                        {loan.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDownloadPDF(loan)}
                        className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all"
                        title="Descargar Comprobante"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
