/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import agentService from '../../services/agentService';
import styles from './AgentEditProduct.module.css';

const AgentEditProduct = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [product, setProduct] = useState(null);
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    short_description: '',
    base_price: '',
    selling_price: '',
    discount_percentage: '',
    commission_rate: '10.00',
    sku: '',
    barcode: '',
    stock_quantity: '0',
    low_stock_threshold: '5',
  });

  useEffect(() => {
    loadProduct();
  }, [id]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await agentService.getProduct(id);
      setProduct(data);
      
      // Populate form data
      setFormData({
        name: data.name || '',
        description: data.description || '',
        short_description: data.short_description || '',
        base_price: data.base_price || '',
        selling_price: data.selling_price || '',
        discount_percentage: data.discount_percentage || '',
        commission_rate: data.commission_rate || '10.00',
        sku: data.sku || '',
        barcode: data.barcode || '',
        stock_quantity: data.stock_quantity || '0',
        low_stock_threshold: data.low_stock_threshold || '5',
      });
    } catch (err) {
      console.error('Error loading product:', err);
      setError('Failed to load product details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value
    }));
  };

  const calculateSellingPrice = () => {
    const basePrice = parseFloat(formData.base_price) || 0;
    const discount = parseFloat(formData.discount_percentage) || 0;
    
    if (basePrice > 0 && discount > 0) {
      const sellingPrice = basePrice * (1 - discount / 100);
      setFormData(prev => ({
        ...prev,
        selling_price: Math.round(sellingPrice * 100) / 100
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name) {
      alert('Product name is required');
      return;
    }
    
    if (!formData.description) {
      alert('Product description is required');
      return;
    }
    
    if (!formData.base_price || parseFloat(formData.base_price) <= 0) {
      alert('Please enter a valid base price');
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      // Prepare data for submission
      const submitData = {
        ...formData,
        base_price: parseFloat(formData.base_price),
        selling_price: formData.selling_price ? parseFloat(formData.selling_price) : null,
        discount_percentage: parseFloat(formData.discount_percentage || 0),
        commission_rate: parseFloat(formData.commission_rate || 10),
        stock_quantity: parseInt(formData.stock_quantity || 0),
        low_stock_threshold: parseInt(formData.low_stock_threshold || 5)
      };
      
      await agentService.updateProduct(id, submitData);
      setSuccess(true);
      
      // Redirect after 2 seconds
      setTimeout(() => {
        navigate(`/agent/products/${id}`);
      }, 2000);
      
    } catch (err) {
      console.error('Error updating product:', err);
      setError(err.message || 'Failed to update product. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading product details...</p>
      </div>
    );
  }

  if (error && !product) {
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

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Edit Product</h1>
          <p className={styles.subtitle}>
            Update product information for {product?.name}
          </p>
        </div>
        <Link to={`/agent/products/${id}`} className={styles.cancelLink}>
          Cancel
        </Link>
      </div>

      {/* Success Message */}
      {success && (
        <div className={styles.successAlert}>
          <div className={styles.successIcon}>✅</div>
          <div className={styles.successContent}>
            <h3>Product Updated Successfully!</h3>
            <p>Your changes have been saved. Redirecting to product details...</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className={styles.errorAlert}>
          <div className={styles.errorIcon}>❌</div>
          <div className={styles.errorContent}>
            <h3>Error</h3>
            <p>{error}</p>
          </div>
          <button onClick={() => setError(null)} className={styles.closeButton}>×</button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Basic Information */}
        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Basic Information</h2>
          
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Product Name <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="e.g., Men's Cotton T-Shirt"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Short Description</label>
            <input
              type="text"
              name="short_description"
              value={formData.short_description}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="Brief description for product listings"
              maxLength="500"
            />
            <small className={styles.helper}>
              {formData.short_description?.length || 0}/500 characters
            </small>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Full Description <span className={styles.required}>*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className={styles.textarea}
              rows="6"
              placeholder="Detailed product description"
              required
            ></textarea>
          </div>
        </div>

        {/* Pricing */}
        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Pricing</h2>
          
          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Base Price (R) <span className={styles.required}>*</span>
              </label>
              <input
                type="number"
                name="base_price"
                value={formData.base_price}
                onChange={handleInputChange}
                onBlur={calculateSellingPrice}
                className={styles.input}
                placeholder="0.00"
                step="0.01"
                min="0"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Discount (%)</label>
              <input
                type="number"
                name="discount_percentage"
                value={formData.discount_percentage}
                onChange={handleInputChange}
                onBlur={calculateSellingPrice}
                className={styles.input}
                placeholder="0"
                step="0.1"
                min="0"
                max="100"
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Selling Price (R)</label>
              <input
                type="number"
                name="selling_price"
                value={formData.selling_price}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="Auto-calculated"
                step="0.01"
                min="0"
              />
              <small className={styles.helper}>
                Leave empty to auto-calculate from discount
              </small>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Commission Rate (%)</label>
              <input
                type="number"
                name="commission_rate"
                value={formData.commission_rate}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="10.00"
                step="0.1"
                min="0"
                max="100"
              />
            </div>
          </div>
        </div>

        {/* Inventory */}
        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Inventory</h2>
          
          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label className={styles.label}>SKU (Stock Keeping Unit)</label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="e.g., TSHIRT-BLK-M"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Barcode</label>
              <input
                type="text"
                name="barcode"
                value={formData.barcode}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="UPC/EAN"
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Stock Quantity</label>
              <input
                type="number"
                name="stock_quantity"
                value={formData.stock_quantity}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="0"
                min="0"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Low Stock Threshold</label>
              <input
                type="number"
                name="low_stock_threshold"
                value={formData.low_stock_threshold}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="5"
                min="1"
              />
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className={styles.formActions}>
          <Link to={`/agent/products/${id}`} className={styles.secondaryButton}>
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className={`${styles.primaryButton} ${saving ? styles.loading : ''}`}
          >
            {saving ? (
              <>
                <span className={styles.spinner}></span>
                Saving Changes...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AgentEditProduct;