/* eslint-disable no-unused-vars */
// frontend/src/pages/sme/SMEOrderDetail.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { smeService } from '../../services/smeService';
import styles from './SMEOrderDetail.module.css';

const SMEOrderDetail = () => {
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [packaging, setPackaging] = useState(false);
  const [packagingSuccess, setPackagingSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('items');

  useEffect(() => {
    fetchOrderDetails();
  }, [orderNumber]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await smeService.getOrderByNumber(orderNumber);
      console.log('✅ Order details fetched:', data);
      setOrder(data);
    } catch (err) {
      console.error('Error fetching order details:', err);
      setError('Failed to load order details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePackageOrder = async () => {
    try {
      setPackaging(true);
      
      // Call API to mark order as ready for pickup
      // This would be a new endpoint you need to create
      const response = await smeService.markOrderReadyForPickup(orderNumber);
      
      console.log('✅ Order marked as ready for pickup:', response);
      setPackagingSuccess(true);
      
      // Refresh order details after 2 seconds
      setTimeout(() => {
        fetchOrderDetails();
        setPackagingSuccess(false);
      }, 2000);
      
    } catch (err) {
      console.error('Error packaging order:', err);
      setError('Failed to package order. Please try again.');
    } finally {
      setPackaging(false);
    }
  };

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
        month: 'long',
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

  const canPackageOrder = () => {
    if (!order) return false;
    return order.status === 'paid' || order.status === 'processing';
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
        <button onClick={() => navigate('/sme/orders')} className={styles.backButton}>
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
          The order you're looking for doesn't exist or has been deleted.
        </p>
        <button onClick={() => navigate('/sme/orders')} className={styles.backButton}>
          Back to Orders
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Navigation Header */}
      <div className={styles.navigation}>
        <Link to="/sme/orders" className={styles.backLink}>
          ← Back to Orders
        </Link>
        <span className={styles.breadcrumb}>
          Orders / {order.order_number}
        </span>
      </div>

      {/* Success Message */}
      {packagingSuccess && (
        <div className={styles.successAlert}>
          <div className={styles.successIcon}>✅</div>
          <div className={styles.successContent}>
            <h3>Order Ready for Pickup!</h3>
            <p>The agent has been notified that this order is ready for collection.</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={styles.content}>
        {/* Header Section */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>Order {order.order_number}</h1>
            <div className={styles.metaInfo}>
              <span className={`${styles.statusBadge} ${getStatusClass(order.status)}`}>
                {getStatusDisplay(order.status)}
              </span>
              <span className={`${styles.paymentStatus} ${order.payment_status === 'paid' ? styles.paymentPaid : styles.paymentPending}`}>
                {order.payment_status === 'paid' ? 'Payment Received' : 'Payment Pending'}
              </span>
              <span className={styles.orderDate}>
                Placed on {formatDate(order.created_at)}
              </span>
            </div>
          </div>
          
          {/* Package Button */}
          {canPackageOrder() && (
            <div className={styles.headerActions}>
              <button
                onClick={handlePackageOrder}
                disabled={packaging}
                className={styles.packageButton}
              >
                {packaging ? '📦 Packaging...' : '📦 Mark as Ready for Pickup'}
              </button>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'items' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('items')}
          >
            Order Items
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'customer' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('customer')}
          >
            Customer Details
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'shipping' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('shipping')}
          >
            Shipping Info
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'payment' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('payment')}
          >
            Payment Details
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'timeline' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            Timeline
          </button>
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          {/* Order Items Tab */}
          {activeTab === 'items' && (
            <div className={styles.itemsTab}>
              <h3 className={styles.tabTitle}>Order Items</h3>
              
              <div className={styles.itemsTable}>
                <table className={styles.itemsTable}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Price</th>
                      <th>Quantity</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items && order.items.map((item, index) => (
                      <tr key={index}>
                        <td>
                          <div className={styles.productInfo}>
                            <span className={styles.productName}>{item.product_name}</span>
                            {item.variant_name && (
                              <span className={styles.variantName}>{item.variant_name}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={styles.productSku}>{item.product_sku || '-'}</span>
                        </td>
                        <td>
                          <span className={styles.productPrice}>{formatCurrency(item.unit_price)}</span>
                        </td>
                        <td>
                          <span className={styles.productQuantity}>{item.quantity}</span>
                        </td>
                        <td>
                          <span className={styles.productTotal}>{formatCurrency(item.total)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="4" className={styles.totalLabel}>Subtotal</td>
                      <td className={styles.totalValue}>{formatCurrency(order.subtotal)}</td>
                    </tr>
                    <tr>
                      <td colSpan="4" className={styles.totalLabel}>Delivery</td>
                      <td className={styles.totalValue}>{formatCurrency(order.shipping_amount)}</td>
                    </tr>
                    <tr>
                      <td colSpan="4" className={styles.totalLabel}>Tax (15% VAT)</td>
                      <td className={styles.totalValue}>{formatCurrency(order.tax_amount)}</td>
                    </tr>
                    <tr>
                      <td colSpan="4" className={styles.grandTotalLabel}>Total</td>
                      <td className={styles.grandTotalValue}>{formatCurrency(order.total_amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Customer Details Tab */}
          {activeTab === 'customer' && (
            <div className={styles.customerTab}>
              <h3 className={styles.tabTitle}>Customer Information</h3>
              
              <div className={styles.infoCard}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Full Name:</span>
                  <span className={styles.infoValue}>{order.customer_full_name || 'N/A'}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Email:</span>
                  <span className={styles.infoValue}>{order.customer_email}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Phone:</span>
                  <span className={styles.infoValue}>{order.customer_phone || 'N/A'}</span>
                </div>
                {order.customer && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Customer ID:</span>
                    <span className={styles.infoValue}>{order.customer}</span>
                  </div>
                )}
              </div>

              {order.agent && (
                <>
                  <h3 className={styles.tabTitle} style={{ marginTop: '2rem' }}>Agent Information</h3>
                  <div className={styles.infoCard}>
                    <div className={styles.agentInfo}>
                      <div className={styles.agentAvatar}>
                        {order.agent_details?.user?.full_name?.charAt(0) || 'A'}
                      </div>
                      <div className={styles.agentDetails}>
                        <h4 className={styles.agentName}>
                          {order.agent_details?.user?.full_name || 'Agent'}
                        </h4>
                        <p className={styles.agentEmail}>{order.agent_details?.user?.email}</p>
                        <p className={styles.agentPhone}>{order.agent_details?.user?.phone || 'No phone'}</p>
                        <div className={styles.agentCapabilities}>
                          {order.agent_details?.has_smartphone && (
                            <span className={styles.capabilityBadge}>📱 Smartphone</span>
                          )}
                          {order.agent_details?.has_internet && (
                            <span className={styles.capabilityBadge}>🌐 Internet</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Shipping Info Tab */}
          {activeTab === 'shipping' && (
            <div className={styles.shippingTab}>
              <h3 className={styles.tabTitle}>Shipping Information</h3>
              
              <div className={styles.infoCard}>
                <h4 className={styles.cardSubtitle}>Shipping Address</h4>
                {order.shipping_address_snapshot ? (
                  <div className={styles.address}>
                    <p><strong>{order.shipping_address_snapshot.full_name}</strong></p>
                    <p>{order.shipping_address_snapshot.address_line1}</p>
                    {order.shipping_address_snapshot.address_line2 && (
                      <p>{order.shipping_address_snapshot.address_line2}</p>
                    )}
                    <p>
                      {order.shipping_address_snapshot.city}, {order.shipping_address_snapshot.state} {order.shipping_address_snapshot.postal_code}
                    </p>
                    <p>{order.shipping_address_snapshot.country}</p>
                    <p>Phone: {order.shipping_address_snapshot.phone}</p>
                  </div>
                ) : (
                  <p className={styles.noData}>No shipping address available</p>
                )}
              </div>

              <div className={styles.infoCard}>
                <h4 className={styles.cardSubtitle}>Delivery Method</h4>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Method:</span>
                  <span className={styles.infoValue}>{order.shipping_method || 'Standard'}</span>
                </div>
                {order.tracking_number && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Tracking #:</span>
                    <span className={styles.infoValue}>{order.tracking_number}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment Details Tab */}
          {activeTab === 'payment' && (
            <div className={styles.paymentTab}>
              <h3 className={styles.tabTitle}>Payment Information</h3>
              
              <div className={styles.infoCard}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Payment Method:</span>
                  <span className={styles.infoValue}>{order.payment_method || 'N/A'}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Payment Status:</span>
                  <span className={`${styles.paymentStatus} ${order.payment_status === 'paid' ? styles.paymentPaid : styles.paymentPending}`}>
                    {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                </div>
                {order.paid_at && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Paid At:</span>
                    <span className={styles.infoValue}>{formatDate(order.paid_at)}</span>
                  </div>
                )}
                {order.payment_reference && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Reference:</span>
                    <span className={styles.infoValue}>{order.payment_reference}</span>
                  </div>
                )}
              </div>

              <div className={styles.infoCard}>
                <h4 className={styles.cardSubtitle}>Billing Address</h4>
                {order.billing_address_snapshot ? (
                  <div className={styles.address}>
                    <p><strong>{order.billing_address_snapshot.full_name}</strong></p>
                    <p>{order.billing_address_snapshot.address_line1}</p>
                    {order.billing_address_snapshot.address_line2 && (
                      <p>{order.billing_address_snapshot.address_line2}</p>
                    )}
                    <p>
                      {order.billing_address_snapshot.city}, {order.billing_address_snapshot.state} {order.billing_address_snapshot.postal_code}
                    </p>
                    <p>{order.billing_address_snapshot.country}</p>
                    <p>Phone: {order.billing_address_snapshot.phone}</p>
                  </div>
                ) : (
                  <p className={styles.noData}>Same as shipping address</p>
                )}
              </div>
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <div className={styles.timelineTab}>
              <h3 className={styles.tabTitle}>Order Timeline</h3>
              
              <div className={styles.timeline}>
                <div className={styles.timelineItem}>
                  <div className={styles.timelineIcon}>🛒</div>
                  <div className={styles.timelineContent}>
                    <h4>Order Placed</h4>
                    <p>{formatDate(order.created_at)}</p>
                  </div>
                </div>
                
                {order.paid_at && (
                  <div className={styles.timelineItem}>
                    <div className={styles.timelineIcon}>💰</div>
                    <div className={styles.timelineContent}>
                      <h4>Payment Received</h4>
                      <p>{formatDate(order.paid_at)}</p>
                    </div>
                  </div>
                )}
                
                {order.status === 'processing' && (
                  <div className={styles.timelineItem}>
                    <div className={styles.timelineIcon}>⚙️</div>
                    <div className={styles.timelineContent}>
                      <h4>Processing</h4>
                      <p>Order is being prepared</p>
                    </div>
                  </div>
                )}
                
                {order.shipped_at && (
                  <div className={styles.timelineItem}>
                    <div className={styles.timelineIcon}>🚚</div>
                    <div className={styles.timelineContent}>
                      <h4>Shipped</h4>
                      <p>{formatDate(order.shipped_at)}</p>
                    </div>
                  </div>
                )}
                
                {order.delivered_at && (
                  <div className={styles.timelineItem}>
                    <div className={styles.timelineIcon}>✅</div>
                    <div className={styles.timelineContent}>
                      <h4>Delivered</h4>
                      <p>{formatDate(order.delivered_at)}</p>
                    </div>
                  </div>
                )}
                
                {order.status === 'cancelled' && (
                  <div className={styles.timelineItem}>
                    <div className={styles.timelineIcon}>❌</div>
                    <div className={styles.timelineContent}>
                      <h4>Cancelled</h4>
                      <p>{order.cancellation_reason || 'No reason provided'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SMEOrderDetail;