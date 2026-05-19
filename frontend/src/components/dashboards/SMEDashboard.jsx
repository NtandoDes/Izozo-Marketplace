/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { smeService } from '../../services/smeService';
import styles from './SMEDashboard.module.css';

const SMEDashboard = () => {
  const navigate = useNavigate();
  const { user, profile, refreshUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const [smeData, setSmeData] = useState(null);
  const [assignedAgents, setAssignedAgents] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [productStats, setProductStats] = useState({
    total_products: 0,
    active_products: 0,
    pending_products: 0,
    draft_products: 0,
    rejected_products: 0,
    out_of_stock: 0,
    low_stock: 0,
    total_value: 0,
    products_by_agent: []
  });

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
    completed_revenue: 0,
    average_order_value: 0,
    products_sold: [],
    by_agent: []
  });

  const [monthlyStats, setMonthlyStats] = useState({
    revenue: [],
    orders: [],
    labels: [],
    growth: 0
  });

  useEffect(() => {
    if (user && profile) {
      setSmeData({
        id: profile.id || user.id,
        name: profile.business_name || '',
        email: user.email || '',
        phone: user.phone || '',
        businessType: profile.business_type || 'Not specified',
        businessAddress: profile.business_address || profile.address || '',
        ownerName: profile.owner_name || user.full_name || '',
        status: user.status || 'pending',
        createdAt: profile.created_at || user.created_at
      });
    }
  }, [user, profile]);

  useEffect(() => {
    if (user && profile && user.role === 'sme') {
      fetchDashboardData();
    }
  }, [user, profile]);

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    setError(null);
    
    try {
      const [
        agents, 
        productsData, 
        productStatsData,
        ordersData, 
        orderStatsData,
      ] = await Promise.all([
        smeService.getAssignedAgents(),
        smeService.getProducts({ limit: 100 }),
        smeService.getProductStats(),
        smeService.getOrders({ limit: 100 }),
        smeService.getOrderStats()
      ]);
      
      setAssignedAgents(agents);
      setProducts(productsData);
      setOrders(ordersData);
      setRecentOrders(ordersData.slice(0, 5));
      
      setProductStats({
        total_products: productStatsData.total_products || productsData.length,
        active_products: productStatsData.active_products || productsData.filter(p => p.status === 'active' && p.is_active).length,
        pending_products: productStatsData.pending_products || productsData.filter(p => p.status === 'pending').length,
        draft_products: productStatsData.draft_products || productsData.filter(p => p.status === 'draft').length,
        rejected_products: productStatsData.rejected_products || productsData.filter(p => p.status === 'rejected').length,
        out_of_stock: productStatsData.out_of_stock || productsData.filter(p => p.stock_quantity === 0).length,
        low_stock: productStatsData.low_stock || productsData.filter(p => p.stock_quantity > 0 && p.stock_quantity <= (p.low_stock_threshold || 5)).length,
        total_value: productStatsData.total_value || productsData.reduce((sum, p) => sum + (parseFloat(p.base_price || 0) * (p.stock_quantity || 0)), 0),
        products_by_agent: productStatsData.products_by_agent || []
      });

      const enhancedOrderStats = {
        total_orders: orderStatsData.total_orders || ordersData.length,
        pending_orders: orderStatsData.pending_orders || ordersData.filter(o => o.status === 'pending').length,
        processing_orders: orderStatsData.processing_orders || ordersData.filter(o => o.status === 'processing').length,
        paid_orders: orderStatsData.paid_orders || ordersData.filter(o => o.status === 'paid').length,
        shipped_orders: orderStatsData.shipped_orders || ordersData.filter(o => o.status === 'shipped').length,
        delivered_orders: orderStatsData.delivered_orders || ordersData.filter(o => o.status === 'delivered').length,
        cancelled_orders: orderStatsData.cancelled_orders || ordersData.filter(o => o.status === 'cancelled').length,
        completed_orders: orderStatsData.completed_orders || ordersData.filter(o => o.status === 'completed').length,
        total_revenue: orderStatsData.total_revenue || 0,
        delivered_revenue: orderStatsData.delivered_revenue || 0,
        paid_revenue: orderStatsData.paid_revenue || 0,
        completed_revenue: orderStatsData.completed_revenue || 0,
        average_order_value: orderStatsData.average_order_value || 0,
        products_sold: orderStatsData.products_sold || [],
        by_agent: orderStatsData.by_agent || []
      };

      if (enhancedOrderStats.total_revenue === 0 && ordersData.length > 0) {
        let totalRevenue = 0, deliveredRevenue = 0, paidRevenue = 0, completedRevenue = 0;
        ordersData.forEach(order => {
          const amount = parseFloat(order.total_amount || 0);
          if (order.status === 'delivered')  { deliveredRevenue  += amount; totalRevenue += amount; }
          else if (order.status === 'paid')  { paidRevenue       += amount; totalRevenue += amount; }
          else if (order.status === 'completed') { completedRevenue += amount; totalRevenue += amount; }
        });
        enhancedOrderStats.total_revenue = totalRevenue;
        enhancedOrderStats.delivered_revenue = deliveredRevenue;
        enhancedOrderStats.paid_revenue = paidRevenue;
        enhancedOrderStats.completed_revenue = completedRevenue;
        enhancedOrderStats.average_order_value = ordersData.length > 0 ? totalRevenue / ordersData.length : 0;
      }

      setOrderStats(enhancedOrderStats);
      calculateMonthlyStats(ordersData);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      
      try {
        const productsData = await smeService.getProducts({ limit: 100 });
        const ordersData   = await smeService.getOrders({ limit: 100 });
        
        setProducts(productsData.slice(0, 5));
        setOrders(ordersData);
        setRecentOrders(ordersData.slice(0, 5));
        
        const calculatedProductStats = {
          total_products:    productsData.length,
          active_products:   productsData.filter(p => p.status === 'active' && p.is_active).length,
          pending_products:  productsData.filter(p => p.status === 'pending').length,
          draft_products:    productsData.filter(p => p.status === 'draft').length,
          rejected_products: productsData.filter(p => p.status === 'rejected').length,
          out_of_stock:      productsData.filter(p => p.stock_quantity === 0).length,
          low_stock:         productsData.filter(p => p.stock_quantity > 0 && p.stock_quantity <= (p.low_stock_threshold || 5)).length,
          total_value:       productsData.reduce((sum, p) => sum + (parseFloat(p.base_price || 0) * (p.stock_quantity || 0)), 0),
          products_by_agent: []
        };
        
        const deliveredOrders  = ordersData.filter(o => o.status === 'delivered');
        const paidOrders       = ordersData.filter(o => o.status === 'paid');
        const completedOrders  = ordersData.filter(o => o.status === 'completed');
        const totalRevenue     = [...deliveredOrders, ...paidOrders, ...completedOrders].reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
        
        const calculatedOrderStats = {
          total_orders:        ordersData.length,
          pending_orders:      ordersData.filter(o => o.status === 'pending').length,
          processing_orders:   ordersData.filter(o => o.status === 'processing').length,
          paid_orders:         paidOrders.length,
          shipped_orders:      ordersData.filter(o => o.status === 'shipped').length,
          delivered_orders:    deliveredOrders.length,
          cancelled_orders:    ordersData.filter(o => o.status === 'cancelled').length,
          completed_orders:    completedOrders.length,
          total_revenue:       totalRevenue,
          delivered_revenue:   deliveredOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0),
          paid_revenue:        paidOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0),
          completed_revenue:   completedOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0),
          average_order_value: ordersData.length > 0 ? totalRevenue / ordersData.length : 0,
          products_sold:       [],
          by_agent:            []
        };
        
        setProductStats(calculatedProductStats);
        setOrderStats(calculatedOrderStats);
        calculateMonthlyStats(ordersData);
        
      } catch (fallbackErr) {
        console.error('Fallback error:', fallbackErr);
        if (err.response?.status === 401 || err.message?.includes('401')) {
          localStorage.removeItem('izozo_tokens');
          navigate('/login');
          return;
        }
        setError({ title: 'Failed to load dashboard', message: 'Please try refreshing the page or contact support.' });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateMonthlyStats = (ordersData) => {
    const last6Months = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      last6Months.push({ month: months[date.getMonth()], year: date.getFullYear(), revenue: 0, orders: 0 });
    }
    ordersData.forEach(order => {
      if (['delivered', 'paid', 'completed'].includes(order.status)) {
        const d = new Date(order.created_at);
        const stat = last6Months.find(s => s.month === months[d.getMonth()] && s.year === d.getFullYear());
        if (stat) { stat.revenue += parseFloat(order.total_amount || 0); stat.orders += 1; }
      }
    });
    let growth = 0;
    if (last6Months.length >= 2) {
      const lastMonth = last6Months[last6Months.length - 1].revenue;
      const prevMonth = last6Months[last6Months.length - 2].revenue;
      if (prevMonth > 0) growth = ((lastMonth - prevMonth) / prevMonth) * 100;
      else if (lastMonth > 0) growth = 100;
    }
    setMonthlyStats({ revenue: last6Months.map(m => m.revenue), orders: last6Months.map(m => m.orders), labels: last6Months.map(m => m.month), growth });
  };

  const handleRefresh = () => {
    refreshUser();
    fetchDashboardData(true);
  };

  const hasSMEProfile = () => {
    if (!user || !profile) return false;
    if (user.role !== 'sme') return false;
    return profile.business_name && profile.business_name.trim() !== '';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try { return new Date(dateString).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return 'N/A'; }
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return 'R0.00';
    return `R${parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercentage = (value) => {
    if (!value && value !== 0) return '0%';
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getStatusClass = (status) => {
    const statusMap = {
      pending: styles.statusPending, processing: styles.statusProcessing,
      paid: styles.statusPaid, shipped: styles.statusShipped,
      delivered: styles.statusDelivered, cancelled: styles.statusCancelled, completed: styles.statusCompleted
    };
    return statusMap[status] || '';
  };

  const getStatusDisplay = (status) => {
    const displayMap = {
      pending: 'Pending', processing: 'Processing', paid: 'Paid',
      shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', completed: 'Completed'
    };
    return displayMap[status] || status;
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  if (!hasSMEProfile()) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>🏢</div>
        <h3 className={styles.emptyTitle}>No Business Profile Found</h3>
        <p className={styles.emptyDescription}>Please complete your business registration to start using the dashboard.</p>
        <Link to="/sme/complete-profile" className={styles.emptyButton}>Complete Profile</Link>
      </div>
    );
  }

  if (user?.status === 'pending') {
    return (
      <div className={styles.pendingContainer}>
        <div className={styles.pendingCard}>
          <div className={styles.pendingIcon}>⏳</div>
          <h2>Account Pending Approval</h2>
          <p>Your business account is currently being reviewed. You'll receive an email once approved.</p>
          <div className={styles.profileSummary}>
            <h3>Business Information</h3>
            <p><strong>{smeData?.name}</strong></p>
            <p>{smeData?.email}</p>
            <p>{smeData?.phone}</p>
            <p>{smeData?.businessType}</p>
          </div>
          <button onClick={handleRefresh} className={styles.retryButton}>Check Status</button>
        </div>
      </div>
    );
  }

  const totalRevenue = orders.reduce((sum, order) => {
    if (['delivered', 'paid', 'completed'].includes(order.status)) return sum + parseFloat(order.total_amount || 0);
    return sum;
  }, 0);

  return (
    <div className={styles.dashboardContainer}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={styles.dashboardHeader}>
        <div className={styles.headerLeft}>
          <div>
            <h1>SME Dashboard</h1>
            <div className={styles.userInfo}>
              <span className={styles.businessName}>{smeData?.name}</span>
              <span className={styles.businessType}>{smeData?.businessType}</span>
            </div>
          </div>
          {refreshing && <span className={styles.refreshing}>Refreshing...</span>}
        </div>
        <div className={styles.headerActions}>
          {/* ── NEW: Add Product button ── */}
          <button
            onClick={() => navigate('/sme/products/create')}
            className={styles.addProductButton}
            title="Add a new product to your store"
          >
            + Add Product
          </button>
        </div>
      </div>

      {/* Welcome */}
      <div className={styles.welcomeCard}>
        <h2>Welcome back, {smeData?.ownerName?.split(' ')[0] || 'Business Owner'}!</h2>
        <div className={styles.performanceSummary}>
          <div className={styles.performanceItem}>
            <span className={styles.performanceLabel}>Monthly Revenue</span>
            <span className={styles.performanceValue}>{formatCurrency(monthlyStats.revenue[monthlyStats.revenue.length - 1] || 0)}</span>
          </div>
          <div className={styles.performanceItem}>
            <span className={styles.performanceLabel}>Growth</span>
            <span className={`${styles.performanceValue} ${monthlyStats.growth >= 0 ? styles.positive : styles.negative}`}>{formatPercentage(monthlyStats.growth)}</span>
          </div>
          <div className={styles.performanceItem}>
            <span className={styles.performanceLabel}>Total Orders</span>
            <span className={styles.performanceValue}>{orderStats.total_orders || orders.length}</span>
          </div>
        </div>
      </div>

      {/* Revenue Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}>📊</div>
          <div className={styles.statContent}>
            <h3>{formatCurrency(orderStats.total_revenue || totalRevenue)}</h3>
            <p>Total Revenue</p>
            <div className={styles.statBreakdown}>
              <small className={styles.deliveredRevenue}>{formatCurrency(orderStats.delivered_revenue)} delivered</small>
              {orderStats.completed_revenue > 0 && <small className={styles.completedRevenue}>{formatCurrency(orderStats.completed_revenue)} completed</small>}
            </div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(33, 150, 243, 0.1)' }}>📦</div>
          <div className={styles.statContent}>
            <h3>{orderStats.total_orders || orders.length}</h3>
            <p>Total Orders</p>
            <div className={styles.statBreakdown}>
              <small className={styles.deliveredCount}>{orderStats.delivered_orders || orders.filter(o => o.status === 'delivered').length} delivered</small>
              {orderStats.pending_orders > 0 && <small className={styles.pendingCount}>{orderStats.pending_orders} pending</small>}
            </div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(242, 192, 26, 0.1)' }}>🤝</div>
          <div className={styles.statContent}>
            <h3>{assignedAgents.length}</h3>
            <p>Assigned Agents</p>
            {assignedAgents.length > 0 && <small className={styles.activeCount}>Active Partners</small>}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(156, 39, 176, 0.1)' }}>📈</div>
          <div className={styles.statContent}>
            <h3>{formatCurrency(orderStats.average_order_value)}</h3>
            <p>Avg. Order Value</p>
            <small className={styles.inventoryValue}>Per transaction</small>
          </div>
        </div>
      </div>

      {/* Product Stats */}
      <div className={styles.statsGridSecondary}>
        <div className={styles.statCardSmall}><span className={styles.statLabel}>Active Products</span><span className={styles.statValue}>{productStats.active_products}</span></div>
        <div className={styles.statCardSmall}><span className={styles.statLabel}>Pending Approval</span><span className={styles.statValue}>{productStats.pending_products}</span></div>
        <div className={styles.statCardSmall}><span className={styles.statLabel}>Out of Stock</span><span className={styles.statValue}>{productStats.out_of_stock}</span></div>
        <div className={styles.statCardSmall}><span className={styles.statLabel}>Low Stock</span><span className={styles.statValue}>{productStats.low_stock}</span></div>
        <div className={styles.statCardSmall}><span className={styles.statLabel}>Inventory Value</span><span className={styles.statValue}>{formatCurrency(productStats.total_value)}</span></div>
      </div>

      {/* Inventory Alerts */}
      {(productStats.out_of_stock > 0 || productStats.low_stock > 0) && (
        <div className={styles.alertsSection}>
          <h3 className={styles.alertsTitle}>⚠️ Inventory Alerts</h3>
          <div className={styles.alertGrid}>
            {productStats.out_of_stock > 0 && (
              <div className={styles.alertCard} style={{ backgroundColor: 'rgba(244, 67, 54, 0.1)' }}>
                <div className={styles.alertIcon}>🛑</div>
                <div className={styles.alertContent}>
                  <h4>Out of Stock</h4>
                  <p className={styles.alertCount}>{productStats.out_of_stock} products</p>
                  <span className={styles.alertAction}>Contact your agents to restock</span>
                </div>
              </div>
            )}
            {productStats.low_stock > 0 && (
              <div className={styles.alertCard} style={{ backgroundColor: 'rgba(255, 152, 0, 0.1)' }}>
                <div className={styles.alertIcon}>⚠️</div>
                <div className={styles.alertContent}>
                  <h4>Low Stock</h4>
                  <p className={styles.alertCount}>{productStats.low_stock} products</p>
                  <span className={styles.alertAction}>Running low on inventory</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Order Status Overview */}
      <div className={styles.orderStatusSection}>
        <h3 className={styles.sectionTitle}>Order Status Overview</h3>
        <div className={styles.statusGrid}>
          {[
            { label: 'Pending',    key: 'pending_orders' },
            { label: 'Processing', key: 'processing_orders' },
            { label: 'Paid',       key: 'paid_orders' },
            { label: 'Shipped',    key: 'shipped_orders' },
            { label: 'Delivered',  key: 'delivered_orders' },
            { label: 'Completed',  key: 'completed_orders' },
            { label: 'Cancelled',  key: 'cancelled_orders' },
          ].map(({ label, key }) => (
            <div key={key} className={styles.statusItem}>
              <span className={styles.statusLabel}>{label}</span>
              <span className={styles.statusCount}>{orderStats[key] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className={styles.contentGrid}>

        {/* Recent Orders */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2>Recent Orders</h2>
            {orders.length > 0 && <Link to="/sme/orders" className={styles.viewAllLink}>View All {orderStats.total_orders || orders.length} Orders →</Link>}
          </div>
          <div className={styles.tableContainer}>
            <table className={styles.dataTable}>
              <thead>
                <tr><th>Order #</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr>
              </thead>
              <tbody>
                {recentOrders.length > 0 ? recentOrders.map(order => (
                  <tr key={order.id}>
                    <td><Link to={`/sme/orders/${order.order_number}`} className={styles.orderLink}>{order.order_number}</Link></td>
                    <td>{formatDate(order.created_at)}</td>
                    <td>{order.customer_full_name || 'N/A'}</td>
                    <td>{order.item_count || order.items?.length || 0}</td>
                    <td>{formatCurrency(order.total_amount)}</td>
                    <td><span className={`${styles.statusBadge} ${getStatusClass(order.status)}`}>{getStatusDisplay(order.status)}</span></td>
                  </tr>
                )) : (
                  <tr><td colSpan="6" className={styles.emptyTableCell}><p>No orders yet</p><p className={styles.emptySubtext}>When customers place orders for your products, they'll appear here.</p></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Assigned Agents */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2>Your Sales Agents</h2>
            <span className={styles.badge}>{assignedAgents.length} Agents</span>
          </div>
          <div className={styles.listContainer}>
            {assignedAgents.length > 0 ? assignedAgents.map(agent => (
              <div key={agent.id} className={styles.agentListItem}>
                <div className={styles.agentAvatar}>{agent.name?.charAt(0) || 'A'}</div>
                <div className={styles.agentInfo}>
                  <h4>{agent.name}</h4>
                  <p>{agent.email}</p>
                  <div className={styles.agentCapabilities}>
                    {agent.has_smartphone && <span className={styles.capabilityBadge}>📱 Smartphone</span>}
                    {agent.has_internet   && <span className={styles.capabilityBadge}>🌐 Internet</span>}
                  </div>
                  <span className={styles.assignedDate}>Assigned: {formatDate(agent.assigned_at)}</span>
                </div>
              </div>
            )) : (
              <div className={styles.emptyState}>
                <p>No agents assigned yet</p>
                <p className={styles.emptyDescription}>Agents will appear here once assigned by an administrator.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Products */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2>Recent Products</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* ── Quick add product shortcut ── */}
              <button
                onClick={() => navigate('/sme/products/create')}
                className={styles.addProductButtonSmall}
                title="Add new product"
              >
                + Add Product
              </button>
              {products.length > 0 && <Link to="/sme/products" className={styles.viewAllLink}>View All {productStats.total_products} →</Link>}
            </div>
          </div>
          <div className={styles.tableContainer}>
            <table className={styles.dataTable}>
              <thead>
                <tr><th>Product</th><th>Price</th><th>Status</th><th>Stock</th><th>Agent</th></tr>
              </thead>
              <tbody>
                {products.slice(0, 5).map(product => (
                  <tr key={product.id}>
                    <td>
                      <div className={styles.productInfo}>
                        <Link to={`/sme/products/${product.id}`} className={styles.productName}>{product.name || 'Unnamed Product'}</Link>
                        {product.sku && <span className={styles.productSku}>SKU: {product.sku}</span>}
                      </div>
                    </td>
                    <td>
                      <span className={styles.productPrice}>{formatCurrency(product.selling_price || product.base_price)}</span>
                      {product.discount_percentage > 0 && <span className={styles.discountBadge}>-{product.discount_percentage}%</span>}
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${product.status === 'active' && product.is_active ? styles.statusActive : product.status === 'pending' ? styles.statusPending : product.status === 'rejected' ? styles.statusRejected : styles.statusInactive}`}>
                        {product.status === 'active' && product.is_active ? 'Active' : product.status === 'pending' ? 'Pending' : product.status === 'rejected' ? 'Rejected' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.stockValue} ${product.stock_quantity <= product.low_stock_threshold ? styles.stockLow : ''}`}>
                        {product.stock_quantity || 0}
                      </span>
                    </td>
                    <td><span className={styles.agentName}>{product.agent_name || 'Self'}</span></td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan="5" className={styles.emptyTableCell}>
                      <p>No products yet</p>
                      <p className={styles.emptySubtext}>
                        <button onClick={() => navigate('/sme/products/create')} className={styles.inlineAddButton}>
                          Add your first product →
                        </button>
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Products by Agent */}
        {productStats.products_by_agent && productStats.products_by_agent.length > 0 && (
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}><h2>Products by Agent</h2></div>
            <div className={styles.agentStatsList}>
              {productStats.products_by_agent.map((agent, index) => (
                <div key={index} className={styles.agentStatItem}>
                  <span className={styles.agentStatName}>{agent.agent__user__full_name || 'Agent'}</span>
                  <span className={styles.agentStatCount}>{agent.count} products</span>
                  <span className={styles.agentStatActive}>{agent.active_count || 0} active</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Selling Products */}
        {orderStats.products_sold && orderStats.products_sold.length > 0 && (
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}><h2>Top Selling Products</h2></div>
            <div className={styles.topProductsList}>
              {orderStats.products_sold.slice(0, 5).map((product, index) => (
                <div key={index} className={styles.topProductItem}>
                  <span className={styles.topProductRank}>{index + 1}</span>
                  <span className={styles.topProductName}>{product.product_name}</span>
                  <span className={styles.topProductQuantity}>{product.total_quantity} sold</span>
                  <span className={styles.topProductRevenue}>{formatCurrency(product.total_revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Business Profile */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2>Business Profile</h2>
            <Link to="/account" className={styles.editLink}>Edit Profile</Link>
          </div>
          <div className={styles.businessSummary}>
            {[
              { label: 'Business Name', value: smeData?.name || 'Not set' },
              { label: 'Owner',         value: smeData?.ownerName || 'Not set' },
              { label: 'Contact',       value: `${smeData?.email || ''}${smeData?.phone ? ` | ${smeData.phone}` : ''}` },
              { label: 'Business Type', value: smeData?.businessType || 'Not specified' },
              ...(smeData?.businessAddress ? [{ label: 'Address', value: smeData.businessAddress }] : []),
              { label: 'Member Since',  value: formatDate(smeData?.createdAt) },
            ].map(({ label, value }) => (
              <div key={label} className={styles.summaryRow}>
                <span className={styles.summaryLabel}>{label}</span>
                <span className={styles.summaryValue}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SMEDashboard;