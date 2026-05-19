/* eslint-disable react-hooks/rules-of-hooks */
// frontend/src/components/NotificationIcon.jsx
import React, { useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import styles from './NotificationIcon.module.css';

const NotificationIcon = () => {
  let notificationsContext;
  try {
    notificationsContext = useNotifications();
  } catch (error) {
    console.error('NotificationIcon: Not wrapped in NotificationProvider', error);
    return null;
  }
  
  const {
    notifications,
    unreadCount,
    loading,
    showDropdown,
    toggleDropdown,
    closeDropdown,
    markAsRead,
    markAllAsRead
  } = notificationsContext;
  
  const { user } = useAuth();
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeDropdown]);

  // Helper function to get role-based URL (fallback in case context doesn't handle it)
  const getRoleBasedUrl = (url) => {
    if (!url || !user?.role) return url;
    
    // If it's an order URL and user is customer, redirect to account orders
    if (url.includes('/orders/') && user.role === 'customer') {
      const orderNumber = url.split('/orders/')[1]?.split('/')[0];
      if (orderNumber) {
        return `/account/orders/${orderNumber}`;
      }
    }
    
    return url;
  };

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    // Get role-based URL (the context should have already transformed it)
    const targetUrl = notification.related_object_url || getRoleBasedUrl(notification.related_object_url);
    
    if (targetUrl) {
      navigate(targetUrl);
    }
    
    closeDropdown();
  };

  const handleViewAll = () => {
    navigate('/notifications');
    closeDropdown();
  };

  const formatTime = (timeAgo) => {
    if (!timeAgo) return '';
    return timeAgo
      .replace('minutes', 'min')
      .replace('minute', 'min')
      .replace('hours', 'h')
      .replace('hour', 'h')
      .replace('days', 'd')
      .replace('day', 'd');
  };

  const getNotificationIcon = (type) => {
    switch(type) {
      case 'order_placed':
      case 'order_paid':
      case 'order_shipped':
      case 'order_delivered':
        return '🛒';
      case 'product_created':
      case 'product_approved':
      case 'product_rejected':
        return '📦';
      case 'agent_commission':
        return '💰';
      case 'revenue_updated':
        return '📊';
      case 'account_approved':
        return '✅';
      case 'account_suspended':
        return '⚠️';
      default:
        return '🔔';
    }
  };

  return (
    <div className={styles.notificationContainer} ref={dropdownRef}>
      <button 
        className={styles.notificationButton}
        onClick={toggleDropdown}
        aria-label="Notifications"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="20" 
          height="20" 
          fill="currentColor" 
          viewBox="0 0 16 16"
        >
          <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zM8 1.918l-.797.161A4.002 4.002 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4.002 4.002 0 0 0-3.203-3.92L8 1.917zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5.002 5.002 0 0 1 13 6c0 .88.32 4.2 1.22 6z"/>
        </svg>
        {unreadCount > 0 && (
          <span className={styles.notificationBadge}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className={styles.notificationDropdown}>
          <div className={styles.notificationHeader}>
            <h3 className={styles.notificationTitle}>Notifications</h3>
            {unreadCount > 0 && (
              <button 
                className={styles.markAllReadBtn}
                onClick={markAllAsRead}
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className={styles.notificationList}>
            {loading ? (
              <div className={styles.loadingState}>
                <div className={styles.spinner}></div>
                <p>Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🔔</div>
                <p className={styles.emptyText}>No notifications yet</p>
              </div>
            ) : (
              notifications.slice(0, 10).map(notification => (
                <div
                  key={notification.id}
                  className={`${styles.notificationItem} ${!notification.is_read ? styles.unread : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className={styles.notificationIcon}>
                    {getNotificationIcon(notification.notification_type)}
                  </div>
                  <div className={styles.notificationContent}>
                    <div className={styles.notificationTitle}>
                      {notification.title}
                    </div>
                    <div className={styles.notificationMessage}>
                      {notification.message}
                    </div>
                    <div className={styles.notificationTime}>
                      {formatTime(notification.time_ago)} ago
                    </div>
                  </div>
                  {!notification.is_read && (
                    <div className={styles.unreadDot}></div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className={styles.notificationFooter}>
            <button 
              className={styles.viewAllBtn}
              onClick={handleViewAll}
            >
              View All Notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationIcon;