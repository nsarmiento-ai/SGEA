import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Responsable, Profile } from '../types';

export type AppRole = 'Administración' | 'Docente' | 'Director';

interface AppContextType {
  activeResponsable: string | null;
  setActiveResponsable: (name: string | null) => void;
  loading: boolean;
  role: AppRole | null;
  userEmail: string | null;
  profile: Profile | null;
  setRole: (role: AppRole | null) => void;
  toggleFavorite: (equipmentId: string) => Promise<void>;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeResponsable, setActiveResponsableState] = useState<string | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const lastSessionId = useRef<string | null>(null);

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
      setIsSuperAdmin(false);
      lastSessionId.current = null;
      return;
    }

    // Prevent redundant fetches if session hasn't changed
    if (lastSessionId.current === session.user.id) {
      setLoading(false);
      return;
    }

    lastSessionId.current = session.user.id;
    const email = session.user.email;
    const fullName = session.user.user_metadata.full_name || session.user.email;
    setUserEmail(email);

    const superAdmins = ['n.sarmiento@cine.unt.edu.ar', 'jveiga@cine.unt.edu.ar'];
    const isSpecial = superAdmins.includes(email);
    setIsSuperAdmin(isSpecial);

    try {
      let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!profile) {
        const newRole = email?.endsWith('@cine.unt.edu.ar') ? 'Administración' : 'Docente';
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert([{ id: session.user.id, email, rol: newRole, favoritos: [] }])
          .select()
          .single();
        
        if (insertError) console.error('Error creating profile:', insertError);
        profile = newProfile;
      }

      setProfile(profile);
      
      // If super admin, we let them pick. We might want to persist their last choice in session storage
      if (isSpecial) {
        const savedRole = sessionStorage.getItem('selected_role') as AppRole;
        if (savedRole) {
          setRole(savedRole);
        } else {
          setRole(null); // Force selection screen
        }
      } else {
        setRole(profile?.rol as AppRole || null);
      }
      
      setActiveResponsableState(fullName);
    } catch (error) {
      console.error('Error syncing user:', error);
    } finally {
      setLoading(false);
    }
  };

  const setRoleAndSave = async (newRole: AppRole | null) => {
    if (!profile && !isSuperAdmin) return;
    
    if (isSuperAdmin) {
      if (newRole) {
        sessionStorage.setItem('selected_role', newRole);
      } else {
        sessionStorage.removeItem('selected_role');
      }
      setRole(newRole);
      return;
    }

    if (!newRole) return;

    const { error } = await supabase
      .from('profiles')
      .update({ rol: newRole })
      .eq('id', profile?.id);
    
    if (!error) {
      setRole(newRole);
      if (profile) setProfile({ ...profile, rol: newRole });
    }
  };

  const toggleFavorite = async (equipmentId: string) => {
    if (!profile) return;
    const isFavorite = profile.favoritos?.includes(equipmentId);
    const newFavorites = isFavorite 
      ? profile.favoritos.filter(id => id !== equipmentId)
      : [...(profile.favoritos || []), equipmentId];
    
    const { error } = await supabase
      .from('profiles')
      .update({ favoritos: newFavorites })
      .eq('id', profile.id);
    
    if (!error) {
      setProfile({ ...profile, favoritos: newFavorites });
    }
  };

  const setActiveResponsable = (name: string | null) => {
    setActiveResponsableState(name);
  };

  const signOut = async () => {
    sessionStorage.removeItem('selected_role');
    await supabase.auth.signOut();
  };

  return (
    <AppContext.Provider value={{ 
      activeResponsable, 
      setActiveResponsable, 
      loading, 
      role, 
      userEmail, 
      profile, 
      setRole: setRoleAndSave, 
      toggleFavorite,
      isSuperAdmin,
      signOut
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
