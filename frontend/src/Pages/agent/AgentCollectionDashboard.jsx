// frontend/src/Pages/agent/AgentCollectionDashboard.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentService } from '../../services/agentService';
import styles from './AgentCollectionDashboard.module.css';

const AgentCollectionDashboard = ({ pickupOrders = [] }) => {
  const navigate = useNavigate();
  const [processingId, setProcessingId] = useState(null);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [collectionNotes, setCollectionNotes] = useState('');
  const [collectionPhoto, setCollectionPhoto] = useState(null);

  console.log('🎨 AgentCollectionDashboard rendered with', pickupOrders.length, 'orders');

  const handleCollectClick = (order) => {
    console.log('📝 Collect clicked for order:', order);
    setSelectedOrder(order);
    setShowCollectionModal(true);
  };

  const handleCollectionSubmit = async () => {
    if (!selectedOrder) return;
    
    console.log('📝 Submitting collection for order:', selectedOrder.id);
    setProcessingId(selectedOrder.id);
    
    try {
      const collectionData = {
        notes: collectionNotes,
        collected_at: new Date().toISOString()
      };
      
      console.log('📦 Collection data:', collectionData);
      
      // If you have photo upload capability
      if (collectionPhoto) {
        const formData = new FormData();
        formData.append('photo', collectionPhoto);
        formData.append('notes', collectionNotes);
        await agentService.markOrderAsCollected(selectedOrder.id, formData);
      } else {
        await agentService.markOrderAsCollected(selectedOrder.id, collectionData);
      }
      
      console.log('✅ Order marked as collected successfully');
      
      // Refresh the page or notify parent to refresh
      window.location.reload(); // Simple solution - reload the page
      
      // Close modal
      setShowCollectionModal(false);
      setSelectedOrder(null);
      setCollectionNotes('');
      setCollectionPhoto(null);
      
    } catch (error) {
      console.error('❌ Error collecting order:', error);
      alert('Failed to mark order as collected. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewOrder = (orderId) => {
    console.log('👁️ Viewing order:', orderId);
    navigate(`/agent/orders/${orderId}`);
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

  // If no orders, don't render anything
  if (!pickupOrders || pickupOrders.length === 0) {
    console.log('🚫 No pickup orders to display');
    return null;
  }

  return (
    <>
      {/* Collection Banner */}
      <div className={styles.collectionBanner}>
        <div className={styles.bannerContent}>
          <div className={styles.bannerIcon}>📦</div>
          <div className={styles.bannerText}>
            <h3>Orders Ready for Collection</h3>
            <p>You have <strong>{pickupOrders.length}</strong> order(s) ready to pick up from SMMEs</p>
          </div>
          <button 
            className={styles.viewButton}
            onClick={() => document.getElementById('collection-section').scrollIntoView({ behavior: 'smooth' })}
          >
            View Orders
          </button>
        </div>
      </div>

      {/* Collection Section */}
      <div id="collection-section" className={styles.collectionSection}>
        <div className={styles.sectionHeader}>
          <h2>Ready for Collection</h2>
          <span className={styles.badge}>{pickupOrders.length} Orders</span>
        </div>

        <div className={styles.ordersGrid}>
          {pickupOrders.map(order => (
            <div key={order.id} className={styles.orderCard}>
              <div className={styles.orderHeader}>
                <span className={styles.orderNumber}>#{order.order_number}</span>
                <span className={styles.orderStatus}>Ready for Pickup</span>
              </div>
              
              <div className={styles.orderDetails}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>SMME:</span>
                  <span className={styles.detailValue}>
                    <strong>{order.sme_name || 'N/A'}</strong>
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>SMME Phone:</span>
                  <span className={styles.detailValue}>{order.sme_phone || 'N/A'}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Customer:</span>
                  <span className={styles.detailValue}>{order.customer_full_name}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Items:</span>
                  <span className={styles.detailValue}>{order.item_count || order.items?.length || 0}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Total:</span>
                  <span className={styles.detailValue}>{formatCurrency(order.total_amount)}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Commission:</span>
                  <span className={styles.commissionValue}>
                    {formatCurrency(order.commission_amount || order.total_amount * 0.1)}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Ready Since:</span>
                  <span className={styles.detailValue}>{formatDate(order.ready_at || order.created_at)}</span>
                </div>
              </div>

              <div className={styles.smeAddress}>
                <strong>Pickup Address:</strong>
                <p>{order.sme_address || 'Address not available'}</p>
                {order.sme_address && (
                  <a 
                    href={`https://maps.google.com/?q=${encodeURIComponent(order.sme_address)}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={styles.mapLink}
                  >
                    📍 View on Maps
                  </a>
                )}
              </div>

              <div className={styles.actionButtons}>
                <button 
                  className={styles.viewDetailsButton}
                  onClick={() => handleViewOrder(order.id)}
                >
                  👁️ View Details
                </button>
                <button 
                  className={styles.collectButton}
                  onClick={() => handleCollectClick(order)}
                  disabled={processingId === order.id}
                >
                  {processingId === order.id ? 'Processing...' : '📦 Mark as Collected'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Collection Modal */}
      {showCollectionModal && selectedOrder && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Confirm Collection</h3>
            <p className={styles.modalSubtitle}>
              Order #{selectedOrder.order_number} from <strong>{selectedOrder.sme_name || 'SMME'}</strong>
            </p>

            <div className={styles.modalContent}>
              <div className={styles.smeInfoBox}>
                <h4>SMME Information</h4>
                <p><strong>Business:</strong> {selectedOrder.sme_name || 'N/A'}</p>
                <p><strong>Address:</strong> {selectedOrder.sme_address || 'N/A'}</p>
                <p><strong>Phone:</strong> {selectedOrder.sme_phone || 'N/A'}</p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Collection Notes (Optional)</label>
                <textarea
                  value={collectionNotes}
                  onChange={(e) => setCollectionNotes(e.target.value)}
                  placeholder="Add any notes about the collection (e.g., package condition, special instructions)"
                  className={styles.textarea}
                  rows="3"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Collection Photo (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCollectionPhoto(e.target.files[0])}
                  className={styles.fileInput}
                />
                <p className={styles.inputHint}>Upload a photo as proof of collection</p>
              </div>

              <div className={styles.orderSummary}>
                <h4>Order Summary</h4>
                <div className={styles.summaryRow}>
                  <span>Items:</span>
                  <span>{selectedOrder.item_count || selectedOrder.items?.length || 0}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Total Value:</span>
                  <span>{formatCurrency(selectedOrder.total_amount)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Your Commission:</span>
                  <span className={styles.commissionHighlight}>
                    {formatCurrency(selectedOrder.commission_amount || selectedOrder.total_amount * 0.1)}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button 
                className={styles.cancelButton}
                onClick={() => {
                  setShowCollectionModal(false);
                  setSelectedOrder(null);
                  setCollectionNotes('');
                  setCollectionPhoto(null);
                }}
              >
                Cancel
              </button>
              <button 
                className={styles.confirmButton}
                onClick={handleCollectionSubmit}
                disabled={processingId === selectedOrder.id}
              >
                {processingId === selectedOrder.id ? 'Processing...' : 'Confirm Collection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AgentCollectionDashboard;