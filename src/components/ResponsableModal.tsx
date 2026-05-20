import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { Loader2, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { optimizeCloudinaryUrl, cn } from '../lib/utils';
import { AnimatedBackground } from './ui/AnimatedBackground';
import { BackgroundImageTexture } from './ui/BackgroundImageTexture';
import { BorderBeam } from './ui/BorderBeam';
import { TextAnimate } from './ui/TextAnimate';

export const ResponsableModal: React.FC = () => {
  const { activeResponsable, loading: authLoading } = useApp();
  const [loggingIn, setLoggingIn] = useState(false);
  const [loggingInStudent, setLoggingInStudent] = useState(false);
  const navigate = useNavigate();

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
      console.error('Detalle del error de Auth (Docentes/Admin):', error);
      alert('Error al iniciar sesión: ' + error.message);
      setLoggingIn(false);
    }
  };

  const handleGoogleStudentLogin = async () => {
    setLoggingInStudent(true);
    
    // Redirect logic: local dev redirects to local window.location.origin, production redirects to https://sgea.vercel.app/dashboard
    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname.includes('127.0.0.1') || 
                    window.location.hostname.includes('run.app');
    const redirectToUrl = isLocal ? window.location.origin : 'https://sgea.vercel.app/dashboard';

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
          // No hd query parameter so personal accounts can log in
        },
        redirectTo: redirectToUrl
      }
    });

    if (error) {
      console.error('Detalle del error de Auth (Alumnos):', error);
      alert('Error al iniciar sesión: ' + error.message);
      setLoggingInStudent(false);
    }
  };

  if (activeResponsable || authLoading) return null;

  const logoUrl = optimizeCloudinaryUrl("https://res.cloudinary.com/divij23kk/image/upload/v1775522044/Logo-Escuela_clscco_1_pe7ao5.png");

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-slate-950">
      <AnimatedBackground className="opacity-40" />
      <BackgroundImageTexture variant="grid-noise" opacity={0.08} className="z-[1]" />
      
      {/* Radial Gradient overlay for focus */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.05)_0%,transparent_70%)] pointer-events-none" />

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <div className={cn(
          "relative overflow-hidden rounded-3xl",
          "bg-white/5 backdrop-blur-2xl border border-white/10",
          "shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]"
        )}>
          <BackgroundImageTexture variant="inflicted" opacity={0.1} />
          <BorderBeam size={250} duration={10} colorFrom="#f59e0b" colorTo="#d97706" />

          <div className="p-8 text-center border-b border-white/5">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-6 flex justify-center"
            >
              <img 
                src={logoUrl} 
                alt="Logo Escuela" 
                className="w-24 h-24 object-contain brightness-0 invert opacity-80"
                referrerPolicy="no-referrer"
              />
            </motion.div>
            
            <TextAnimate 
              text="SGEA"
              type="popIn"
              className="text-4xl font-display font-black text-white tracking-tighter justify-center"
            />
            
            <TextAnimate 
              text="Sistema de Gestión Audiovisual"
              type="fadeIn"
              delay={0.4}
              className="text-amber-500/80 text-[10px] mt-2 uppercase tracking-[0.3em] font-black justify-center"
            />
          </div>

          <div className="p-8 space-y-6">
            <div className="flex flex-col gap-4">
              <p className="text-slate-300 text-center mb-2 font-medium text-sm">
                Bienvenidos. Por favor, identifíquese para continuar.
              </p>
              
              <button
                onClick={handleGoogleLogin}
                disabled={loggingIn || loggingInStudent}
                className={cn(
                  "w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl transition-all shadow-xl group relative overflow-hidden",
                  "bg-white text-slate-900 font-bold hover:bg-slate-50 active:scale-[0.98]",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {loggingIn ? (
                  <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                ) : (
                  <svg className="w-5 h-5 text-[#4285F4]" viewBox="0 0 24 24">
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
                <span>Iniciar sesión Google (Docentes/Admin)</span>
              </button>

              <button
                onClick={handleGoogleStudentLogin}
                disabled={loggingIn || loggingInStudent}
                className={cn(
                  "w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl transition-all shadow-xl group relative overflow-hidden",
                  "bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 active:scale-[0.98]",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {loggingInStudent ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                ) : (
                  <svg className="w-5 h-5 text-slate-950" viewBox="0 0 24 24">
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
                <span>Iniciar sesión con Google (Alumnos)</span>
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-xs font-black uppercase tracking-widest">
                <span className="bg-[#0f172a] px-4 text-slate-500">¿Consulta Pública?</span>
              </div>
            </div>

            <button
              onClick={() => navigate('/catalogo-publico')}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl transition-all border border-white/10",
                "bg-white/5 text-slate-400 font-bold hover:bg-white/10 hover:text-white"
              )}
            >
              <ExternalLink className="w-4 h-4" />
              Catálogo Público
            </button>
          </div>

          <div className="p-6 bg-white/5 border-t border-white/5 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
              Docentes/Admin: correo <span className="text-amber-500/60 font-black">@cine.unt.edu.ar</span>
            </p>
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-medium mt-1">
              Alumnos: correo institucional o personal
            </p>
          </div>
        </div>

        {/* Support link or credits */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center mt-8 text-slate-600 text-xs font-medium"
        >
          &copy; {new Date().getFullYear()} Escuela Universitaria de Cine, Video y TV
        </motion.p>
      </motion.div>
    </div>
  );
};

