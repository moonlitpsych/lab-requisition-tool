// Auth Context - Simple auth context (expand as needed)

import React, { createContext, useContext, useState } from 'react';

interface AuthContextValue {
  user: any | null;
  login: (credentials: any) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  login: async () => {},
  logout: () => {},
  isAuthenticated: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);

  const login = async (credentials: any) => {
    // TODO: Implement actual authentication
    // For now, just set a mock user
    setUser({ name: 'MOONLIT Admin', email: 'admin@moonlit.com' });
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};