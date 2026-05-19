/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { customerService } from '../../services/customerService';
import styles from './CustomerDashboard.module.css';

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const { user, profile, refreshUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // State for all data
  const [customerData, setCustomerData] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [orders, setOrders] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  
  const [orderStats, setOrderStats] = useState({
    total_orders: 0,
    pending_orders: 0,
    processing_orders: 0,
    completed_orders: 0,
    cancelled_orders: 0,
    total_spent: 0,
    average_order_value: 0
  });

  const [recentActivity, setRecentActivity] = useState([]);

  // Initialize with data from AuthContext
  useEffect(() => {
    if (user) {
      console.log('AuthContext Customer data:', { user, profile });
      
      setCustomerData({
        id: user.id,
        fullName: user.full_name || '',
        email: user.email || '',
        phone: user.phone || '',
        status: user.status || 'active',
        createdAt: user.created_at || user.date_joined,
        avatar: user.avatar || null
      });
    }
  }, [user, profile]);

  // Fetch dashboard data
  useEffect(() => {
    if (user && user.role === 'customer') {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    setError(null);
    
    try {
      // Fetch all data in parallel
      const [
        ordersData,
        orderStatsData,
        wishlistData,
        recentlyViewedData
      ] = await Promise.all([
        customerService.getOrders({ limit: 100 }),
        customerService.getOrderStats(),
        customerService.getWishlist(),
        customerService.getRecentlyViewed()
      ]);
      
      console.log('✅ Orders loaded:', ordersData.length);
      console.log('✅ Order stats:', orderStatsData);
      console.log('✅ Wishlist loaded:', wishlistData.length);
      console.log('✅ Recently viewed loaded:', recentlyViewedData.length);
      
      setOrders(ordersData);
      setRecentOrders(ordersData.slice(0, 5));
      setWishlist(wishlistData);
      setRecentlyViewed(recentlyViewedData);

      setOrderStats({
        total_orders: orderStatsData.total_orders || ordersData.length,
        pending_orders: orderStatsData.pending_orders || ordersData.filter(o => o.status === 'pending').length,
        processing_orders: orderStatsData.processing_orders || ordersData.filter(o => o.status === 'processing').length,
        completed_orders: orderStatsData.completed_orders || ordersData.filter(o => o.status === 'delivered' || o.status === 'completed').length,
        cancelled_orders: orderStatsData.cancelled_orders || ordersData.filter(o => o.status === 'cancelled').length,
        total_spent: orderStatsData.total_spent || calculateTotalSpent(ordersData),
        average_order_value: orderStatsData.average_order_value || calculateAverageOrderValue(ordersData)
      });

      // Create recent activity feed
      createActivityFeed(ordersData);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      
      // Fallback to local calculations
      try {
        const ordersData = await customerService.getOrders({ limit: 100 });
        
        setOrders(ordersData);
        setRecentOrders(ordersData.slice(0, 5));
        
        setOrderStats({
          total_orders: ordersData.length,
          pending_orders: ordersData.filter(o => o.status === 'pending').length,
          processing_orders: ordersData.filter(o => o.status === 'processing').length,
          completed_orders: ordersData.filter(o => o.status === 'delivered' || o.status === 'completed').length,
          cancelled_orders: ordersData.filter(o => o.status === 'cancelled').length,
          total_spent: calculateTotalSpent(ordersData),
          average_order_value: calculateAverageOrderValue(ordersData)
        });

        createActivityFeed(ordersData);
        
      // eslint-disable-next-line no-unused-vars
      } catch (fallbackErr) {
        if (err.response?.status === 401) {
          localStorage.removeItem('izozo_tokens');
          navigate('/login');
          return;
        }
        
        setError({
          title: 'Failed to load dashboard',
          message: 'Please try refreshing the page or contact support.'
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateTotalSpent = (orders) => {
    return orders
      .filter(o => o.status === 'delivered' || o.status === 'completed' || o.status === 'paid')
      .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
  };

  const calculateAverageOrderValue = (orders) => {
    const completedOrders = orders.filter(o => o.status === 'delivered' || o.status === 'completed' || o.status === 'paid');
    if (completedOrders.length === 0) return 0;
    const total = completedOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
    return total / completedOrders.length;
  };

  const createActivityFeed = (orders) => {
    const activities = [];
    
    orders.slice(0, 10).forEach(order => {
      activities.push({
        id: `order-${order.id}`,
        type: 'order',
        title: `Order #${order.order_number}`,
        description: `Status: ${order.status}`,
        amount: order.total_amount,
        date: order.created_at,
        status: order.status,
        link: `/account/orders/${order.order_number}`
      });
    });

    // Sort by date (newest first)
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));
    setRecentActivity(activities.slice(0, 10));
  };

  const handleRefresh = () => {
    refreshUser();
    fetchDashboardData(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return 'Today';
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else {
        return date.toLocaleDateString('en-ZA', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
    } catch {
      return 'N/A';
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('en-ZA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return 'R0.00';
    return `R${parseFloat(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const getStatusClass = (status) => {
    const statusMap = {
      'pending': styles.statusPending,
      'processing': styles.statusProcessing,
      'paid': styles.statusPaid,
      'shipped': styles.statusShipped,
      'delivered': styles.statusDelivered,
      'completed': styles.statusCompleted,
      'cancelled': styles.statusCancelled
    };
    return statusMap[status] || '';
  };

  const getStatusDisplay = (status) => {
    const displayMap = {
      'pending': 'Pending',
      'processing': 'Processing',
      'paid': 'Paid',
      'shipped': 'Shipped',
      'delivered': 'Delivered',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    return displayMap[status] || status;
  };

  const getStatusIcon = (status) => {
    const iconMap = {
      'pending': '⏳',
      'processing': '⚙️',
      'paid': '💰',
      'shipped': '📦',
      'delivered': '✅',
      'completed': '🎉',
      'cancelled': '❌'
    };
    return iconMap[status] || '📋';
  };

  // Helper function to get product image from order item
  const getProductImage = (item) => {
    if (item.image) return item.image;
    if (item.product_image) return item.product_image;
    if (item.featured_image) return item.featured_image;
    return '/placeholder-product.jpg';
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  if (user?.role !== 'customer') {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>⚠️</div>
        <h2>Access Denied</h2>
        <p>This dashboard is only for customers.</p>
        <button onClick={() => navigate('/')} className={styles.primaryButton}>
          Go to Home
        </button>
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      {/* Header */}
      <div className={styles.dashboardHeader}>
        <div className={styles.headerLeft}>
          <div>
            <h1>My Dashboard</h1>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{customerData?.fullName}</span>
              <span className={styles.userEmail}>{customerData?.email}</span>
            </div>
          </div>
          {refreshing && <span className={styles.refreshing}>Refreshing...</span>}
        </div>
        <div className={styles.headerActions}>
          <Link to="/products" className={styles.primaryButton}>
            + Shop Now
          </Link>
          <button onClick={handleRefresh} className={styles.refreshButton} title="Refresh">
            🔄
          </button>
        </div>
      </div>

      {/* Welcome Banner */}
      <div className={styles.welcomeBanner}>
        <div className={styles.welcomeContent}>
          <h2>Welcome back, {customerData?.fullName?.split(' ')[0] || 'Valued Customer'}!</h2>
          <p>Ready to discover amazing products from local businesses?</p>
        </div>
        <Link to="/products" className={styles.shopNowButton}>
          Shop Now →
        </Link>
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}>
            📦
          </div>
          <div className={styles.statContent}>
            <h3>{orderStats.total_orders}</h3>
            <p>Total Orders</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(33, 150, 243, 0.1)' }}>
            ⏳
          </div>
          <div className={styles.statContent}>
            <h3>{orderStats.pending_orders + orderStats.processing_orders}</h3>
            <p>Active Orders</p>
            <small className={styles.statDetail}>
              {orderStats.pending_orders} pending • {orderStats.processing_orders} processing
            </small>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(255, 152, 0, 0.1)' }}>
            ✅
          </div>
          <div className={styles.statContent}>
            <h3>{orderStats.completed_orders}</h3>
            <p>Completed Orders</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(156, 39, 176, 0.1)' }}>
            💰
          </div>
          <div className={styles.statContent}>
            <h3>{formatCurrency(orderStats.total_spent)}</h3>
            <p>Total Spent</p>
            <small className={styles.statDetail}>
              Avg: {formatCurrency(orderStats.average_order_value)}
            </small>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className={styles.contentGrid}>
        {/* Recent Orders Section */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2>Recent Orders</h2>
            {orders.length > 0 && (
              <Link to="/account/orders" className={styles.viewAllLink}>
                View All Orders →
              </Link>
            )}
          </div>
          
          {recentOrders.length > 0 ? (
            <div className={styles.ordersList}>
              {recentOrders.map(order => (
                <Link 
                  key={order.id} 
                  to={`/account/orders/${order.order_number}`}
                  className={styles.orderItem}
                >
                  <div className={styles.orderHeader}>
                    <span className={styles.orderNumber}>#{order.order_number}</span>
                    <span className={`${styles.orderStatus} ${getStatusClass(order.status)}`}>
                      {getStatusIcon(order.status)} {getStatusDisplay(order.status)}
                    </span>
                  </div>
                  
                  <div className={styles.orderDetails}>
                    <div className={styles.orderInfo}>
                      <span className={styles.orderDate}>
                        {formatDateTime(order.created_at)}
                      </span>
                      <span className={styles.orderItems}>
                        {order.item_count || order.items?.length || 0} items
                      </span>
                    </div>
                    <span className={styles.orderTotal}>
                      {formatCurrency(order.total_amount)}
                    </span>
                  </div>

                  {/* Product Images Section */}
                  {order.items && order.items.length > 0 && (
                    <div className={styles.orderProducts}>
                      {order.items.slice(0, 4).map((item, idx) => (
                        <div key={idx} className={styles.orderProduct}>
                          <img 
                            src={getProductImage(item)} 
                            alt={item.product_name || 'Product'}
                            className={styles.productImage}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = '/placeholder-product.jpg';
                            }}
                          />
                          {idx === 3 && order.items.length > 4 && (
                            <div className={styles.productImageOverlay}>
                              +{order.items.length - 4}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Order Summary */}
                  <div className={styles.orderSummary}>
                    <div className={styles.orderSummaryRow}>
                      <span>Subtotal:</span>
                      <span>{formatCurrency(order.subtotal)}</span>
                    </div>
                    {order.shipping_amount > 0 && (
                      <div className={styles.orderSummaryRow}>
                        <span>Shipping:</span>
                        <span>{formatCurrency(order.shipping_amount)}</span>
                      </div>
                    )}
                    <div className={`${styles.orderSummaryRow} ${styles.orderSummaryTotal}`}>
                      <span>Total:</span>
                      <span>{formatCurrency(order.total_amount)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🛒</div>
              <h3>No orders yet</h3>
              <p>Start shopping to see your orders here!</p>
              <Link to="/products" className={styles.emptyStateButton}>
                Browse Products
              </Link>
            </div>
          )}
        </div>

        {/* Wishlist Section */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2>My Wishlist</h2>
            {wishlist.length > 0 && (
              <Link to="/wishlist" className={styles.viewAllLink}>
                View All →
              </Link>
            )}
          </div>
          
          {wishlist.length > 0 ? (
            <div className={styles.wishlistGrid}>
              {wishlist.slice(0, 4).map(item => (
                <Link 
                  key={item.id} 
                  to={`/product/${item.slug || item.id}`}
                  className={styles.wishlistItem}
                >
                  <div className={styles.wishlistImage}>
                    <img 
                      src={item.image || '/placeholder-product.jpg'} 
                      alt={item.name}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/placeholder-product.jpg';
                      }}
                    />
                  </div>
                  <div className={styles.wishlistInfo}>
                    <h4>{item.name}</h4>
                    <p className={styles.wishlistPrice}>{formatCurrency(item.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>❤️</div>
              <h3>Your wishlist is empty</h3>
              <p>Save items you love to your wishlist!</p>
              <Link to="/products" className={styles.emptyStateButton}>
                Explore Products
              </Link>
            </div>
          )}
        </div>

        {/* Recently Viewed Section */}
        {recentlyViewed.length > 0 && (
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2>Recently Viewed</h2>
              <Link to="/recently-viewed" className={styles.viewAllLink}>
                View All →
              </Link>
            </div>
            
            <div className={styles.recentlyViewedGrid}>
              {recentlyViewed.slice(0, 4).map(item => (
                <Link 
                  key={item.id} 
                  to={`/product/${item.slug || item.id}`}
                  className={styles.recentItem}
                >
                  <div className={styles.recentImage}>
                    <img 
                      src={item.image || '/placeholder-product.jpg'} 
                      alt={item.name}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/placeholder-product.jpg';
                      }}
                    />
                  </div>
                  <div className={styles.recentInfo}>
                    <h4>{item.name}</h4>
                    <p className={styles.recentPrice}>{formatCurrency(item.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity Feed */}
        {recentActivity.length > 0 && (
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2>Recent Activity</h2>
            </div>
            
            <div className={styles.activityFeed}>
              {recentActivity.map(activity => (
                <Link 
                  key={activity.id} 
                  to={activity.link}
                  className={styles.activityItem}
                >
                  <div className={styles.activityIcon}>
                    {activity.type === 'order' ? '📦' : '❤️'}
                  </div>
                  <div className={styles.activityContent}>
                    <div className={styles.activityTitle}>{activity.title}</div>
                    <div className={styles.activityDescription}>
                      {activity.description}
                      {activity.amount && ` • ${formatCurrency(activity.amount)}`}
                    </div>
                    <span className={styles.activityTime}>
                      {formatDate(activity.date)}
                    </span>
                  </div>
                  <span className={`${styles.activityStatus} ${getStatusClass(activity.status)}`}>
                    {getStatusDisplay(activity.status)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2>Quick Actions</h2>
          </div>
          
          <div className={styles.quickActions}>
            <Link to="/products" className={styles.quickAction}>
              <span className={styles.quickActionIcon}>🛍️</span>
              <span className={styles.quickActionText}>Shop Now</span>
            </Link>
            
            <Link to="/account/profile" className={styles.quickAction}>
              <span className={styles.quickActionIcon}>👤</span>
              <span className={styles.quickActionText}>My Profile</span>
            </Link>
            
            <Link to="/account/addresses" className={styles.quickAction}>
              <span className={styles.quickActionIcon}>📍</span>
              <span className={styles.quickActionText}>Addresses</span>
            </Link>
            
            <Link to="/account/payment-methods" className={styles.quickAction}>
              <span className={styles.quickActionIcon}>💳</span>
              <span className={styles.quickActionText}>Payment Methods</span>
            </Link>
            
            <Link to="/wishlist" className={styles.quickAction}>
              <span className={styles.quickActionIcon}>❤️</span>
              <span className={styles.quickActionText}>Wishlist</span>
            </Link>
            
            <Link to="/support" className={styles.quickAction}>
              <span className={styles.quickActionIcon}>💬</span>
              <span className={styles.quickActionText}>Support</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;