// Pages/agent/AgentOrders.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { agentService } from "../../services/agentService";
import styles from "./AgentOrders.module.css";

const AgentOrders = () => {
  // eslint-disable-next-line no-unused-vars
  const navigate = useNavigate();
  // eslint-disable-next-line no-unused-vars
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Orders data
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [orderStats, setOrderStats] = useState({
    total_orders: 0,
    pending_orders: 0,
    processing_orders: 0,
    delivered_orders: 0,
    cancelled_orders: 0,
    total_revenue: 0,
  });

  // Assigned SMEs for filter
  const [assignedSMEs, setAssignedSMEs] = useState([]);

  // Filter states
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    sme_id: "all",
    date_range: "all",
    start_date: "",
    end_date: "",
    sort: "newest",
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Status update modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  // Shipping details for shipped status
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");

  // Load orders on component mount
  useEffect(() => {
    loadOrders();
    loadAssignedSMEs();
  }, []);

  // Apply filters whenever filters or orders change
  useEffect(() => {
    applyFilters();
  }, [filters, orders]);

  // Update pagination when filtered orders change
  useEffect(() => {
    setTotalPages(Math.ceil(filteredOrders.length / ordersPerPage));
    setCurrentPage(1);
  }, [filteredOrders, ordersPerPage]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await agentService.getAssignedOrders({ limit: 100 });
      console.log("✅ Orders loaded:", data.length);
      
      // Log first order to see structure
      if (data.length > 0) {
        console.log("📦 Sample order structure:", data[0]);
      }
      
      // Enhance orders with SME info from items if needed
      const enhancedOrders = data.map(order => {
        // If sme_name is missing or N/A, try to extract from items
        if ((!order.sme_name || order.sme_name === 'N/A') && order.items && order.items.length > 0) {
          // Try to get SME name from the first item
          const firstItem = order.items[0];
          if (firstItem.sme_name || firstItem.sme?.business_name) {
            order.sme_name = firstItem.sme_name || firstItem.sme?.business_name;
            order.sme_id = firstItem.sme_id || firstItem.sme?.id;
          }
          
          // If there are multiple SMEs, note that
          const uniqueSMEs = new Set();
          order.items.forEach(item => {
            const smeName = item.sme_name || item.sme?.business_name;
            if (smeName) uniqueSMEs.add(smeName);
          });
          
          if (uniqueSMEs.size > 1) {
            order.sme_name = `Multiple (${uniqueSMEs.size})`;
            order.multiple_smes = Array.from(uniqueSMEs);
          }
        }
        return order;
      });
      
      setOrders(enhancedOrders);
      setFilteredOrders(enhancedOrders);

      // Calculate stats
      const stats = {
        total_orders: enhancedOrders.length,
        pending_orders: enhancedOrders.filter((o) => o.status === "pending").length,
        processing_orders: enhancedOrders.filter((o) => o.status === "processing").length,
        delivered_orders: enhancedOrders.filter((o) => o.status === "delivered").length,
        cancelled_orders: enhancedOrders.filter((o) => o.status === "cancelled").length,
        total_revenue: enhancedOrders
          .filter((o) => o.status === "delivered" || o.status === "paid")
          .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0),
      };
      setOrderStats(stats);
    } catch (err) {
      console.error("Error loading orders:", err);
      setError("Failed to load orders. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadAssignedSMEs = async () => {
    try {
      const smes = await agentService.getAssignedSMEs();
      console.log("✅ Assigned SMEs loaded:", smes.length);
      setAssignedSMEs(smes);
    } catch (err) {
      console.error("Error loading SMEs:", err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    await loadAssignedSMEs();
  };

  const applyFilters = () => {
    let filtered = [...orders];

    // Search filter (order number, customer name, email)
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.order_number?.toLowerCase().includes(searchTerm) ||
          o.customer_full_name?.toLowerCase().includes(searchTerm) ||
          o.customer_email?.toLowerCase().includes(searchTerm) ||
          o.customer?.full_name?.toLowerCase().includes(searchTerm),
      );
    }

    // Status filter
    if (filters.status !== "all") {
      filtered = filtered.filter((o) => o.status === filters.status);
    }

    // SME filter
    if (filters.sme_id !== "all") {
      filtered = filtered.filter((o) => o.sme_id === parseInt(filters.sme_id));
    }

    // Date range filter
    if (filters.date_range !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (filters.date_range === "today") {
        filtered = filtered.filter(o => new Date(o.created_at) >= today);
      } else if (filters.date_range === "yesterday") {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        filtered = filtered.filter(o => {
          const date = new Date(o.created_at);
          return date >= yesterday && date < today;
        });
      } else if (filters.date_range === "this_week") {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        filtered = filtered.filter(o => new Date(o.created_at) >= startOfWeek);
      } else if (filters.date_range === "this_month") {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        filtered = filtered.filter(o => new Date(o.created_at) >= startOfMonth);
      } else if (filters.date_range === "last_month") {
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        filtered = filtered.filter(o => {
          const date = new Date(o.created_at);
          return date >= startOfLastMonth && date <= endOfLastMonth;
        });
      } else if (
        filters.date_range === "custom" &&
        filters.start_date &&
        filters.end_date
      ) {
        const customStart = new Date(filters.start_date);
        customStart.setHours(0, 0, 0, 0);
        const customEnd = new Date(filters.end_date);
        customEnd.setHours(23, 59, 59, 999);
        filtered = filtered.filter((o) => {
          const orderDate = new Date(o.created_at);
          return orderDate >= customStart && orderDate <= customEnd;
        });
      }
    }

    // Sorting
    switch (filters.sort) {
      case "newest":
        filtered.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at),
        );
        break;
      case "oldest":
        filtered.sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at),
        );
        break;
      case "amount_high":
        filtered.sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0));
        break;
      case "amount_low":
        filtered.sort((a, b) => (a.total_amount || 0) - (b.total_amount || 0));
        break;
      default:
        break;
    }

    setFilteredOrders(filtered);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      status: "all",
      sme_id: "all",
      date_range: "all",
      start_date: "",
      end_date: "",
      sort: "newest",
    });
  };

  // Status update handlers
  const handleStatusUpdateClick = (order) => {
    // Don't open modal if order is delivered
    if (order.status?.toLowerCase() === "delivered") {
      alert("Cannot update status for delivered orders");
      return;
    }
    
    setSelectedOrder(order);
    setNewStatus(order.status);
    setStatusNotes("");
    setTrackingNumber("");
    setCarrier("");
    setShowStatusModal(true);
  };

  const handleStatusUpdate = async () => {
    if (!selectedOrder || !newStatus) return;

    // Validate shipping details if status is 'shipped'
    if (newStatus === 'shipped' && (!trackingNumber || !carrier)) {
      alert('Please enter tracking number and select carrier');
      return;
    }

    setUpdatingStatus(true);

    try {
      const orderIdentifier = selectedOrder.order_number || selectedOrder.id;

      // Prepare payload with shipping details if status is 'shipped'
      const payload = {
        status: newStatus,
        notes: statusNotes
      };

      // Add shipping details for shipped status
      if (newStatus === 'shipped') {
        payload.tracking_number = trackingNumber;
        payload.carrier = carrier;
      }

      await agentService.updateOrderStatus(orderIdentifier, payload);

      // Show success message
      alert(
        `✅ Order status updated to ${newStatus.toUpperCase()} successfully!`,
      );

      // Refresh orders
      await loadOrders();

      setShowStatusModal(false);
      setSelectedOrder(null);
      setNewStatus("");
      setStatusNotes("");
      setTrackingNumber("");
      setCarrier("");
    } catch (err) {
      console.error("Error updating order status:", err);
      alert(
        `❌ Failed to update order status: ${err.message || "Please try again."}`,
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Get SME display name with fallback
  const getSMEDisplay = (order) => {
    // If we have sme_name directly
    if (order.sme_name && order.sme_name !== 'N/A') {
      return order.sme_name;
    }
    
    // If we have multiple SMEs
    if (order.multiple_smes && order.multiple_smes.length > 0) {
      return `Multiple (${order.multiple_smes.length})`;
    }
    
    // Try to get from items
    if (order.items && order.items.length > 0) {
      const smeNames = [];
      order.items.forEach(item => {
        if (item.sme_name) smeNames.push(item.sme_name);
        else if (item.sme?.business_name) smeNames.push(item.sme.business_name);
      });
      
      if (smeNames.length > 0) {
        const uniqueNames = [...new Set(smeNames)];
        if (uniqueNames.length === 1) {
          return uniqueNames[0];
        } else {
          return `Multiple (${uniqueNames.length})`;
        }
      }
    }
    
    // Try to find in assignedSMEs by ID
    if (order.sme_id && assignedSMEs.length > 0) {
      const foundSME = assignedSMEs.find(s => s.id === order.sme_id);
      if (foundSME) return foundSME.business_name;
    }
    
    return "N/A";
  };

  // Pagination
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = filteredOrders.slice(
    indexOfFirstOrder,
    indexOfLastOrder,
  );

  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const nextPage = () =>
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-ZA", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "N/A";
    }
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "R0.00";
    return `R${parseFloat(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return styles.statusPending;
      case "processing":
        return styles.statusProcessing;
      case "paid":
        return styles.statusPaid;
      case "shipped":
        return styles.statusShipped;
      case "delivered":
        return styles.statusDelivered;
      case "cancelled":
        return styles.statusCancelled;
      default:
        return styles.statusPending;
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading orders...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Manage Orders</h1>
          <p className={styles.subtitle}>
            View and update orders for your assigned SMMEs
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link to="/agent/orders/create" className={styles.createButton}>
            + Create New Order
          </Link>
          <button
            onClick={handleRefresh}
            className={styles.refreshButton}
            disabled={refreshing}
          >
            {refreshing ? "⟳ Refreshing..." : "⟳ Refresh"}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ backgroundColor: "rgba(33, 150, 243, 0.1)" }}
          >
            📋
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Total Orders</span>
            <span className={styles.statValue}>{orderStats.total_orders}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ backgroundColor: "rgba(255, 152, 0, 0.1)" }}
          >
            ⏳
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Pending</span>
            <span className={styles.statValue}>
              {orderStats.pending_orders}
            </span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ backgroundColor: "rgba(33, 150, 243, 0.1)" }}
          >
            🔄
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Processing</span>
            <span className={styles.statValue}>
              {orderStats.processing_orders}
            </span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ backgroundColor: "rgba(76, 175, 80, 0.1)" }}
          >
            ✅
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Delivered</span>
            <span className={styles.statValue}>
              {orderStats.delivered_orders}
            </span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ backgroundColor: "rgba(244, 67, 54, 0.1)" }}
          >
            ❌
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Cancelled</span>
            <span className={styles.statValue}>
              {orderStats.cancelled_orders}
            </span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ backgroundColor: "rgba(156, 39, 176, 0.1)" }}
          >
            💰
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Total Revenue</span>
            <span className={styles.statValue}>
              {formatCurrency(orderStats.total_revenue)}
            </span>
          </div>
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
          <button onClick={() => setError(null)} className={styles.closeButton}>
            ×
          </button>
        </div>
      )}

      {/* Filters Section */}
      <div className={styles.filtersSection}>
        <div className={styles.searchBox}>
          <input
            type="text"
            name="search"
            placeholder="Search by order number or customer..."
            value={filters.search}
            onChange={handleFilterChange}
            className={styles.searchInput}
          />
          <span className={styles.searchIcon}>🔍</span>
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
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="paid">Paid</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>SME</label>
            <select
              name="sme_id"
              value={filters.sme_id}
              onChange={handleFilterChange}
              className={styles.filterSelect}
            >
              <option value="all">All SMMEs</option>
              {assignedSMEs.map((sme) => (
                <option key={sme.id} value={sme.id}>
                  {sme.business_name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Date Range</label>
            <select
              name="date_range"
              value={filters.date_range}
              onChange={handleFilterChange}
              className={styles.filterSelect}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

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

        {filters.date_range === "custom" && (
          <div className={styles.customDateRange}>
            <div className={styles.dateInput}>
              <label>From</label>
              <input
                type="date"
                name="start_date"
                value={filters.start_date}
                onChange={handleFilterChange}
                className={styles.datePicker}
              />
            </div>
            <div className={styles.dateInput}>
              <label>To</label>
              <input
                type="date"
                name="end_date"
                value={filters.end_date}
                onChange={handleFilterChange}
                className={styles.datePicker}
              />
            </div>
          </div>
        )}

        <div className={styles.resultsInfo}>
          <span className={styles.resultsCount}>
            Showing {filteredOrders.length > 0 ? indexOfFirstOrder + 1 : 0} -{" "}
            {Math.min(indexOfLastOrder, filteredOrders.length)} of{" "}
            {filteredOrders.length} orders
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
                  <th>Customer</th>
                  <th>SMME</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentOrders.map((order) => {
                  const smeDisplay = getSMEDisplay(order);
                  const isMultiple = smeDisplay.startsWith('Multiple');
                  const isDelivered = order.status?.toLowerCase() === "delivered";
                  
                  return (
                    <tr key={order.id}>
                      <td>
                        <Link
                          to={`/agent/orders/${order.order_number || order.id}`}
                          className={styles.orderLink}
                        >
                          #{order.order_number || order.id}
                        </Link>
                      </td>
                      <td>
                        <div className={styles.customerInfo}>
                          <span className={styles.customerName}>
                            {order.customer_full_name ||
                              order.customer?.full_name ||
                              "N/A"}
                          </span>
                          <span className={styles.customerEmail}>
                            {order.customer_email ||
                              order.customer?.email ||
                              "N/A"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={`${styles.smeInfo} ${isMultiple ? styles.multipleSMEs : ''}`}>
                          <span className={styles.smeName}>
                            {smeDisplay}
                          </span>
                          {order.sme_id && !isMultiple && (
                            <span className={styles.smeBadge}>
                              ID: {order.sme_id}
                            </span>
                          )}
                          {order.multiple_smes && order.multiple_smes.length > 0 && (
                            <div className={styles.smeTooltip}>
                              {order.multiple_smes.map((sme, idx) => (
                                <span key={idx} className={styles.smeTooltipItem}>
                                  • {sme}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={styles.orderAmount}>
                          {formatCurrency(order.total_amount || 0)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`${styles.statusBadge} ${getStatusBadgeClass(order.status)}`}
                        >
                          {order.status?.toUpperCase() || "PENDING"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`${styles.typeBadge} ${order.order_type === "agent" ? styles.agentType : styles.platformType}`}
                        >
                          {order.order_type === "agent" ? "AGENT" : "PLATFORM"}
                        </span>
                      </td>
                      <td>
                        <span className={styles.orderDate}>
                          {formatDate(order.created_at)}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionButtons}>
                          <Link
                            to={`/agent/orders/${order.order_number || order.id}`}
                            className={styles.viewButton}
                            title="View Order"
                          >
                            👁️
                          </Link>
                          <button
                            onClick={() => handleStatusUpdateClick(order)}
                            className={`${styles.statusButton} ${isDelivered ? styles.disabledStatusButton : ""}`}
                            title={isDelivered ? "Cannot update status for delivered orders" : "Update Status"}
                            disabled={isDelivered}
                          >
                            📝
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
                    (pageNumber >= currentPage - 1 &&
                      pageNumber <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => paginate(pageNumber)}
                        className={`${styles.pageButton} ${currentPage === pageNumber ? styles.activePage : ""}`}
                      >
                        {pageNumber}
                      </button>
                    );
                  } else if (
                    pageNumber === currentPage - 2 ||
                    pageNumber === currentPage + 2
                  ) {
                    return (
                      <span key={pageNumber} className={styles.pageEllipsis}>
                        ...
                      </span>
                    );
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
          <div className={styles.emptyIcon}>📋</div>
          <h3 className={styles.emptyTitle}>No Orders Found</h3>
          <p className={styles.emptyDescription}>
            {orders.length === 0
              ? "You haven't created any orders yet. Create your first assisted order to get started!"
              : "No orders match your current filters. Try adjusting your search criteria."}
          </p>
          {orders.length === 0 && (
            <Link to="/agent/orders/create" className={styles.emptyButton}>
              Create Your First Order
            </Link>
          )}
        </div>
      )}

      {/* Status Update Modal */}
      {showStatusModal && selectedOrder && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Update Order Status</h3>
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedOrder(null);
                  setNewStatus("");
                  setStatusNotes("");
                  setTrackingNumber("");
                  setCarrier("");
                }}
                className={styles.modalClose}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalOrderInfo}>
                <p className={styles.modalOrderNumber}>
                  Order #{selectedOrder.order_number || selectedOrder.id}
                </p>
                <p className={styles.modalCustomer}>
                  Customer:{" "}
                  {selectedOrder.customer_full_name ||
                    selectedOrder.customer?.full_name ||
                    "N/A"}
                </p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Current Status</label>
                <div className={styles.currentStatus}>
                  <span
                    className={`${styles.statusBadge} ${getStatusBadgeClass(selectedOrder.status)}`}
                  >
                    {selectedOrder.status?.toUpperCase() || "PENDING"}
                  </span>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  New Status <span className={styles.required}>*</span>
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className={styles.select}
                  required
                >
                  <option value="">-- Select Status --</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="paid">Paid</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Shipping Details - Show only when 'shipped' is selected */}
              {newStatus === 'shipped' && (
                <div className={styles.shippingDetails}>
                  <h4 className={styles.shippingTitle}>Shipping Information</h4>
                  
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Tracking Number <span className={styles.required}>*</span>
                    </label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="Enter tracking number"
                      className={styles.input}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Carrier <span className={styles.required}>*</span>
                    </label>
                    <select
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      className={styles.select}
                      required
                    >
                      <option value="">Select carrier</option>
                      <option value="PAXI">PAxi</option>
                      <option value="The Courier Guy">The Courier Guy</option>
                      <option value="PostNet">PostNet</option>
                    </select>
                  </div>

                  <div className={styles.addressBox}>
                    <h4>Delivery Address</h4>
                    <p>
                      {selectedOrder.shipping_address_snapshot?.full_name}<br />
                      {selectedOrder.shipping_address_snapshot?.address_line1}<br />
                      {selectedOrder.shipping_address_snapshot?.address_line2 && (
                        <>{selectedOrder.shipping_address_snapshot.address_line2}<br /></>
                      )}
                      {selectedOrder.shipping_address_snapshot?.city}, {selectedOrder.shipping_address_snapshot?.state} {selectedOrder.shipping_address_snapshot?.postal_code}<br />
                      {selectedOrder.shipping_address_snapshot?.country}<br />
                      Phone: {selectedOrder.shipping_address_snapshot?.phone}
                    </p>
                  </div>
                  
                  <div className={styles.commissionInfo}>
                    <p>Commission upon delivery: <strong>
                      {formatCurrency(selectedOrder.total_amount * 0.1)}
                    </strong></p>
                  </div>
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.label}>Notes (Optional)</label>
                <textarea
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  className={styles.textarea}
                  rows="3"
                  placeholder="Add any notes about this status update..."
                ></textarea>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedOrder(null);
                  setNewStatus("");
                  setStatusNotes("");
                  setTrackingNumber("");
                  setCarrier("");
                }}
                className={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                onClick={handleStatusUpdate}
                disabled={
                  !newStatus || 
                  updatingStatus || 
                  (newStatus === 'shipped' && (!trackingNumber || !carrier))
                }
                className={styles.confirmButton}
              >
                {updatingStatus ? (
                  <>
                    <span className={styles.buttonSpinner}></span>
                    Updating...
                  </>
                ) : (
                  "Update Status"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentOrders;