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
      const savedRole = localStorage.getItem('selected_role') as AppRole;
      
      if (isSpecial) {
        if (savedRole) {
          setRole(savedRole);
        } else {
          setRole(null); // Force selection screen
        }
      } else {
        // Simple domain-based auto-role for @cine users who aren't superadmins
        const defaultRole = email?.endsWith('@cine.unt.edu.ar') ? 'Administración' : 'Docente';
        setRole(savedRole || defaultRole);
      }
      
      setActiveResponsableState(fullName);
    } catch (error) {
      console.error('Error syncing user:', error);
    } finally {
      setLoading(false);
    }
  };

  const setRoleAndSave = async (newRole: AppRole | null) => {
    if (newRole) {
      localStorage.setItem('selected_role', newRole);
    } else {
      localStorage.removeItem('selected_role');
    }
    setRole(newRole);
  };

  const toggleFavorite = async (equipmentId: string) => {
    // Favorites logic disabled as it required 'profiles' table
    console.log('Favorites temporarily disabled (requires profiles table):', equipmentId);
  };

  const setActiveResponsable = (name: string | null) => {
    setActiveResponsableState(name);
  };

  const signOut = async () => {
    localStorage.removeItem('selected_role');
    await supabase.auth.signOut();
  };

  return (
    <AppContext.Provider value={{ 
      activeResponsable, 
      setActiveResponsable, 
      loading, 
      role, 
      userEmail, 
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
