import React, { useState, useEffect } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { Responsable } from '../types';
import { useApp } from '../context/AppContext';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ResponsableModal: React.FC = () => {
  const { activeResponsable, setActiveResponsable } = useApp();
  const [responsables, setResponsables] = useState<Responsable[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchResponsables();
  }, []);

  const fetchResponsables = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('responsables')
      .select('*')
      .eq('activo', true)
      .order('nombre_completo', { ascending: true });
    
    if (!error && data) {
      setResponsables(data);
    }
    setLoading(false);
  };

  const handleAddResponsable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setSaving(true);
    const { data, error } = await supabase
      .from('responsables')
      .insert([{ nombre_completo: newName.trim(), activo: true }])
      .select();

    if (error) {
      console.error('Error adding responsable:', error);
      alert('Error al guardar el responsable: ' + error.message);
    } else if (data && data.length > 0) {
      const newResponsable = data[0];
      console.log('New responsable created:', newResponsable);
      
      // Log action in background
      logAction(newResponsable.nombre_completo, 'ALTA_RESPONSABLE', { nombre: newResponsable.nombre_completo }).catch(console.error);
      
      // Update local list
      setResponsables(prev => [...prev, newResponsable]);
      
      // Set active responsable to close modal and enter app
      console.log('Setting active responsable to:', newResponsable.nombre_completo);
      setActiveResponsable(newResponsable.nombre_completo);
      setIsAdding(false);
    } else {
      console.warn('No data returned from insert');
      alert('Error: No se recibió confirmación del servidor.');
    }
    setSaving(false);
  };

  if (activeResponsable) return null;

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 bg-[url('https://res.cloudinary.com/divij23kk/image/upload/v1775519974/Gemini_Generated_Image_3t4jzz3t4jzz3t4j_womjw8.png')] bg-center bg-no-repeat">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="bg-slate-900 p-6 text-white">
          <h2 className="text-2xl font-display font-bold">Identificación Obligatoria</h2>
          <p className="text-slate-400 text-sm mt-1">Seleccione el responsable de turno para continuar.</p>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : isAdding ? (
            <form onSubmit={handleAddResponsable} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                  placeholder="Ej: Juan Pérez"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="flex-1 px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Guardar
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                {responsables.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setActiveResponsable(r.nombre_completo)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50 transition-all text-left group"
                  >
                    <span className="font-medium text-slate-700 group-hover:text-amber-700">{r.nombre_completo}</span>
                    <UserCheck className="w-4 h-4 text-slate-400 group-hover:text-amber-600" />
                  </button>
                ))}
                {responsables.length === 0 && (
                  <p className="text-center text-slate-500 py-4">No hay responsables registrados.</p>
                )}
              </div>
              
              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={() => setIsAdding(true)}
                  className="w-full py-3 flex items-center justify-center gap-2 text-amber-600 font-semibold hover:bg-amber-50 rounded-xl transition-colors"
                >
                  <UserPlus className="w-5 h-5" />
                  Agregar nuevo Responsable
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
