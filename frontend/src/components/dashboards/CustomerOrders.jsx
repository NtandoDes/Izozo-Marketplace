/* eslint-disable no-unused-vars */
// frontend/src/components/dashboards/CustomerOrders.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { customerService } from '../../services/customerService';
import styles from './CustomerOrders.module.css';

const CustomerOrders = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // State for orders data
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [orderStats, setOrderStats] = useState({
    total_orders: 0,
    pending_orders: 0,
    processing_orders: 0,
    paid_orders: 0,
    shipped_orders: 0,
    delivered_orders: 0,
    completed_orders: 0,
    cancelled_orders: 0,
    total_spent: 0,
    average_order_value: 0
  });

  // Filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage] = useState(10);

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/account/orders' } });
    }
  }, [isAuthenticated, navigate]);

  // Fetch orders on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
    }
  }, [isAuthenticated]);

  // Apply filters when they change
  useEffect(() => {
    applyFilters();
  }, [orders, statusFilter, dateFilter, searchQuery, sortBy]);

  const fetchOrders = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    setError(null);
    
    try {
      console.log('Fetching orders data...');
      
      const [ordersData, statsData] = await Promise.all([
        customerService.getOrders({ limit: 1000 }),
        customerService.getOrderStats()
      ]);
      
      console.log('Orders data received:', ordersData);
      console.log('Stats data received:', statsData);
      
      setOrders(ordersData);
      
      // Calculate stats manually to ensure accuracy
      const calculatedStats = {
        total_orders: ordersData.length,
        pending_orders: ordersData.filter(o => o.status === 'pending').length,
        processing_orders: ordersData.filter(o => o.status === 'processing').length,
        paid_orders: ordersData.filter(o => o.status === 'paid').length,
        shipped_orders: ordersData.filter(o => o.status === 'shipped').length,
        delivered_orders: ordersData.filter(o => o.status === 'delivered').length,
        completed_orders: ordersData.filter(o => o.status === 'completed').length,
        cancelled_orders: ordersData.filter(o => o.status === 'cancelled').length,
        total_spent: calculateTotalSpent(ordersData),
        average_order_value: calculateAverageOrderValue(ordersData)
      };
      
      console.log('Calculated stats:', calculatedStats);
      setOrderStats(calculatedStats);

    } catch (err) {
      console.error('Error fetching orders:', err);
      setError({
        title: 'Failed to load orders',
        message: err.message || 'Please try refreshing the page.'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateTotalSpent = (orders) => {
    // Only count completed and delivered orders as spent
    return orders
      .filter(o => ['completed', 'delivered'].includes(o.status))
      .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
  };

  const calculateAverageOrderValue = (orders) => {
    // Only count completed and delivered orders for average
    const completedOrders = orders.filter(o => ['completed', 'delivered'].includes(o.status));
    if (completedOrders.length === 0) return 0;
    const total = completedOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
    return total / completedOrders.length;
  };

  const applyFilters = () => {
    console.log('Applying filters. Total orders:', orders.length);
    
    let filtered = [...orders];
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
      console.log(`After status filter (${statusFilter}):`, filtered.length);
    }
    
    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch(dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(order => new Date(order.created_at) >= filterDate);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          filtered = filtered.filter(order => new Date(order.created_at) >= filterDate);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          filtered = filtered.filter(order => new Date(order.created_at) >= filterDate);
          break;
        case '3months':
          filterDate.setMonth(now.getMonth() - 3);
          filtered = filtered.filter(order => new Date(order.created_at) >= filterDate);
          break;
        case 'year':
          filterDate.setFullYear(now.getFullYear() - 1);
          filtered = filtered.filter(order => new Date(order.created_at) >= filterDate);
          break;
      }
      console.log(`After date filter (${dateFilter}):`, filtered.length);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(order => 
        order.order_number?.toLowerCase().includes(query) ||
        order.customer_full_name?.toLowerCase().includes(query) ||
        order.items?.some(item => item.product_name?.toLowerCase().includes(query))
      );
      console.log(`After search filter:`, filtered.length);
    }
    
    // Apply sorting
    switch(sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case 'highest':
        filtered.sort((a, b) => parseFloat(b.total_amount) - parseFloat(a.total_amount));
        break;
      case 'lowest':
        filtered.sort((a, b) => parseFloat(a.total_amount) - parseFloat(b.total_amount));
        break;
    }
    
    console.log('Final filtered orders:', filtered.length);
    setFilteredOrders(filtered);
    setCurrentPage(1);
  };

  const handleRefresh = () => {
    fetchOrders(true);
  };

  const handleStatusFilterChange = (status) => {
    console.log('Status filter changed to:', status);
    setStatusFilter(status);
  };

  const handleDateFilterChange = (e) => {
    console.log('Date filter changed to:', e.target.value);
    setDateFilter(e.target.value);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    applyFilters();
  };

  const handleSortChange = (e) => {
    console.log('Sort changed to:', e.target.value);
    setSortBy(e.target.value);
  };

  const handleCancelOrder = async (orderNumber) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) {
      return;
    }
    
    try {
      await customerService.cancelOrder(orderNumber);
      await fetchOrders(true);
      alert('Order cancelled successfully');
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert('Failed to cancel order. Please try again.');
    }
  };

  const clearFilters = () => {
    console.log('Clearing all filters');
    setStatusFilter('all');
    setDateFilter('all');
    setSearchQuery('');
    setSortBy('newest');
  };

  // Pagination
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder);
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-ZA', {
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

  const canCancelOrder = (status) => {
    return ['pending', 'processing'].includes(status);
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading your orders...</p>
      </div>
    );
  }

  return (
    <div className={styles.ordersPage}>
      <div className="container">
        {/* Header */}
        <div className={styles.pageHeader}>
          <div className={styles.headerLeft}>
            <h1>My Orders</h1>
            <p className={styles.orderCount}>
              {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'} found
            </p>
          </div>
          <div className={styles.headerActions}>
            <button 
              onClick={handleRefresh} 
              className={styles.refreshButton}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : '⟳ Refresh'}
            </button>
            <Link to="/products" className={styles.shopButton}>
              Continue Shopping
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ backgroundColor: 'rgba(33, 150, 243, 0.1)' }}>
              📦
            </div>
            <div className={styles.statContent}>
              <h3>{orderStats.total_orders}</h3>
              <p>Total Orders</p>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ backgroundColor: 'rgba(255, 152, 0, 0.1)' }}>
              ⏳
            </div>
            <div className={styles.statContent}>
              <h3>{orderStats.pending_orders + orderStats.processing_orders + orderStats.paid_orders + orderStats.shipped_orders}</h3>
              <p>In Progress</p>
              <div className={styles.statBreakdown}>
                <small>Pending: {orderStats.pending_orders}</small>
                <small>Processing: {orderStats.processing_orders}</small>
                <small>Paid: {orderStats.paid_orders}</small>
                <small>Shipped: {orderStats.shipped_orders}</small>
              </div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}>
              ✅
            </div>
            <div className={styles.statContent}>
              <h3>{orderStats.delivered_orders + orderStats.completed_orders}</h3>
              <p>Completed</p>
              <div className={styles.statBreakdown}>
                <small>Delivered: {orderStats.delivered_orders}</small>
                <small>Completed: {orderStats.completed_orders}</small>
              </div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ backgroundColor: 'rgba(156, 39, 176, 0.1)' }}>
              💰
            </div>
            <div className={styles.statContent}>
              <h3>{formatCurrency(orderStats.total_spent)}</h3>
              <p>Total Spent</p>
              <small className={styles.averageValue}>
                Avg: {formatCurrency(orderStats.average_order_value)}
              </small>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className={styles.filtersSection}>
          <div className={styles.filtersHeader}>
            <h2>Filter Orders</h2>
            {(statusFilter !== 'all' || dateFilter !== 'all' || searchQuery || sortBy !== 'newest') && (
              <button onClick={clearFilters} className={styles.clearFilters}>
                Clear Filters
              </button>
            )}
          </div>

          <div className={styles.filtersGrid}>
            {/* Status Filter */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Status</label>
              <div className={styles.statusFilters}>
                <button
                  className={`${styles.statusFilter} ${statusFilter === 'all' ? styles.active : ''}`}
                  onClick={() => handleStatusFilterChange('all')}
                >
                  All
                </button>
                <button
                  className={`${styles.statusFilter} ${statusFilter === 'pending' ? styles.active : ''}`}
                  onClick={() => handleStatusFilterChange('pending')}
                >
                  Pending
                </button>
                <button
                  className={`${styles.statusFilter} ${statusFilter === 'processing' ? styles.active : ''}`}
                  onClick={() => handleStatusFilterChange('processing')}
                >
                  Processing
                </button>
                <button
                  className={`${styles.statusFilter} ${statusFilter === 'paid' ? styles.active : ''}`}
                  onClick={() => handleStatusFilterChange('paid')}
                >
                  Paid
                </button>
                <button
                  className={`${styles.statusFilter} ${statusFilter === 'shipped' ? styles.active : ''}`}
                  onClick={() => handleStatusFilterChange('shipped')}
                >
                  Shipped
                </button>
                <button
                  className={`${styles.statusFilter} ${statusFilter === 'delivered' ? styles.active : ''}`}
                  onClick={() => handleStatusFilterChange('delivered')}
                >
                  Delivered
                </button>
                <button
                  className={`${styles.statusFilter} ${statusFilter === 'completed' ? styles.active : ''}`}
                  onClick={() => handleStatusFilterChange('completed')}
                >
                  Completed
                </button>
                <button
                  className={`${styles.statusFilter} ${statusFilter === 'cancelled' ? styles.active : ''}`}
                  onClick={() => handleStatusFilterChange('cancelled')}
                >
                  Cancelled
                </button>
              </div>
            </div>

            <div className={styles.filterRow}>
              {/* Date Filter */}
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel} htmlFor="dateFilter">Date Range</label>
                <select
                  id="dateFilter"
                  value={dateFilter}
                  onChange={handleDateFilterChange}
                  className={styles.filterSelect}
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                  <option value="3months">Last 3 Months</option>
                  <option value="year">Last Year</option>
                </select>
              </div>

              {/* Sort By */}
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel} htmlFor="sortBy">Sort By</label>
                <select
                  id="sortBy"
                  value={sortBy}
                  onChange={handleSortChange}
                  className={styles.filterSelect}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="highest">Highest Amount</option>
                  <option value="lowest">Lowest Amount</option>
                </select>
              </div>

              {/* Search */}
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel} htmlFor="search">Search Orders</label>
                <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
                  <input
                    type="text"
                    id="search"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Order #, product name..."
                    className={styles.searchInput}
                  />
                  <button type="submit" className={styles.searchButton}>
                    🔍
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        {filteredOrders.length > 0 ? (
          <>
            <div className={styles.ordersTableContainer}>
              <table className={styles.ordersTable}>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentOrders.map(order => (
                    <tr key={order.id} className={styles.orderRow}>
                      <td className={styles.orderNumberCell}>
                        <Link to={`/account/orders/${order.order_number}`} className={styles.orderLink}>
                          {order.order_number}
                        </Link>
                      </td>
                      <td className={styles.orderDateCell}>
                        {formatDate(order.created_at)}
                      </td>
                      <td className={styles.orderItemsCell}>
                        <div className={styles.orderItemsPreview}>
                          {order.items && order.items.slice(0, 3).map((item, idx) => (
                            <div key={idx} className={styles.orderItemThumb}>
                              {item.image ? (
                                <img 
                                  src={item.image} 
                                  alt={item.product_name}
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = '/placeholder-product.jpg';
                                  }}
                                />
                              ) : (
                                <div className={styles.placeholderImage}>📦</div>
                              )}
                            </div>
                          ))}
                          {order.items && order.items.length > 3 && (
                            <span className={styles.moreItems}>+{order.items.length - 3}</span>
                          )}
                          <span className={styles.itemCount}>
                            {order.item_count || order.items?.length || 0} items
                          </span>
                        </div>
                      </td>
                      <td className={styles.orderTotalCell}>
                        <span className={styles.orderTotal}>
                          {formatCurrency(order.total_amount)}
                        </span>
                      </td>
                      <td className={styles.orderStatusCell}>
                        <div className={styles.statusContainer}>
                          <span className={`${styles.orderStatus} ${getStatusClass(order.status)}`}>
                            {getStatusIcon(order.status)} {getStatusDisplay(order.status)}
                          </span>
                          {order.status === 'delivered' && (
                            <span className={styles.statusNote}>Awaiting completion</span>
                          )}
                          {order.status === 'completed' && (
                            <span className={styles.statusNote}>✓ Order complete</span>
                          )}
                        </div>
                      </td>
                      <td className={styles.orderActionsCell}>
                        <Link 
                          to={`/account/orders/${order.order_number}`}
                          className={styles.viewButton}
                        >
                          View
                        </Link>
                        {canCancelOrder(order.status) && (
                          <button
                            onClick={() => handleCancelOrder(order.order_number)}
                            className={styles.cancelButton}
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  className={`${styles.pageButton} ${currentPage === 1 ? styles.disabled : ''}`}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  ← Previous
                </button>
                
                <div className={styles.pageNumbers}>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        className={`${styles.pageNumber} ${currentPage === pageNum ? styles.active : ''}`}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <>
                      <span className={styles.pageDots}>...</span>
                      <button
                        className={styles.pageNumber}
                        onClick={() => setCurrentPage(totalPages)}
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>
                
                <button
                  className={`${styles.pageButton} ${currentPage === totalPages ? styles.disabled : ''}`}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📦</div>
            <h2>No orders found</h2>
            <p>
              {searchQuery || statusFilter !== 'all' || dateFilter !== 'all'
                ? "Try adjusting your filters to find what you're looking for."
                : "You haven't placed any orders yet."}
            </p>
            <div className={styles.emptyActions}>
              <Link to="/products" className={styles.shopNowButton}>
                Start Shopping
              </Link>
              {(searchQuery || statusFilter !== 'all' || dateFilter !== 'all') && (
                <button onClick={clearFilters} className={styles.clearFiltersButton}>
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerOrders;