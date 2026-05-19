/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import agentService from '../../services/agentService';
import styles from './AgentProductDetail.module.css';

const AgentProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    loadProduct();
  }, [id]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await agentService.getProduct(id);
      console.log('Product loaded:', data);
      setProduct(data);
    } catch (err) {
      console.error('Error loading product:', err);
      setError('Failed to load product details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await agentService.deleteProduct(id);
      navigate('/agent/products');
    } catch (err) {
      console.error('Error deleting product:', err);
      alert('Failed to delete product. Please try again.');
    } finally {
      setShowDeleteModal(false);
    }
  };

  const formatPrice = (price) => {
    if (!price) return 'R0.00';
    return `R${parseFloat(price).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const getStatusBadgeClass = (status, isActive) => {
    if (status === 'active' && isActive) return styles.statusActive;
    if (status === 'pending') return styles.statusPending;
    if (status === 'rejected') return styles.statusRejected;
    if (status === 'draft') return styles.statusDraft;
    return styles.statusInactive;
  };

  const getStatusText = (status, isActive) => {
    if (status === 'active' && isActive) return 'Active';
    if (status === 'pending') return 'Pending Approval';
    if (status === 'rejected') return 'Rejected';
    if (status === 'draft') return 'Draft';
    return 'Inactive';
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading product details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>❌</div>
        <h2 className={styles.errorTitle}>Error Loading Product</h2>
        <p className={styles.errorMessage}>{error}</p>
        <button onClick={() => navigate('/agent/products')} className={styles.backButton}>
          Back to Products
        </button>
      </div>
    );
  }

  if (!product) {
    return (
      <div className={styles.notFoundContainer}>
        <div className={styles.notFoundIcon}>🔍</div>
        <h2 className={styles.notFoundTitle}>Product Not Found</h2>
        <p className={styles.notFoundMessage}>The product you're looking for doesn't exist or has been deleted.</p>
        <button onClick={() => navigate('/agent/products')} className={styles.backButton}>
          Back to Products
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>{product.name}</h1>
          <div className={styles.metaInfo}>
            <span className={`${styles.statusBadge} ${getStatusBadgeClass(product.status, product.is_active)}`}>
              {getStatusText(product.status, product.is_active)}
            </span>
            {product.sku && (
              <span className={styles.sku}>SKU: {product.sku}</span>
            )}
          </div>
        </div>
        <div className={styles.headerActions}>
          <Link to={`/agent/products/${id}/edit`} className={styles.editButton}>
             Edit Product
          </Link>
          <button onClick={() => setShowDeleteModal(true)} className={styles.deleteButton}>
            🗑️ Delete
          </button>
          <Link to="/agent/products" className={styles.backLink}>
            ← Back to Products
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.content}>
        <div className={styles.mainGrid}>
          {/* Left Column - Images */}
          <div className={styles.imageSection}>
            <div className={styles.mainImage}>
              {product.images && product.images.length > 0 ? (
                <img 
                  src={product.images[activeImageIndex]?.image || product.featured_image} 
                  alt={product.name}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://via.placeholder.com/600x600?text=No+Image';
                  }}
                />
              ) : product.featured_image ? (
                <img 
                  src={product.featured_image} 
                  alt={product.name}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://via.placeholder.com/600x600?text=No+Image';
                  }}
                />
              ) : (
                <div className={styles.noImage}>
                  <span>📦</span>
                  <p>No Image Available</p>
                </div>
              )}
            </div>
            
            {product.images && product.images.length > 1 && (
              <div className={styles.imageThumbnails}>
                {product.images.map((img, index) => (
                  <button
                    key={index}
                    className={`${styles.thumbnail} ${activeImageIndex === index ? styles.activeThumbnail : ''}`}
                    onClick={() => setActiveImageIndex(index)}
                  >
                    <img src={img.image} alt={`${product.name} - ${index + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column - Details */}
          <div className={styles.detailsSection}>
            {/* Pricing */}
            <div className={styles.priceCard}>
              <h3 className={styles.sectionTitle}>Pricing</h3>
              <div className={styles.priceInfo}>
                <div className={styles.currentPrice}>
                  <span className={styles.priceLabel}>Selling Price</span>
                  <span className={styles.priceValue}>{formatPrice(product.selling_price || product.base_price)}</span>
                </div>
                {product.discount_percentage > 0 && (
                  <>
                    <div className={styles.originalPrice}>
                      <span className={styles.priceLabel}>Original Price</span>
                      <span className={styles.priceValue}>{formatPrice(product.base_price)}</span>
                    </div>
                    <div className={styles.discountBadge}>
                      Save {product.discount_percentage}%
                    </div>
                  </>
                )}
              </div>
              <div className={styles.commissionInfo}>
                <span>Commission Rate: </span>
                <strong>R{product.commission_rate || 0}</strong>
              </div>
            </div>

            {/* Inventory */}
            <div className={styles.inventoryCard}>
              <h3 className={styles.sectionTitle}>Inventory</h3>
              <div className={styles.inventoryGrid}>
                <div className={styles.inventoryItem}>
                  <span className={styles.inventoryLabel}>Stock Quantity</span>
                  <span className={`${styles.inventoryValue} ${product.stock_quantity <= product.low_stock_threshold ? styles.lowStock : ''}`}>
                    {product.stock_quantity || 0} units
                  </span>
                </div>
                <div className={styles.inventoryItem}>
                  <span className={styles.inventoryLabel}>Low Stock Threshold</span>
                  <span className={styles.inventoryValue}>{product.low_stock_threshold || 5} units</span>
                </div>
                {product.stock_quantity <= product.low_stock_threshold && (
                  <div className={styles.lowStockAlert}>
                    ⚠️ Low Stock Alert
                  </div>
                )}
              </div>
            </div>

            {/* Categories */}
            {product.categories && product.categories.length > 0 && (
              <div className={styles.categoriesCard}>
                <h3 className={styles.sectionTitle}>Categories</h3>
                <div className={styles.categoryList}>
                  {product.categories.map(cat => (
                    <span key={cat.id} className={styles.categoryTag}>
                      {cat.full_path || cat.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div className={styles.descriptionCard}>
              <h3 className={styles.sectionTitle}>Description</h3>
              <p className={styles.description}>
                {product.description || 'No description provided.'}
              </p>
              {product.short_description && (
                <>
                  <h4 className={styles.subsectionTitle}>Short Description</h4>
                  <p className={styles.shortDescription}>{product.short_description}</p>
                </>
              )}
            </div>

            {/* Attributes */}
            {product.attributes && product.attributes.length > 0 && (
              <div className={styles.attributesCard}>
                <h3 className={styles.sectionTitle}>Product Attributes</h3>
                <div className={styles.attributesGrid}>
                  {product.attributes.map(attr => (
                    <div key={attr.id} className={styles.attributeItem}>
                      <span className={styles.attributeLabel}>{attr.attribute_name}:</span>
                      <span className={styles.attributeValue}>
                        {attr.display_value || attr.value}
                        {attr.attribute_unit && ` ${attr.attribute_unit}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Variants */}
            {product.variants && product.variants.length > 0 && (
              <div className={styles.variantsCard}>
                <h3 className={styles.sectionTitle}>Variants</h3>
                <div className={styles.variantsTable}>
                  <table>
                    <thead>
                      <tr>
                        <th>Variant</th>
                        <th>SKU</th>
                        <th>Price Adjustment</th>
                        <th>Final Price</th>
                        <th>Stock</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {product.variants.map((variant, index) => (
                        <tr key={index}>
                          <td>{variant.name}</td>
                          <td>{variant.sku || '-'}</td>
                          <td>
                            {variant.price_adjustment > 0 ? '+' : ''}
                            {formatPrice(variant.price_adjustment)}
                          </td>
                          <td>{formatPrice((product.selling_price || product.base_price) + variant.price_adjustment)}</td>
                          <td>
                            <span className={variant.stock_quantity <= 5 ? styles.lowStock : ''}>
                              {variant.stock_quantity || 0}
                            </span>
                          </td>
                          <td>
                            <span className={`${styles.variantStatus} ${variant.is_active ? styles.variantActive : styles.variantInactive}`}>
                              {variant.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className={styles.metadataCard}>
              <h3 className={styles.sectionTitle}>Additional Information</h3>
              <div className={styles.metadataGrid}>
                <div className={styles.metadataItem}>
                  <span className={styles.metadataLabel}>Created By</span>
                  <span className={styles.metadataValue}>
                    {product.agent_details?.user?.full_name || 'Agent'} 
                    {product.agent_details && ' (Agent)'}
                  </span>
                </div>
                <div className={styles.metadataItem}>
                  <span className={styles.metadataLabel}>SME</span>
                  <span className={styles.metadataValue}>
                    {product.sme_details?.business_name || 'Unknown SME'}
                  </span>
                </div>
                <div className={styles.metadataItem}>
                  <span className={styles.metadataLabel}>Created Date</span>
                  <span className={styles.metadataValue}>{formatDate(product.created_at)}</span>
                </div>
                {product.updated_at && (
                  <div className={styles.metadataItem}>
                    <span className={styles.metadataLabel}>Last Updated</span>
                    <span className={styles.metadataValue}>{formatDate(product.updated_at)}</span>
                  </div>
                )}
                {product.published_at && (
                  <div className={styles.metadataItem}>
                    <span className={styles.metadataLabel}>Published Date</span>
                    <span className={styles.metadataValue}>{formatDate(product.published_at)}</span>
                  </div>
                )}
                {product.barcode && (
                  <div className={styles.metadataItem}>
                    <span className={styles.metadataLabel}>Barcode</span>
                    <span className={styles.metadataValue}>{product.barcode}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Delete Product</h3>
              <button onClick={() => setShowDeleteModal(false)} className={styles.modalClose}>×</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalMessage}>
                Are you sure you want to delete <strong>"{product.name}"</strong>?
              </p>
              <p className={styles.modalWarning}>
                This action cannot be undone. The product will be permanently removed from the system.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button onClick={() => setShowDeleteModal(false)} className={styles.cancelButton}>
                Cancel
              </button>
              <button onClick={handleDelete} className={styles.confirmButton}>
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentProductDetail;