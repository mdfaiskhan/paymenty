import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);
const TOKEN_KEY = "paymenty_token";
const ADMIN_KEY = "paymenty_admin";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY));
  const [admin, setAdmin] = useState(() => {
    const raw = localStorage.getItem(ADMIN_KEY);
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [token]);

  useEffect(() => {
    if (admin) {
      localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
    } else {
      localStorage.removeItem(ADMIN_KEY);
    }
  }, [admin]);

  const value = useMemo(
    () => ({
      token,
      admin,
      login: (authToken, adminPayload) => {
        setToken(authToken);
        setAdmin(adminPayload);
      },
      logout: () => {
        setToken(null);
        setAdmin(null);
      }
    }),
    [token, admin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
