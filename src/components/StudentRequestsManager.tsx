import React, { useState, useEffect } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { StudentRequest, Equipment } from '../types';
import { useApp } from '../context/AppContext';
import { CONTACTS_DATA } from '../lib/contactsData';
import { Loader2, CheckCircle, XCircle, Clock, AlertCircle, Package, User, Calendar, BookOpen, ExternalLink, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const StudentRequestsManager: React.FC<{ filterDireccion?: boolean }> = ({ filterDireccion }) => {
  const { activeResponsable, role, userEmail } = useApp();
  const [requests, setRequests] = useState<StudentRequest[]>([]);
  const [equipment, setEquipment] = useState<Record<string, Equipment>>({});
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const isDireccion = userEmail === 'jveiga@cine.unt.edu.ar' || userEmail === 'n.sarmiento@cine.unt.edu.ar';

  const docenteName = CONTACTS_DATA.find(c => c.email === userEmail)?.nombre;

  useEffect(() => {
    if (role === 'Docente') {
      console.log('Panel Docente: Buscando pedidos para:', userEmail);
    }
    fetchRequests();
    fetchEquipment();
  }, [filterDireccion, activeResponsable, userEmail]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      // 1. Fetch Student Requests
      let studentQuery = supabase.from('solicitudes_alumnos').select('*');
      
      if (filterDireccion) {
        studentQuery = studentQuery.eq('estado', 'Pendiente de Dirección');
      } else {
        studentQuery = studentQuery.eq('estado', 'Pendiente de Aval Docente');
        if (role === 'Docente' && userEmail) {
          studentQuery = studentQuery.eq('docente_id', userEmail);
        }
      }

      const { data: studentData } = await studentQuery.order('created_at', { ascending: false });
      
      let unified: StudentRequest[] = (studentData || []).map(s => ({ ...s, _table: 'solicitudes_alumnos' }));

      // 2. Fetch Docente Reservations if for Director
      if (filterDireccion) {
        const { data: resData } = await supabase
          .from('reservas')
          .select('*')
          .or('estado.eq.Pendiente Aval,estado.eq.Pendiente de Dirección')
          .order('created_at', { ascending: false });

        if (resData) {
          const mappedRes: StudentRequest[] = resData.map(r => ({
            id: r.id,
            responsable: r.docente_nombre,
            dni: 'N/A',
            materia: r.materia || 'S/M',
            docente_id: r.usuario_id, // Might not be email, but used as ref
            docente_nombre: r.docente_nombre,
            tipo_uso: 'Uso Externo',
            equipos: r.equipos_ids,
            fecha_inicio: r.fecha_inicio,
            fecha_fin: r.fecha_fin,
            estado: 'Pendiente Aval' as any,
            created_at: r.created_at,
            _table: 'reservas'
          } as any));
          unified = [...unified, ...mappedRes];
        }
      }

      setRequests(unified);
    } catch (err) {
      console.error('Error fetching unified requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEquipment = async () => {
    const { data } = await supabase.from('equipamiento').select('id, nombre, categoria, modelo, numero_serie, ubicacion, descripcion, foto_url, estado, permiso_uso, piezas, created_at, updated_at');
    if (data) {
      const eMap: Record<string, Equipment> = {};
      data.forEach(e => eMap[e.id] = e);
      setEquipment(eMap);
    }
  };

  const handleAuthorize = async (request: StudentRequest) => {
    if (!userEmail) {
      alert('Error: No se detectó una sesión activa para firmar la autorización.');
      return;
    }
    setProcessingId(request.id);
    let nextStatus: StudentRequest['estado'] = request.estado;

    if (filterDireccion) {
      nextStatus = 'Autorizado para Despacho';
    } else {
      // Logic for teacher authorization
      if (request.tipo_uso === 'Uso en Escuela') {
        nextStatus = 'Autorizado para Despacho';
      } else {
        nextStatus = 'Pendiente de Dirección';
      }
    }

    console.log('Autorizando solicitud ID:', request.id, 'con email:', userEmail);

    try {
      const isReserva = (request as any)._table === 'reservas';
      const updateData: any = { 
        estado: isReserva ? 'Aprobada' : nextStatus
      };

      // Only add authorization fields for student requests (solicitudes_alumnos)
      if (!isReserva) {
        if (filterDireccion) {
          updateData.autorizado_por_direccion = userEmail;
        } else {
          updateData.autorizado_por_docente = userEmail;
        }
      }

      const { error } = await supabase
        .from((request as any)._table || 'solicitudes_alumnos')
        .update(updateData)
        .eq('id', request.id);

      if (error) throw error;
      
      // Log historical operation
      await logAction(
        activeResponsable || userEmail, 
        filterDireccion ? 'AVAL_DIRECTOR' : 'AVAL_DOCENTE', 
        { 
          requestId: request.id, 
          alumno: request.responsable,
          materia: request.materia,
          status: updateData.estado,
          source: (request as any)._table
        }
      );

      setRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (err) {
      console.error('Error authorizing request:', err);
      alert('Error en la autorización. Verifique la consola.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (request: StudentRequest) => {
    if (!window.confirm('¿Está seguro de que desea rechazar esta solicitud?')) return;
    setProcessingId(request.id);
    try {
      const { error } = await supabase
        .from((request as any)._table || 'solicitudes_alumnos')
        .update({ estado: (request as any)._table === 'reservas' ? 'Rechazada' : 'Rechazado' })
        .eq('id', request.id);

      if (error) throw error;

      // Log rejection
      await logAction(
        activeResponsable || userEmail, 
        'RECHAZO_SOLICITUD', 
        { requestId: request.id, source: (request as any)._table }
      );

      setRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (err) {
      console.error('Error rejecting request:', err);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Visual Identity Headers */}
      {role === 'Director' && filterDireccion && (
        <div className="mb-6 bg-[#450a0a] text-white px-6 py-3 rounded-2xl flex items-center justify-between shadow-xl border-l-4 border-amber-500">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Panel de Dirección</span>
          </div>
          <span className="text-[10px] font-bold opacity-60 uppercase">{userEmail}</span>
        </div>
      )}

      {role === 'Docente' && !filterDireccion && (
        <div className="mb-6 bg-amber-50 text-amber-900 px-6 py-3 rounded-2xl flex items-center justify-between border border-amber-100">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">Panel Docente: Gestión de Avales</span>
          </div>
        </div>
      )}

      {role === 'Administración' && !filterDireccion && (
        <div className="mb-6 bg-slate-100 text-slate-900 px-6 py-3 rounded-2xl flex items-center justify-between border border-slate-200">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">Panel de Administración</span>
          </div>
        </div>
      )}

      <header className="mb-10">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
            {filterDireccion ? <ShieldCheck className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              {filterDireccion ? 'Autorización de Rodajes Externos' : 'Autorizar Pedidos de Alumnos'}
            </h1>
            <p className="text-slate-500 font-medium">
              {filterDireccion ? 'Revisión técnica de proyectos con salida de la Facultad.' : 'Valide las solicitudes de sus alumnos.'}
            </p>
          </div>
        </div>
      </header>

      {requests.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-slate-200">
          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900">No hay solicitudes pendientes</h3>
          <p className="text-slate-500">Todo al día por aquí.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <AnimatePresence>
            {requests.map(req => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden group hover:shadow-xl hover:border-amber-200 transition-all"
              >
                <div className="flex flex-col lg:flex-row">
                  {/* Left Info Section */}
                  <div className="p-6 lg:w-2/3 border-b lg:border-b-0 lg:border-r border-slate-100">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        req.tipo_uso === 'Uso Externo' ? 'bg-amber-100 text-amber-950' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {req.tipo_uso}
                      </span>
                      <span className="text-[10px] items-center gap-1 font-black uppercase tracking-widest text-slate-400 flex">
                        <Calendar className="w-3 h-3" />
                        Solicitado: {new Date(req.created_at!).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
                      <User className="w-5 h-5 text-amber-500" />
                      {req.responsable} 
                      <span className="text-slate-400 text-sm font-bold">DNI: {req.dni}</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Materia</p>
                        <p className="font-bold text-slate-700 flex items-center gap-2">
                          <BookOpen className="w-4 h-4" />
                          {req.materia}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Período</p>
                        <p className="font-bold text-slate-700 text-sm">
                          {new Date(req.fecha_inicio).toLocaleString()} al {new Date(req.fecha_fin).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {req.integrantes && (
                      <div className="mb-6 p-4 bg-slate-50 rounded-2xl">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Integrantes del Equipo</p>
                        <div className="text-sm text-slate-600 leading-relaxed font-medium">
                          {typeof req.integrantes === 'string' ? (
                            req.integrantes
                          ) : Array.isArray(req.integrantes) ? (
                            req.integrantes.map((int: any, idx: number) => (
                              <span key={idx}>{int.nombre || int}{idx < req.integrantes.length - 1 ? ', ' : ''}</span>
                            ))
                          ) : 'Dato no reconocido'}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Equipamiento Solicitado</p>
                      <div className="flex flex-wrap gap-2">
                        {req.equipos.map(id => (
                          <div key={id} className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-2">
                            <Package className="w-3 h-3 text-slate-400" />
                            <span className="text-xs font-bold text-slate-700">{equipment[id]?.nombre || 'Equipo no encontrado'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Actions Section */}
                  <div className="p-6 lg:w-1/3 bg-slate-50 flex flex-col justify-between">
                    <div className="space-y-4">
                      {req.observaciones && (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Notas / Proyecto</p>
                          <p className="text-sm text-slate-600 italic font-medium">"{req.observaciones}"</p>
                        </div>
                      )}
                      
                      <div className="p-4 bg-white rounded-2xl border border-slate-200">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Requerimientos de Aval</p>
                        </div>
                        <ul className="space-y-2">
                          <li className="text-xs font-bold text-slate-600 flex items-center gap-2">
                            <CheckCircle className={`w-3.3 h-3.3 ${(req.autorizado_por_docente || (req as any).estado_docente === 'aprobado') ? 'text-green-500' : 'text-slate-300'}`} />
                            Aval Docente {(req as any)._table === 'reservas' && ' (Autor)'}
                          </li>
                          {req.tipo_uso === 'Uso Externo' && (
                            <li className="text-xs font-bold text-slate-600 flex items-center gap-2">
                              <CheckCircle className={`w-3.3 h-3.3 ${req.autorizado_por_direccion ? 'text-green-500' : 'text-slate-300'}`} />
                              Autorización Dirección
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-6">
                      <button
                        onClick={() => handleReject(req)}
                        disabled={processingId === req.id}
                        className="flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 text-slate-500 font-bold rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Rechazar
                      </button>
                      <button
                        onClick={() => handleAuthorize(req)}
                        disabled={processingId === req.id}
                        className="flex items-center justify-center gap-2 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-green-600 transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
                      >
                        {processingId === req.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        Autorizar
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
