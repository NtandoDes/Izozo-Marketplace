/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { agentService } from "../../services/agentService";
import styles from "./AgentOrderDetail.module.css";

const AgentOrderDetail = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  // eslint-disable-next-line no-unused-vars
  const { user } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("details");

  // Status update modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  // Shipping details for shipped status
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");

  // Timeline
  const [statusHistory, setStatusHistory] = useState([]);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await agentService.getOrder(orderId);
      console.log("✅ Order details fetched:", data);
      setOrder(data);

      // Set status history from order data
      if (data.status_history) {
        setStatusHistory(data.status_history);
      } else {
        // Create mock history if not available
        setStatusHistory([
          {
            status: data.status,
            notes: "Order created",
            changed_by: data.agent_details?.user?.full_name || "Agent",
            created_at: data.created_at,
          },
        ]);
      }

      // Set current status for modal
      setNewStatus(data.status);
    } catch (err) {
      console.error("Error fetching order details:", err);
      setError("Failed to load order details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!newStatus || newStatus === order.status) {
      setShowStatusModal(false);
      return;
    }

    // Validate shipping details if status is 'shipped'
    if (newStatus === 'shipped' && (!trackingNumber || !carrier)) {
      alert('Please enter tracking number and select carrier');
      return;
    }

    setUpdatingStatus(true);

    try {
      const orderIdentifier = order.order_number || order.id;

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

      // Refresh order details
      await fetchOrderDetails();

      setShowStatusModal(false);
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

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "R0.00";
    return `R${parseFloat(amount).toLocaleString(undefined, {
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
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "N/A";
    }
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

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return "⏳";
      case "processing":
        return "🔄";
      case "paid":
        return "💰";
      case "shipped":
        return "🚚";
      case "delivered":
        return "✅";
      case "cancelled":
        return "❌";
      default:
        return "📝";
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading order details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>❌</div>
        <h2 className={styles.errorTitle}>Error Loading Order</h2>
        <p className={styles.errorMessage}>{error}</p>
        <button
          onClick={() => navigate("/agent/orders")}
          className={styles.backButton}
        >
          Back to Orders
        </button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className={styles.notFoundContainer}>
        <div className={styles.notFoundIcon}>🔍</div>
        <h2 className={styles.notFoundTitle}>Order Not Found</h2>
        <p className={styles.notFoundMessage}>
          The order you're looking for doesn't exist or you don't have
          permission to view it.
        </p>
        <button
          onClick={() => navigate("/agent/orders")}
          className={styles.backButton}
        >
          Back to Orders
        </button>
      </div>
    );
  }

  // Check if order is delivered
  const isOrderDelivered = order.status?.toLowerCase() === "delivered";

  return (
    <div className={styles.container}>
      {/* Navigation Header */}
      <div className={styles.navigation}>
        <Link to="/agent/orders" className={styles.backLink}>
          ← Back to Orders
        </Link>
        <div className={styles.orderMeta}>
          <span className={styles.orderNumber}>
            Order #{order.order_number || order.id}
          </span>
          <span
            className={`${styles.statusBadge} ${getStatusBadgeClass(order.status)}`}
          >
            {getStatusIcon(order.status)}{" "}
            {order.status?.toUpperCase() || "PENDING"}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.content}>
        {/* Header Section */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>
              Order #{order.order_number || order.id}
            </h1>
            <div className={styles.orderInfo}>
              <span className={styles.orderDate}>
                Placed on {formatDate(order.created_at)}
              </span>
              <span
                className={`${styles.typeBadge} ${order.order_type === "agent" ? styles.agentType : styles.platformType}`}
              >
                {order.order_type === "agent"
                  ? "AGENT ASSISTED"
                  : "PLATFORM ORDER"}
              </span>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button
              onClick={() => setShowStatusModal(true)}
              className={`${styles.statusButton} ${isOrderDelivered ? styles.disabledButton : ""}`}
              disabled={isOrderDelivered}
              title={isOrderDelivered ? "Cannot update status for delivered orders" : "Update Status"}
            >
              📝 Update Status
            </button>
          </div>
        </div>

        {/* Show delivery completion message if order is delivered */}
        {isOrderDelivered && (
          <div className={styles.deliveryMessage}>
            <div className={styles.deliveryIcon}>✅</div>
            <div className={styles.deliveryContent}>
              <h3>Order Completed</h3>
              <p>This order has been delivered and is now complete. Status updates are disabled.</p>
            </div>
          </div>
        )}

        {/* Order Progress Timeline */}
        <div className={styles.timelineSection}>
          <h3 className={styles.sectionTitle}>Order Progress</h3>
          <div className={styles.timeline}>
            {["pending", "processing", "paid", "shipped", "delivered"].map(
              (status, index) => {
                const isCompleted =
                  order.status === status ||
                  (status === "delivered" && order.status === "delivered") ||
                  (status === "shipped" &&
                    ["shipped", "delivered"].includes(order.status)) ||
                  (status === "paid" &&
                    ["paid", "shipped", "delivered"].includes(order.status)) ||
                  (status === "processing" &&
                    ["processing", "paid", "shipped", "delivered"].includes(
                      order.status,
                    )) ||
                  (status === "pending" &&
                    [
                      "pending",
                      "processing",
                      "paid",
                      "shipped",
                      "delivered",
                    ].includes(order.status));

                const isCurrent = order.status === status;

                return (
                  <div
                    key={status}
                    className={`${styles.timelineItem} ${isCompleted ? styles.completed : ""} ${isCurrent ? styles.current : ""}`}
                  >
                    <div className={styles.timelineIcon}>
                      {status === "pending" && "⏳"}
                      {status === "processing" && "🔄"}
                      {status === "paid" && "💰"}
                      {status === "shipped" && "🚚"}
                      {status === "delivered" && "✅"}
                    </div>
                    <div className={styles.timelineContent}>
                      <span className={styles.timelineStatus}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                      {isCompleted && !isCurrent && (
                        <span className={styles.timelineCheck}>✓</span>
                      )}
                      {isCurrent && (
                        <span className={styles.timelineCurrent}>Current</span>
                      )}
                    </div>
                  </div>
                );
              },
            )}
            {order.status === "cancelled" && (
              <div className={`${styles.timelineItem} ${styles.cancelled}`}>
                <div className={styles.timelineIcon}>❌</div>
                <div className={styles.timelineContent}>
                  <span className={styles.timelineStatus}>Cancelled</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "details" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("details")}
          >
            Order Details
          </button>
          <button
            className={`${styles.tab} ${activeTab === "items" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("items")}
          >
            Items ({order.items?.length || 0})
          </button>
          <button
            className={`${styles.tab} ${activeTab === "timeline" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("timeline")}
          >
            Status History
          </button>
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          {/* Order Details Tab */}
          {activeTab === "details" && (
            <div className={styles.detailsTab}>
              {/* Two Column Layout */}
              <div className={styles.twoColumnGrid}>
                {/* Left Column - Customer & Shipping */}
                <div className={styles.leftColumn}>
                  {/* Customer Information */}
                  <div className={styles.infoCard}>
                    <h3 className={styles.cardTitle}>
                      <span className={styles.cardIcon}>👤</span>
                      Customer Information
                    </h3>
                    <div className={styles.customerInfo}>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Name:</span>
                        <span className={styles.infoValue}>
                          {order.customer_full_name ||
                            order.customer?.full_name ||
                            "N/A"}
                        </span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Email:</span>
                        <span className={styles.infoValue}>
                          {order.customer_email ||
                            order.customer?.email ||
                            "N/A"}
                        </span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Phone:</span>
                        <span className={styles.infoValue}>
                          {order.customer_phone ||
                            order.customer?.phone ||
                            "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Shipping Address */}
                  <div className={styles.infoCard}>
                    <h3 className={styles.cardTitle}>
                      <span className={styles.cardIcon}>🚚</span>
                      Shipping Address
                    </h3>
                    <div className={styles.addressInfo}>
                      {order.shipping_address_snapshot ? (
                        <>
                          <p className={styles.addressName}>
                            {order.shipping_address_snapshot.full_name}
                          </p>
                          <p className={styles.addressLine}>
                            {order.shipping_address_snapshot.address_line1}
                          </p>
                          {order.shipping_address_snapshot.address_line2 && (
                            <p className={styles.addressLine}>
                              {order.shipping_address_snapshot.address_line2}
                            </p>
                          )}
                          <p className={styles.addressLine}>
                            {order.shipping_address_snapshot.city},{" "}
                            {order.shipping_address_snapshot.state}{" "}
                            {order.shipping_address_snapshot.postal_code}
                          </p>
                          <p className={styles.addressLine}>
                            {order.shipping_address_snapshot.country}
                          </p>
                          {order.shipping_address_snapshot.phone && (
                            <p className={styles.addressPhone}>
                              Phone: {order.shipping_address_snapshot.phone}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className={styles.noAddress}>
                          No shipping address provided
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Billing Address */}
                  <div className={styles.infoCard}>
                    <h3 className={styles.cardTitle}>
                      <span className={styles.cardIcon}>💰</span>
                      Billing Address
                    </h3>
                    <div className={styles.addressInfo}>
                      {order.billing_address_snapshot ? (
                        <>
                          <p className={styles.addressName}>
                            {order.billing_address_snapshot.full_name}
                          </p>
                          <p className={styles.addressLine}>
                            {order.billing_address_snapshot.address_line1}
                          </p>
                          {order.billing_address_snapshot.address_line2 && (
                            <p className={styles.addressLine}>
                              {order.billing_address_snapshot.address_line2}
                            </p>
                          )}
                          <p className={styles.addressLine}>
                            {order.billing_address_snapshot.city},{" "}
                            {order.billing_address_snapshot.state}{" "}
                            {order.billing_address_snapshot.postal_code}
                          </p>
                          <p className={styles.addressLine}>
                            {order.billing_address_snapshot.country}
                          </p>
                        </>
                      ) : (
                        <p className={styles.noAddress}>
                          Same as shipping address
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column - Order Summary & Payment */}
                <div className={styles.rightColumn}>
                  {/* Order Summary */}
                  <div className={styles.infoCard}>
                    <h3 className={styles.cardTitle}>
                      <span className={styles.cardIcon}>📋</span>
                      Order Summary
                    </h3>
                    <div className={styles.summaryInfo}>
                      <div className={styles.summaryRow}>
                        <span className={styles.summaryLabel}>Subtotal:</span>
                        <span className={styles.summaryValue}>
                          {formatCurrency(order.subtotal || 0)}
                        </span>
                      </div>
                      {order.discount_amount > 0 && (
                        <div className={styles.summaryRow}>
                          <span className={styles.summaryLabel}>Discount:</span>
                          <span className={styles.summaryDiscount}>
                            -{formatCurrency(order.discount_amount)}
                          </span>
                        </div>
                      )}
                      <div className={styles.summaryRow}>
                        <span className={styles.summaryLabel}>Shipping:</span>
                        <span className={styles.summaryValue}>
                          {formatCurrency(order.shipping_amount || 0)}
                        </span>
                      </div>
                      <div className={styles.summaryRow}>
                        <span className={styles.summaryLabel}>Tax:</span>
                        <span className={styles.summaryValue}>
                          {formatCurrency(order.tax_amount || 0)}
                        </span>
                      </div>
                      <div className={styles.summaryRowTotal}>
                        <span className={styles.summaryLabel}>Total:</span>
                        <span className={styles.summaryTotal}>
                          {formatCurrency(order.total_amount || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Information */}
                  <div className={styles.infoCard}>
                    <h3 className={styles.cardTitle}>
                      <span className={styles.cardIcon}>💳</span>
                      Payment Information
                    </h3>
                    <div className={styles.paymentInfo}>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>
                          Payment Status:
                        </span>
                        <span
                          className={`${styles.paymentStatus} ${
                            order.payment_status === "paid"
                              ? styles.paymentPaid
                              : order.payment_status === "pending"
                                ? styles.paymentPending
                                : order.payment_status === "failed"
                                  ? styles.paymentFailed
                                  : styles.paymentRefunded
                          }`}
                        >
                          {order.payment_status?.toUpperCase() || "PENDING"}
                        </span>
                      </div>
                      {order.payment_method && (
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>
                            Payment Method:
                          </span>
                          <span className={styles.infoValue}>
                            {order.payment_method}
                          </span>
                        </div>
                      )}
                      {order.payment_reference && (
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Reference:</span>
                          <span className={styles.infoValue}>
                            {order.payment_reference}
                          </span>
                        </div>
                      )}
                      {order.paid_at && (
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Paid Date:</span>
                          <span className={styles.infoValue}>
                            {formatDate(order.paid_at)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Shipping Information */}
                  <div className={styles.infoCard}>
                    <h3 className={styles.cardTitle}>
                      <span className={styles.cardIcon}>📦</span>
                      Shipping Information
                    </h3>
                    <div className={styles.shippingInfo}>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>
                          Shipping Method:
                        </span>
                        <span className={styles.infoValue}>
                          {order.shipping_method?.toUpperCase() || "STANDARD"}
                        </span>
                      </div>
                      {order.tracking_number && (
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>
                            Tracking Number:
                          </span>
                          <span className={styles.trackingNumber}>
                            {order.tracking_number}
                          </span>
                        </div>
                      )}
                      {order.shipped_at && (
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>
                            Shipped Date:
                          </span>
                          <span className={styles.infoValue}>
                            {formatDate(order.shipped_at)}
                          </span>
                        </div>
                      )}
                      {order.delivered_at && (
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>
                            Delivered Date:
                          </span>
                          <span className={styles.infoValue}>
                            {formatDate(order.delivered_at)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Agent Information (for assisted orders) */}
                  {order.order_type === "agent" && order.agent_details && (
                    <div className={styles.infoCard}>
                      <h3 className={styles.cardTitle}>
                        <span className={styles.cardIcon}>🤝</span>
                        Agent Information
                      </h3>
                      <div className={styles.agentInfo}>
                        <div className={styles.agentAvatar}>
                          {order.agent_details.user?.full_name?.charAt(0) ||
                            "A"}
                        </div>
                        <div className={styles.agentDetails}>
                          <h4 className={styles.agentName}>
                            {order.agent_details.user?.full_name || "Agent"}
                          </h4>
                          <p className={styles.agentEmail}>
                            {order.agent_details.user?.email}
                          </p>
                          <p className={styles.agentPhone}>
                            {order.agent_details.user?.phone || "No phone"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Order Items Tab */}
          {activeTab === "items" && (
            <div className={styles.itemsTab}>
              <h3 className={styles.tabTitle}>Order Items</h3>

              {order.items && order.items.length > 0 ? (
                <div className={styles.itemsTableContainer}>
                  <table className={styles.itemsTable}>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Price</th>
                        <th>Quantity</th>
                        <th>Total</th>
                        <th>SMME</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item, index) => (
                        <tr key={index}>
                          <td>
                            <div className={styles.productInfo}>
                              <span className={styles.productName}>
                                {item.product_name}
                              </span>
                              {item.variant_name && (
                                <span className={styles.productVariant}>
                                  {item.variant_name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className={styles.productSku}>
                              {item.product_sku || "N/A"}
                            </span>
                          </td>
                          <td>
                            <span className={styles.productPrice}>
                              {formatCurrency(item.unit_price)}
                            </span>
                          </td>
                          <td>
                            <span className={styles.productQuantity}>
                              {item.quantity}
                            </span>
                          </td>
                          <td>
                            <span className={styles.productTotal}>
                              {formatCurrency(item.total)}
                            </span>
                          </td>
                          <td>
                            <span className={styles.productSme}>
                              {item.sme?.business_name ||
                                item.sme_name ||
                                "N/A"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="4" className={styles.footerLabel}>
                          Subtotal:
                        </td>
                        <td className={styles.footerValue}>
                          {formatCurrency(order.subtotal || 0)}
                        </td>
                        <td></td>
                      </tr>
                      {order.discount_amount > 0 && (
                        <tr>
                          <td colSpan="4" className={styles.footerLabel}>
                            Discount:
                          </td>
                          <td className={styles.footerDiscount}>
                            -{formatCurrency(order.discount_amount)}
                          </td>
                          <td></td>
                        </tr>
                      )}
                      <tr>
                        <td colSpan="4" className={styles.footerLabel}>
                          Shipping:
                        </td>
                        <td className={styles.footerValue}>
                          {formatCurrency(order.shipping_amount || 0)}
                        </td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan="4" className={styles.footerLabel}>
                          Tax:
                        </td>
                        <td className={styles.footerValue}>
                          {formatCurrency(order.tax_amount || 0)}
                        </td>
                        <td></td>
                      </tr>
                      <tr className={styles.totalRow}>
                        <td colSpan="4" className={styles.footerLabel}>
                          Total:
                        </td>
                        <td className={styles.footerTotal}>
                          {formatCurrency(order.total_amount || 0)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className={styles.emptySection}>
                  <div className={styles.emptyIcon}>📦</div>
                  <h4>No Items</h4>
                  <p>This order has no items.</p>
                </div>
              )}
            </div>
          )}

          {/* Status History Tab */}
          {activeTab === "timeline" && (
            <div className={styles.timelineTab}>
              <h3 className={styles.tabTitle}>Status History</h3>

              {statusHistory.length > 0 ? (
                <div className={styles.historyTimeline}>
                  {statusHistory.map((history, index) => (
                    <div key={index} className={styles.historyItem}>
                      <div className={styles.historyIcon}>
                        {getStatusIcon(history.status)}
                      </div>
                      <div className={styles.historyContent}>
                        <div className={styles.historyHeader}>
                          <span
                            className={`${styles.historyStatus} ${getStatusBadgeClass(history.status)}`}
                          >
                            {history.status?.toUpperCase() || "PENDING"}
                          </span>
                          <span className={styles.historyDate}>
                            {formatDate(history.created_at)}
                          </span>
                        </div>
                        {history.notes && (
                          <p className={styles.historyNotes}>{history.notes}</p>
                        )}
                        <span className={styles.historyUser}>
                          Updated by:{" "}
                          {history.changed_by ||
                            history.changed_by_name ||
                            "System"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptySection}>
                  <div className={styles.emptyIcon}>📋</div>
                  <h4>No Status History</h4>
                  <p>No status updates have been recorded for this order.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Customer Notes */}
        {order.customer_notes && (
          <div className={styles.notesSection}>
            <h3 className={styles.sectionTitle}>Customer Notes</h3>
            <div className={styles.notesContent}>{order.customer_notes}</div>
          </div>
        )}

        {/* Admin Notes */}
        {order.admin_notes && (
          <div className={styles.notesSection}>
            <h3 className={styles.sectionTitle}>Admin Notes</h3>
            <div className={styles.notesContent}>{order.admin_notes}</div>
          </div>
        )}
      </div>

      {/* Status Update Modal */}
      {showStatusModal && !isOrderDelivered && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Update Order Status</h3>
              <button
                onClick={() => {
                  setShowStatusModal(false);
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
                  Order #{order.order_number || order.id}
                </p>
                <p className={styles.modalCustomer}>
                  Customer:{" "}
                  {order.customer_full_name ||
                    order.customer?.full_name ||
                    "N/A"}
                </p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Current Status</label>
                <div className={styles.currentStatus}>
                  <span
                    className={`${styles.statusBadge} ${getStatusBadgeClass(order.status)}`}
                  >
                    {order.status?.toUpperCase() || "PENDING"}
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
                      {order.shipping_address_snapshot?.full_name}<br />
                      {order.shipping_address_snapshot?.address_line1}<br />
                      {order.shipping_address_snapshot?.address_line2 && (
                        <>{order.shipping_address_snapshot.address_line2}<br /></>
                      )}
                      {order.shipping_address_snapshot?.city}, {order.shipping_address_snapshot?.state} {order.shipping_address_snapshot?.postal_code}<br />
                      {order.shipping_address_snapshot?.country}<br />
                      Phone: {order.shipping_address_snapshot?.phone}
                    </p>
                  </div>
                  
                  <div className={styles.commissionInfo}>
                    <p>Commission upon delivery: <strong>
                      {formatCurrency(order.total_amount * 0.1)}
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
                  newStatus === order.status ||
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

export default AgentOrderDetail;