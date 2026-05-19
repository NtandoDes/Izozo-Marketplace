import axios from 'axios';

// eslint-disable-next-line no-undef
const API_URL = 'https://izozo.izozo.co.za/api';

// Create axios instance with auth header
const getAuthHeader = () => {
  const tokens = localStorage.getItem('izozo_tokens');
  if (tokens) {
    const { access } = JSON.parse(tokens);
    return { Authorization: `Bearer ${access}` };
  }
  return {};
};

const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to add auth token
axiosInstance.interceptors.request.use(
  (config) => {
    const authHeader = getAuthHeader();
    if (authHeader.Authorization) {
      config.headers.Authorization = authHeader.Authorization;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Admin Dashboard Services
export const adminService = {
  // Dashboard Stats
  getDashboardStats: async (days = 30) => {
    try {
      const response = await axiosInstance.get(`/admin/dashboard/stats/?days=${days}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // User Management
  getUsers: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.role) params.append('role', filters.role);
      if (filters.status) params.append('status', filters.status);
      
      const response = await axiosInstance.get(`/admin/users/?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  updateUserStatus: async (userId, status) => {
    try {
      const response = await axiosInstance.patch(`/admin/users/${userId}/`, { status });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  deleteUser: async (userId) => {
    try {
      await axiosInstance.delete(`/admin/users/${userId}/`);
      return { success: true };
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  bulkUserAction: async (action, userIds) => {
    try {
      const response = await axiosInstance.post('/admin/users/bulk-action/', {
        action,
        user_ids: userIds
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Profile Management
  getSMEs: async () => {
    try {
      const response = await axiosInstance.get('/admin/profiles/sme/');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  getAgents: async () => {
    try {
      const response = await axiosInstance.get('/admin/profiles/agent/');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  getDelivery: async () => {
    try {
      const response = await axiosInstance.get('/admin/profiles/delivery/');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Assignment Management
  getAssignments: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.agent_id) params.append('agent_id', filters.agent_id);
      if (filters.sme_id) params.append('sme_id', filters.sme_id);
      if (filters.active !== undefined) params.append('active', filters.active);
      
      const response = await axiosInstance.get(`/admin/assignments/?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  createAssignment: async (assignmentData) => {
    try {
      const response = await axiosInstance.post('/admin/assignments/', assignmentData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  updateAssignment: async (assignmentId, data) => {
    try {
      const response = await axiosInstance.patch(`/admin/assignments/${assignmentId}/`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  deleteAssignment: async (assignmentId) => {
    try {
      await axiosInstance.delete(`/admin/assignments/${assignmentId}/`);
      return { success: true };
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Logs
  getRegistrationLogs: async () => {
    try {
      const response = await axiosInstance.get('/admin/logs/registrations/');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  getActionLogs: async () => {
    try {
      const response = await axiosInstance.get('/admin/logs/actions/');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // System Settings
  getSettings: async (publicOnly = false) => {
    try {
      const response = await axiosInstance.get(`/admin/settings/?public_only=${publicOnly}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  updateSetting: async (key, data) => {
    try {
      const response = await axiosInstance.post('/admin/settings/', {
        key,
        ...data
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  deleteSetting: async (key) => {
    try {
      await axiosInstance.delete(`/admin/settings/${key}/`);
      return { success: true };
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Notifications
  getNotifications: async () => {
    try {
      const response = await axiosInstance.get('/admin/notifications/');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  markNotificationRead: async (notificationId) => {
    try {
      const response = await axiosInstance.post(`/admin/notifications/${notificationId}/mark_as_read/`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  markAllNotificationsRead: async () => {
    try {
      const response = await axiosInstance.post('/admin/notifications/mark_all_as_read/');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  getUnreadCount: async () => {
    try {
      const response = await axiosInstance.get('/admin/notifications/unread_count/');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
};

export default adminService;