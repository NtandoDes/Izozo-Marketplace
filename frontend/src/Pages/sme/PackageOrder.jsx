/* eslint-disable no-unused-vars */
// frontend/src/pages/sme/PackageOrder.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { smeService } from '../../services/smeService';
import styles from './PackageOrder.module.css';

const PackageOrder = () => {
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [packaging, setPackaging] = useState(false);
  const [packagingComplete, setPackagingComplete] = useState(false);
  const [packageNotes, setPackageNotes] = useState('');
  const [estimatedPackTime, setEstimatedPackTime] = useState(5); // minutes
  const [confirmedItems, setConfirmedItems] = useState({});

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
      
      // Initialize confirmed items
      const initialConfirmed = {};
      data.items.forEach(item => {
        initialConfirmed[item.id || item.product_id] = true;
      });
      setConfirmedItems(initialConfirmed);
      
    } catch (err) {
      console.error('Error fetching order details:', err);
      setError('Failed to load order details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmItem = (itemId) => {
    setConfirmedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // frontend/src/pages/sme/PackageOrder.jsx - Update the handlePackageOrder function

const handlePackageOrder = async () => {
  try {
    setPackaging(true);
    
    // Check if all items are confirmed
    const allConfirmed = Object.values(confirmedItems).every(Boolean);
    if (!allConfirmed) {
      alert('Please confirm all items are included in the package');
      setPackaging(false);
      return;
    }
    
    // Prepare package data
    const packageData = {
      package_notes: packageNotes,
      estimated_pack_time: estimatedPackTime,
      items_confirmed: confirmedItems
    };
    
    // Call API to mark order as ready for pickup
    const response = await smeService.markOrderReadyForPickup(orderNumber, packageData);
    
    console.log('✅ Order marked as ready for pickup:', response);
    
    // Show success message with agent notification info
    setPackagingComplete(true);
    
    // You can also show which agents were notified
    if (response.notified_agents && response.notified_agents.length > 0) {
      console.log(`📢 Notified agents: ${response.notified_agents.join(', ')}`);
    }
    
  } catch (err) {
    console.error('Error packaging order:', err);
    setError(err.message || 'Failed to package order. Please try again.');
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
      return new Date(dateString).toLocaleDateString('en-ZA', {
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

  const allItemsConfirmed = Object.values(confirmedItems).every(Boolean);

  if (packagingComplete) {
    return (
      <div className={styles.successContainer}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>📦</div>
          <h1 className={styles.successTitle}>Order Packaged Successfully!</h1>
          <p className={styles.successMessage}>
            Order #{order.order_number} has been marked as ready for pickup.
          </p>
          <p className={styles.successMessage}>
            The assigned agent has been notified and will collect it for delivery.
          </p>
          <div className={styles.successDetails}>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Package Notes:</span>
              <span className={styles.detailValue}>{packageNotes || 'No notes'}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Estimated Pack Time:</span>
              <span className={styles.detailValue}>{estimatedPackTime} minutes</span>
            </div>
          </div>
          <p className={styles.redirectMessage}>
            Redirecting to order details...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Navigation Header */}
      <div className={styles.navigation}>
        <Link to={`/sme/orders/${orderNumber}`} className={styles.backLink}>
          ← Back to Order Details
        </Link>
        <span className={styles.breadcrumb}>
          Package Order / {order.order_number}
        </span>
      </div>

      {/* Main Content */}
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>Package Order #{order.order_number}</h1>
          <p className={styles.subtitle}>
            Verify items and confirm packaging to notify the agent for collection
          </p>
        </div>

        {/* Order Summary */}
        <div className={styles.summaryCard}>
          <h3 className={styles.summaryTitle}>Order Summary</h3>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Customer:</span>
              <span className={styles.summaryValue}>{order.customer_full_name}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Order Date:</span>
              <span className={styles.summaryValue}>{formatDate(order.created_at)}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Total Items:</span>
              <span className={styles.summaryValue}>{order.items?.length || 0}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Total Amount:</span>
              <span className={styles.summaryValue}>{formatCurrency(order.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Items to Package */}
        <div className={styles.itemsSection}>
          <h3 className={styles.sectionTitle}>Verify Items for Packaging</h3>
          <p className={styles.sectionSubtitle}>
            Check each item to confirm it's included in the package
          </p>

          <div className={styles.itemsList}>
            {order.items && order.items.map((item, index) => (
              <div key={index} className={styles.itemCard}>
                <div className={styles.itemCheckbox}>
                  <input
                    type="checkbox"
                    id={`item-${index}`}
                    checked={confirmedItems[item.id || item.product_id] || false}
                    onChange={() => handleConfirmItem(item.id || item.product_id)}
                    className={styles.checkbox}
                  />
                </div>
                <div className={styles.itemDetails}>
                  <h4 className={styles.itemName}>{item.product_name}</h4>
                  {item.variant_name && (
                    <span className={styles.itemVariant}>{item.variant_name}</span>
                  )}
                  <div className={styles.itemMeta}>
                    <span className={styles.itemSku}>SKU: {item.product_sku || '-'}</span>
                    <span className={styles.itemQuantity}>Qty: {item.quantity}</span>
                    <span className={styles.itemPrice}>Price: {formatCurrency(item.unit_price)}</span>
                  </div>
                </div>
                <div className={styles.itemTotal}>
                  <span className={styles.itemTotalLabel}>Total:</span>
                  <span className={styles.itemTotalValue}>{formatCurrency(item.total)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.confirmationStatus}>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill}
                style={{ 
                  width: `${(Object.values(confirmedItems).filter(Boolean).length / order.items.length) * 100}%` 
                }}
              ></div>
            </div>
            <p className={styles.progressText}>
              {Object.values(confirmedItems).filter(Boolean).length} of {order.items.length} items confirmed
            </p>
          </div>
        </div>

        {/* Package Details */}
        <div className={styles.packageDetails}>
          <h3 className={styles.sectionTitle}>Package Information</h3>
          
          <div className={styles.formGroup}>
            <label htmlFor="packageNotes" className={styles.formLabel}>
              Package Notes (Optional)
            </label>
            <textarea
              id="packageNotes"
              value={packageNotes}
              onChange={(e) => setPackageNotes(e.target.value)}
              placeholder="Add any notes about the package (e.g., fragile items, special handling)"
              className={styles.textarea}
              rows="3"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="estimatedTime" className={styles.formLabel}>
              Estimated Packing Time (minutes)
            </label>
            <select
              id="estimatedTime"
              value={estimatedPackTime}
              onChange={(e) => setEstimatedPackTime(parseInt(e.target.value))}
              className={styles.select}
            >
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
              <option value="15">15 minutes</option>
              <option value="20">20 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </div>
        </div>

        {/* Agent Notification Preview */}
        <div className={styles.notificationPreview}>
          <h3 className={styles.sectionTitle}>Agent Notification Preview</h3>
          <div className={styles.notificationCard}>
            <div className={styles.notificationHeader}>
              <span className={styles.notificationIcon}>📦</span>
              <span className={styles.notificationTitle}>Order Ready for Pickup</span>
            </div>
            <div className={styles.notificationBody}>
              <p><strong>Order #{order.order_number}</strong> is ready for collection from your business.</p>
              <p><strong>Items:</strong> {order.items?.length} items</p>
              <p><strong>Estimated pack time:</strong> {estimatedPackTime} minutes</p>
              {packageNotes && (
                <p><strong>Notes:</strong> {packageNotes}</p>
              )}
              <p className={styles.notificationFooter}>
                Please collect and ship to customer: {order.customer_full_name}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={styles.actions}>
          <button
            onClick={() => navigate(`/sme/orders/${orderNumber}`)}
            className={styles.cancelButton}
            disabled={packaging}
          >
            Cancel
          </button>
          <button
            onClick={handlePackageOrder}
            disabled={!allItemsConfirmed || packaging}
            className={styles.packageButton}
          >
            {packaging ? '📦 Packaging...' : '✅ Confirm Package & Notify Agent'}
          </button>
        </div>

        {!allItemsConfirmed && (
          <p className={styles.warningMessage}>
            ⚠️ Please confirm all items before packaging
          </p>
        )}
      </div>
    </div>
  );
};

export default PackageOrder;