/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { smeService } from '../../services/smeService';
import styles from './SMEProducts.module.css';

const SMEProducts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  
  // Data states
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [productStats, setProductStats] = useState({
    total_products: 0,
    active_products: 0,
    pending_products: 0,
    draft_products: 0,
    rejected_products: 0,
    out_of_stock: 0,
    low_stock: 0,
    total_value: 0
  });
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    stock: 'all',
    sort: 'newest'
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch products on component mount
  useEffect(() => {
    fetchProducts();
    fetchProductStats();
  }, []);

  // Apply filters whenever filters or products change
  useEffect(() => {
    applyFilters();
  }, [filters, products]);

  // Update pagination when filtered products change
  useEffect(() => {
    setTotalPages(Math.ceil(filteredProducts.length / productsPerPage));
    setCurrentPage(1);
  }, [filteredProducts, productsPerPage]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await smeService.getProducts();
      console.log('✅ Products fetched:', data.length);
      setProducts(data);
      setFilteredProducts(data);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to load products. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchProductStats = async () => {
    try {
      const stats = await smeService.getProductStats();
      console.log('✅ Product stats fetched:', stats);
      setProductStats(stats);
    } catch (err) {
      console.error('Error fetching product stats:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchProducts(),
      fetchProductStats()
    ]);
  };

  const handleEditClick = (productId) => {
    navigate(`/sme/products/${productId}/edit`);
  };

  const handleDeleteClick = (product) => {
    setShowDeleteConfirm(product);
  };

  const handleDeleteConfirm = async (product) => {
    setDeletingId(product.id);
    setError(null);
    
    try {
      await smeService.deleteProduct(product.id);
      console.log('✅ Product deleted:', product.id);
      
      // Refresh products and stats
      await Promise.all([
        fetchProducts(),
        fetchProductStats()
      ]);
      
    } catch (err) {
      console.error('Error deleting product:', err);
      setError(`Failed to delete "${product.name}". ${err.response?.data?.error || 'Please try again.'}`);
    } finally {
      setDeletingId(null);
      setShowDeleteConfirm(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(null);
  };

  const applyFilters = () => {
    let filtered = [...products];
    
    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(p => 
        p.name?.toLowerCase().includes(searchTerm) ||
        p.sku?.toLowerCase().includes(searchTerm) ||
        p.agent_name?.toLowerCase().includes(searchTerm)
      );
    }
    
    // Status filter
    if (filters.status !== 'all') {
      if (filters.status === 'active') {
        filtered = filtered.filter(p => p.status === 'active' && p.is_active);
      } else if (filters.status === 'pending') {
        filtered = filtered.filter(p => p.status === 'pending');
      } else if (filters.status === 'rejected') {
        filtered = filtered.filter(p => p.status === 'rejected');
      } else if (filters.status === 'draft') {
        filtered = filtered.filter(p => p.status === 'draft');
      } else if (filters.status === 'inactive') {
        filtered = filtered.filter(p => p.status === 'inactive' || !p.is_active);
      }
    }
    
    // Stock filter
    if (filters.stock !== 'all') {
      if (filters.stock === 'in_stock') {
        filtered = filtered.filter(p => p.stock_quantity > p.low_stock_threshold);
      } else if (filters.stock === 'low_stock') {
        filtered = filtered.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold);
      } else if (filters.stock === 'out_of_stock') {
        filtered = filtered.filter(p => p.stock_quantity === 0);
      }
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
      case 'stock_asc':
        filtered.sort((a, b) => (a.stock_quantity || 0) - (b.stock_quantity || 0));
        break;
      case 'stock_desc':
        filtered.sort((a, b) => (b.stock_quantity || 0) - (a.stock_quantity || 0));
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
      stock: 'all',
      sort: 'newest'
    });
  };

  // Get current page products
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

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
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const getStatusClass = (product) => {
    if (product.status === 'active' && product.is_active) return styles.statusActive;
    if (product.status === 'pending') return styles.statusPending;
    if (product.status === 'rejected') return styles.statusRejected;
    if (product.status === 'draft') return styles.statusDraft;
    return styles.statusInactive;
  };

  const getStatusText = (product) => {
    if (product.status === 'active' && product.is_active) return 'Active';
    if (product.status === 'pending') return 'Pending Approval';
    if (product.status === 'rejected') return 'Rejected';
    if (product.status === 'draft') return 'Draft';
    return 'Inactive';
  };

  const getStockStatus = (product) => {
    if (product.stock_quantity === 0) return { class: styles.stockOut, text: 'Out of Stock' };
    if (product.stock_quantity <= product.low_stock_threshold) return { class: styles.stockLow, text: 'Low Stock' };
    return { class: styles.stockIn, text: 'In Stock' };
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
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className={styles.modalOverlay} onClick={handleDeleteCancel}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Delete Product</h3>
              <button className={styles.modalClose} onClick={handleDeleteCancel}>×</button>
            </div>
            <div className={styles.modalBody}>
              <p>Are you sure you want to delete <strong>{showDeleteConfirm.name}</strong>?</p>
              <p className={styles.modalWarning}>This action cannot be undone. All product data, images, and variants will be permanently removed.</p>
            </div>
            <div className={styles.modalFooter}>
              <button 
                className={styles.modalCancelButton} 
                onClick={handleDeleteCancel}
                disabled={deletingId === showDeleteConfirm.id}
              >
                Cancel
              </button>
              <button 
                className={styles.modalDeleteButton} 
                onClick={() => handleDeleteConfirm(showDeleteConfirm)}
                disabled={deletingId === showDeleteConfirm.id}
              >
                {deletingId === showDeleteConfirm.id ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>My Products</h1>
          <p className={styles.subtitle}>
            View and monitor all products in your catalog
          </p>
        </div>
        <div className={styles.headerActions}>
          <button 
            onClick={handleRefresh} 
            disabled={refreshing} 
            className={styles.refreshButton}
          >
            {refreshing ? 'Refreshing...' : '⟳ Refresh'}
          </button>
        </div>
      </div>

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

      {/* Stats Summary Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(33, 150, 243, 0.1)' }}>
            📦
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Total Products</span>
            <span className={styles.statValue}>{productStats.total_products}</span>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}>
            ✅
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Active</span>
            <span className={styles.statValue}>{productStats.active_products}</span>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(255, 152, 0, 0.1)' }}>
            ⏳
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Pending</span>
            <span className={styles.statValue}>{productStats.pending_products}</span>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(244, 67, 54, 0.1)' }}>
            ❌
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Rejected</span>
            <span className={styles.statValue}>{productStats.rejected_products}</span>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(156, 39, 176, 0.1)' }}>
            💰
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Inventory Value</span>
            <span className={styles.statValue}>{formatCurrency(productStats.total_value)}</span>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ backgroundColor: 'rgba(158, 158, 158, 0.1)' }}>
            📋
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Draft</span>
            <span className={styles.statValue}>{productStats.draft_products}</span>
          </div>
        </div>
      </div>

      {/* Inventory Alert Summary */}
      {(productStats.out_of_stock > 0 || productStats.low_stock > 0) && (
        <div className={styles.alertSummary}>
          <div className={styles.alertSummaryContent}>
            <span className={styles.alertSummaryIcon}>⚠️</span>
            <span className={styles.alertSummaryText}>
              {productStats.out_of_stock > 0 && `${productStats.out_of_stock} product(s) out of stock`}
              {productStats.out_of_stock > 0 && productStats.low_stock > 0 && ' • '}
              {productStats.low_stock > 0 && `${productStats.low_stock} product(s) low on stock`}
            </span>
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div className={styles.filtersSection}>
        <div className={styles.searchBox}>
          <input
            type="text"
            name="search"
            placeholder="Search products by name, SKU, or agent..."
            value={filters.search}
            onChange={handleFilterChange}
            className={styles.searchInput}
          />
          <button onClick={applyFilters} className={styles.searchButton}>
            🔍 Search
          </button>
        </div>

        <div className={styles.filtersRow}>
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
              <option value="pending">Pending Approval</option>
              <option value="rejected">Rejected</option>
              <option value="draft">Draft</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Stock Status</label>
            <select
              name="stock"
              value={filters.stock}
              onChange={handleFilterChange}
              className={styles.filterSelect}
            >
              <option value="all">All Stock</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </div>

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
              <option value="stock_desc">Stock: High to Low</option>
              <option value="stock_asc">Stock: Low to High</option>
            </select>
          </div>

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

        <div className={styles.resultsInfo}>
          <span className={styles.resultsCount}>
            Showing {filteredProducts.length > 0 ? indexOfFirstProduct + 1 : 0} - {Math.min(indexOfLastProduct, filteredProducts.length)} of {filteredProducts.length} products
          </span>
          <span className={styles.totalProducts}>
            Total in catalog: {productStats.total_products}
          </span>
        </div>
      </div>

      {/* Products Table */}
      {filteredProducts.length > 0 ? (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.productsTable}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Stock</th>
                  <th>Agent</th>
                  <th>Created</th>
                  <th>SKU</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentProducts.map(product => {
                  const stockStatus = getStockStatus(product);
                  return (
                    <tr key={product.id}>
                      <td>
                        <div className={styles.productInfo}>
                          <Link to={`/sme/products/${product.id}`} className={styles.productName}>
                            {product.name || 'Unnamed Product'}
                          </Link>
                          {product.short_description && (
                            <span className={styles.productDescription}>
                              {product.short_description.length > 50 
                                ? `${product.short_description.substring(0, 50)}...` 
                                : product.short_description}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className={styles.priceInfo}>
                          <span className={styles.currentPrice}>
                            {formatCurrency(product.selling_price || product.base_price)}
                          </span>
                          {product.discount_percentage > 0 && (
                            <>
                              <span className={styles.originalPrice}>
                                {formatCurrency(product.base_price)}
                              </span>
                              <span className={styles.discountBadge}>
                                -{product.discount_percentage}%
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${getStatusClass(product)}`}>
                          {getStatusText(product)}
                        </span>
                      </td>
                      <td>
                        <div className={styles.stockInfo}>
                          <span className={`${styles.stockQuantity} ${stockStatus.class}`}>
                            {product.stock_quantity || 0}
                          </span>
                          <span className={styles.stockStatusText}>
                            {stockStatus.text}
                          </span>
                          {product.low_stock_threshold && (
                            <span className={styles.stockThreshold}>
                              Threshold: {product.low_stock_threshold}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={styles.agentName}>
                          {product.agent_name || 'System'}
                        </span>
                      </td>
                      <td>
                        <span className={styles.createdDate}>
                          {formatDate(product.created_at)}
                        </span>
                      </td>
                      <td>
                        <span className={styles.sku}>
                          {product.sku || '-'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button
                            onClick={() => handleEditClick(product.id)}
                            className={styles.editButton}
                            title="Edit product"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(product)}
                            className={styles.deleteButton}
                            disabled={deletingId === product.id}
                            title="Delete product"
                          >
                            {deletingId === product.id ? '⌛' : '🗑️ Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button 
                onClick={prevPage} 
                disabled={currentPage === 1}
                className={styles.paginationButton}
              >
                ← Previous
              </button>
              
              <div className={styles.pageNumbers}>
                {[...Array(totalPages)].map((_, i) => {
                  const pageNumber = i + 1;
                  if (
                    pageNumber === 1 ||
                    pageNumber === totalPages ||
                    (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => paginate(pageNumber)}
                        className={`${styles.pageButton} ${currentPage === pageNumber ? styles.activePage : ''}`}
                      >
                        {pageNumber}
                      </button>
                    );
                  } else if (
                    pageNumber === currentPage - 2 ||
                    pageNumber === currentPage + 2
                  ) {
                    return <span key={pageNumber} className={styles.pageEllipsis}>...</span>;
                  }
                  return null;
                })}
              </div>
              
              <button 
                onClick={nextPage} 
                disabled={currentPage === totalPages}
                className={styles.paginationButton}
              >
                Next →
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📦</div>
          <h3 className={styles.emptyTitle}>No Products Found</h3>
          <p className={styles.emptyDescription}>
            {products.length === 0 
              ? "You don't have any products in your catalog yet. Your agents will create products for your business."
              : "No products match your current filters. Try adjusting your search criteria."}
          </p>
          {products.length === 0 ? (
            <p className={styles.emptySubtext}>
              Once your agents create products, they will appear here.
            </p>
          ) : (
            <button onClick={clearFilters} className={styles.emptyButton}>
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SMEProducts;