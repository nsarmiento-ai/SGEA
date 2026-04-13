import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export const ResponsableModal: React.FC = () => {
  const { activeResponsable, loading: authLoading } = useApp();
  const [loggingIn, setLoggingIn] = useState(false);

  const handleGoogleLogin = async () => {
    setLoggingIn(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
          hd: 'cine.unt.edu.ar'
        },
        redirectTo: window.location.origin
      }
    });

    if (error) {
      console.error('Detalle del error de Auth:', error);
      alert('Error al iniciar sesión: ' + error.message);
      setLoggingIn(false);
    }
  };

  if (activeResponsable || authLoading) return null;

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 bg-[url('https://res.cloudinary.com/divij23kk/image/upload/v1776123937/Gemini_Generated_Image_bs4vhjbs4vhjbs4v_lk4bry.png')] bg-center bg-no-repeat">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="bg-slate-900 p-8 text-white text-center">
          <div className="mb-6 flex justify-center">
            <img 
              src="https://res.cloudinary.com/divij23kk/image/upload/v1775522044/Logo-Escuela_clscco_1_pe7ao5.png" 
              alt="Logo Escuela" 
              className="w-24 h-24 object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h2 className="text-3xl font-display font-bold">SGEA</h2>
          <p className="text-slate-400 text-sm mt-2 uppercase tracking-widest font-bold">Sistema de Gestión Audiovisual</p>
        </div>

        <div className="p-8">
          <p className="text-slate-600 text-center mb-8 font-medium">
            Para acceder al panel de control, debe identificarse con su cuenta institucional.
          </p>

          <button
            onClick={handleGoogleLogin}
            disabled={loggingIn}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 text-slate-700 font-bold py-4 px-6 rounded-xl hover:bg-slate-50 transition-all shadow-sm group"
          >
            {loggingIn ? (
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            ) : (
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            <span className="group-hover:text-slate-900">Iniciar sesión con Google</span>
          </button>

          <p className="text-[10px] text-slate-400 text-center mt-8 uppercase tracking-tighter">
            Solo correos autorizados @cine.unt.edu.ar
          </p>
        </div>
      </motion.div>
    </div>
  );
};
