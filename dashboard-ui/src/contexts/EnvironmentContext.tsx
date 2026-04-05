import React, { createContext, useContext, useState } from 'react';

export type Environment = 'dev' | 'staging' | 'prod';

interface EnvironmentContextType {
  currentEnv: Environment;
  setEnv: (env: Environment) => void;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

const STORAGE_KEY = 'clarion-ops-env';

export const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentEnv, setCurrentEnv] = useState<Environment>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored as Environment) || 'prod';
  });

  const setEnv = (env: Environment) => {
    setCurrentEnv(env);
    localStorage.setItem(STORAGE_KEY, env);
  };

  return (
    <EnvironmentContext.Provider value={{ currentEnv, setEnv }}>
      {children}
    </EnvironmentContext.Provider>
  );
};

export const useEnvironment = () => {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error('useEnvironment must be used within an EnvironmentProvider');
  }
  return context;
};
