/* eslint-disable no-unused-vars */
// frontend/src/components/agent/AgentShippingDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { agentService } from '../../services/agentService';
import styles from './AgentShippingDashboard.module.css';

const AgentShippingDashboard = () => {
  const [collectedOrders, setCollectedOrders] = useState([]);
  const [shippedOrders, setShippedOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [showShipModal, setShowShipModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [shippingNotes, setShippingNotes] = useState('');

  useEffect(() => {
    fetchShippingOrders();
    
    // Poll every 30 seconds
    const interval = setInterval(fetchShippingOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchShippingOrders = async () => {
    try {
      setLoading(true);
      // Fetch orders collected but not shipped (status 'collected')
      const collected = await agentService.getCollectedOrders();
      // Fetch orders shipped but not delivered (status 'shipped')
      const shipped = await agentService.getShippedOrders();
      
      console.log('📦 Collected orders:', collected.length);
      console.log('🚚 Shipped orders:', shipped.length);
      
      setCollectedOrders(collected);
      setShippedOrders(shipped);
    } catch (error) {
      console.error('Error fetching shipping orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShipClick = (order) => {
    setSelectedOrder(order);
    setShowShipModal(true);
  };

  const handleShipSubmit = async () => {
    if (!selectedOrder) return;
    
    setProcessingId(selectedOrder.id);
    
    try {
      const shippingData = {
        tracking_number: trackingNumber,
        carrier: carrier,
        notes: shippingNotes,
        status: 'shipped'  // Explicitly set status
      };
      
      console.log(`📦 Shipping order ${selectedOrder.order_number} with data:`, shippingData);
      
      // Update order status to shipped with tracking info
      const response = await agentService.updateOrderStatus(
        selectedOrder.order_number,
        'shipped',
        shippingNotes
      );
      
      console.log('✅ Ship response:', response);
      
      // Also update tracking info separately if needed
      if (response.success) {
        // You might want to update tracking info via a separate API call
        // await agentService.updateOrderTracking(selectedOrder.order_number, trackingNumber, carrier);
      }
      
      // Refresh orders
      await fetchShippingOrders();
      
      // Close modal
      setShowShipModal(false);
      setSelectedOrder(null);
      setTrackingNumber('');
      setCarrier('');
      setShippingNotes('');
      
      alert('✅ Order marked as shipped successfully!');
      
    } catch (error) {
      console.error('❌ Error shipping order:', error);
      alert(`❌ Failed to mark order as shipped: ${error.message || 'Please try again.'}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeliverOrder = async (orderId, orderNumber) => {
    if (!window.confirm('Confirm that this order has been delivered to the customer?')) {
      return;
    }
    
    setProcessingId(orderId);
    
    try {
      const deliveryData = {
        notes: 'Order delivered successfully',
        status: 'delivered'
      };
      
      const response = await agentService.updateOrderStatus(
        orderNumber,
        'delivered',
        'Order delivered successfully'
      );
      
      console.log('✅ Delivery response:', response);
      
      // Refresh orders
      await fetchShippingOrders();
      
      alert('✅ Order marked as delivered successfully! Commission will be added to your account.');
      
    } catch (error) {
      console.error('❌ Error delivering order:', error);
      alert(`❌ Failed to mark order as delivered: ${error.message || 'Please try again.'}`);
    } finally {
      setProcessingId(null);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'R0.00';
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

  if (collectedOrders.length === 0 && shippedOrders.length === 0 && !loading) {
    return null;
  }

  return (
    <div className={styles.shippingSection}>
      <div className={styles.sectionHeader}>
        <h2>Shipping & Delivery</h2>
      </div>

      {/* Collected Orders (Ready to Ship) */}
      {collectedOrders.length > 0 && (
        <div className={styles.subSection}>
          <h3 className={styles.subSectionTitle}>
            📦 Collected - Ready to Ship
            <span className={styles.badge}>{collectedOrders.length}</span>
          </h3>
          
          <div className={styles.ordersGrid}>
            {collectedOrders.map(order => (
              <div key={order.id} className={styles.orderCard}>
                <div className={styles.orderHeader}>
                  <span className={styles.orderNumber}>#{order.order_number}</span>
                  <span className={styles.statusCollected}>Collected</span>
                </div>
                
                <div className={styles.orderDetails}>
                  <div className={styles.detailRow}>
                    <span>SMME:</span>
                    <span>{order.sme_name || order.sme?.business_name || 'N/A'}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Customer:</span>
                    <span>{order.customer_full_name}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Items:</span>
                    <span>{order.item_count || order.items?.length || 0}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Total:</span>
                    <span>{formatCurrency(order.total_amount)}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Commission:</span>
                    <span className={styles.commissionAmount}>
                      {formatCurrency(order.commission_amount || order.total_amount * 0.1)}
                    </span>
                  </div>
                </div>

                <div className={styles.customerAddress}>
                  <strong>Delivery Address:</strong>
                  <p>
                    {order.shipping_address_snapshot?.address_line1}<br />
                    {order.shipping_address_snapshot?.city}, {order.shipping_address_snapshot?.state} {order.shipping_address_snapshot?.postal_code}
                  </p>
                </div>

                <button 
                  className={styles.shipButton}
                  onClick={() => handleShipClick(order)}
                  disabled={processingId === order.id}
                >
                  {processingId === order.id ? 'Processing...' : '🚚 Mark as Shipped'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shipped Orders (In Transit) */}
      {shippedOrders.length > 0 && (
        <div className={styles.subSection}>
          <h3 className={styles.subSectionTitle}>
            🚚 In Transit
            <span className={styles.badge}>{shippedOrders.length}</span>
          </h3>
          
          <div className={styles.ordersGrid}>
            {shippedOrders.map(order => (
              <div key={order.id} className={styles.orderCard}>
                <div className={styles.orderHeader}>
                  <span className={styles.orderNumber}>#{order.order_number}</span>
                  <span className={styles.statusShipped}>Shipped</span>
                </div>
                
                <div className={styles.orderDetails}>
                  <div className={styles.detailRow}>
                    <span>Customer:</span>
                    <span>{order.customer_full_name}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Tracking:</span>
                    <span className={styles.trackingNumber}>{order.tracking_number || 'N/A'}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Carrier:</span>
                    <span>{order.carrier || 'N/A'}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Shipped:</span>
                    <span>{formatDate(order.shipped_at)}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Commission:</span>
                    <span className={styles.commissionAmount}>
                      {formatCurrency(order.commission_amount || order.total_amount * 0.1)}
                    </span>
                  </div>
                </div>

                <div className={styles.customerAddress}>
                  <strong>Delivery Address:</strong>
                  <p>
                    {order.shipping_address_snapshot?.address_line1}<br />
                    {order.shipping_address_snapshot?.city}, {order.shipping_address_snapshot?.state} {order.shipping_address_snapshot?.postal_code}
                  </p>
                </div>

                <div className={styles.commissionPreview}>
                  <span>Commission on delivery:</span>
                  <span className={styles.commissionAmount}>
                    {formatCurrency(order.commission_amount || order.total_amount * 0.1)}
                  </span>
                </div>

                <button 
                  className={styles.deliverButton}
                  onClick={() => handleDeliverOrder(order.id, order.order_number)}
                  disabled={processingId === order.id}
                >
                  {processingId === order.id ? 'Processing...' : '✅ Mark as Delivered'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ship Modal */}
      {showShipModal && selectedOrder && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Ship Order</h3>
            <p className={styles.modalSubtitle}>
              Order #{selectedOrder.order_number} to {selectedOrder.customer_full_name}
            </p>

            <div className={styles.modalContent}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Tracking Number *</label>
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
                <label className={styles.formLabel}>Carrier *</label>
                <select
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className={styles.select}
                  required
                >
                  <option value="">Select carrier</option>
                  <option value="DHL">DHL</option>
                  <option value="FedEx">FedEx</option>
                  <option value="UPS">UPS</option>
                  <option value="USPS">USPS</option>
                  <option value="Aramex">Aramex</option>
                  <option value="Fastway">Fastway</option>
                  <option value="Post Office">Post Office</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Shipping Notes</label>
                <textarea
                  value={shippingNotes}
                  onChange={(e) => setShippingNotes(e.target.value)}
                  placeholder="Add any shipping notes"
                  className={styles.textarea}
                  rows="3"
                />
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
                <p>Commission upon delivery: <strong>{formatCurrency(selectedOrder.total_amount * 0.1)}</strong></p>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button 
                className={styles.cancelButton}
                onClick={() => {
                  setShowShipModal(false);
                  setSelectedOrder(null);
                  setTrackingNumber('');
                  setCarrier('');
                  setShippingNotes('');
                }}
              >
                Cancel
              </button>
              <button 
                className={styles.confirmButton}
                onClick={handleShipSubmit}
                disabled={!trackingNumber || !carrier || processingId === selectedOrder.id}
              >
                {processingId === selectedOrder.id ? 'Processing...' : 'Confirm Shipment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentShippingDashboard;