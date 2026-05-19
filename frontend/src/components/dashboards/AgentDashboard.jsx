/* eslint-disable no-unused-vars */
// frontend/src/components/dashboards/AgentDashboard.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { agentService } from "../../services/agentService";
import AgentCollectionDashboard from "../../Pages/agent/AgentCollectionDashboard";
import AgentShippingDashboard from "../../Pages/agent/AgentShippingDashboard";
import AgentCommissionDashboard from "../../Pages/agent/AgentCommissionDashboard";
import styles from "./AgentDashboard.module.css";

const AgentDashboard = () => {
  const navigate = useNavigate();
  const { user, profile, refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // State for all data
  const [agentData, setAgentData] = useState(null);
  const [assignedSMEs, setAssignedSMEs] = useState([]);
  const [recentProducts, setRecentProducts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [pickupOrders, setPickupOrders] = useState([]);
  const [allProducts, setAllProducts] = useState([]); // Store all products
  const [allOrders, setAllOrders] = useState([]); // Store all orders
  const [commission, setCommission] = useState({
    totalCommission: 0,
    pendingCommission: 0,
    paidCommission: 0,
    thisMonth: 0,
  });
  const [stats, setStats] = useState({
    totalSMEs: 0,
    totalProducts: 0,
    activeProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    deliveredOrders: 0,
    readyForPickup: 0,
  });

  // Initialize with data from AuthContext
  useEffect(() => {
    if (user && profile) {
      console.log("AuthContext agent data:", { user, profile });

      // Set agent profile data from AuthContext
      setAgentData({
        id: profile.id || user.id,
        name: user.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
        homeAddress: profile.home_address || "",
        hasInternet: profile.has_internet || false,
        hasSmartphone: profile.has_smartphone || false,
        status: user.status || "pending",
        createdAt: profile.created_at || user.created_at,
      });
    }
  }, [user, profile]);

  // Fetch additional dashboard data
  useEffect(() => {
    if (user && profile && user.role === "agent") {
      fetchDashboardData();
      fetchPickupOrders();

      // Poll for new pickup orders every 15 seconds
      const interval = setInterval(fetchPickupOrders, 15000);
      return () => clearInterval(interval);
    }
  }, [user, profile]);

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }

    setError(null);

    try {
      // Fetch data from agent service
      const dashboardData = await agentService.getDashboardData();

      console.log("📊 Dashboard data received:", dashboardData);
      console.log("💰 Commission data:", dashboardData.commission);

      // Store all products and orders
      const products = dashboardData.products || [];
      const orders = dashboardData.orders || [];

      setAllProducts(products);
      setAllOrders(orders);

      // Process assigned SMEs with proper counts
      const processedSMEs = (dashboardData.assignedSMEs || []).map((sme) => {
        // Count products for this SME by matching SME ID
        const smeProducts = products.filter((p) => {
          return (
            p.sme_id === sme.id ||
            p.sme?.id === sme.id ||
            p.sme === sme.id ||
            (p.sme_name &&
              sme.business_name &&
              p.sme_name === sme.business_name)
          );
        });

        // Count orders for this SME
        const smeOrders = orders.filter((o) => {
          return (
            o.sme_id === sme.id ||
            o.sme?.id === sme.id ||
            (o.sme_name &&
              sme.business_name &&
              o.sme_name === sme.business_name)
          );
        });

        console.log(
          `📊 SME ${sme.business_name}: Found ${smeProducts.length} products, ${smeOrders.length} orders`,
        );

        return {
          ...sme,
          productsCount: smeProducts.length,
          activeProducts: smeProducts.filter((p) => p.is_active).length,
          ordersCount: smeOrders.length,
          totalRevenue: smeOrders
            .filter((o) => o.status === "delivered" || o.status === "paid")
            .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0),
        };
      });

      setAssignedSMEs(processedSMEs);

      // Set recent products
      setRecentProducts(
        products.slice(0, 5).map((product) => ({
          id: product.id,
          name: product.name || "Unnamed Product",
          sme: product.sme_name || product.sme?.business_name || "Unknown SME",
          sme_id: product.sme_id || product.sme?.id,
          basePrice: parseFloat(product.base_price || 0),
          finalPrice: parseFloat(
            product.selling_price || product.base_price || 0,
          ),
          status: product.is_active ? "Active" : "Pending",
          is_active: product.is_active,
        })),
      );

      // Set recent orders with proper customer name
      setRecentOrders(
        orders.slice(0, 5).map((order) => ({
          id: order.order_id || order.id,
          order_number: order.order_number,
          customer:
            order.customer_full_name ||
            order.customer_name ||
            order.customer?.full_name ||
            order.customer?.name ||
            "Guest Customer",
          customer_email: order.customer_email || order.customer?.email,
          sme: order.sme_name || order.sme?.business_name || "Unknown SME",
          sme_id: order.sme_id || order.sme?.id,
          total: parseFloat(order.total_amount || 0),
          status: order.status?.toUpperCase() || "PENDING",
          type: order.order_type || (order.assisted_by ? "AGENT" : "PLATFORM"),
          date: order.created_at
            ? new Date(order.created_at).toLocaleDateString("en-ZA")
            : new Date().toLocaleDateString("en-ZA"),
          created_at: order.created_at,
        })),
      );

      // Set commission data - ensure we're using the correct field names
      const commissionData = dashboardData.commission || {};
      console.log("💰 Parsed commission data:", commissionData);
      
      setCommission({
        totalCommission: commissionData.total_commission || 0,
        pendingCommission: commissionData.pending_commission || 0,
        paidCommission: commissionData.paid_commission || 0,
        thisMonth: commissionData.this_month || 0,
      });

      // Calculate stats
      const totalProducts = products.length;
      const activeProducts = products.filter((p) => p.is_active).length;
      const totalOrders = orders.length;
      const pendingOrders = orders.filter(
        (o) => o.status === "pending" || o.status === "processing",
      ).length;
      const deliveredOrders = orders.filter(
        (o) => o.status === "delivered",
      ).length;

      setStats({
        totalSMEs: dashboardData.assignedSMEs?.length || 0,
        totalProducts,
        activeProducts,
        totalOrders,
        pendingOrders,
        deliveredOrders,
        readyForPickup: dashboardData.readyForPickup || 0,
      });
    } catch (err) {
      console.error("Error fetching dashboard data:", err);

      // Handle authentication errors
      if (
        err.status === 401 ||
        err.detail === "Authentication credentials were not provided."
      ) {
        localStorage.removeItem("izozo_tokens");
        navigate("/login");
        return;
      }

      // Don't show error for missing endpoints - just use empty data
      if (!err.response || err.response.status !== 404) {
        setError({
          title: "Failed to load dashboard",
          message: err.message || "Please try again later",
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Enhanced fetchPickupOrders function with better logging
  const fetchPickupOrders = async () => {
    try {
      console.log("🔍 Fetching pickup orders...");
      const orders = await agentService.getReadyForPickupOrders();
      console.log("📦 Pickup orders fetched:", orders);
      console.log("📦 Number of pickup orders:", orders.length);

      // Log each order for debugging
      if (orders.length > 0) {
        orders.forEach((order, index) => {
          console.log(`📦 Order ${index + 1}:`, {
            id: order.id,
            order_number: order.order_number,
            status: order.status,
            sme_name: order.sme_name,
          });
        });
      }

      setPickupOrders(orders);
      setStats((prev) => ({ ...prev, readyForPickup: orders.length }));

      if (orders.length > 0) {
        console.log(
          "✅ Showing collection dashboard with",
          orders.length,
          "orders",
        );
      } else {
        console.log("ℹ️ No pickup orders to display");
      }
    } catch (error) {
      console.error("❌ Error fetching pickup orders:", error);
    }
  };

  // Manual check for pickup orders
  const handleCheckPickups = () => {
    fetchPickupOrders();
    alert("Checking for pickup orders...");
  };

  // Log when pickupOrders state changes
  useEffect(() => {
    console.log("🔄 Pickup orders state updated:", pickupOrders.length);
  }, [pickupOrders]);

  const handleRefresh = () => {
    refreshUser(); // Refresh from AuthContext
    fetchDashboardData(true);
    fetchPickupOrders();
  };

  const handleCreateOrder = () => {
    navigate("/agent/orders/create");
  };

  const handleAddProduct = () => {
    navigate("/agent/products/create");
  };

  const handleUpdateOrderStatus = async (orderId, currentStatus) => {
    try {
      const newStatus = prompt(
        "Enter new status (processing, paid, delivered, cancelled):",
        currentStatus.toLowerCase(),
      );
      if (
        newStatus &&
        ["processing", "paid", "delivered", "cancelled"].includes(
          newStatus.toLowerCase(),
        )
      ) {
        await agentService.updateOrderStatus(orderId, newStatus);

        // Refresh orders
        const orders = await agentService.getAssignedOrders({ limit: 5 });
        setRecentOrders(
          orders.map((order) => ({
            id: order.order_id || order.id,
            order_number: order.order_number,
            customer:
              order.customer_full_name ||
              order.customer_name ||
              order.customer?.full_name ||
              "Guest Customer",
            customer_email: order.customer_email || order.customer?.email,
            sme: order.sme_name || order.sme?.business_name || "Unknown SME",
            total: parseFloat(order.total_amount || 0),
            status: order.status?.toUpperCase() || "PENDING",
            type:
              order.order_type || (order.assisted_by ? "AGENT" : "PLATFORM"),
            date: order.created_at
              ? new Date(order.created_at).toLocaleDateString("en-ZA")
              : new Date().toLocaleDateString("en-ZA"),
          })),
        );
      }
    } catch (err) {
      console.error("Error updating order status:", err);
      alert("Failed to update order status. Please try again.");
    }
  };

  // Get product count for a specific SME
  const getProductCountForSME = (smeId) => {
    if (!smeId || !allProducts.length) return 0;
    return allProducts.filter((p) => p.sme_id === smeId || p.sme?.id === smeId)
      .length;
  };

  // Get order count for a specific SME
  const getOrderCountForSME = (smeId) => {
    if (!smeId || !allOrders.length) return 0;
    return allOrders.filter((o) => o.sme_id === smeId || o.sme?.id === smeId)
      .length;
  };

  // Check if agent has profile
  const hasAgentProfile = () => {
    if (!user || !profile) return false;
    if (user.role !== "agent") return false;

    // Check if profile has required fields
    return profile.home_address && profile.home_address.trim() !== "";
  };

  const formatCurrency = (amount) => {
    // Ensure amount is a number
    const numAmount = parseFloat(amount) || 0;
    return `R${numAmount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-ZA", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  // No Agent Profile State
  if (!hasAgentProfile()) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>🤝</div>
        <h3 className={styles.emptyTitle}>No Agent Profile Found</h3>
        <p className={styles.emptyDescription}>
          Please complete your agent registration to start using the dashboard.
        </p>
        <Link to="/agent/complete-profile" className={styles.emptyButton}>
          Complete Profile
        </Link>
      </div>
    );
  }

  // Pending Approval State
  if (user?.status === "pending") {
    return (
      <div className={styles.pendingContainer}>
        <div className={styles.pendingCard}>
          <div className={styles.pendingIcon}>⏳</div>
          <h2>Account Pending Approval</h2>
          <p>
            Your agent account is currently being reviewed by our team. You'll
            receive an email once your account is approved.
          </p>
          <div className={styles.profileSummary}>
            <h3>Agent Information</h3>
            <p>
              <strong>{agentData?.name}</strong>
            </p>
            <p>{agentData?.email}</p>
            <p>{agentData?.phone}</p>
            <p>{agentData?.homeAddress}</p>
          </div>
          <button onClick={handleRefresh} className={styles.retryButton}>
            Check Status
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      {/* Header */}
      <div className={styles.dashboardHeader}>
        <div className={styles.headerLeft}>
          <div>
            <h1>Agent Dashboard</h1>
            <div className={styles.userInfo}>
              <span className={styles.agentName}>
                {agentData?.name || "Agent"}
              </span>
              <span className={styles.agentEmail}>
                {agentData?.email || ""}
              </span>
            </div>
          </div>
          {refreshing && (
            <span className={styles.refreshing}>Refreshing...</span>
          )}
        </div>
        <div className={styles.headerActions}>
          <button onClick={handleCreateOrder} className={styles.primaryButton}>
            + Create Assisted Order
          </button>
          <button onClick={handleAddProduct} className={styles.secondaryButton}>
            + Add Product
          </button>
          <button
            onClick={handleRefresh}
            className={styles.refreshButton}
            title="Refresh"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.errorAlert}>
          <div className={styles.errorIcon}>❌</div>
          <div className={styles.errorContent}>
            <h3>{error.title || "Error"}</h3>
            <p>{error.message || "Something went wrong"}</p>
          </div>
          <button onClick={() => setError(null)} className={styles.closeButton}>
            ×
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ backgroundColor: "rgba(242, 192, 26, 0.1)" }}
          >
            🏢
          </div>
          <div className={styles.statContent}>
            <h3>{stats.totalSMEs}</h3>
            <p>Assigned SMMEs</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ backgroundColor: "rgba(76, 175, 80, 0.1)" }}
          >
            📦
          </div>
          <div className={styles.statContent}>
            <h3>{stats.totalProducts}</h3>
            <p>Total Products</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ backgroundColor: "rgba(33, 150, 243, 0.1)" }}
          >
            📋
          </div>
          <div className={styles.statContent}>
            <h3>{stats.totalOrders}</h3>
            <p>Total Orders</p>
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
            <h3>{formatCurrency(commission.totalCommission)}</h3>
            <p>Total Commission</p>
            {commission.pendingCommission > 0 && (
              <small className={styles.pendingCommission}>
                +{formatCurrency(commission.pendingCommission)} pending
              </small>
            )}
          </div>
        </div>
      </div>

      {/* Collection Dashboard - Shows when orders are ready for pickup */}
      {pickupOrders.length > 0 ? (
        <AgentCollectionDashboard pickupOrders={pickupOrders} />
      ) : (
        pickupOrders.length === 0 &&
        !loading && (
          <div className={styles.noPickupMessage}>
            <p>No orders ready for pickup at the moment.</p>
            <button
              onClick={fetchPickupOrders}
              className={styles.refreshPickupButton}
            >
              🔄 Check Again
            </button>
          </div>
        )
      )}

      {/* Dashboard Tabs */}
      <div className={styles.dashboardTabs}>
        <button
          className={`${styles.tabButton} ${activeTab === "overview" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === "shipping" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("shipping")}
        >
          Shipping{" "}
          {stats.readyForPickup > 0 && (
            <span className={styles.tabBadge}>{stats.readyForPickup}</span>
          )}
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === "commission" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("commission")}
        >
          Commission
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className={styles.contentGrid}>
          {/* Assigned SMEs */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2>My SMMEs</h2>
              <span className={styles.badge}>{assignedSMEs.length} SMEs</span>
            </div>
            <div className={styles.listContainer}>
              {assignedSMEs.length > 0 ? (
                assignedSMEs.map((sme) => (
                  <div key={sme.id} className={styles.listItem}>
                    <div
                      className={styles.listItemAvatar}
                      style={{ backgroundColor: "#f2c01a" }}
                    >
                      {sme.business_name?.charAt(0) || "B"}
                    </div>
                    <div className={styles.listItemContent}>
                      <h4>{sme.business_name || "Unnamed Business"}</h4>
                      <p>{sme.business_type || "Not specified"}</p>
                      <div className={styles.smeStats}>
                        <span className={styles.smeStat}>
                          <strong>
                            {sme.productsCount || getProductCountForSME(sme.id)}
                          </strong>{" "}
                          Products
                        </span>
                        <span className={styles.smeStat}>
                          <strong>
                            {sme.ordersCount || getOrderCountForSME(sme.id)}
                          </strong>{" "}
                          Orders
                        </span>
                      </div>
                      {sme.assigned_at && (
                        <small>Assigned: {formatDate(sme.assigned_at)}</small>
                      )}
                    </div>
                    <Link
                      to={`/agent/sme/${sme.id}`}
                      className={styles.viewLink}
                    >
                      View →
                    </Link>
                  </div>
                ))
              ) : (
                <div className={styles.emptyState}>
                  <p>No SMMEs assigned yet</p>
                  <p className={styles.emptyDescription}>
                    SMMEs will appear here once assigned by an administrator.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Products */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2>Recent Products</h2>
              <Link to="/agent/products" className={styles.viewAll}>
                View All
              </Link>
            </div>
            <div className={styles.tableContainer}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SMME</th>
                    <th>Base Price</th>
                    <th>Final Price</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentProducts.length > 0 ? (
                    recentProducts.slice(0, 5).map((product) => (
                      <tr key={product.id}>
                        <td>
                          <Link
                            to={`/agent/products/${product.id}`}
                            className={styles.productLink}
                          >
                            {product.name}
                          </Link>
                        </td>
                        <td>{product.sme}</td>
                        <td>{formatCurrency(product.basePrice)}</td>
                        <td>{formatCurrency(product.finalPrice)}</td>
                        <td>
                          <span
                            className={`${styles.statusBadge} ${product.status === "Active" ? styles.active : styles.pending}`}
                          >
                            {product.status}
                          </span>
                        </td>
                        <td>
                          <Link
                            to={`/agent/products/${product.id}/edit`}
                            className={styles.actionButton}
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className={styles.emptyTableCell}>
                        <p>No products added yet</p>
                        <button
                          onClick={handleAddProduct}
                          className={styles.emptyButton}
                        >
                          Add Your First Product
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Orders */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2>Recent Orders</h2>
              <Link to="/agent/orders" className={styles.viewAll}>
                View All
              </Link>
            </div>
            <div className={styles.tableContainer}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>SMME</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Type</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.length > 0 ? (
                    recentOrders.slice(0, 5).map((order) => (
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
                              {order.customer}
                            </span>
                            
                          </div>
                        </td>
                        <td>{order.sme}</td>
                        <td>{formatCurrency(order.total)}</td>
                        <td>
                          <span
                            className={`${styles.statusBadge} ${styles[order.status.toLowerCase()] || ""}`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`${styles.typeBadge} ${order.type === "AGENT" ? styles.agentType : styles.platformType}`}
                          >
                            {order.type}
                          </span>
                        </td>
                        <td>{order.date}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className={styles.emptyTableCell}>
                        <p>No orders yet</p>
                        <p className={styles.emptyDescription}>
                          Orders will appear here once customers start
                          purchasing.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Actions */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2>Quick Actions</h2>
            </div>
            <div className={styles.quickActions}>
              <Link to="/agent/products/create" className={styles.quickAction}>
                <div className={styles.quickActionIcon}>➕</div>
                <div className={styles.quickActionContent}>
                  <h4>Add New Product</h4>
                  <p>Create product listing for assigned SMME</p>
                </div>
              </Link>

              <Link to="/agent/orders/create" className={styles.quickAction}>
                <div className={styles.quickActionIcon}>🛒</div>
                <div className={styles.quickActionContent}>
                  <h4>Create Assisted Order</h4>
                  <p>Place order for offline customer</p>
                </div>
              </Link>

              <Link to="/agent/orders" className={styles.quickAction}>
                <div className={styles.quickActionIcon}>📋</div>
                <div className={styles.quickActionContent}>
                  <h4>Manage Orders</h4>
                  <p>Update order status and tracking</p>
                </div>
              </Link>

              <Link to="/agent/commission" className={styles.quickAction}>
                <div className={styles.quickActionIcon}>💰</div>
                <div className={styles.quickActionContent}>
                  <h4>View Commission</h4>
                  <p>Check earnings and payout status</p>
                </div>
              </Link>

              <Link to="/account" className={styles.quickAction}>
                <div className={styles.quickActionIcon}>⚙️</div>
                <div className={styles.quickActionContent}>
                  <h4>Account Settings</h4>
                  <p>Update your profile and preferences</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}

      {activeTab === "shipping" && <AgentShippingDashboard />}

      {activeTab === "commission" && <AgentCommissionDashboard />}
    </div>
  );
};

export default AgentDashboard;