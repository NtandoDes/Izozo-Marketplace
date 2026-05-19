/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import agentService from '../../services/agentService';
import styles from './AgentProducts.module.css';

const AgentProducts = () => {
  // eslint-disable-next-line no-unused-vars
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [assignedSMEs, setAssignedSMEs] = useState([]);
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    sme_id: 'all',
    category: 'all',
    sort: 'newest'
  });
  
  // UI states
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
    rejected: 0,
    draft: 0
  });

  // Load initial data
  useEffect(() => {
    loadProducts();
    loadAssignedSMEs();
  }, []);

  // Apply filters whenever filters or products change
  useEffect(() => {
    applyFilters();
  }, [filters, products]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const productsData = await agentService.getAssignedProducts({ limit: 100 });
      console.log('✅ Products loaded:', productsData);
      setProducts(productsData);
      setFilteredProducts(productsData);
      
      // Calculate stats
      const stats = {
        total: productsData.length,
        active: productsData.filter(p => p.status === 'active' && p.is_active).length,
        pending: productsData.filter(p => p.status === 'pending').length,
        rejected: productsData.filter(p => p.status === 'rejected').length,
        draft: productsData.filter(p => p.status === 'draft').length
      };
      setStats(stats);
      
    } catch (err) {
      console.error('❌ Error loading products:', err);
      setError({
        title: 'Failed to Load Products',
        message: err.message || 'Please try again later'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAssignedSMEs = async () => {
    try {
      const smes = await agentService.getAssignedSMEs();
      setAssignedSMEs(smes);
    } catch (err) {
      console.error('Error loading SMEs:', err);
    }
  };

  const applyFilters = () => {
    let filtered = [...products];
    
    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(p => 
        p.name?.toLowerCase().includes(searchTerm) ||
        p.sku?.toLowerCase().includes(searchTerm) ||
        p.sme_name?.toLowerCase().includes(searchTerm) ||
        p.description?.toLowerCase().includes(searchTerm)
      );
    }
    
    // Status filter
    if (filters.status !== 'all') {
      if (filters.status === 'active') {
        filtered = filtered.filter(p => p.status === 'active' && p.is_active);
      } else if (filters.status === 'inactive') {
        filtered = filtered.filter(p => p.status === 'inactive' || !p.is_active);
      } else {
        filtered = filtered.filter(p => p.status === filters.status);
      }
    }
    
    // SME filter
    if (filters.sme_id !== 'all') {
      filtered = filtered.filter(p => p.sme_id === parseInt(filters.sme_id));
    }
    
    // Category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter(p => 
        p.category_ids?.includes(parseInt(filters.category))
      );
    }
    
    // Sorting
    switch (filters.sort) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case 'price_high':
        filtered.sort((a, b) => (b.selling_price || b.base_price) - (a.selling_price || a.base_price));
        break;
      case 'price_low':
        filtered.sort((a, b) => (a.selling_price || a.base_price) - (b.selling_price || b.base_price));
        break;
      case 'name_asc':
        filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'name_desc':
        filtered.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        break;
      default:
        break;
    }
    
    setFilteredProducts(filtered);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      sme_id: 'all',
      category: 'all',
      sort: 'newest'
    });
    setSelectedProducts([]);
    setBulkDeleteMode(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    applyFilters();
  };

  // Product selection for bulk actions
  const toggleProductSelection = (productId) => {
    if (selectedProducts.includes(productId)) {
      setSelectedProducts(selectedProducts.filter(id => id !== productId));
    } else {
      setSelectedProducts([...selectedProducts, productId]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
  };

  // Delete handlers
  const handleDeleteClick = (product) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  const handleBulkDeleteClick = () => {
    if (selectedProducts.length > 0) {
      setBulkDeleteMode(true);
      setShowDeleteModal(true);
    }
  };

  const confirmDelete = async () => {
    try {
      if (bulkDeleteMode) {
        // Bulk delete
        await agentService.bulkDeleteProducts(selectedProducts);
        setProducts(products.filter(p => !selectedProducts.includes(p.id)));
        setSelectedProducts([]);
        setBulkDeleteMode(false);
      } else {
        // Single delete
        await agentService.deleteProduct(productToDelete.id);
        setProducts(products.filter(p => p.id !== productToDelete.id));
      }
      
      setShowDeleteModal(false);
      setProductToDelete(null);
      
      // Show success message (you can add a toast notification here)
      alert(bulkDeleteMode 
        ? `${selectedProducts.length} products deleted successfully` 
        : 'Product deleted successfully'
      );
      
    } catch (err) {
      console.error('Error deleting product:', err);
      alert('Failed to delete product. Please try again.');
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setProductToDelete(null);
    setBulkDeleteMode(false);
  };

  // Status badge class helper
  const getStatusBadgeClass = (product) => {
    if (product.status === 'active' && product.is_active) return styles.active;
    if (product.status === 'pending') return styles.pending;
    if (product.status === 'rejected') return styles.rejected;
    if (product.status === 'draft') return styles.draft;
    return styles.inactive;
  };

  const getStatusText = (product) => {
    if (product.status === 'active' && product.is_active) return 'Active';
    if (product.status === 'pending') return 'Pending Approval';
    if (product.status === 'rejected') return 'Rejected';
    if (product.status === 'draft') return 'Draft';
    return 'Inactive';
  };

  // Format price
  const formatPrice = (price) => {
    if (!price) return 'R0.00';
    return `R${parseFloat(price).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading your products...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>My Products</h1>
          <p className={styles.subtitle}>
            Manage all products you've created for your assigned SMEs
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link to="/agent/products/create" className={styles.createButton}>
            + Create New Product
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(33, 150, 243, 0.1)' }}>
            📦
          </div>
          <div className={styles.statContent}>
            <h3>{stats.total}</h3>
            <p>Total Products</p>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(0, 200, 83, 0.1)' }}>
            ✅
          </div>
          <div className={styles.statContent}>
            <h3>{stats.active}</h3>
            <p>Active</p>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(255, 152, 0, 0.1)' }}>
            ⏳
          </div>
          <div className={styles.statContent}>
            <h3>{stats.pending}</h3>
            <p>Pending</p>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(244, 67, 54, 0.1)' }}>
            ❌
          </div>
          <div className={styles.statContent}>
            <h3>{stats.rejected}</h3>
            <p>Rejected</p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.errorAlert}>
          <div className={styles.errorIcon}>❌</div>
          <div className={styles.errorContent}>
            <h3>{error.title}</h3>
            <p>{error.message}</p>
          </div>
          <button onClick={() => setError(null)} className={styles.closeButton}>×</button>
        </div>
      )}

      {/* Filters Section */}
      <div className={styles.filtersSection}>
        <form onSubmit={handleSearch} className={styles.filtersForm}>
          {/* Search */}
          <div className={styles.searchBox}>
            <input
              type="text"
              name="search"
              placeholder="Search products by name, SKU, or SME..."
              value={filters.search}
              onChange={handleFilterChange}
              className={styles.searchInput}
            />
            <button type="submit" className={styles.searchButton}>
              🔍 Search
            </button>
          </div>

          <div className={styles.filtersRow}>
            {/* Status Filter */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Status</label>
              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                className={styles.filterSelect}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
                <option value="draft">Draft</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* SME Filter */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>SME</label>
              <select
                name="sme_id"
                value={filters.sme_id}
                onChange={handleFilterChange}
                className={styles.filterSelect}
              >
                <option value="all">All SMEs</option>
                {assignedSMEs.map(sme => (
                  <option key={sme.id} value={sme.id}>
                    {sme.business_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Filter */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Sort By</label>
              <select
                name="sort"
                value={filters.sort}
                onChange={handleFilterChange}
                className={styles.filterSelect}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="price_high">Price: High to Low</option>
                <option value="price_low">Price: Low to High</option>
                <option value="name_asc">Name: A to Z</option>
                <option value="name_desc">Name: Z to A</option>
              </select>
            </div>

            {/* Clear Filters */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>&nbsp;</label>
              <button
                type="button"
                onClick={clearFilters}
                className={styles.clearButton}
              >
                Clear Filters
              </button>
            </div>
          </div>
        </form>

        {/* Results Info */}
        <div className={styles.resultsInfo}>
          <span className={styles.resultsCount}>
            Showing {filteredProducts.length} of {products.length} products
          </span>
          
          {/* Bulk Actions */}
          {filteredProducts.length > 0 && (
            <div className={styles.bulkActions}>
              <label className={styles.selectAllLabel}>
                <input
                  type="checkbox"
                  checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                  onChange={toggleSelectAll}
                  className={styles.selectAllCheckbox}
                />
                Select All
              </label>
              
              {selectedProducts.length > 0 && (
                <button
                  onClick={handleBulkDeleteClick}
                  className={styles.bulkDeleteButton}
                >
                  Delete Selected ({selectedProducts.length})
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Products Table */}
      {filteredProducts.length > 0 ? (
        <div className={styles.tableContainer}>
          <table className={styles.productsTable}>
            <thead>
              <tr>
                {bulkDeleteMode && (
                  <th className={styles.checkboxColumn}>
                    <input
                      type="checkbox"
                      checked={selectedProducts.length === filteredProducts.length}
                      onChange={toggleSelectAll}
                      className={styles.checkbox}
                    />
                  </th>
                )}
                <th>Product</th>
                <th>SME</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => (
                <tr key={product.id} className={styles.productRow}>
                  {bulkDeleteMode && (
                    <td className={styles.checkboxColumn}>
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => toggleProductSelection(product.id)}
                        className={styles.checkbox}
                      />
                    </td>
                  )}
                  <td>
                    <div className={styles.productInfo}>
                      <div className={styles.productImage}>
                        {product.featured_image ? (
                          <img 
                            src={product.featured_image} 
                            alt={product.name}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://via.placeholder.com/50?text=No+Image';
                            }}
                          />
                        ) : (
                          <div className={styles.noImage}>📦</div>
                        )}
                      </div>
                      <div className={styles.productDetails}>
                        <Link to={`/agent/products/${product.id}`} className={styles.productName}>
                          {product.name || 'Unnamed Product'}
                        </Link>
                        {product.sku && (
                          <span className={styles.productSku}>SKU: {product.sku}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={styles.smeName}>
                      {product.sme_name || 'Unknown SME'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.priceInfo}>
                      <span className={styles.currentPrice}>
                        {formatPrice(product.selling_price || product.base_price)}
                      </span>
                      {product.discount_percentage > 0 && (
                        <>
                          <span className={styles.originalPrice}>
                            {formatPrice(product.base_price)}
                          </span>
                          <span className={styles.discountBadge}>
                            -{product.discount_percentage}%
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.stockQuantity} ${product.stock_quantity <= product.low_stock_threshold ? styles.lowStock : ''}`}>
                      {product.stock_quantity || 0}
                    </span>
                    {product.stock_quantity <= product.low_stock_threshold && (
                      <span className={styles.lowStockBadge}>Low</span>
                    )}
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${getStatusBadgeClass(product)}`}>
                      {getStatusText(product)}
                    </span>
                  </td>
                  <td>
                    <span className={styles.createdDate}>
                      {formatDate(product.created_at)}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionButtons}>
                      <Link
                        to={`/agent/products/${product.id}/edit`}
                        className={styles.editButton}
                        title="Edit Product"
                      >
                        ✏️
                      </Link>
                      <Link
                        to={`/agent/products/${product.id}`}
                        className={styles.viewButton}
                        title="View Product"
                      >
                        👁️
                      </Link>
                      <button
                        onClick={() => handleDeleteClick(product)}
                        className={styles.deleteButton}
                        title="Delete Product"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📦</div>
          <h3 className={styles.emptyTitle}>No Products Found</h3>
          <p className={styles.emptyDescription}>
            {products.length === 0 
              ? "You haven't created any products yet. Start by creating your first product!"
              : "No products match your current filters. Try adjusting your search criteria."}
          </p>
          {products.length === 0 ? (
            <Link to="/agent/products/create" className={styles.emptyButton}>
              Create Your First Product
            </Link>
          ) : (
            <button onClick={clearFilters} className={styles.emptyButton}>
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {bulkDeleteMode ? 'Delete Products' : 'Delete Product'}
              </h3>
              <button onClick={cancelDelete} className={styles.modalClose}>×</button>
            </div>
            <div className={styles.modalBody}>
              {bulkDeleteMode ? (
                <>
                  <p className={styles.modalMessage}>
                    Are you sure you want to delete <strong>{selectedProducts.length} products</strong>?
                  </p>
                  <p className={styles.modalWarning}>
                    This action cannot be undone. These products will be permanently removed from the system.
                  </p>
                </>
              ) : (
                <>
                  <p className={styles.modalMessage}>
                    Are you sure you want to delete <strong>"{productToDelete?.name}"</strong>?
                  </p>
                  <p className={styles.modalWarning}>
                    This action cannot be undone. The product will be permanently removed from the system.
                  </p>
                </>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button onClick={cancelDelete} className={styles.cancelButton}>
                Cancel
              </button>
              <button onClick={confirmDelete} className={styles.confirmButton}>
                {bulkDeleteMode ? 'Delete Products' : 'Delete Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentProducts;