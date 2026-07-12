import { createContext, useContext, useState, useEffect } from "react";
import { api } from "../lib/api";

interface User {
  id: number;
  email: string;
  role: string;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      localStorage.setItem("token", token);
      if (user) localStorage.setItem("user", JSON.stringify(user));
    } else {
      delete api.defaults.headers.common["Authorization"];
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  }, [token, user]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
