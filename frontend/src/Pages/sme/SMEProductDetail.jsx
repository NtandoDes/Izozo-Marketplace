/* eslint-disable no-unused-vars */
// SMEProductDetail.jsx - Full edit support for images, categories, attributes, and variants
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { smeService } from '../../services/smeService';
import styles from './SMEProductDetail.module.css';

const SMEProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('details');
  
  // Edit mode states
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  // Image management
  const [newImages, setNewImages] = useState([]);
  const [imagesToDelete, setImagesToDelete] = useState([]);
  const [featuredImageFile, setFeaturedImageFile] = useState(null);
  
  // Category management
  const [allCategories, setAllCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  
  // Attribute management
  const [availableAttributes, setAvailableAttributes] = useState([]);
  const [productAttributes, setProductAttributes] = useState({});
  
  // Variant management
  const [variants, setVariants] = useState([]);
  const [editingVariantIndex, setEditingVariantIndex] = useState(null);
  const [variantFormData, setVariantFormData] = useState({
    name: '',
    sku: '',
    price_adjustment: 0,
    stock_quantity: 0,
    attributes: {},
    is_active: true
  });

  useEffect(() => {
    fetchProductDetails();
    fetchCategories();
  }, [id]);

  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      const categories = await smeService.getAllCategories();
      setAllCategories(categories);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchProductDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`🔍 Fetching product with ID: ${id}`);
      
      // First, try to get all products and find the one with matching ID
      const allProducts = await smeService.getProducts({ limit: 100 });
      console.log('📦 All products fetched:', allProducts.length);
      
      // Find the product by ID (comparing as strings or numbers)
      const foundProduct = allProducts.find(p => 
        String(p.id) === String(id) || 
        String(p.product_id) === String(id)
      );
      
      if (foundProduct) {
        console.log('✅ Product found in list:', foundProduct);
        setProduct(foundProduct);
        // Initialize edit form data
        initializeEditForm(foundProduct);
      } else {
        console.log('❌ Product not found in list, trying direct fetch...');
        
        // Try direct fetch as fallback
        try {
          const data = await smeService.getProduct(id);
          console.log('✅ Product fetched directly:', data);
          setProduct(data);
          initializeEditForm(data);
        } catch (directError) {
          console.error('Direct fetch also failed:', directError);
          throw new Error('Product not found');
        }
      }
      
    } catch (err) {
      console.error('Error fetching product details:', err);
      setError('Failed to load product details. The product may not exist or you may not have permission to view it.');
    } finally {
      setLoading(false);
    }
  };

  const initializeEditForm = (productData) => {
    // Initialize basic fields
    setEditFormData({
      name: productData.name || '',
      description: productData.description || '',
      short_description: productData.short_description || '',
      base_price: productData.base_price || 0,
      selling_price: productData.selling_price || '',
      discount_percentage: productData.discount_percentage || 0,
      commission_rate: productData.commission_rate || 0,
      sku: productData.sku || '',
      barcode: productData.barcode || '',
      stock_quantity: productData.stock_quantity || 0,
      low_stock_threshold: productData.low_stock_threshold || 5,
      is_active: productData.is_active !== undefined ? productData.is_active : true,
      status: productData.status || 'draft',
      length_cm: productData.length_cm || 1,
      width_cm: productData.width_cm || 1,
      height_cm: productData.height_cm || 1,
      weight_kg: productData.weight_kg || 0.1,
      is_foldable: productData.is_foldable || false,
      packaging_override: productData.packaging_override || 'none',
    });
    
    // Initialize categories
    const currentCategoryIds = (productData.categories || []).map(cat => cat.id);
    setSelectedCategories(currentCategoryIds);
    
    // Initialize attributes
    const attrs = {};
    (productData.attributes || []).forEach(attr => {
      attrs[attr.attribute] = attr.value;
    });
    setProductAttributes(attrs);
    
    // Initialize variants
    setVariants(productData.variants || []);
    
    // Reset image management
    setNewImages([]);
    setImagesToDelete([]);
    setFeaturedImageFile(null);
  };

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Category handlers
  const handleCategoryToggle = (categoryId) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
    
    // Load attributes for newly selected category
    const category = allCategories.find(c => c.id === categoryId);
    if (category && category.attributes) {
      setAvailableAttributes(prev => {
        const existingIds = new Set(prev.map(a => a.id));
        const newAttrs = category.attributes.filter(a => !existingIds.has(a.id));
        return [...prev, ...newAttrs];
      });
    }
  };

  // Attribute handlers
  const handleAttributeChange = (attributeId, value, attributeType) => {
    let processedValue = value;
    
    if (attributeType === 'number') {
      processedValue = parseFloat(value) || 0;
    } else if (attributeType === 'boolean') {
      processedValue = value === 'true' || value === true;
    }
    
    setProductAttributes(prev => ({
      ...prev,
      [attributeId]: processedValue
    }));
  };

  // Image handlers
  const handleAddImages = (e) => {
    const files = Array.from(e.target.files);
    setNewImages(prev => [...prev, ...files]);
  };

  const handleRemoveNewImage = (index) => {
    setNewImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleMarkImageForDeletion = (imageId) => {
    setImagesToDelete(prev => [...prev, imageId]);
  };

  const handleRestoreImage = (imageId) => {
    setImagesToDelete(prev => prev.filter(id => id !== imageId));
  };

  const handleFeaturedImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFeaturedImageFile(e.target.files[0]);
    }
  };

  // Variant handlers
  const handleAddVariant = () => {
    setVariants(prev => [...prev, { ...variantFormData, id: Date.now() }]);
    setVariantFormData({
      name: '',
      sku: '',
      price_adjustment: 0,
      stock_quantity: 0,
      attributes: {},
      is_active: true
    });
    setEditingVariantIndex(null);
  };

  const handleEditVariant = (index) => {
    setVariantFormData(variants[index]);
    setEditingVariantIndex(index);
  };

  const handleUpdateVariant = () => {
    if (editingVariantIndex !== null) {
      setVariants(prev => prev.map((v, i) => 
        i === editingVariantIndex ? { ...variantFormData, id: v.id } : v
      ));
      setVariantFormData({
        name: '',
        sku: '',
        price_adjustment: 0,
        stock_quantity: 0,
        attributes: {},
        is_active: true
      });
      setEditingVariantIndex(null);
    }
  };

  const handleDeleteVariant = (index) => {
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const handleVariantFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setVariantFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleVariantAttributeChange = (key, value) => {
    setVariantFormData(prev => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [key]: value
      }
    }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    
    try {
      // Prepare update data
      const updateData = new FormData();
      
      // Basic fields
      updateData.append('name', editFormData.name);
      updateData.append('description', editFormData.description);
      if (editFormData.short_description) {
        updateData.append('short_description', editFormData.short_description);
      }
      updateData.append('base_price', parseFloat(editFormData.base_price));
      if (editFormData.selling_price) {
        updateData.append('selling_price', parseFloat(editFormData.selling_price));
      }
      updateData.append('discount_percentage', parseFloat(editFormData.discount_percentage) || 0);
      updateData.append('commission_rate', parseFloat(editFormData.commission_rate) || 0);
      if (editFormData.sku) updateData.append('sku', editFormData.sku);
      if (editFormData.barcode) updateData.append('barcode', editFormData.barcode);
      updateData.append('stock_quantity', parseInt(editFormData.stock_quantity) || 0);
      updateData.append('low_stock_threshold', parseInt(editFormData.low_stock_threshold) || 5);
      
      // Delivery fields
      updateData.append('length_cm', parseInt(editFormData.length_cm) || 1);
      updateData.append('width_cm', parseInt(editFormData.width_cm) || 1);
      updateData.append('height_cm', parseInt(editFormData.height_cm) || 1);
      updateData.append('weight_kg', parseFloat(editFormData.weight_kg) || 0.1);
      updateData.append('is_foldable', editFormData.is_foldable);
      updateData.append('packaging_override', editFormData.packaging_override);
      
      // Categories
      selectedCategories.forEach(catId => {
        updateData.append('category_ids', catId);
      });
      
      // Attributes - convert to JSON
      if (Object.keys(productAttributes).length > 0) {
        updateData.append('attributes', JSON.stringify(productAttributes));
      }
      
      // Variants - convert to JSON
      if (variants.length > 0) {
        const variantsForSubmit = variants.map(v => ({
          name: v.name,
          sku: v.sku || '',
          price_adjustment: parseFloat(v.price_adjustment) || 0,
          stock_quantity: parseInt(v.stock_quantity) || 0,
          attributes: v.attributes || {},
          is_active: v.is_active !== undefined ? v.is_active : true
        }));
        updateData.append('variants', JSON.stringify(variantsForSubmit));
      }
      
      // Existing images to keep
      const existingImageIds = (product.images || [])
        .filter(img => !imagesToDelete.includes(img.id))
        .map(img => img.id);
      existingImageIds.forEach(id => {
        updateData.append('existing_images', id);
      });
      
      // New images
      newImages.forEach(image => {
        updateData.append('images', image);
      });
      
      // Featured image
      if (featuredImageFile) {
        updateData.append('featured_image', featuredImageFile);
      }
      
      const updatedProduct = await smeService.updateProduct(product.id, updateData);
      console.log('✅ Product updated:', updatedProduct);
      
      // Refresh product data
      await fetchProductDetails();
      setIsEditing(false);
      
    } catch (err) {
      console.error('Error updating product:', err);
      setError(err.message || 'Failed to update product. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset to original product data
    if (product) {
      initializeEditForm(product);
    }
    setNewImages([]);
    setImagesToDelete([]);
    setFeaturedImageFile(null);
  };

  const handleDeleteClick = () => {
    setDeleteConfirm(product);
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    setError(null);
    
    try {
      await smeService.deleteProduct(product.id);
      console.log('✅ Product deleted:', product.id);
      navigate('/sme/products', { 
        state: { message: `Product "${product.name}" has been deleted successfully.` }
      });
    } catch (err) {
      console.error('Error deleting product:', err);
      setError(err.message || 'Failed to delete product. Please try again.');
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
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
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const getStatusClass = () => {
    if (!product) return '';
    if (product.status === 'active' && product.is_active) return styles.statusActive;
    if (product.status === 'pending') return styles.statusPending;
    if (product.status === 'rejected') return styles.statusRejected;
    if (product.status === 'draft') return styles.statusDraft;
    return styles.statusInactive;
  };

  const getStatusText = () => {
    if (!product) return '';
    if (product.status === 'active' && product.is_active) return 'Active';
    if (product.status === 'pending') return 'Pending Approval';
    if (product.status === 'rejected') return 'Rejected';
    if (product.status === 'draft') return 'Draft';
    return 'Inactive';
  };

  const getStockStatus = () => {
    if (!product) return { class: '', text: '' };
    if (product.stock_quantity === 0) return { class: styles.stockOut, text: 'Out of Stock' };
    if (product.stock_quantity <= (product.low_stock_threshold || 5)) return { class: styles.stockLow, text: 'Low Stock' };
    return { class: styles.stockIn, text: 'In Stock' };
  };

  const renderCategoryTree = (categories, level = 0) => {
    return categories.map(category => (
      <div key={category.id} style={{ marginLeft: `${level * 20}px` }}>
        <label className={styles.categoryCheckbox}>
          <input
            type="checkbox"
            checked={selectedCategories.includes(category.id)}
            onChange={() => handleCategoryToggle(category.id)}
          />
          <span>{category.name}</span>
        </label>
        {category.children && category.children.length > 0 && 
          renderCategoryTree(category.children, level + 1)}
      </div>
    ));
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
        
        {debugInfo && (
          <div className={styles.debugInfo}>
            <h3>Debug Information:</h3>
            <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
        )}
        
        <div className={styles.errorActions}>
          <button onClick={() => navigate('/sme/products')} className={styles.backButton}>
            Back to Products
          </button>
          <button onClick={fetchProductDetails} className={styles.retryButton}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className={styles.notFoundContainer}>
        <div className={styles.notFoundIcon}>🔍</div>
        <h2 className={styles.notFoundTitle}>Product Not Found</h2>
        <p className={styles.notFoundMessage}>
          The product you're looking for doesn't exist or has been deleted.
        </p>
        <button onClick={() => navigate('/sme/products')} className={styles.backButton}>
          Back to Products
        </button>
      </div>
    );
  }

  const stockStatus = getStockStatus();

  // Render edit form
  if (isEditing) {
    return (
      <div className={styles.container}>
        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className={styles.modalOverlay} onClick={handleDeleteCancel}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3>Delete Product</h3>
                <button className={styles.modalClose} onClick={handleDeleteCancel}>×</button>
              </div>
              <div className={styles.modalBody}>
                <p>Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?</p>
                <p className={styles.modalWarning}>This action cannot be undone. All product data, images, and variants will be permanently removed.</p>
              </div>
              <div className={styles.modalFooter}>
                <button 
                  className={styles.modalCancelButton} 
                  onClick={handleDeleteCancel}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button 
                  className={styles.modalDeleteButton} 
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={styles.navigation}>
          <button onClick={() => navigate('/sme/products')} className={styles.backLink}>
            ← Back to Products
          </button>
          <div className={styles.navigationRight}>
            <button onClick={handleCancelEdit} className={styles.cancelButton}>
              Cancel
            </button>
            <button onClick={handleEditSubmit} disabled={saving} className={styles.saveButton}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className={styles.content}>
          <form>
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <input
                  type="text"
                  name="name"
                  value={editFormData.name}
                  onChange={handleEditChange}
                  className={styles.editTitleInput}
                  placeholder="Product Name"
                  required
                />
                <div className={styles.metaInfo}>
                  <select
                    name="status"
                    value={editFormData.status}
                    onChange={handleEditChange}
                    className={styles.editSmallInput}
                  >
                    <option value="draft">Draft</option>
                    <option value="pending">Pending Approval</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={editFormData.is_active}
                      onChange={handleEditChange}
                    />
                    Active
                  </label>
                </div>
              </div>
            </div>

            <div className={styles.tabs}>
              <button type="button" className={`${styles.tab} ${activeTab === 'details' ? styles.activeTab : ''}`} onClick={() => setActiveTab('details')}>Details</button>
              <button type="button" className={`${styles.tab} ${activeTab === 'categories' ? styles.activeTab : ''}`} onClick={() => setActiveTab('categories')}>Categories & Attributes</button>
              <button type="button" className={`${styles.tab} ${activeTab === 'variants' ? styles.activeTab : ''}`} onClick={() => setActiveTab('variants')}>Variants</button>
              <button type="button" className={`${styles.tab} ${activeTab === 'images' ? styles.activeTab : ''}`} onClick={() => setActiveTab('images')}>Images</button>
            </div>

            <div className={styles.tabContent}>
              {/* Details Tab */}
              {activeTab === 'details' && (
                <div className={styles.detailsTab}>
                  <div className={styles.twoColumnGrid}>
                    <div className={styles.leftColumn}>
                      <div className={styles.infoCard}>
                        <h3 className={styles.cardTitle}>Pricing Information</h3>
                        <div className={styles.editField}>
                          <label>Base Price (R)</label>
                          <input type="number" name="base_price" value={editFormData.base_price} onChange={handleEditChange} step="0.01" min="0" required />
                        </div>
                        <div className={styles.editField}>
                          <label>Selling Price (R) - Optional</label>
                          <input type="number" name="selling_price" value={editFormData.selling_price} onChange={handleEditChange} step="0.01" min="0" />
                        </div>
                        <div className={styles.editField}>
                          <label>Discount Percentage (%)</label>
                          <input type="number" name="discount_percentage" value={editFormData.discount_percentage} onChange={handleEditChange} step="0.01" min="0" max="100" />
                        </div>
                        <div className={styles.editField}>
                          <label>Commission Rate (R)</label>
                          <input type="number" name="commission_rate" value={editFormData.commission_rate} onChange={handleEditChange} step="0.01" min="0" />
                        </div>
                      </div>

                      <div className={styles.infoCard}>
                        <h3 className={styles.cardTitle}>Inventory Information</h3>
                        <div className={styles.editField}>
                          <label>Stock Quantity</label>
                          <input type="number" name="stock_quantity" value={editFormData.stock_quantity} onChange={handleEditChange} min="0" />
                        </div>
                        <div className={styles.editField}>
                          <label>Low Stock Threshold</label>
                          <input type="number" name="low_stock_threshold" value={editFormData.low_stock_threshold} onChange={handleEditChange} min="0" />
                        </div>
                      </div>

                      <div className={styles.infoCard}>
                        <h3 className={styles.cardTitle}>Identifiers</h3>
                        <div className={styles.editField}>
                          <label>SKU</label>
                          <input type="text" name="sku" value={editFormData.sku} onChange={handleEditChange} />
                        </div>
                        <div className={styles.editField}>
                          <label>Barcode</label>
                          <input type="text" name="barcode" value={editFormData.barcode} onChange={handleEditChange} />
                        </div>
                      </div>
                    </div>

                    <div className={styles.rightColumn}>
                      <div className={styles.infoCard}>
                        <h3 className={styles.cardTitle}>Description</h3>
                        <div className={styles.editField}>
                          <label>Short Description</label>
                          <textarea name="short_description" value={editFormData.short_description} onChange={handleEditChange} rows="3" />
                        </div>
                        <div className={styles.editField}>
                          <label>Full Description</label>
                          <textarea name="description" value={editFormData.description} onChange={handleEditChange} rows="6" />
                        </div>
                      </div>

                      <div className={styles.infoCard}>
                        <h3 className={styles.cardTitle}>Shipping Information</h3>
                        <div className={styles.editField}>
                          <label>Length (cm)</label>
                          <input type="number" name="length_cm" value={editFormData.length_cm} onChange={handleEditChange} step="0.1" min="0" />
                        </div>
                        <div className={styles.editField}>
                          <label>Width (cm)</label>
                          <input type="number" name="width_cm" value={editFormData.width_cm} onChange={handleEditChange} step="0.1" min="0" />
                        </div>
                        <div className={styles.editField}>
                          <label>Height (cm)</label>
                          <input type="number" name="height_cm" value={editFormData.height_cm} onChange={handleEditChange} step="0.1" min="0" />
                        </div>
                        <div className={styles.editField}>
                          <label>Weight (kg)</label>
                          <input type="number" name="weight_kg" value={editFormData.weight_kg} onChange={handleEditChange} step="0.01" min="0" />
                        </div>
                        <div className={styles.editField}>
                          <label className={styles.checkboxLabel}>
                            <input type="checkbox" name="is_foldable" checked={editFormData.is_foldable} onChange={handleEditChange} />
                            Foldable Product
                          </label>
                        </div>
                        <div className={styles.editField}>
                          <label>Packaging Override</label>
                          <select name="packaging_override" value={editFormData.packaging_override} onChange={handleEditChange}>
                            <option value="none">None (use dimensional logic)</option>
                            <option value="small">Always Small</option>
                            <option value="medium">Always Medium</option>
                            <option value="large">Always Large</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Categories & Attributes Tab */}
              {activeTab === 'categories' && (
                <div className={styles.categoriesTab}>
                  <div className={styles.twoColumnGrid}>
                    <div className={styles.leftColumn}>
                      <div className={styles.infoCard}>
                        <h3 className={styles.cardTitle}>Categories</h3>
                        <div className={styles.categoryTree}>
                          {loadingCategories ? (
                            <p>Loading categories...</p>
                          ) : (
                            renderCategoryTree(allCategories)
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className={styles.rightColumn}>
                      <div className={styles.infoCard}>
                        <h3 className={styles.cardTitle}>Product Attributes</h3>
                        {availableAttributes.length === 0 && Object.keys(productAttributes).length === 0 ? (
                          <p>Select a category above to see available attributes.</p>
                        ) : (
                          <div className={styles.attributesEditForm}>
                            {Object.entries(productAttributes).map(([attrId, value]) => {
                              const attribute = availableAttributes.find(a => a.id === parseInt(attrId));
                              if (!attribute) return null;
                              
                              return (
                                <div key={attrId} className={styles.editField}>
                                  <label>{attribute.name}</label>
                                  {attribute.attribute_type === 'text' && (
                                    <input
                                      type="text"
                                      value={value || ''}
                                      onChange={(e) => handleAttributeChange(attrId, e.target.value, attribute.attribute_type)}
                                    />
                                  )}
                                  {attribute.attribute_type === 'number' && (
                                    <input
                                      type="number"
                                      value={value || 0}
                                      onChange={(e) => handleAttributeChange(attrId, e.target.value, attribute.attribute_type)}
                                    />
                                  )}
                                  {attribute.attribute_type === 'boolean' && (
                                    <select
                                      value={value === true || value === 'true' ? 'true' : 'false'}
                                      onChange={(e) => handleAttributeChange(attrId, e.target.value === 'true', attribute.attribute_type)}
                                    >
                                      <option value="true">Yes</option>
                                      <option value="false">No</option>
                                    </select>
                                  )}
                                  {attribute.attribute_type === 'select' && attribute.options && (
                                    <select
                                      value={value || ''}
                                      onChange={(e) => handleAttributeChange(attrId, e.target.value, attribute.attribute_type)}
                                    >
                                      <option value="">Select...</option>
                                      {attribute.options.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  )}
                                  {attribute.unit && <small>Unit: {attribute.unit}</small>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Variants Tab */}
              {activeTab === 'variants' && (
                <div className={styles.variantsTab}>
                  <div className={styles.infoCard}>
                    <h3 className={styles.cardTitle}>Manage Variants</h3>
                    
                    {/* Variant Form */}
                    <div className={styles.variantForm}>
                      <h4>{editingVariantIndex !== null ? 'Edit Variant' : 'Add New Variant'}</h4>
                      <div className={styles.variantFormGrid}>
                        <div className={styles.editField}>
                          <label>Variant Name *</label>
                          <input type="text" name="name" value={variantFormData.name} onChange={handleVariantFormChange} required />
                        </div>
                        <div className={styles.editField}>
                          <label>SKU</label>
                          <input type="text" name="sku" value={variantFormData.sku} onChange={handleVariantFormChange} />
                        </div>
                        <div className={styles.editField}>
                          <label>Price Adjustment (R)</label>
                          <input type="number" name="price_adjustment" value={variantFormData.price_adjustment} onChange={handleVariantFormChange} step="0.01" />
                        </div>
                        <div className={styles.editField}>
                          <label>Stock Quantity</label>
                          <input type="number" name="stock_quantity" value={variantFormData.stock_quantity} onChange={handleVariantFormChange} min="0" />
                        </div>
                        <div className={styles.editField}>
                          <label className={styles.checkboxLabel}>
                            <input type="checkbox" name="is_active" checked={variantFormData.is_active} onChange={handleVariantFormChange} />
                            Active
                          </label>
                        </div>
                        <div className={styles.editField}>
                          <label>Attributes (JSON)</label>
                          <textarea
                            value={JSON.stringify(variantFormData.attributes, null, 2)}
                            onChange={(e) => {
                              try {
                                const parsed = JSON.parse(e.target.value);
                                setVariantFormData(prev => ({ ...prev, attributes: parsed }));
                              } catch (err) {
                                // Invalid JSON, ignore
                              }
                            }}
                            rows="3"
                            placeholder='{"color": "red", "size": "large"}'
                          />
                        </div>
                      </div>
                      <div className={styles.variantFormActions}>
                        {editingVariantIndex !== null ? (
                          <>
                            <button type="button" onClick={handleUpdateVariant} className={styles.saveButton}>Update Variant</button>
                            <button type="button" onClick={() => setEditingVariantIndex(null)} className={styles.cancelButton}>Cancel</button>
                          </>
                        ) : (
                          <button type="button" onClick={handleAddVariant} className={styles.addButton}>Add Variant</button>
                        )}
                      </div>
                    </div>
                    
                    {/* Variants List */}
                    {variants.length > 0 && (
                      <div className={styles.variantsList}>
                        <h4>Current Variants</h4>
                        <table className={styles.variantsTable}>
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>SKU</th>
                              <th>Price Adj.</th>
                              <th>Stock</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {variants.map((variant, index) => (
                              <tr key={index}>
                                <td>{variant.name}</td>
                                <td>{variant.sku || '-'}</td>
                                <td className={variant.price_adjustment > 0 ? styles.positiveAdjustment : styles.negativeAdjustment}>
                                  {variant.price_adjustment > 0 ? '+' : ''}{formatCurrency(variant.price_adjustment)}
                                </td>
                                <td>{variant.stock_quantity || 0}</td>
                                <td>
                                  <span className={variant.is_active ? styles.variantActive : styles.variantInactive}>
                                    {variant.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td>
                                  <button type="button" onClick={() => handleEditVariant(index)} className={styles.editButtonSmall}>Edit</button>
                                  <button type="button" onClick={() => handleDeleteVariant(index)} className={styles.deleteButtonSmall}>Delete</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Images Tab */}
              {activeTab === 'images' && (
                <div className={styles.imagesTab}>
                  <div className={styles.infoCard}>
                    <h3 className={styles.cardTitle}>Product Images</h3>
                    
                    {/* Featured Image Upload */}
                    <div className={styles.editField}>
                      <label>Featured Image</label>
                      <input type="file" accept="image/*" onChange={handleFeaturedImageChange} />
                      {featuredImageFile && (
                        <div className={styles.imagePreview}>
                          <img src={URL.createObjectURL(featuredImageFile)} alt="New featured" />
                          <button type="button" onClick={() => setFeaturedImageFile(null)}>Remove</button>
                        </div>
                      )}
                      {product.featured_image && !featuredImageFile && (
                        <div className={styles.imagePreview}>
                          <img src={product.featured_image} alt="Current featured" />
                          <small>Current featured image</small>
                        </div>
                      )}
                    </div>
                    
                    {/* Add New Images */}
                    <div className={styles.editField}>
                      <label>Add Additional Images</label>
                      <input type="file" accept="image/*" multiple onChange={handleAddImages} />
                    </div>
                    
                    {/* New Images Preview */}
                    {newImages.length > 0 && (
                      <div className={styles.newImagesGrid}>
                        <h4>New Images to Add</h4>
                        <div className={styles.imageGrid}>
                          {newImages.map((img, idx) => (
                            <div key={idx} className={styles.imagePreview}>
                              <img src={URL.createObjectURL(img)} alt={`New ${idx + 1}`} />
                              <button type="button" onClick={() => handleRemoveNewImage(idx)}>Remove</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Existing Images */}
                    {product.images && product.images.length > 0 && (
                      <div className={styles.existingImages}>
                        <h4>Current Images</h4>
                        <div className={styles.imageGrid}>
                          {product.images.map((img) => (
                            <div key={img.id} className={`${styles.imagePreview} ${imagesToDelete.includes(img.id) ? styles.markedForDeletion : ''}`}>
                              <img src={img.image} alt={img.alt_text || product.name} />
                              {imagesToDelete.includes(img.id) ? (
                                <>
                                  <span className={styles.deletionMark}>Will be deleted</span>
                                  <button type="button" onClick={() => handleRestoreImage(img.id)}>Restore</button>
                                </>
                              ) : (
                                <button type="button" onClick={() => handleMarkImageForDeletion(img.id)}>Delete</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Render view mode (same as original)
  return (
    <div className={styles.container}>
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className={styles.modalOverlay} onClick={handleDeleteCancel}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Delete Product</h3>
              <button className={styles.modalClose} onClick={handleDeleteCancel}>×</button>
            </div>
            <div className={styles.modalBody}>
              <p>Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?</p>
              <p className={styles.modalWarning}>This action cannot be undone. All product data, images, and variants will be permanently removed.</p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalCancelButton} onClick={handleDeleteCancel} disabled={deleting}>Cancel</button>
              <button className={styles.modalDeleteButton} onClick={handleDeleteConfirm} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Header */}
      <div className={styles.navigation}>
        <Link to="/sme/products" className={styles.backLink}>← Back to Products</Link>
        <div className={styles.navigationRight}>
          <button onClick={handleEditClick} className={styles.editProductButton}>✏️ Edit Product</button>
          <button onClick={handleDeleteClick} className={styles.deleteProductButton}>🗑️ Delete Product</button>
        </div>
      </div>

      {/* Main Content - View Mode */}
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>{product.name}</h1>
            <div className={styles.metaInfo}>
              <span className={`${styles.statusBadge} ${getStatusClass()}`}>{getStatusText()}</span>
              {product.sku && <span className={styles.sku}>SKU: {product.sku}</span>}
              {product.barcode && <span className={styles.barcode}>Barcode: {product.barcode}</span>}
            </div>
          </div>
        </div>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${activeTab === 'details' ? styles.activeTab : ''}`} onClick={() => setActiveTab('details')}>Product Details</button>
          <button className={`${styles.tab} ${activeTab === 'attributes' ? styles.activeTab : ''}`} onClick={() => setActiveTab('attributes')}>Attributes</button>
          <button className={`${styles.tab} ${activeTab === 'variants' ? styles.activeTab : ''}`} onClick={() => setActiveTab('variants')}>Variants ({product.variants?.length || 0})</button>
          <button className={`${styles.tab} ${activeTab === 'images' ? styles.activeTab : ''}`} onClick={() => setActiveTab('images')}>Images ({product.images?.length || 0})</button>
        </div>

        <div className={styles.tabContent}>
          {activeTab === 'details' && (
            <div className={styles.detailsTab}>
              <div className={styles.twoColumnGrid}>
                <div className={styles.leftColumn}>
                  <div className={styles.infoCard}>
                    <h3 className={styles.cardTitle}>Pricing Information</h3>
                    <div className={styles.pricingGrid}>
                      <div className={styles.pricingRow}><span className={styles.pricingLabel}>Base Price:</span><span className={styles.pricingValue}>{formatCurrency(product.base_price)}</span></div>
                      {product.discount_percentage > 0 && <div className={styles.pricingRow}><span className={styles.pricingLabel}>Discount:</span><span className={styles.discountValue}>-{product.discount_percentage}%</span></div>}
                      <div className={styles.pricingRow}><span className={styles.pricingLabel}>Selling Price:</span><span className={styles.sellingPrice}>{formatCurrency(product.selling_price || product.base_price)}</span></div>
                      <div className={styles.pricingRow}><span className={styles.pricingLabel}>Commission Rate:</span><span className={styles.pricingValue}>R{product.commission_rate || 0}</span></div>
                    </div>
                  </div>

                  <div className={styles.infoCard}>
                    <h3 className={styles.cardTitle}>Inventory Status</h3>
                    <div className={styles.inventoryGrid}>
                      <div className={styles.inventoryItem}><span className={styles.inventoryLabel}>Stock Quantity:</span><span className={`${styles.inventoryValue} ${stockStatus.class}`}>{product.stock_quantity || 0} units</span></div>
                      <div className={styles.inventoryItem}><span className={styles.inventoryLabel}>Low Stock Threshold:</span><span className={styles.inventoryValue}>{product.low_stock_threshold || 5} units</span></div>
                      <div className={styles.inventoryItem}><span className={styles.inventoryLabel}>Stock Status:</span><span className={`${styles.stockStatus} ${stockStatus.class}`}>{stockStatus.text}</span></div>
                    </div>
                  </div>

                  <div className={styles.infoCard}>
                    <h3 className={styles.cardTitle}>Description</h3>
                    <div className={styles.description}>{product.description || 'No description provided.'}</div>
                    {product.short_description && <><h4 className={styles.subTitle}>Short Description</h4><div className={styles.shortDescription}>{product.short_description}</div></>}
                  </div>
                </div>

                <div className={styles.rightColumn}>
                  <div className={styles.imageCard}>
                    <h3 className={styles.cardTitle}>Product Image</h3>
                    <div className={styles.imageContainer}>
                      {product.featured_image ? <img src={product.featured_image} alt={product.name} className={styles.featuredImage} onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/400x400?text=No+Image'; }} /> : <div className={styles.noImage}><span>📦</span><p>No Image Available</p></div>}
                    </div>
                  </div>

                  {product.categories && product.categories.length > 0 && (
                    <div className={styles.infoCard}>
                      <h3 className={styles.cardTitle}>Categories</h3>
                      <div className={styles.categories}>{product.categories.map(category => (<span key={category.id} className={styles.categoryTag}>{category.full_path || category.name}</span>))}</div>
                    </div>
                  )}

                  <div className={styles.infoCard}>
                    <h3 className={styles.cardTitle}>Product Information</h3>
                    <div className={styles.metadataGrid}>
                      <div className={styles.metadataRow}><span className={styles.metadataLabel}>Product ID:</span><span className={styles.metadataValue}>{product.id}</span></div>
                      {product.sku && <div className={styles.metadataRow}><span className={styles.metadataLabel}>SKU:</span><span className={styles.metadataValue}>{product.sku}</span></div>}
                      {product.barcode && <div className={styles.metadataRow}><span className={styles.metadataLabel}>Barcode:</span><span className={styles.metadataValue}>{product.barcode}</span></div>}
                      <div className={styles.metadataRow}><span className={styles.metadataLabel}>Created By:</span><span className={styles.metadataValue}>{product.agent_name || 'Agent'}</span></div>
                      <div className={styles.metadataRow}><span className={styles.metadataLabel}>Created Date:</span><span className={styles.metadataValue}>{formatDate(product.created_at)}</span></div>
                      {product.updated_at && product.updated_at !== product.created_at && <div className={styles.metadataRow}><span className={styles.metadataLabel}>Last Updated:</span><span className={styles.metadataValue}>{formatDate(product.updated_at)}</span></div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'attributes' && (
            <div className={styles.attributesTab}>
              <h3 className={styles.tabTitle}>Product Attributes</h3>
              {product.attributes && product.attributes.length > 0 ? (
                <div className={styles.attributesGrid}>
                  {product.attributes.map(attr => (
                    <div key={attr.id} className={styles.attributeCard}>
                      <div className={styles.attributeHeader}><span className={styles.attributeName}>{attr.attribute_name}</span>{attr.attribute_unit && <span className={styles.attributeUnit}>{attr.attribute_unit}</span>}</div>
                      <div className={styles.attributeValue}>{attr.display_value || attr.value}</div>
                      <div className={styles.attributeType}>{attr.attribute_type}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptySection}><div className={styles.emptyIcon}>🏷️</div><h4>No Attributes</h4><p>This product doesn't have any custom attributes.</p></div>
              )}
            </div>
          )}

          {activeTab === 'variants' && (
            <div className={styles.variantsTab}>
              <h3 className={styles.tabTitle}>Product Variants</h3>
              {product.variants && product.variants.length > 0 ? (
                <div className={styles.variantsTable}>
                  <table className={styles.variantsTable}>
                    <thead><tr><th>Variant Name</th><th>SKU</th><th>Price Adjustment</th><th>Final Price</th><th>Stock</th><th>Status</th><th>Attributes</th></tr></thead>
                    <tbody>
                      {product.variants.map((variant, index) => {
                        const variantFinalPrice = (product.selling_price || product.base_price) + (variant.price_adjustment || 0);
                        return (<tr key={index}>
                          <td><span className={styles.variantName}>{variant.name}</span></td>
                          <td><span className={styles.variantSku}>{variant.sku || '-'}</span></td>
                          <td><span className={variant.price_adjustment > 0 ? styles.positiveAdjustment : styles.negativeAdjustment}>{variant.price_adjustment > 0 ? '+' : ''}{formatCurrency(variant.price_adjustment || 0)}</span></td>
                          <td><span className={styles.variantPrice}>{formatCurrency(variantFinalPrice)}</span></td>
                          <td><span className={`${styles.variantStock} ${variant.stock_quantity === 0 ? styles.stockOut : variant.stock_quantity <= 5 ? styles.stockLow : ''}`}>{variant.stock_quantity || 0}</span></td>
                          <td><span className={`${styles.variantStatus} ${variant.is_active ? styles.variantActive : styles.variantInactive}`}>{variant.is_active ? 'Active' : 'Inactive'}</span></td>
                          <td><div className={styles.variantAttributes}>{Object.entries(variant.attributes || {}).map(([key, value]) => (<span key={key} className={styles.variantAttribute}>{key}: {value}</span>))}</div></td>
                        </tr>);
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={styles.emptySection}><div className={styles.emptyIcon}>🔄</div><h4>No Variants</h4><p>This product doesn't have any variants.</p></div>
              )}
            </div>
          )}

          {activeTab === 'images' && (
            <div className={styles.imagesTab}>
              <h3 className={styles.tabTitle}>Product Images</h3>
              {product.images && product.images.length > 0 ? (
                <>
                  <div className={styles.mainImageContainer}><img src={product.images[activeImageIndex]?.image || product.featured_image} alt={product.name} className={styles.mainImage} onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/600x600?text=No+Image'; }} /></div>
                  <div className={styles.thumbnailGallery}>{product.images.map((img, index) => (<button key={index} className={`${styles.thumbnail} ${activeImageIndex === index ? styles.activeThumbnail : ''}`} onClick={() => setActiveImageIndex(index)}><img src={img.image} alt={`${product.name} - ${index + 1}`} className={styles.thumbnailImage} /></button>))}</div>
                  <div className={styles.imageCount}>{activeImageIndex + 1} / {product.images.length} images</div>
                </>
              ) : (
                <div className={styles.emptySection}><div className={styles.emptyIcon}>🖼️</div><h4>No Images</h4><p>This product doesn't have any images.</p></div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SMEProductDetail;