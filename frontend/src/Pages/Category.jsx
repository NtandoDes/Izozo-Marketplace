import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useCart } from "../contexts/CartContext";
import { productsService } from "../services/productsService";
import styles from "./Category.module.css";

// Import placeholder images
import productPlaceholder from "../assets/products/hoodie.jpg";

export default function Category() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  
  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const [priceRange, setPriceRange] = useState([0, 5000]);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState("grid");
  const [selectedSellers, setSelectedSellers] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  
  const productsPerPage = 12;

  // Sort options
  const sortOptions = [
    { id: "featured", name: "Featured" },
    { id: "newest", name: "Newest" },
    { id: "price-low", name: "Price: Low to High" },
    { id: "price-high", name: "Price: High to Low" },
    { id: "rating", name: "Highest Rated" },
    { id: "popular", name: "Most Popular" }
  ];

  // Common tags
  const commonTags = ["Featured", "New Arrival", "Best Seller", "Limited Edition", "Popular", "Discount"];

  // Initialize category and products
  useEffect(() => {
    fetchCategoryData();
  }, [searchParams]);

  // Filter and sort products when dependencies change
  useEffect(() => {
    filterAndSortProducts();
  }, [products, searchQuery, sortBy, priceRange, selectedSellers, selectedTags]);

  const fetchCategoryData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const categorySlug = searchParams.get("category");
      
      if (!categorySlug) {
        navigate("/products");
        return;
      }
      
      // Fetch all categories
      const categoriesData = await productsService.getCategories();
      const currentCategory = categoriesData.find(cat => 
        cat.slug === categorySlug || cat.name.toLowerCase() === categorySlug.toLowerCase()
      );
      
      if (!currentCategory) {
        navigate("/products");
        return;
      }
      
      setCategory(currentCategory);
      
      // Fetch products for this category
      const productsData = await productsService.getProductsByCategory(currentCategory.id);
      setProducts(productsData);
      
    } catch (err) {
      console.error('Error fetching category data:', err);
      setError('Failed to load category. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortProducts = useCallback(() => {
    let filtered = [...products];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product => 
        product.name?.toLowerCase().includes(query) ||
        product.sme_name?.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query)
      );
    }
    
    // Apply price filter
    filtered = filtered.filter(product => {
      const price = product.selling_price || product.base_price;
      return price >= priceRange[0] && price <= priceRange[1];
    });
    
    // Apply seller filter
    if (selectedSellers.length > 0) {
      filtered = filtered.filter(product => 
        selectedSellers.includes(product.sme_name)
      );
    }
    
    // Apply tags filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(product => {
        const productTags = [];
        if (product.is_featured) productTags.push("Featured");
        if (product.is_new) productTags.push("New Arrival");
        if (product.is_best_seller) productTags.push("Best Seller");
        if (product.discount_percentage > 0) productTags.push("Discount");
        return selectedTags.some(tag => productTags.includes(tag));
      });
    }
    
    // Apply sorting
    switch(sortBy) {
      case "newest":
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case "price-low":
        filtered.sort((a, b) => (a.selling_price || a.base_price) - (b.selling_price || b.base_price));
        break;
      case "price-high":
        filtered.sort((a, b) => (b.selling_price || b.base_price) - (a.selling_price || a.base_price));
        break;
      case "rating":
        filtered.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
        break;
      case "popular":
        filtered.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
        break;
      case "featured":
      default:
        filtered.sort((a, b) => {
          const aFeatured = a.is_featured ? 1 : 0;
          const bFeatured = b.is_featured ? 1 : 0;
          return bFeatured - aFeatured || (b.average_rating || 0) - (a.average_rating || 0);
        });
        break;
    }
    
    setFilteredProducts(filtered);
    setCurrentPage(1);
  }, [products, searchQuery, sortBy, priceRange, selectedSellers, selectedTags]);

  const handleSearch = (e) => {
    e.preventDefault();
    filterAndSortProducts();
  };

  const handlePriceRangeChange = (e, index) => {
    const newValue = parseInt(e.target.value) || 0;
    const newRange = [...priceRange];
    newRange[index] = newValue;
    setPriceRange(newRange);
  };

  const handleSellerChange = (seller) => {
    setSelectedSellers(prev => 
      prev.includes(seller) 
        ? prev.filter(s => s !== seller)
        : [...prev, seller]
    );
  };

  const handleTagChange = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
  };

  // Calculate pagination
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
  const startIndex = (currentPage - 1) * productsPerPage;
  const endIndex = startIndex + productsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddToCart = (product, e) => {
    e.stopPropagation();
    e.preventDefault();
    addToCart({
      id: product.id,
      name: product.name,
      price: product.selling_price || product.base_price,
      image: product.featured_image || productPlaceholder,
      quantity: 1
    });
    alert(`${product.name} added to cart!`);
  };

  const handleWishlist = (productId, e) => {
    e.stopPropagation();
    e.preventDefault();
    alert(`Product added to wishlist!`);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSortBy("featured");
    setPriceRange([0, 5000]);
    setSelectedSellers([]);
    setSelectedTags([]);
  };

  const formatPrice = (price) => {
    if (!price) return 'R0';
    return `R${parseFloat(price).toLocaleString()}`;
  };

  const getProductImage = (product) => {
    if (product.featured_image) return product.featured_image;
    if (product.images && product.images.length > 0) return product.images[0].image;
    return productPlaceholder;
  };

  // Get unique sellers for this category
  const uniqueSellers = [...new Set(products.map(p => p.sme_name).filter(Boolean))];

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading category...</p>
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>⚠️</div>
        <h2>Oops! Something went wrong</h2>
        <p>{error || 'Category not found'}</p>
        <button onClick={fetchCategoryData} className={styles.retryButton}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className={styles.categoryPage}>
      {/* Hero Banner */}
      <section className={styles.categoryHero}>
        <div className="container">
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>{category.name}</h1>
            <p className={styles.heroSubtitle}>
              {category.description || `Browse our collection of ${category.name.toLowerCase()} products`}
            </p>
            <div className={styles.categoryStats}>
              <span className={styles.statItem}>
                <strong>{products.length}</strong> Products
              </span>
              <span className={styles.statItem}>
                <strong>{uniqueSellers.length}</strong> Sellers
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        <div className={styles.productsLayout}>
          {/* Sidebar Filters */}
          <aside className={styles.sidebar}>
            <div className={styles.sidebarSection}>
              <h3 className={styles.sidebarTitle}>Price Range</h3>
              <div className={styles.priceFilter}>
                <div className={styles.priceInputs}>
                  <div className={styles.priceInputGroup}>
                    <label htmlFor="minPrice">Min</label>
                    <input
                      type="number"
                      id="minPrice"
                      min="0"
                      max="5000"
                      value={priceRange[0]}
                      onChange={(e) => handlePriceRangeChange(e, 0)}
                      className={styles.priceInput}
                    />
                  </div>
                  <div className={styles.priceInputGroup}>
                    <label htmlFor="maxPrice">Max</label>
                    <input
                      type="number"
                      id="maxPrice"
                      min="0"
                      max="5000"
                      value={priceRange[1]}
                      onChange={(e) => handlePriceRangeChange(e, 1)}
                      className={styles.priceInput}
                    />
                  </div>
                </div>
                <div className={styles.priceSlider}>
                  <input
                    type="range"
                    min="0"
                    max="5000"
                    value={priceRange[0]}
                    onChange={(e) => handlePriceRangeChange(e, 0)}
                    className={styles.rangeSlider}
                  />
                  <input
                    type="range"
                    min="0"
                    max="5000"
                    value={priceRange[1]}
                    onChange={(e) => handlePriceRangeChange(e, 1)}
                    className={styles.rangeSlider}
                  />
                </div>
                <div className={styles.priceDisplay}>
                  {formatPrice(priceRange[0])} - {formatPrice(priceRange[1])}
                </div>
              </div>
            </div>

            {uniqueSellers.length > 0 && (
              <div className={styles.sidebarSection}>
                <h3 className={styles.sidebarTitle}>Sellers</h3>
                <ul className={styles.sellerList}>
                  {uniqueSellers.map(seller => (
                    <li key={seller} className={styles.sellerItem}>
                      <label className={styles.sellerLabel}>
                        <input
                          type="checkbox"
                          checked={selectedSellers.includes(seller)}
                          onChange={() => handleSellerChange(seller)}
                          className={styles.sellerCheckbox}
                        />
                        <span className={styles.sellerName}>{seller}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={styles.sidebarSection}>
              <h3 className={styles.sidebarTitle}>Tags</h3>
              <div className={styles.tagCloud}>
                {commonTags.map(tag => (
                  <button 
                    key={tag} 
                    className={`${styles.tag} ${selectedTags.includes(tag) ? styles.active : ''}`}
                    onClick={() => handleTagChange(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <button className={styles.resetFiltersBtn} onClick={resetFilters}>
              Reset All Filters
            </button>
          </aside>

          {/* Main Content */}
          <main className={styles.mainContent}>
            {/* Search and Controls Bar */}
            <div className={styles.controlsBar}>
              <form onSubmit={handleSearch} className={styles.searchForm}>
                <div className={styles.searchInputGroup}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search in ${category.name.toLowerCase()}...`}
                    className={styles.searchInput}
                  />
                  <button type="submit" className={styles.searchButton}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                    </svg>
                  </button>
                </div>
              </form>

              <div className={styles.controlsRight}>
                <div className={styles.sortContainer}>
                  <span className={styles.sortLabel}>Sort by:</span>
                  <select 
                    value={sortBy} 
                    onChange={handleSortChange}
                    className={styles.sortSelect}
                  >
                    {sortOptions.map(option => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.viewToggle}>
                  <button
                    className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.active : ''}`}
                    onClick={() => setViewMode('grid')}
                    aria-label="Grid view"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3A1.5 1.5 0 0 1 15 10.5v3A1.5 1.5 0 0 1 13.5 15h-3A1.5 1.5 0 0 1 9 13.5v-3z"/>
                    </svg>
                  </button>
                  <button
                    className={`${styles.viewBtn} ${viewMode === 'list' ? styles.active : ''}`}
                    onClick={() => setViewMode('list')}
                    aria-label="List view"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                      <path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Results Info */}
            <div className={styles.resultsInfo}>
              <p className={styles.resultsCount}>
                Showing {filteredProducts.length > 0 ? startIndex + 1 : 0}-
                {Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} products
                {searchQuery && ` for "${searchQuery}"`}
              </p>
              
              {filteredProducts.length === 0 && (
                <div className={styles.noResults}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M11.354 6.354a.5.5 0 0 0-.708-.708L8 8.293 6.854 7.146a.5.5 0 1 0-.708.708l1.5 1.5a.5.5 0 0 0 .708 0l3-3z"/>
                    <path d="M.5 1a.5.5 0 0 0 0 1h1.11l.401 1.607 1.498 7.985A.5.5 0 0 0 4 12h1a2 2 0 1 0 0 4 2 2 0 0 0 0-4h7a2 2 0 1 0 0 4 2 2 0 0 0 0-4h1a.5.5 0 0 0 .491-.408l1.5-8A.5.5 0 0 0 14.5 3H2.89l-.405-1.621A.5.5 0 0 0 2 1H.5zm3.915 10L3.102 4h10.796l-1.313 7h-8.17zM6 14a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm7 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                  </svg>
                  <h3>No products found</h3>
                  <p>Try adjusting your search or filter to find what you're looking for.</p>
                  <button className={styles.resetFiltersBtn} onClick={resetFilters}>
                    Reset Filters
                  </button>
                </div>
              )}
            </div>

            {/* Products Grid/List */}
            {filteredProducts.length > 0 && (
              <div className={`${styles.productsContainer} ${viewMode === 'list' ? styles.listView : ''}`}>
                {currentProducts.map(product => {
                  const price = product.selling_price || product.base_price;
                  const originalPrice = product.base_price > price ? product.base_price : null;
                  const discountPercentage = product.discount_percentage > 0 ? product.discount_percentage : null;
                  
                  return (
                    <div 
                      key={product.id} 
                      className={`${styles.productCard} ${viewMode === 'list' ? styles.listCard : ''}`}
                      onClick={() => navigate(`/product/${product.slug || product.id}`)}
                    >
                      <div className={styles.productImage}>
                        <img 
                          src={getProductImage(product)} 
                          alt={product.name}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = productPlaceholder;
                          }}
                        />
                        <button 
                          className={styles.wishlistBtn}
                          onClick={(e) => handleWishlist(product.id, e)}
                          aria-label="Add to wishlist"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                            <path d="m8 2.748-.717-.737C5.6.281 2.514.878 1.4 3.053c-.523 1.023-.641 2.5.314 4.385.92 1.815 2.834 3.989 6.286 6.357 3.452-2.368 5.365-4.542 6.286-6.357.955-1.886.838-3.362.314-4.385C13.486.878 10.4.28 8.717 2.01L8 2.748zM8 15C-7.333 4.868 3.279-3.04 7.824 1.143c.06.055.119.112.176.171a3.12 3.12 0 0 1 .176-.17C12.72-3.042 23.333 4.867 8 15z"/>
                          </svg>
                        </button>
                        {product.is_featured && (
                          <div className={styles.productBadge}>Featured</div>
                        )}
                        {product.is_new && (
                          <div className={`${styles.productBadge} ${styles.newBadge}`}>
                            New
                          </div>
                        )}
                        {discountPercentage && (
                          <div className={styles.discountBadge}>
                            -{discountPercentage}%
                          </div>
                        )}
                      </div>
                      
                      <div className={styles.productContent}>
                        <div className={styles.productHeader}>
                          <span className={styles.productCategory}>{category.name}</span>
                          {product.average_rating > 0 && (
                            <div className={styles.productRating}>
                              <span className={styles.stars}>
                                {[...Array(5)].map((_, i) => (
                                  <span
                                    key={i}
                                    className={`${styles.star} ${i < Math.floor(product.average_rating) ? styles.filled : ''}`}
                                  >
                                    ★
                                  </span>
                                ))}
                              </span>
                              <span className={styles.ratingValue}>
                                {product.average_rating.toFixed(1)}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <h3 className={styles.productName}>{product.name}</h3>
                        
                        {viewMode === 'list' && product.description && (
                          <p className={styles.productDescription}>
                            {product.description.length > 150 
                              ? `${product.description.substring(0, 150)}...` 
                              : product.description}
                          </p>
                        )}
                        
                        {product.sme_name && (
                          <div className={styles.productSeller}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
                            </svg>
                            {product.sme_name}
                          </div>
                        )}
                        
                        <div className={styles.productFooter}>
                          <div className={styles.productPrice}>
                            <span className={styles.currentPrice}>{formatPrice(price)}</span>
                            {originalPrice && (
                              <span className={styles.originalPrice}>{formatPrice(originalPrice)}</span>
                            )}
                          </div>
                          
                          <div className={styles.productActions}>
                            <button 
                              className={`${styles.btn} ${styles.viewBtnSmall}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/product/${product.slug || product.id}`);
                              }}
                            >
                              View
                            </button>
                            <button 
                              className={`${styles.btn} ${styles.addToCartBtn}`}
                              onClick={(e) => handleAddToCart(product, e)}
                              disabled={product.stock_quantity === 0}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M0 1.5A.5.5 0 0 1 .5 1H2a.5.5 0 0 1 .485.379L2.89 3H14.5a.5.5 0 0 1 .491.592l-1.5 8A.5.5 0 0 1 13 12H4a.5.5 0 0 1-.491-.408L2.01 3.607 1.61 2H.5a.5.5 0 0 1-.5-.5zM3.102 4l1.313 7h8.17l1.313-7H3.102z"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {filteredProducts.length > productsPerPage && (
              <div className={styles.pagination}>
                <button
                  className={`${styles.pageBtn} ${currentPage === 1 ? styles.disabled : ''}`}
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
                  </svg>
                  Previous
                </button>
                
                <div className={styles.pageNumbers}>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        className={`${styles.pageNumber} ${currentPage === pageNum ? styles.active : ''}`}
                        onClick={() => handlePageChange(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <>
                      <span className={styles.pageDots}>...</span>
                      <button
                        className={styles.pageNumber}
                        onClick={() => handlePageChange(totalPages)}
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>
                
                <button
                  className={`${styles.pageBtn} ${currentPage === totalPages ? styles.disabled : ''}`}
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
                  </svg>
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}