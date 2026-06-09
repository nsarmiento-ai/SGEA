import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import * as Sentry from "@sentry/react";
import { supabase } from '../lib/supabase';
import { Responsable } from '../types';

export type AppRole = 'Administración' | 'Docente' | 'Director' | 'SuperAdmin' | 'Estudiante';

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
      Sentry.setUser(null);
      setActiveResponsableState(null);
      setRole(null);
      setUserEmail(null);
      setLoading(false);
      setIsSuperAdmin(false);
      lastSessionId.current = null;
      return;
    }

    Sentry.setUser({
      id: session.user.id,
      email: session.user.email || undefined
    });

    // Prevent redundant fetches if session hasn't changed
    if (lastSessionId.current === session.user.id) {
      setLoading(false);
      return;
    }

    lastSessionId.current = session.user.id;
    const email = session.user.email;
    const fullName = session.user.user_metadata.full_name || session.user.email;
    setUserEmail(email);

    try {
      // Query role from 'user_roles' table
      let dbRole: AppRole | null = null;
      if (email) {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('email', email)
          .maybeSingle(); // Use maybeSingle to not throw error if not found
        if (data?.role) {
          dbRole = data.role as AppRole;
        }
      }

      const isCineDomain = email?.endsWith('@cine.unt.edu.ar');
      let inferredRole: AppRole | null = dbRole;

      if (!inferredRole) {
        if (isCineDomain) {
          inferredRole = 'Docente';
        } else {
          inferredRole = 'Estudiante';
        }
      }

      const superAdmins = ['n.sarmiento@cine.unt.edu.ar', 'jveiga@cine.unt.edu.ar'];
      const isSpecial = superAdmins.includes(email || '') || inferredRole === 'SuperAdmin';
      setIsSuperAdmin(isSpecial);

      const savedRole = localStorage.getItem('selected_role') as AppRole;

      if (isSpecial) {
        if (savedRole) {
          setRole(savedRole);
        } else {
          setRole(null); // Force selection screen
        }
      } else {
        if (inferredRole === 'Estudiante') {
          localStorage.removeItem('selected_role');
        }
        setRole(inferredRole);
      }
      
      setActiveResponsableState(fullName);
    } catch (error) {
      console.error('Error syncing user:', error);
    } finally {
      setLoading(false);
    }
  };

  const setRoleAndSave = async (newRole: AppRole | null) => {
    // Treat student accounts strictly: prevent assigning administrative roles
    if (userEmail && !userEmail.endsWith('@cine.unt.edu.ar') && newRole !== null && newRole !== 'Estudiante') {
      console.warn('Block: Alumno tried to assign authorized AppRole');
      return;
    }
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
    Sentry.setUser(null);
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
