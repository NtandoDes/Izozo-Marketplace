import { createContext, useContext, useState } from "react";
import { login as loginApi, logout as logoutApi } from "../api/auth";
import { storeTokens, getRole } from "../utils/tokenStorage";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [role, setRole] = useState(getRole());
  const [loading, setLoading] = useState(false);

  async function login(credentials, remember) {
    setLoading(true);
    const data = await loginApi(credentials);

    storeTokens(
      { access: data.access, refresh: data.refresh, role: credentials.role },
      remember
    );

    setRole(credentials.role);
    setLoading(false);

    return credentials.role;
  }

  function logout() {
    logoutApi();
    setRole(null);
  }

  return (
    <AuthContext.Provider value={{ role, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuthContext() {
  return useContext(AuthContext);
}
