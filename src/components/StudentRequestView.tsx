import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Equipment, StudentRequest } from '../types';
import { CONTACTS_DATA } from '../lib/contactsData';
import { MATERIAS_CATEGORIES } from '../constants';
import { Loader2, Package, Search, Users, BookOpen, Calendar, CheckCircle, AlertCircle, ArrowLeft, Filter, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

export const StudentRequestView: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    responsable: '',
    dni: '',
    integrantes: '',
    materia: '',
    docente_id: '',
    docente_nombre: '',
    tipo_uso: 'Uso en Escuela' as 'Uso en Escuela' | 'Uso Externo',
    fecha_inicio: '',
    fecha_fin: '',
    observaciones: ''
  });

  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEquipment = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('equipamiento')
        .select('*')
        .neq('estado', 'Archivado')
        .order('nombre');
      if (data) setEquipment(data);
      setLoading(false);
    };
    fetchEquipment();

    // Check for pre-selected items in URL
    const params = new URLSearchParams(window.location.search);
    const items = params.get('items');
    if (items) {
      setSelectedIds(items.split(',').filter(id => id.length > 0));
    }
  }, []);

  const filteredEquipment = equipment.filter(e => 
    e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.modelo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleEquipment = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      setError('Debe seleccionar al menos un equipo.');
      return;
    }

    setLoading(true);
    setError(null);

    const newRequest: Partial<StudentRequest> = {
      ...formData,
      equipos: selectedIds,
      estado: 'Pendiente de Aval Docente',
      created_at: new Date().toISOString()
    };

    console.log('Enviando solicitud:', {
      ...newRequest,
      equipos_count: selectedIds.length
    });

    try {
      const { data, error: insertError } = await supabase
        .from('solicitudes_alumnos')
        .insert([newRequest])
        .select();

      if (insertError) throw insertError;
      console.log('Solicitud enviada con éxito:', data);
      setSubmitted(true);
    } catch (err: any) {
      console.error('Error submitting request:', err);
      setError('Hubo un error al enviar la solicitud. Por favor, intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">¡Solicitud Enviada!</h2>
          <p className="text-slate-600 mb-8">
            Tu pedido ha sido registrado correctamente y se encuentra <b>Pendiente de Aval Docente</b>. 
            Contacta a tu docente para que autorice el pedido.
          </p>
          <button 
            onClick={() => navigate('/catalogo-publico')}
            className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all"
          >
            Volver al Catálogo
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-6 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button 
            onClick={() => step > 1 ? setStep(step - 1) : navigate('/catalogo-publico')}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-slate-600" />
          </button>
          <div className="flex items-center gap-3">
            <img 
              src="https://res.cloudinary.com/divij23kk/image/upload/v1775522044/Logo-Escuela_clscco_1_pe7ao5.png" 
              alt="Logo" 
              className="h-10 w-auto"
            />
            <div>
              <h1 className="text-xl font-black text-slate-900 leading-none">Nueva Solicitud</h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">Formulario de Pedido de Equipamiento</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-10">
        {/* Progress Bar */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div 
              key={s} 
              className={`h-2 flex-1 rounded-full transition-all duration-500 ${step >= s ? 'bg-amber-500' : 'bg-slate-200'}`}
            />
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="space-y-6"
              >
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-500" />
                    Datos del Responsable e Integrantes
                  </h3>
                  
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase text-slate-500 ml-1">Nombre Completo del Responsable</label>
                        <input 
                          required
                          type="text"
                          value={formData.responsable}
                          onChange={(e) => setFormData({...formData, responsable: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                          placeholder="Ej: Juan Pérez"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase text-slate-500 ml-1">DNI del Responsable</label>
                        <input 
                          required
                          type="text"
                          value={formData.dni}
                          onChange={(e) => setFormData({...formData, dni: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                          placeholder="Ej: 12.345.678"
                        />
                      </div>
                    </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-slate-500 ml-1">Otros Integrantes (Opcional)</label>
                    <textarea 
                      value={formData.integrantes}
                      onChange={(e) => setFormData({...formData, integrantes: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none transition-all h-24"
                      placeholder="Lista de nombres y DNIs de los compañeros de equipo..."
                    />
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-amber-500" />
                    Materia y Docente
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-slate-500 ml-1">Materia / Cátedra</label>
                      <select 
                        required
                        value={formData.materia}
                        onChange={(e) => setFormData({...formData, materia: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none transition-all appearance-none"
                      >
                        <option value="">Seleccione una Materia...</option>
                        {Object.entries(MATERIAS_CATEGORIES).map(([cat, materias]) => (
                          <optgroup key={cat} label={cat}>
                            {materias.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-slate-500 ml-1">Docente que Avala</label>
                      <select 
                        required
                        value={formData.docente_id}
                        onChange={(e) => {
                          const contact = CONTACTS_DATA.find(c => c.email === e.target.value);
                          setFormData({
                            ...formData, 
                            docente_id: e.target.value,
                            docente_nombre: contact?.nombre || ''
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none transition-all appearance-none"
                      >
                        <option value="">Seleccione un Docente...</option>
                        {CONTACTS_DATA.sort((a,b) => a.nombre.localeCompare(b.nombre)).map(contact => (
                          <option key={contact.email} value={contact.email}>{contact.nombre}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button 
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!formData.responsable || !formData.dni || !formData.materia || !formData.docente_id}
                    className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
                  >
                    Siguiente: Selección de Equipos
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="space-y-6"
              >
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <Package className="w-5 h-5 text-amber-500" />
                      Selección de Equipamiento
                    </h3>
                    <div className="text-xs font-black text-slate-400 uppercase">
                      {selectedIds.length} seleccionados
                    </div>
                  </div>

                  <div className="relative mb-4">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      placeholder="Buscar cámaras, trípodes, luces..."
                    />
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    <div className="max-h-[500px] overflow-y-auto scrollbar-thin">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                          <tr>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Equipo</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</th>
                            <th className="px-6 py-4 text-right"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredEquipment.length > 0 ? (
                            filteredEquipment.map(item => (
                              <tr 
                                key={item.id} 
                                className={cn(
                                  "hover:bg-slate-50/80 transition-colors cursor-pointer",
                                  selectedIds.includes(item.id) && "bg-amber-50/50"
                                )}
                                onClick={() => toggleEquipment(item.id)}
                              >
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-4">
                                    <div className={cn(
                                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                      selectedIds.includes(item.id) ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-400"
                                    )}>
                                      <Package className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-slate-900 truncate tracking-tight">{item.nombre}</p>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{item.modelo}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex flex-col gap-1">
                                    <span className={cn(
                                      "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border text-center",
                                      item.estado === 'Disponible' 
                                        ? "bg-green-50 text-green-600 border-green-200" 
                                        : "bg-red-50 text-red-600 border-red-200"
                                    )}>
                                      {item.estado}
                                    </span>
                                    <span className="text-[8px] font-black uppercase text-slate-300 text-center">{item.categoria}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className={cn(
                                    "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ml-auto",
                                    selectedIds.includes(item.id)
                                      ? "bg-amber-500 border-amber-500 text-white"
                                      : "border-slate-200 text-transparent"
                                  )}>
                                    <CheckCircle className="w-4 h-4" />
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={3} className="px-6 py-12 text-center text-slate-400 font-bold text-sm">
                                No se encontraron equipos con ese nombre.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <button 
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-slate-500 font-bold px-8 py-4 hover:bg-slate-100 rounded-xl transition-all"
                  >
                    Atrás
                  </button>
                  <button 
                    type="button"
                    onClick={() => setStep(3)}
                    disabled={selectedIds.length === 0}
                    className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
                  >
                    Siguiente: Detalles de Fecha y Uso
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="space-y-6"
              >
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-amber-500" />
                    Detalles del Préstamo
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-slate-500 ml-1">Fecha y Hora de Retiro</label>
                      <input 
                        required
                        type="datetime-local"
                        value={formData.fecha_inicio}
                        onChange={(e) => setFormData({...formData, fecha_inicio: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-slate-500 ml-1">Fecha y Hora de Devolución</label>
                      <input 
                        required
                        type="datetime-local"
                        value={formData.fecha_fin}
                        onChange={(e) => setFormData({...formData, fecha_fin: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-black uppercase text-slate-500 ml-1">Tipo de Uso / Destino</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, tipo_uso: 'Uso en Escuela'})}
                        className={`p-4 rounded-2xl border text-left flex items-center gap-4 transition-all ${
                          formData.tipo_uso === 'Uso en Escuela' 
                          ? 'border-amber-500 bg-amber-50 shadow-sm' 
                          : 'border-slate-100 hover:border-slate-200 bg-slate-50'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          formData.tipo_uso === 'Uso en Escuela' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-400'
                        }`}>
                          <Package className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">Uso en Escuela</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-tight">Aval Docente requerido</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({...formData, tipo_uso: 'Uso Externo'})}
                        className={`p-4 rounded-2xl border text-left flex items-center gap-4 transition-all ${
                          formData.tipo_uso === 'Uso Externo' 
                          ? 'border-amber-500 bg-amber-50 shadow-sm' 
                          : 'border-slate-100 hover:border-slate-200 bg-slate-50'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          formData.tipo_uso === 'Uso Externo' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-400'
                        }`}>
                          <Search className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">Uso Externo</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-tight">Aval Docente + Dirección</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-slate-500 ml-1">Observaciones / Proyecto</label>
                    <textarea 
                      value={formData.observaciones}
                      onChange={(e) => setFormData({...formData, observaciones: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none transition-all h-24"
                      placeholder="Indique el nombre del proyecto o cualquier detalle importante..."
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 border border-red-100">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-bold">{error}</p>
                  </div>
                )}

                <div className="flex justify-between">
                  <button 
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-slate-500 font-bold px-8 py-4 hover:bg-slate-100 rounded-xl transition-all"
                  >
                    Atrás
                  </button>
                  <button 
                    type="submit"
                    disabled={loading || !formData.fecha_inicio || !formData.fecha_fin}
                    className="bg-slate-900 text-white px-12 py-4 rounded-xl font-bold hover:bg-amber-500 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                    Enviar Solicitud
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </main>
    </div>
  );
};
