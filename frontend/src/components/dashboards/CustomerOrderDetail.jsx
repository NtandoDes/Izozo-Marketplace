/* eslint-disable no-unused-vars */
// frontend/src/components/dashboards/CustomerOrderDetail.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { customerService } from '../../services/customerService';
import styles from './CustomerOrderDetail.module.css';

const CustomerOrderDetail = () => {
  const navigate = useNavigate();
  const { orderNumber } = useParams();
  const { user, isAuthenticated } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [activeTab, setActiveTab] = useState('items');

  // Shipping tracking modal
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/account/orders/${orderNumber}` } });
    }
  }, [isAuthenticated, navigate, orderNumber]);

  // Fetch order details
  useEffect(() => {
    if (isAuthenticated && orderNumber) {
      fetchOrderDetails();
    }
  }, [isAuthenticated, orderNumber]);

  const fetchOrderDetails = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching order details for:', orderNumber);
      const orderData = await customerService.getOrder(orderNumber);
      console.log('Order details received:', orderData);
      setOrder(orderData);
      
      // Set tracking info if available
      if (orderData.tracking_number) {
        setTrackingNumber(orderData.tracking_number);
      }
      if (orderData.carrier) {
        setCarrier(orderData.carrier);
      }
    } catch (err) {
      console.error('Error fetching order details:', err);
      setError({
        title: 'Failed to load order',
        message: err.message || 'Please try again later.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!window.confirm('Are you sure you want to cancel this order?')) {
      return;
    }
    
    setCancelling(true);
    
    try {
      await customerService.cancelOrder(order.order_number);
      await fetchOrderDetails(); // Refresh order details
      alert('Order cancelled successfully');
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert('Failed to cancel order. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const handleReorder = () => {
    // Navigate to product page or add to cart functionality
    alert('Reorder functionality coming soon!');
  };

  const handleTrackOrder = () => {
    if (order?.tracking_number) {
      setShowTrackingModal(true);
    } else {
      alert('No tracking information available yet');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-ZA', {
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

  const getStatusDescription = (status) => {
    const descMap = {
      'pending': 'Your order has been received and is awaiting confirmation.',
      'processing': 'Your order is being prepared for shipping.',
      'paid': 'Payment has been confirmed. Your order is being processed.',
      'shipped': 'Your order has been shipped and is on its way!',
      'delivered': 'Your order has been delivered. Thank you for shopping with us!',
      'completed': 'Your order is complete. Thank you for your purchase!',
      'cancelled': 'This order has been cancelled.'
    };
    return descMap[status] || 'Status update pending.';
  };

  const canCancelOrder = (status) => {
    return ['pending', 'processing'].includes(status);
  };

  const canTrackOrder = (status) => {
    return ['shipped', 'delivered'].includes(status);
  };

  const getProgressPercentage = (status) => {
    const progressMap = {
      'pending': 10,
      'processing': 30,
      'paid': 50,
      'shipped': 75,
      'delivered': 100,
      'completed': 100,
      'cancelled': 0
    };
    return progressMap[status] || 0;
  };

  // Helper function to get address from snapshot or address object - with null checks
  const getShippingAddress = () => {
    if (!order) return {};
    
    if (order.shipping_address_snapshot && Object.keys(order.shipping_address_snapshot).length > 0) {
      return order.shipping_address_snapshot;
    }
    return order.shipping_address || {};
  };

  const getBillingAddress = () => {
    if (!order) return {};
    
    if (order.billing_address_snapshot && Object.keys(order.billing_address_snapshot).length > 0) {
      return order.billing_address_snapshot;
    }
    return order.billing_address || order.shipping_address || {};
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading order details...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>⚠️</div>
        <h2>{error?.title || 'Order not found'}</h2>
        <p>{error?.message || 'The order you\'re looking for doesn\'t exist or you don\'t have permission to view it.'}</p>
        <div className={styles.errorActions}>
          <Link to="/account/orders" className={styles.primaryButton}>
            Back to Orders
          </Link>
          <Link to="/products" className={styles.secondaryButton}>
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  // Only now we can safely access order properties
  const shippingAddress = getShippingAddress();
  const billingAddress = getBillingAddress();
  const progressPercentage = getProgressPercentage(order.status);

  return (
    <div className={styles.orderDetailPage}>
      <div className="container">
        {/* Breadcrumb */}
        <nav className={styles.breadcrumb}>
          <Link to="/">Home</Link> &gt;
          <Link to="/account/orders">My Orders</Link> &gt;
          <span>Order #{order.order_number}</span>
        </nav>

        {/* Header */}
        <div className={styles.pageHeader}>
          <div className={styles.headerLeft}>
            <h1>Order Details</h1>
            <div className={styles.orderReference}>
              <span className={styles.orderNumber}>#{order.order_number}</span>
              <span className={styles.orderDate}>Placed on {formatDate(order.created_at)}</span>
            </div>
          </div>
          <div className={styles.headerActions}>
            <Link to="/account/orders" className={styles.backButton}>
              ← Back to Orders
            </Link>
            {canCancelOrder(order.status) && (
              <button
                onClick={handleCancelOrder}
                className={styles.cancelButton}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling...' : 'Cancel Order'}
              </button>
            )}
            <button
              onClick={handleReorder}
              className={styles.reorderButton}
            >
              Reorder
            </button>
          </div>
        </div>

        {/* Order Status Banner */}
        <div className={`${styles.statusBanner} ${getStatusClass(order.status)}`}>
          <div className={styles.statusIcon}>{getStatusIcon(order.status)}</div>
          <div className={styles.statusInfo}>
            <h2>{getStatusDisplay(order.status)}</h2>
            <p>{getStatusDescription(order.status)}</p>
          </div>
          {canTrackOrder(order.status) && (
            <button onClick={handleTrackOrder} className={styles.trackButton}>
              Track Order
            </button>
          )}
        </div>

        {/* Progress Tracker */}
        <div className={styles.progressTracker}>
          <div className={styles.progressSteps}>
            <div className={`${styles.progressStep} ${styles.completed}`}>
              <div className={styles.stepIcon}>✓</div>
              <span className={styles.stepLabel}>Order Placed</span>
              <span className={styles.stepDate}>{formatDate(order.created_at)}</span>
            </div>
            <div className={`${styles.progressStep} ${order.status !== 'pending' ? styles.completed : ''}`}>
              <div className={styles.stepIcon}>💰</div>
              <span className={styles.stepLabel}>Payment</span>
              {order.paid_at && <span className={styles.stepDate}>{formatDate(order.paid_at)}</span>}
            </div>
            <div className={`${styles.progressStep} ${['shipped', 'delivered', 'completed'].includes(order.status) ? styles.completed : ''}`}>
              <div className={styles.stepIcon}>📦</div>
              <span className={styles.stepLabel}>Shipped</span>
              {order.shipped_at && <span className={styles.stepDate}>{formatDate(order.shipped_at)}</span>}
            </div>
            <div className={`${styles.progressStep} ${['delivered', 'completed'].includes(order.status) ? styles.completed : ''}`}>
              <div className={styles.stepIcon}>✅</div>
              <span className={styles.stepLabel}>Delivered</span>
              {order.delivered_at && <span className={styles.stepDate}>{formatDate(order.delivered_at)}</span>}
            </div>
          </div>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className={styles.contentGrid}>
          {/* Left Column - Order Items */}
          <div className={styles.leftColumn}>
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h2>Order Items</h2>
                <span className={styles.itemCount}>{order.item_count || order.items?.length || 0} items</span>
              </div>

              <div className={styles.itemsList}>
                {order.items && order.items.length > 0 ? (
                  order.items.map((item, index) => {
                    const itemPrice = parseFloat(item.unit_price || item.price || 0);
                    const itemTotal = parseFloat(item.total || itemPrice * item.quantity || 0);
                    
                    return (
                      <div key={index} className={styles.orderItem}>
                        <div className={styles.itemImage}>
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
                        <div className={styles.itemDetails}>
                          <h3 className={styles.itemName}>
                            <Link to={`/product/${item.product_id}`}>
                              {item.product_name}
                            </Link>
                          </h3>
                          {item.variant_name && (
                            <p className={styles.itemVariant}>Variant: {item.variant_name}</p>
                          )}
                          {item.sku && (
                            <p className={styles.itemSku}>SKU: {item.sku}</p>
                          )}
                          <div className={styles.itemMeta}>
                            <span className={styles.itemPrice}>{formatCurrency(itemPrice)}</span>
                            <span className={styles.itemQuantity}>x {item.quantity}</span>
                            <span className={styles.itemTotal}>= {formatCurrency(itemTotal)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.noItems}>No items found in this order</div>
                )}
              </div>

              {/* Order Summary */}
              <div className={styles.orderSummary}>
                <div className={styles.summaryRow}>
                  <span>Subtotal</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Shipping</span>
                  <span>{parseFloat(order.shipping_amount) === 0 ? 'Free' : formatCurrency(order.shipping_amount)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Tax (15% VAT)</span>
                  <span>{formatCurrency(order.tax_amount)}</span>
                </div>
                {parseFloat(order.discount_amount) > 0 && (
                  <div className={`${styles.summaryRow} ${styles.discount}`}>
                    <span>Discount</span>
                    <span>-{formatCurrency(order.discount_amount)}</span>
                  </div>
                )}
                <div className={`${styles.summaryRow} ${styles.total}`}>
                  <span>Total</span>
                  <span>{formatCurrency(order.total_amount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Order Details */}
          <div className={styles.rightColumn}>
            {/* Tabs */}
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${activeTab === 'items' ? styles.active : ''}`}
                onClick={() => setActiveTab('items')}
              >
                Items
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'shipping' ? styles.active : ''}`}
                onClick={() => setActiveTab('shipping')}
              >
                Shipping
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'payment' ? styles.active : ''}`}
                onClick={() => setActiveTab('payment')}
              >
                Payment
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'history' ? styles.active : ''}`}
                onClick={() => setActiveTab('history')}
              >
                History
              </button>
            </div>

            {/* Tab Content */}
            <div className={styles.tabContent}>
              {/* Items Tab - Summary View */}
              {activeTab === 'items' && (
                <div className={styles.itemsTab}>
                  <h3>Order Summary</h3>
                  <div className={styles.itemsSummary}>
                    {order.items && order.items.length > 0 ? (
                      order.items.map((item, index) => {
                        const itemPrice = parseFloat(item.unit_price || item.price || 0);
                        const itemTotal = parseFloat(item.total || itemPrice * item.quantity || 0);
                        
                        return (
                          <div key={index} className={styles.itemsSummaryRow}>
                            <span className={styles.itemsSummaryName}>
                              {item.product_name} {item.quantity > 1 && `(x${item.quantity})`}
                            </span>
                            <span className={styles.itemsSummaryPrice}>
                              {formatCurrency(itemTotal)}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p>No items found</p>
                    )}
                  </div>
                  
                  <div className={styles.itemsTotals}>
                    <div className={styles.itemsTotalRow}>
                      <span>Subtotal</span>
                      <span>{formatCurrency(order.subtotal)}</span>
                    </div>
                    <div className={styles.itemsTotalRow}>
                      <span>Shipping</span>
                      <span>{parseFloat(order.shipping_amount) === 0 ? 'Free' : formatCurrency(order.shipping_amount)}</span>
                    </div>
                    <div className={styles.itemsTotalRow}>
                      <span>Tax</span>
                      <span>{formatCurrency(order.tax_amount)}</span>
                    </div>
                    {parseFloat(order.discount_amount) > 0 && (
                      <div className={`${styles.itemsTotalRow} ${styles.discount}`}>
                        <span>Discount</span>
                        <span>-{formatCurrency(order.discount_amount)}</span>
                      </div>
                    )}
                    <div className={`${styles.itemsTotalRow} ${styles.grandTotal}`}>
                      <span>Total</span>
                      <span>{formatCurrency(order.total_amount)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Shipping Tab */}
              {activeTab === 'shipping' && (
                <div className={styles.shippingTab}>
                  <h3>Shipping Address</h3>
                  <div className={styles.addressCard}>
                    <p className={styles.addressName}>{shippingAddress.full_name || order.customer_full_name}</p>
                    {shippingAddress.address_line1 && <p>{shippingAddress.address_line1}</p>}
                    {shippingAddress.address_line2 && <p>{shippingAddress.address_line2}</p>}
                    <p>
                      {shippingAddress.city || ''} 
                      {shippingAddress.state ? `, ${shippingAddress.state}` : ''} 
                      {shippingAddress.postal_code ? ` ${shippingAddress.postal_code}` : ''}
                    </p>
                    <p>{shippingAddress.country || 'South Africa'}</p>
                    <p className={styles.addressPhone}>📞 {shippingAddress.phone || order.customer_phone}</p>
                  </div>

                  <h3>Shipping Method</h3>
                  <div className={styles.shippingMethod}>
                    <span className={styles.methodName}>
                      {order.shipping_method === 'standard' ? 'Standard Delivery' :
                       order.shipping_method === 'express' ? 'Express Delivery' :
                       order.shipping_method === 'same-day' ? 'Same Day Delivery' :
                       order.shipping_method || 'Standard Delivery'}
                    </span>
                    <span className={styles.methodCost}>
                      {parseFloat(order.shipping_amount) === 0 ? 'Free' : formatCurrency(order.shipping_amount)}
                    </span>
                  </div>

                  {order.tracking_number && (
                    <div className={styles.trackingInfo}>
                      <h3>Tracking Information</h3>
                      <p>Tracking Number: <strong>{order.tracking_number}</strong></p>
                      {order.carrier && <p>Carrier: <strong>{order.carrier}</strong></p>}
                    </div>
                  )}

                  {order.shipped_at && (
                    <div className={styles.shippingDates}>
                      <div className={styles.dateItem}>
                        <span className={styles.dateLabel}>Shipped on:</span>
                        <span className={styles.dateValue}>{formatDate(order.shipped_at)}</span>
                      </div>
                    </div>
                  )}

                  {order.delivered_at && (
                    <div className={styles.shippingDates}>
                      <div className={styles.dateItem}>
                        <span className={styles.dateLabel}>Delivered on:</span>
                        <span className={styles.dateValue}>{formatDate(order.delivered_at)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Tab */}
              {activeTab === 'payment' && (
                <div className={styles.paymentTab}>
                  <h3>Payment Information</h3>
                  <div className={styles.paymentDetails}>
                    <div className={styles.paymentRow}>
                      <span className={styles.paymentLabel}>Payment Method</span>
                      <span className={styles.paymentValue}>
                        {order.payment_method === 'card' ? 'Credit/Debit Card' :
                         order.payment_method === 'cash_on_delivery' ? 'Cash on Delivery' :
                         order.payment_method === 'eft' ? 'EFT/Bank Transfer' :
                         order.payment_method || 'Not specified'}
                      </span>
                    </div>
                    <div className={styles.paymentRow}>
                      <span className={styles.paymentLabel}>Payment Status</span>
                      <span className={`${styles.paymentStatus} ${styles[order.payment_status] || ''}`}>
                        {order.payment_status === 'paid' ? 'Paid' :
                         order.payment_status === 'pending' ? 'Pending' :
                         order.payment_status === 'failed' ? 'Failed' :
                         order.payment_status === 'refunded' ? 'Refunded' :
                         order.payment_status || 'Pending'}
                      </span>
                    </div>
                    {order.payment_reference && (
                      <div className={styles.paymentRow}>
                        <span className={styles.paymentLabel}>Reference</span>
                        <span className={styles.paymentValue}>{order.payment_reference}</span>
                      </div>
                    )}
                    {order.paid_at && (
                      <div className={styles.paymentRow}>
                        <span className={styles.paymentLabel}>Paid on</span>
                        <span className={styles.paymentValue}>{formatDate(order.paid_at)}</span>
                      </div>
                    )}
                  </div>

                  <h3>Billing Address</h3>
                  <div className={styles.addressCard}>
                    <p className={styles.addressName}>{billingAddress.full_name || order.customer_full_name}</p>
                    {billingAddress.address_line1 && <p>{billingAddress.address_line1}</p>}
                    {billingAddress.address_line2 && <p>{billingAddress.address_line2}</p>}
                    <p>
                      {billingAddress.city || ''} 
                      {billingAddress.state ? `, ${billingAddress.state}` : ''} 
                      {billingAddress.postal_code ? ` ${billingAddress.postal_code}` : ''}
                    </p>
                    <p>{billingAddress.country || 'South Africa'}</p>
                    {billingAddress.phone && <p className={styles.addressPhone}>📞 {billingAddress.phone}</p>}
                  </div>
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div className={styles.historyTab}>
                  <h3>Order Timeline</h3>
                  <div className={styles.timeline}>
                    {order.status_history && order.status_history.length > 0 ? (
                      order.status_history.map((event, index) => (
                        <div key={index} className={styles.timelineItem}>
                          <div className={styles.timelineIcon}>
                            {event.status === 'pending' ? '⏳' :
                             event.status === 'processing' ? '⚙️' :
                             event.status === 'paid' ? '💰' :
                             event.status === 'shipped' ? '📦' :
                             event.status === 'delivered' ? '✅' :
                             event.status === 'completed' ? '🎉' :
                             event.status === 'cancelled' ? '❌' : '📋'}
                          </div>
                          <div className={styles.timelineContent}>
                            <div className={styles.timelineHeader}>
                              <span className={styles.timelineStatus}>
                                {getStatusDisplay(event.status)}
                              </span>
                              <span className={styles.timelineDate}>
                                {formatDate(event.created_at)}
                              </span>
                            </div>
                            {event.notes && (
                              <p className={styles.timelineNotes}>{event.notes}</p>
                            )}
                            {event.changed_by_name && (
                              <p className={styles.timelineActor}>by {event.changed_by_name}</p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className={styles.timelineItem}>
                        <div className={styles.timelineIcon}>📋</div>
                        <div className={styles.timelineContent}>
                          <div className={styles.timelineHeader}>
                            <span className={styles.timelineStatus}>
                              {getStatusDisplay(order.status)}
                            </span>
                            <span className={styles.timelineDate}>
                              {formatDate(order.created_at)}
                            </span>
                          </div>
                          <p className={styles.timelineNotes}>Order placed</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Customer Support Section */}
            <div className={styles.supportSection}>
              <h3>Need Help?</h3>
              <p>If you have any questions about your order, please contact our support team.</p>
              <div className={styles.supportOptions}>
                <a href="tel:+27123456789" className={styles.supportOption}>
                  <span className={styles.supportIcon}>📞</span>
                  <span>+27 12 345 6789</span>
                </a>
                <a href="mailto:support@izozo.co.za" className={styles.supportOption}>
                  <span className={styles.supportIcon}>✉️</span>
                  <span>support@izozo.co.za</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tracking Modal */}
      {showTrackingModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Track Your Order</h3>
              <button
                onClick={() => setShowTrackingModal(false)}
                className={styles.modalClose}
              >
                ×
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.trackingDetails}>
                <div className={styles.trackingRow}>
                  <span className={styles.trackingLabel}>Order Number:</span>
                  <span className={styles.trackingValue}>#{order.order_number}</span>
                </div>
                <div className={styles.trackingRow}>
                  <span className={styles.trackingLabel}>Tracking Number:</span>
                  <span className={styles.trackingValue}>{order.tracking_number}</span>
                </div>
                <div className={styles.trackingRow}>
                  <span className={styles.trackingLabel}>Carrier:</span>
                  <span className={styles.trackingValue}>{order.carrier || 'Not specified'}</span>
                </div>
                <div className={styles.trackingRow}>
                  <span className={styles.trackingLabel}>Shipped Date:</span>
                  <span className={styles.trackingValue}>{formatDate(order.shipped_at)}</span>
                </div>
                <div className={styles.trackingRow}>
                  <span className={styles.trackingLabel}>Estimated Delivery:</span>
                  <span className={styles.trackingValue}>
                    {order.delivered_at ? formatDate(order.delivered_at) : 'In transit'}
                  </span>
                </div>
              </div>

              <div className={styles.trackingProgress}>
                <div className={styles.trackingStep}>
                  <div className={`${styles.trackingStepIcon} ${styles.completed}`}>✓</div>
                  <div className={styles.trackingStepContent}>
                    <h4>Order Shipped</h4>
                    <p>{formatDate(order.shipped_at)}</p>
                  </div>
                </div>
                <div className={styles.trackingStep}>
                  <div className={`${styles.trackingStepIcon} ${order.delivered_at ? styles.completed : ''}`}>
                    {order.delivered_at ? '✓' : '⏳'}
                  </div>
                  <div className={styles.trackingStepContent}>
                    <h4>Out for Delivery</h4>
                    <p>{order.delivered_at ? formatDate(order.delivered_at) : 'In progress'}</p>
                  </div>
                </div>
                <div className={styles.trackingStep}>
                  <div className={`${styles.trackingStepIcon} ${order.delivered_at ? styles.completed : ''}`}>
                    {order.delivered_at ? '✓' : '📦'}
                  </div>
                  <div className={styles.trackingStepContent}>
                    <h4>Delivered</h4>
                    <p>{order.delivered_at ? formatDate(order.delivered_at) : 'Pending'}</p>
                  </div>
                </div>
              </div>

              {order.carrier === 'DHL' && (
                <a 
                  href={`https://www.dhl.com/en/express/tracking.html?AWB=${order.tracking_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.trackingLink}
                >
                  Track on DHL Website →
                </a>
              )}
              {order.carrier === 'FedEx' && (
                <a 
                  href={`https://www.fedex.com/fedextrack/?trknbr=${order.tracking_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.trackingLink}
                >
                  Track on FedEx Website →
                </a>
              )}
              {order.carrier === 'UPS' && (
                <a 
                  href={`https://www.ups.com/track?tracknum=${order.tracking_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.trackingLink}
                >
                  Track on UPS Website →
                </a>
              )}
              {order.carrier === 'Aramex' && (
                <a 
                  href={`https://www.aramex.com/track/results?ShipmentNumber=${order.tracking_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.trackingLink}
                >
                  Track on Aramex Website →
                </a>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button 
                onClick={() => setShowTrackingModal(false)}
                className={styles.modalButton}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerOrderDetail;