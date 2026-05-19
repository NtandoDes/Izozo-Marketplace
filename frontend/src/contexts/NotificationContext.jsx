// frontend/src/contexts/NotificationContext.jsx
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

// Create context
const NotificationContext = createContext();

// Custom hook to use the notification context
// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    console.error('useNotifications must be used within a NotificationProvider');
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Provider component
export const NotificationProvider = ({ children }) => {
  console.log('NotificationProvider rendering');
  
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const { user, isAuthenticated } = useAuth();

  // Helper function to get role-based URL
  // eslint-disable-next-line no-unused-vars
  const getRoleBasedUrl = (relatedObjectUrl, notification) => {
    if (!relatedObjectUrl || !user?.role) return relatedObjectUrl;
    
    // Check if it's an order URL
    if (relatedObjectUrl.includes('/orders/')) {
      // Extract the order number from the URL
      const orderNumber = relatedObjectUrl.split('/orders/')[1]?.split('/')[0];
      
      if (!orderNumber) return relatedObjectUrl;
      
      // If user is customer, redirect to account orders
      if (user.role === 'customer') {
        return `/account/orders/${orderNumber}`;
      }
      
      // If user is agent, redirect to agent orders
      if (user.role === 'agent') {
        return `/agent/orders/${orderNumber}`;
      }
      
      // If user is sme, redirect to sme orders
      if (user.role === 'sme') {
        return `/sme/orders/${orderNumber}`;
      }
      
      // If user is delivery, redirect to delivery orders
      if (user.role === 'delivery') {
        return `/delivery/orders/${orderNumber}`;
      }
    }
    
    // Check if it's a product URL
    if (relatedObjectUrl.includes('/products/')) {
      const productSlug = relatedObjectUrl.split('/products/')[1]?.split('/')[0];
      if (productSlug) {
        return `/product/${productSlug}`;
      }
    }
    
    return relatedObjectUrl;
  };

  // Fetch notifications
  const fetchNotifications = useCallback(async (limit = 20) => {
    if (!isAuthenticated || !user) {
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.get(`/notifications/?limit=${limit}`);
      
      // Enhance notifications with role-based URLs
      const enhancedNotifications = (response.data.notifications || []).map(notification => ({
        ...notification,
        related_object_url: getRoleBasedUrl(notification.related_object_url, notification)
      }));
      
      setNotifications(enhancedNotifications);
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      // Only log errors that aren't 401 (unauthorized)
      if (error.response?.status !== 401) {
        console.error('Error fetching notifications:', error);
      }
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [user, isAuthenticated]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setUnreadCount(0);
      return;
    }
    
    try {
      const response = await api.get('/notifications/unread-count/');
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      // Only log errors that aren't 401
      if (error.response?.status !== 401) {
        console.error('Error fetching unread count:', error);
      }
      setUnreadCount(0);
    }
  }, [user, isAuthenticated]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    if (!isAuthenticated) return;
    
    try {
      await api.patch(`/notifications/${notificationId}/`, { is_read: true });
      
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [isAuthenticated]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      await api.post('/notifications/mark-read/', { mark_all: true });
      
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [isAuthenticated]);

  // Mark multiple as read
  const markMultipleAsRead = useCallback(async (notificationIds) => {
    if (!isAuthenticated || !notificationIds.length) return;
    
    try {
      await api.post('/notifications/mark-read/', { 
        notification_ids: notificationIds 
      });
      
      setNotifications(prev => 
        prev.map(n => 
          notificationIds.includes(n.id) ? { ...n, is_read: true } : n
        )
      );
      
      setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  }, [isAuthenticated]);

  // Archive notification
  const archiveNotification = useCallback(async (notificationId) => {
    if (!isAuthenticated) return;
    
    try {
      await api.delete(`/notifications/${notificationId}/`);
      
      // Remove from local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      // Update unread count if it was unread
      const notification = notifications.find(n => n.id === notificationId);
      if (notification && !notification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error archiving notification:', error);
    }
  }, [isAuthenticated, notifications]);

  // Toggle dropdown
  const toggleDropdown = useCallback(() => {
    setShowDropdown(prev => !prev);
  }, []);

  // Close dropdown
  const closeDropdown = useCallback(() => {
    setShowDropdown(false);
  }, []);

  // Poll for new notifications only when authenticated
  useEffect(() => {
    console.log('Notification effect running, isAuthenticated:', isAuthenticated);
    
    if (!isAuthenticated || !user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    
    fetchUnreadCount();
    
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000); // Poll every 30 seconds
    
    return () => clearInterval(interval);
  }, [user, isAuthenticated, fetchUnreadCount]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (showDropdown && isAuthenticated && user) {
      fetchNotifications();
    }
  }, [showDropdown, user, isAuthenticated, fetchNotifications]);

  const value = {
    notifications,
    unreadCount,
    loading,
    showDropdown,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    markMultipleAsRead,
    archiveNotification,
    toggleDropdown,
    closeDropdown,
    setShowDropdown
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// Also export the context if needed elsewhere
export default NotificationContext;