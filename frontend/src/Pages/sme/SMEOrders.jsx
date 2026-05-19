/* eslint-disable no-unused-vars */
// frontend/src/pages/sme/SMEOrders.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { smeService } from '../../services/smeService';
import styles from './SMEOrders.module.css';

const SMEOrders = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [orderStats, setOrderStats] = useState({
    total_orders: 0,
    pending_orders: 0,
    processing_orders: 0,
    paid_orders: 0,
    shipped_orders: 0,
    delivered_orders: 0,
    cancelled_orders: 0,
    completed_orders: 0,
    total_revenue: 0,
    delivered_revenue: 0,
    paid_revenue: 0,
    average_order_value: 0
  });
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    dateRange: 'all',
    sort: 'newest'
  });
  
  // Date range picker
  const [customDateRange, setCustomDateRange] = useState({
    start: '',
    end: ''
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch orders on component mount
  useEffect(() => {
    fetchOrders();
    fetchOrderStats();
  }, []);

  // Apply filters whenever filters or orders change
  useEffect(() => {
    applyFilters();
  }, [filters, orders, customDateRange]);

  // Update pagination when filtered products change
  useEffect(() => {
    setTotalPages(Math.ceil(filteredOrders.length / ordersPerPage));
    setCurrentPage(1);
  }, [filteredOrders, ordersPerPage]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await smeService.getOrders({ limit: 1000 });
      console.log('📦 Orders fetched:', data.length);
      setOrders(data);
      setFilteredOrders(data);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchOrderStats = async () => {
    try {
      const stats = await smeService.getOrderStats();
      console.log('📊 Order stats fetched:', stats);
      setOrderStats(stats);
    } catch (err) {
      console.error('Error fetching order stats:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchOrders(),
      fetchOrderStats()
    ]);
  };

  const applyFilters = () => {
    let filtered = [...orders];
    
    // Search filter (order number, customer name, customer email)
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(o => 
        o.order_number?.toLowerCase().includes(searchTerm) ||
        o.customer_full_name?.toLowerCase().includes(searchTerm) ||
        o.customer_email?.toLowerCase().includes(searchTerm)
      );
    }
    
    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(o => o.status === filters.status);
    }
    
    // Date range filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    
    if (filters.dateRange === 'today') {
      filtered = filtered.filter(o => new Date(o.created_at) >= today);
    } else if (filters.dateRange === 'week') {
      filtered = filtered.filter(o => new Date(o.created_at) >= startOfWeek);
    } else if (filters.dateRange === 'month') {
      filtered = filtered.filter(o => new Date(o.created_at) >= startOfMonth);
    } else if (filters.dateRange === 'year') {
      filtered = filtered.filter(o => new Date(o.created_at) >= startOfYear);
    } else if (filters.dateRange === 'custom' && customDateRange.start && customDateRange.end) {
      const startDate = new Date(customDateRange.start);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(customDateRange.end);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate >= startDate && orderDate <= endDate;
      });
    }
    
    // Sorting
    switch (filters.sort) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case 'amount_high':
        filtered.sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0));
        break;
      case 'amount_low':
        filtered.sort((a, b) => (a.total_amount || 0) - (b.total_amount || 0));
        break;
      default:
        break;
    }
    
    setFilteredOrders(filtered);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleDateRangeChange = (e) => {
    const { name, value } = e.target;
    setCustomDateRange(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      dateRange: 'all',
      sort: 'newest'
    });
    setCustomDateRange({ start: '', end: '' });
  };

  // Get current page orders
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return 'R0.00';
    return `R${parseFloat(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

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

  const getStatusClass = (status) => {
    const statusMap = {
      'pending': styles.statusPending,
      'processing': styles.statusProcessing,
      'paid': styles.statusPaid,
      'shipped': styles.statusShipped,
      'delivered': styles.statusDelivered,
      'cancelled': styles.statusCancelled,
      'completed': styles.statusCompleted
    };
    return statusMap[status] || '';
  };

  const getStatusDisplay = (status) => {
    const displayMap = {
      'pending': 'Pending Payment',
      'processing': 'Processing',
      'paid': 'Paid',
      'shipped': 'Shipped',
      'delivered': 'Delivered',
      'cancelled': 'Cancelled',
      'completed': 'Completed'
    };
    return displayMap[status] || status;
  };

  const canPackageOrder = (order) => {
    // Order can be packaged if it's paid or processing
    return order.status === 'paid' || order.status === 'processing';
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
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Orders</h1>
          <p className={styles.subtitle}>
            Manage and track all orders for your business
          </p>
        </div>
        <div className={styles.headerActions}>
          <button 
            onClick={handleRefresh} 
            className={styles.refreshButton}
            disabled={refreshing}
          >
            {refreshing ? '⟳ Refreshing...' : '⟳ Refresh'}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.errorAlert}>
          <div className={styles.errorIcon}>❌</div>
          <div className={styles.errorContent}>
            <h3>Error</h3>
            <p>{error}</p>
          </div>
          <button onClick={() => setError(null)} className={styles.closeButton}>×</button>
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(33, 150, 243, 0.1)' }}>
            📋
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Total Orders</span>
            <span className={styles.statValue}>{orderStats.total_orders}</span>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}>
            💰
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Total Revenue</span>
            <span className={styles.statValue}>{formatCurrency(orderStats.total_revenue)}</span>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(255, 152, 0, 0.1)' }}>
            ⏳
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Pending</span>
            <span className={styles.statValue}>{orderStats.pending_orders}</span>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(33, 150, 243, 0.1)' }}>
            📦
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Processing</span>
            <span className={styles.statValue}>{orderStats.processing_orders}</span>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(0, 200, 83, 0.1)' }}>
            ✅
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Delivered</span>
            <span className={styles.statValue}>{orderStats.delivered_orders}</span>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(156, 39, 176, 0.1)' }}>
            📊
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Avg Order</span>
            <span className={styles.statValue}>{formatCurrency(orderStats.average_order_value)}</span>
          </div>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className={styles.statusBreakdown}>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Pending Payment</span>
          <span className={styles.statusCount}>{orderStats.pending_orders}</span>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Processing</span>
          <span className={styles.statusCount}>{orderStats.processing_orders}</span>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Paid</span>
          <span className={styles.statusCount}>{orderStats.paid_orders}</span>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Shipped</span>
          <span className={styles.statusCount}>{orderStats.shipped_orders}</span>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Delivered</span>
          <span className={styles.statusCount}>{orderStats.delivered_orders}</span>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Completed</span>
          <span className={styles.statusCount}>{orderStats.completed_orders}</span>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Cancelled</span>
          <span className={styles.statusCount}>{orderStats.cancelled_orders}</span>
        </div>
      </div>

      {/* Filters Section */}
      <div className={styles.filtersSection}>
        <div className={styles.searchBox}>
          <input
            type="text"
            name="search"
            placeholder="Search by order number, customer name, or email..."
            value={filters.search}
            onChange={handleFilterChange}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filtersRow}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Status</label>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className={styles.filterSelect}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending Payment</option>
              <option value="processing">Processing</option>
              <option value="paid">Paid</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Date Range</label>
            <select
              name="dateRange"
              value={filters.dateRange}
              onChange={handleFilterChange}
              className={styles.filterSelect}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {filters.dateRange === 'custom' && (
            <>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Start Date</label>
                <input
                  type="date"
                  name="start"
                  value={customDateRange.start}
                  onChange={handleDateRangeChange}
                  className={styles.dateInput}
                />
              </div>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>End Date</label>
                <input
                  type="date"
                  name="end"
                  value={customDateRange.end}
                  onChange={handleDateRangeChange}
                  className={styles.dateInput}
                />
              </div>
            </>
          )}

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Sort By</label>
            <select
              name="sort"
              value={filters.sort}
              onChange={handleFilterChange}
              className={styles.filterSelect}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="amount_high">Amount: High to Low</option>
              <option value="amount_low">Amount: Low to High</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>&nbsp;</label>
            <button
              type="button"
              onClick={clearFilters}
              className={styles.clearButton}
            >
              Clear Filters
            </button>
          </div>
        </div>

        <div className={styles.resultsInfo}>
          <span className={styles.resultsCount}>
            Showing {filteredOrders.length > 0 ? indexOfFirstOrder + 1 : 0} - {Math.min(indexOfLastOrder, filteredOrders.length)} of {filteredOrders.length} orders
          </span>
          <span className={styles.totalRevenue}>
            Total: {formatCurrency(filteredOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0))}
          </span>
        </div>
      </div>

      {/* Orders Table */}
      {filteredOrders.length > 0 ? (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.ordersTable}>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentOrders.map(order => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/sme/orders/${order.order_number}`} className={styles.orderLink}>
                        {order.order_number}
                      </Link>
                    </td>
                    <td>
                      <span className={styles.orderDate}>{formatDate(order.created_at)}</span>
                    </td>
                    <td>
                      <div className={styles.customerInfo}>
                        <span className={styles.customerName}>{order.customer_full_name || 'N/A'}</span>
                        <span className={styles.customerEmail}>{order.customer_email}</span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.itemCount}>{order.item_count || order.items?.length || 0}</span>
                    </td>
                    <td>
                      <span className={styles.orderTotal}>{formatCurrency(order.total_amount)}</span>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${getStatusClass(order.status)}`}>
                        {getStatusDisplay(order.status)}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.paymentStatus} ${order.payment_status === 'paid' ? styles.paymentPaid : styles.paymentPending}`}>
                        {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionButtons}>
                        <Link 
                          to={`/sme/orders/${order.order_number}`} 
                          className={styles.actionButton}
                          title="View Details"
                        >
                          👁️
                        </Link>
                        {canPackageOrder(order) && (
                          <Link 
                            to={`/sme/orders/${order.order_number}/package`} 
                            className={`${styles.actionButton} ${styles.packageButton}`}
                            title="Package Order"
                          >
                            📦
                          </Link>
                        )}
                      </div>
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
                onClick={prevPage} 
                disabled={currentPage === 1}
                className={styles.paginationButton}
              >
                ← Previous
              </button>
              
              <div className={styles.pageNumbers}>
                {[...Array(totalPages)].map((_, i) => {
                  const pageNumber = i + 1;
                  if (
                    pageNumber === 1 ||
                    pageNumber === totalPages ||
                    (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => paginate(pageNumber)}
                        className={`${styles.pageButton} ${currentPage === pageNumber ? styles.activePage : ''}`}
                      >
                        {pageNumber}
                      </button>
                    );
                  } else if (
                    pageNumber === currentPage - 2 ||
                    pageNumber === currentPage + 2
                  ) {
                    return <span key={pageNumber} className={styles.pageEllipsis}>...</span>;
                  }
                  return null;
                })}
              </div>
              
              <button 
                onClick={nextPage} 
                disabled={currentPage === totalPages}
                className={styles.paginationButton}
              >
                Next →
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📦</div>
          <h3 className={styles.emptyTitle}>No Orders Found</h3>
          <p className={styles.emptyDescription}>
            {orders.length === 0 
              ? "You haven't received any orders yet. Orders will appear here once customers start purchasing."
              : "No orders match your current filters. Try adjusting your search criteria."}
          </p>
          {orders.length > 0 && (
            <button onClick={clearFilters} className={styles.emptyButton}>
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SMEOrders;