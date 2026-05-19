// frontend/src/pages/NotificationsPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';
import styles from './NotificationsPage.module.css';

const NotificationsPage = () => {
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    archiveNotification
  } = useNotifications();
  
  const [filter, setFilter] = useState('all'); // all, unread, read
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications(100); // Fetch more notifications
  }, [fetchNotifications]);

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    if (notification.related_object_url) {
      navigate(notification.related_object_url);
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.is_read;
    if (filter === 'read') return notification.is_read;
    return true;
  });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getIcon = (type) => {
    switch(type) {
      case 'order_placed': return '🛒';
      case 'order_paid': return '💰';
      case 'order_shipped': return '🚚';
      case 'order_delivered': return '✅';
      case 'product_created': return '📦';
      case 'product_approved': return '👍';
      case 'product_rejected': return '❌';
      case 'agent_commission': return '💵';
      case 'revenue_updated': return '📈';
      case 'account_approved': return '🎉';
      case 'account_suspended': return '⚠️';
      default: return '🔔';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Notifications</h1>
        {unreadCount > 0 && (
          <button 
            className={styles.markAllBtn}
            onClick={markAllAsRead}
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className={styles.filters}>
        <button
          className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`${styles.filterBtn} ${filter === 'unread' ? styles.active : ''}`}
          onClick={() => setFilter('unread')}
        >
          Unread ({unreadCount})
        </button>
        <button
          className={`${styles.filterBtn} ${filter === 'read' ? styles.active : ''}`}
          onClick={() => setFilter('read')}
        >
          Read
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading notifications...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🔔</div>
          <h3>No notifications</h3>
          <p>You don't have any notifications in this category</p>
        </div>
      ) : (
        <div className={styles.notificationList}>
          {filteredNotifications.map(notification => (
            <div
              key={notification.id}
              className={`${styles.notificationCard} ${!notification.is_read ? styles.unread : ''}`}
            >
              <div className={styles.notificationIcon}>
                {getIcon(notification.notification_type)}
              </div>
              <div className={styles.notificationContent}>
                <div className={styles.notificationHeader}>
                  <h3 className={styles.notificationTitle}>
                    {notification.title}
                  </h3>
                  <span className={styles.notificationTime}>
                    {formatDate(notification.created_at)}
                  </span>
                </div>
                <p className={styles.notificationMessage}>
                  {notification.message}
                </p>
                <div className={styles.notificationActions}>
                  {!notification.is_read && (
                    <button
                      className={styles.actionBtn}
                      onClick={() => markAsRead(notification.id)}
                    >
                      Mark as read
                    </button>
                  )}
                  <button
                    className={styles.actionBtn}
                    onClick={() => archiveNotification(notification.id)}
                  >
                    Archive
                  </button>
                  {notification.related_object_url && (
                    <button
                      className={styles.actionBtn}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      View details
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;