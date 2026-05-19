/* eslint-disable no-unused-vars */
/* eslint-disable react-refresh/only-export-components */
// frontend/src/contexts/AuthContext.jsx
import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import axios from "axios";

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

const axiosInstance = axios.create({
  baseURL: "https://izozo.izozo.co.za/api",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: false,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState(() => {
    const storedTokens = localStorage.getItem("izozo_tokens");
    return storedTokens ? JSON.parse(storedTokens) : null;
  });

  // Initialize axios interceptors
  useEffect(() => {
    const requestInterceptor = axiosInstance.interceptors.request.use(
      (config) => {
        if (tokens?.access) {
          config.headers.Authorization = `Bearer ${tokens.access}`;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    const responseInterceptor = axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (
          originalRequest.url.includes("/api/auth/login/") ||
          originalRequest.url.includes("/api/auth/register/") ||
          originalRequest._retry
        ) {
          return Promise.reject(error);
        }

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = tokens?.refresh;
            if (!refreshToken) {
              logout();
              return Promise.reject(error);
            }

            const response = await axiosInstance.post("/auth/refresh/", {
              refresh: refreshToken,
            });

            const newTokens = {
              access: response.data.access,
              refresh: refreshToken,
            };

            setTokens(newTokens);
            localStorage.setItem("izozo_tokens", JSON.stringify(newTokens));

            originalRequest.headers.Authorization = `Bearer ${response.data.access}`;
            return axiosInstance(originalRequest);
          } catch (refreshError) {
            console.error("Token refresh failed:", refreshError);
            logout();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      },
    );

    return () => {
      axiosInstance.interceptors.request.eject(requestInterceptor);
      axiosInstance.interceptors.response.eject(responseInterceptor);
    };
  }, [tokens]);

  // Check if user is logged in on mount
  useEffect(() => {
    const initializeAuth = async () => {
      if (tokens?.access) {
        try {
          const userResponse = await axiosInstance.get("/auth/me/");
          setUser(userResponse.data);

          const role = userResponse.data.role;
          let profileResponse;

          try {
            switch (role) {
              case "sme":
                profileResponse = await axiosInstance.get("/sme/profile/");
                break;
              case "agent":
                profileResponse = await axiosInstance.get("/agent/profile/");
                break;
              case "delivery":
                profileResponse = await axiosInstance.get("/delivery/profile/");
                break;
              case "admin":
                profileResponse = { data: null };
                break;
              default:
                profileResponse = { data: null };
            }

            if (profileResponse?.data) {
              setProfile(profileResponse.data);
            }
          } catch (profileError) {
            console.error("Failed to fetch profile:", profileError);
          }
        } catch (error) {
          console.error("Failed to fetch user data:", error);
          if (error.response?.status === 401) {
            logout();
          }
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, [tokens]);

  const login = async (email, password) => {
    try {
      const response = await axiosInstance.post("/auth/login/", {
        email,
        password,
      });

      const {
        tokens: authTokens,
        user: userData,
        profile: profileData,
        profile_type,
      } = response.data;

      setTokens(authTokens);
      setUser(userData);
      setProfile(profileData);
      localStorage.setItem("izozo_tokens", JSON.stringify(authTokens));

      let redirectPath = "/";
      const PARTNER_ROLES = ["sme", "agent", "delivery"];
      if (PARTNER_ROLES.includes(profile_type) && userData.status === "pending") {
        redirectPath = "/pending";
      } else if (profile_type === "admin") {
        redirectPath = "/admin";
      } else if (profile_type === "sme") {
        redirectPath = "/sme-dashboard";
      } else if (profile_type === "agent") {
        redirectPath = "/agent-dashboard";
      } else if (profile_type === "delivery") {
        redirectPath = "/delivery-dashboard";
      } else if (profile_type === "customer") {
        redirectPath = "/";
      }

      return {
        success: true,
        data: response.data,
        redirectPath,
      };
    } catch (error) {
      console.error("Login error:", error);

      let errorMessage = "Login failed. Please check your credentials.";

      if (error.response?.data) {
        if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.non_field_errors) {
          errorMessage = error.response.data.non_field_errors[0];
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      } else if (error.code === "ERR_NETWORK") {
        errorMessage = "Network error. Please check if the server is running.";
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const register = async (userData) => {
    try {
      let endpoint = "";
      let payload = {};

      console.log("📝 AuthContext.register called with:", userData);

      switch (userData.role) {
        case "admin":
          endpoint = "/auth/register/admin/";
          payload = {
            email: userData.email,
            password: userData.password,
            full_name: userData.full_name,
            phone: userData.phone,
            admin_secret_key: userData.admin_secret_key,
            source: userData.source || "admin_registration",
          };
          break;
        case "sme":
          endpoint = "/auth/register/sme/";
          payload = {
            email: userData.email,
            password: userData.password,
            full_name: userData.full_name,
            phone: userData.phone,
            business_name: userData.business_name,
            owner_name: userData.owner_name,
            business_type: userData.business_type || "",
            business_address: userData.business_address || "",
            address: userData.address,
            source: userData.source || "",  // ✅ Source field included
          };
          break;

        case "agent":
          endpoint = "/auth/register/agent/";
          payload = {
            email: userData.email,
            password: userData.password,
            full_name: userData.full_name,
            phone: userData.phone,
            home_address: userData.home_address,
            has_internet: userData.has_internet || false,
            has_smartphone: userData.has_smartphone || false,
            source: userData.source || "",  // ✅ Source field included
          };
          break;

        case "delivery":
          endpoint = "/auth/register/delivery/";
          payload = {
            email: userData.email,
            password: userData.password,
            full_name: userData.full_name,
            phone: userData.phone,
            home_address: userData.home_address,
            vehicle_type: userData.vehicle_type || "",
            has_internet: userData.has_internet || false,
            has_smartphone: userData.has_smartphone || false,
            source: userData.source || "",  // ✅ Source field included
          };
          break;

        default:
          endpoint = "/auth/register/customer/";
          payload = {
            email: userData.email,
            password: userData.password,
            full_name: userData.full_name,
            phone: userData.phone,
            source: userData.source || "",
          };
      }

      console.log(`📤 Sending registration to ${endpoint}`);
      console.log("📦 Payload:", JSON.stringify(payload, null, 2));

      const response = await axiosInstance.post(endpoint, payload);

      console.log("✅ Registration response:", response.data);

      if (response.data.tokens) {
        const {
          tokens: authTokens,
          user: userData,
          profile: profileData,
        } = response.data;
        setTokens(authTokens);
        setUser(userData);
        setProfile(profileData);
        localStorage.setItem("izozo_tokens", JSON.stringify(authTokens));
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error("❌ Registration error:", error);
      console.error("Error response:", error.response?.data);

      let errorMessage = "Registration failed";
      if (error.response?.data) {
        if (error.response.data.email) {
          errorMessage = `Email: ${Array.isArray(error.response.data.email) ? error.response.data.email[0] : error.response.data.email}`;
        } else if (error.response.data.phone) {
          errorMessage = `Phone: ${Array.isArray(error.response.data.phone) ? error.response.data.phone[0] : error.response.data.phone}`;
        } else if (error.response.data.password) {
          errorMessage = `Password: ${Array.isArray(error.response.data.password) ? error.response.data.password[0] : error.response.data.password}`;
        } else if (error.response.data.admin_secret_key) {
          errorMessage = `Admin Key: ${Array.isArray(error.response.data.admin_secret_key) ? error.response.data.admin_secret_key[0] : error.response.data.admin_secret_key}`;
        } else if (error.response.data.source) {
          errorMessage = `Source: ${Array.isArray(error.response.data.source) ? error.response.data.source[0] : error.response.data.source}`;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.errors) {
          errorMessage = Object.values(error.response.data.errors)
            .flat()
            .join(", ");
        }
      }

      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      if (tokens?.refresh) {
        await axiosInstance.post("/auth/logout/", {
          refresh_token: tokens.refresh,
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setTokens(null);
      setUser(null);
      setProfile(null);
      localStorage.removeItem("izozo_tokens");
    }
  };

  // Update user profile function
  const updateUserProfile = async (profileData) => {
    try {
      if (!user?.role) {
        throw new Error("User role not found");
      }

      console.log("📝 Updating profile with data:", profileData);

      let endpoint;
      switch (user.role) {
        case "sme":
          endpoint = "/sme/profile/";
          break;
        case "agent":
          endpoint = "/agent/profile/";
          break;
        case "delivery":
          endpoint = "/delivery/profile/";
          break;
        case "admin":
          return {
            success: false,
            error: "Admin profiles cannot be updated via this endpoint",
          };
        case "customer":
          endpoint = "/customer/profile/";
          break;
        default:
          endpoint = "/auth/me/";
      }

      console.log(`📡 Sending ${user.role} profile update to ${endpoint}`);

      let response;
      
      if (user.role === "customer") {
        const customerData = {
          full_name: profileData.full_name,
          phone: profileData.phone,
        };
        response = await axiosInstance.patch(endpoint, customerData);
      } else {
        response = await axiosInstance.put(endpoint, profileData);
      }
      
      console.log("✅ Profile update response:", response.data);

      if (response.data) {
        if (user.role === "customer") {
          setUser((prev) => ({
            ...prev,
            full_name: profileData.full_name || prev.full_name,
            phone: profileData.phone || prev.phone,
          }));
        } else {
          if (response.data.user) {
            setUser(response.data.user);
          }
          setProfile(response.data);
        }
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error("❌ Profile update error:", error);

      let errorMessage = "Update failed";
      if (error.response?.data) {
        console.error("Server error details:", error.response.data);
        if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (typeof error.response.data === "object") {
          const errors = Object.entries(error.response.data)
            .map(
              ([field, msgs]) =>
                `${field}: ${Array.isArray(msgs) ? msgs.join(", ") : msgs}`,
            )
            .join("; ");
          if (errors) errorMessage = errors;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const refreshUser = async () => {
    try {
      if (tokens?.access && user) {
        console.log("🔄 Refreshing user data...");
        const userResponse = await axiosInstance.get("/auth/me/");
        setUser(userResponse.data);

        if (user.role && user.role !== "customer" && user.role !== "admin") {
          try {
            let profileEndpoint;
            switch (user.role) {
              case "sme":
                profileEndpoint = "/sme/profile/";
                break;
              case "agent":
                profileEndpoint = "/agent/profile/";
                break;
              case "delivery":
                profileEndpoint = "/delivery/profile/";
                break;
            }

            if (profileEndpoint) {
              const profileResponse = await axiosInstance.get(profileEndpoint);
              console.log("✅ Profile refreshed:", profileResponse.data);
              setProfile(profileResponse.data);
            }
          } catch (profileError) {
            console.error("Failed to refresh profile:", profileError);
          }
        }
      }
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  };

  const getProfileData = () => {
    if (profile) {
      return {
        ...profile,
        role: user?.role,
        email: user?.email,
        full_name: user?.full_name,
        phone: user?.phone,
      };
    }
    return user;
  };

  const getDashboardPath = () => {
    if (!user?.role) return "/";

    const PARTNER_ROLES = ["sme", "agent", "delivery"];
    if (PARTNER_ROLES.includes(user.role) && user.status === "pending") {
      return "/pending";
    }

    switch (user.role) {
      case "admin":
        return "/admin";
      case "sme":
        return "/sme-dashboard";
      case "agent":
        return "/agent-dashboard";
      case "delivery":
        return "/delivery-dashboard";
      case "customer":
        return "/";
      default:
        return "/";
    }
  };

  const value = {
    user,
    profile,
    tokens,
    loading,
    login,
    register,
    logout,
    updateUserProfile,
    refreshUser,
    getProfileData,
    getDashboardPath,
    axiosInstance,
    isAuthenticated: !!tokens?.access,
    isAdmin: user?.role === "admin",
    isSME: user?.role === "sme",
    isAgent: user?.role === "agent",
    isDelivery: user?.role === "delivery",
    isCustomer: user?.role === "customer" || !user?.role,
    hasProfile: !!profile && user?.role !== "admin" && user?.role !== "customer",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export { axiosInstance };