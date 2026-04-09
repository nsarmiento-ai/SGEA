import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Responsable, Profile } from '../types';

interface AppContextType {
  activeResponsable: string | null;
  setActiveResponsable: (name: string | null) => void;
  loading: boolean;
  role: 'Pañolero' | 'Docente' | null;
  userEmail: string | null;
  profile: Profile | null;
  setRole: (role: 'Pañolero' | 'Docente') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeResponsable, setActiveResponsableState] = useState<string | null>(null);
  const [role, setRole] = useState<'Pañolero' | 'Docente' | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
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
      setRole(null);
      setUserEmail(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    const email = session.user.email;
    const fullName = session.user.user_metadata.full_name || session.user.email;
    setUserEmail(email);

    try {
      let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!profile) {
        const newRole = email?.endsWith('@cine.unt.edu.ar') ? null : 'Docente';
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert([{ id: session.user.id, email, rol: newRole, favoritos: [] }])
          .select()
          .single();
        
        if (insertError) console.error('Error creating profile:', insertError);
        profile = newProfile;
      }

      setProfile(profile);
      setRole(profile?.rol || null);
      setActiveResponsableState(fullName);
    } catch (error) {
      console.error('Error syncing user:', error);
    } finally {
      setLoading(false);
    }
  };

  const setRoleAndSave = async (newRole: 'Pañolero' | 'Docente') => {
    if (!profile) return;
    const { error } = await supabase
      .from('profiles')
      .update({ rol: newRole })
      .eq('id', profile.id);
    
    if (!error) {
      setRole(newRole);
      setProfile({ ...profile, rol: newRole });
    }
  };

  const setActiveResponsable = (name: string | null) => {
    setActiveResponsableState(name);
  };

  return (
    <AppContext.Provider value={{ activeResponsable, setActiveResponsable, loading, role, userEmail, profile, setRole: setRoleAndSave }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
