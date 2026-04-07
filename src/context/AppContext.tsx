import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Responsable } from '../types';

interface AppContextType {
  activeResponsable: string | null;
  setActiveResponsable: (name: string | null) => void;
  loading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeResponsable, setActiveResponsableState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleAuthChange(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleAuthChange(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuthChange = async (session: any) => {
    if (!session?.user) {
      setActiveResponsableState(null);
      setLoading(false);
      return;
    }

    const email = session.user.email;
    const fullName = session.user.user_metadata.full_name || session.user.email;

    // Domain validation
    if (!email.endsWith('@cine.unt.edu.ar')) {
      alert('Acceso denegado: Solo se permiten correos @cine.unt.edu.ar');
      await supabase.auth.signOut();
      localStorage.clear(); // Clear any stale data
      setActiveResponsableState(null);
      setLoading(false);
      return;
    }

    try {
      // Sync with responsables table by email (preferred) or name
      const { data: existing, error: fetchError } = await supabase
        .from('responsables')
        .select('*')
        .or(`email.eq.${email},nombre_completo.eq.${fullName}`)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching responsable:', fetchError);
      }

      if (!existing) {
        const { error: insertError } = await supabase
          .from('responsables')
          .insert([{ 
            nombre_completo: fullName, 
            email: email,
            activo: true 
          }]);
        
        if (insertError) {
          console.error('Error creating responsable:', insertError);
        }
      } else if (!existing.email) {
        // Update existing record with email if missing
        await supabase
          .from('responsables')
          .update({ email: email })
          .eq('id', existing.id);
      }

      setActiveResponsableState(fullName);
    } catch (error) {
      console.error('Error syncing user:', error);
    } finally {
      setLoading(false);
    }
  };

  const setActiveResponsable = (name: string | null) => {
    setActiveResponsableState(name);
  };

  return (
    <AppContext.Provider value={{ activeResponsable, setActiveResponsable, loading }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
