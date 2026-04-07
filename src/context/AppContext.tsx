import React, { createContext, useContext, useState, useEffect } from 'react';
import { Responsable } from '../types';

interface AppContextType {
  activeResponsable: string | null;
  setActiveResponsable: (name: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeResponsable, setActiveResponsableState] = useState<string | null>(() => {
    return localStorage.getItem('sgea_responsable');
  });

  const setActiveResponsable = (name: string | null) => {
    setActiveResponsableState(name);
    if (name) {
      localStorage.setItem('sgea_responsable', name);
    } else {
      localStorage.removeItem('sgea_responsable');
    }
  };

  return (
    <AppContext.Provider value={{ activeResponsable, setActiveResponsable }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
