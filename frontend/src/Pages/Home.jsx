/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../contexts/CartContext";
import { homeService } from "../services/homeService";
import styles from "./Home.module.css";

// Import placeholder images as fallbacks
import slider1 from "../assets/products/earbuds.jpg";
import slider2 from "../assets/products/hoodie.jpg";
import slider3 from "../assets/products/kota.jpg";
import slider4 from "../assets/products/sneakers.jpg";
import clothesCat from "../assets/categories/clothes.jpg";
import foodCat from "../assets/categories/food.jpg";
import electronicsCat from "../assets/categories/electronics.jpg";
import otherCat from "../assets/categories/other.jpg";
import productPlaceholder from "../assets/products/hoodie.jpg";

export default function Home() {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  
  // State for dynamic data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [stats, setStats] = useState({
    activeSMEs: 0,
    verifiedAgents: 0,
    totalProducts: 0,
  });
  
  // UI states
  const [searchQuery, setSearchQuery] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [featuredStartIndex, setFeaturedStartIndex] = useState(0);
  const slideIntervalRef = useRef(null);
  const sliderRef = useRef(null);

  // Slider data (static content) - REMOVED IMAGES, USING SOLID COLORS
  const sliderData = [
    {
      id: 1,
      title: "Discover Local Products",
      subtitle: "Shop from verified SMMEs in your community",
      ctaText: "Browse Products",
      ctaLink: "/products",
      backgroundColor: "#150C09", // Dark brown solid color
    },
    {
      id: 2,
      title: "Agent-Assisted Delivery",
      subtitle: "Fast and reliable delivery powered by local agents",
      ctaText: "Learn More",
      ctaLink: "/how-it-works",
      backgroundColor: "#150C09", // Red solid color
    },
    {
      id: 3,
      title: "Support Local Businesses",
      subtitle: "Empower SMMEs with every purchase",
      ctaText: "Shop Now",
      ctaLink: "/products",
      backgroundColor: "#150C09", // Yellow solid color
    },
    {
      id: 4,
      title: "Join the Marketplace",
      subtitle: "Register as SMME, Agent, or Delivery Partner",
      ctaText: "Get Started",
      ctaLink: "/register",
      backgroundColor: "#150C09", // Dark brown solid color
    },
  ];

  // Fetch data on component mount
  useEffect(() => {
    fetchHomeData();
  }, []);

  // Auto slide functionality
  useEffect(() => {
    slideIntervalRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % sliderData.length);
    }, 5000);

    return () => {
      if (slideIntervalRef.current) {
        clearInterval(slideIntervalRef.current);
      }
    };
  }, [sliderData.length]);

  const fetchHomeData = async () => {
    try {
      setLoading(true);
      
      // Fetch all products first
      const productsData = await homeService.getAllProducts({ limit: 100 });
      console.log('All products:', productsData);
      setAllProducts(productsData);
      
      // Fetch categories with product counts
      const categoriesData = await homeService.getCategoriesWithCounts();
      console.log('Categories with counts:', categoriesData);
      
      // Check clothes category specifically
      const clothesCategory = categoriesData.find(c => 
        c.name?.toLowerCase().includes('cloth') || 
        c.name?.toLowerCase().includes('fashion') ||
        c.id === 1
      );
      
      if (clothesCategory) {
        console.log('Clothes category details:', clothesCategory);
        console.log('Products in clothes category:', clothesCategory.products);
      }
      
      setCategories(categoriesData);
      
      // Fetch featured products
      const featuredData = await homeService.getFeaturedProducts();
      console.log('Featured products:', featuredData);
      setFeaturedProducts(featuredData);

      // Fetch stats
      const statsData = await homeService.getStats();
      console.log('Stats:', statsData);
      setStats(statsData);

    } catch (err) {
      console.error('Error fetching home data:', err);
      setError('Failed to load content. Please refresh the page.');
      setFallbackData();
    } finally {
      setLoading(false);
    }
  };

  // Fallback data function
  const setFallbackData = () => {
    // Try to get categories even if product counts fail
    homeService.getCategories().then(cats => {
      if (cats && cats.length > 0) {
        const enhancedCats = cats.map((cat, index) => ({
          ...cat,
          image: getCategoryImage(cat, index),
          count: 'Loading products...',
          product_count: 0,
          products: []
        }));
        setCategories(enhancedCats);
      } else {
        // Ultimate fallback with hardcoded data
        setCategories([
          { 
            id: 1, 
            name: "Clothes", 
            slug: "clothes",
            image: clothesCat, 
            count: "2 products",
            product_count: 2,
            description: "Fashion and apparel"
          },
          { 
            id: 2, 
            name: "Food", 
            slug: "food",
            image: foodCat, 
            count: "85+ products",
            product_count: 85,
            description: "Delicious meals and groceries"
          },
          { 
            id: 3, 
            name: "Electronics", 
            slug: "electronics",
            image: electronicsCat, 
            count: "65+ products",
            product_count: 65,
            description: "Gadgets and devices"
          },
          { 
            id: 4, 
            name: "Other", 
            slug: "other",
            image: otherCat, 
            count: "45+ products",
            product_count: 45,
            description: "Miscellaneous items"
          },
        ]);
      }
    });
    
    setStats({
      activeSMEs: 150,
      verifiedAgents: 50,
      totalProducts: 3000,
    });
  };

  // Helper function to get category image based on category data
  const getCategoryImage = (category, index) => {
    // If category has an image from the database, use it
    if (category.image) {
      return category.image;
    }
    
    // Otherwise, map based on category name
    const name = category.name?.toLowerCase() || '';
    if (name.includes('cloth') || name.includes('fashion') || name.includes('wear') || name.includes('apparel')) {
      return clothesCat;
    } else if (name.includes('food') || name.includes('restaurant') || name.includes('meal') || name.includes('drink')) {
      return foodCat;
    } else if (name.includes('electronic') || name.includes('gadget') || name.includes('tech') || name.includes('device')) {
      return electronicsCat;
    } else if (name.includes('other') || name.includes('misc')) {
      return otherCat;
    }
    
    // Return different images based on index for variety
    const images = [clothesCat, foodCat, electronicsCat, otherCat];
    return images[index % images.length];
  };

  // Get category icon based on name
  const getCategoryIcon = (categoryName) => {
    const name = categoryName?.toLowerCase() || '';
    if (name.includes('cloth') || name.includes('fashion')) return '👕';
    if (name.includes('food') || name.includes('restaurant')) return '🍔';
    if (name.includes('electronic') || name.includes('tech')) return '💻';
    if (name.includes('home') || name.includes('garden')) return '🏠';
    if (name.includes('beauty') || name.includes('cosmetic')) return '💄';
    if (name.includes('sport') || name.includes('fitness')) return '⚽';
    if (name.includes('book') || name.includes('education')) return '📚';
    if (name.includes('toy') || name.includes('game')) return '🎮';
    return '📦';
  };

  // Featured products carousel functions
  const handleNextFeatured = () => {
    if (featuredStartIndex < featuredProducts.length - 4) {
      setFeaturedStartIndex(featuredStartIndex + 1);
    }
  };

  const handlePrevFeatured = () => {
    if (featuredStartIndex > 0) {
      setFeaturedStartIndex(featuredStartIndex - 1);
    }
  };

  const handleDotClick = (pageIndex) => {
    setFeaturedStartIndex(pageIndex * 4);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
    resetAutoSlide();
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % sliderData.length);
    resetAutoSlide();
  };

  const prevSlide = () => {
    setCurrentSlide(
      (prev) => (prev - 1 + sliderData.length) % sliderData.length,
    );
    resetAutoSlide();
  };

  const resetAutoSlide = () => {
    if (slideIntervalRef.current) {
      clearInterval(slideIntervalRef.current);
      slideIntervalRef.current = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % sliderData.length);
      }, 5000);
    }
  };

  const handleCategoryClick = (category) => {
    // Use slug if available, otherwise use name
    const param = category.slug || encodeURIComponent(category.name);
    navigate(`/products?category=${param}`);
  };

  const handleAddToCart = (product, e) => {
  e.stopPropagation();
  e.preventDefault();

  // Current cart
  const existingCart = JSON.parse(
    localStorage.getItem("izozo-cart") || "[]"
  );

  // Create a reliable seller identifier
  const newSellerKey =
    product.sme_id ||
    product.sme?.id ||
    product.sme_name ||
    product.seller ||
    "unknown-seller";

  // Check existing cart seller
  if (existingCart.length > 0) {
    const existingSellerKey =
      existingCart[0].sme_id ||
      existingCart[0].seller ||
      "unknown-seller";

    // Prevent mixing SMEs
    if (String(existingSellerKey) !== String(newSellerKey)) {
      alert(
        "You can only add products from one seller at a time. Please clear your cart before adding items from another seller."
      );
      return;
    }
  }

  addToCart({
    id: product.id,
    product_id: product.id,

    name: product.name,
    product_name: product.name,

    price: product.selling_price || product.base_price,
    originalPrice: product.base_price,

    image: getProductImage(product),

    quantity: 1,

    // Seller info
    seller:
      product.sme_name ||
      product.seller ||
      product.sme?.business_name ||
      "Local Seller",

    sme_id:
      product.sme_id ||
      product.sme?.id ||
      product.sme_name ||
      product.seller,

    commission_rate: product.commission_rate || 10,

    category:
      product.category?.name ||
      product.category ||
      "",

    sku: product.sku || "",

    variant_id: null,
    variant_name: null,

    // Dimensions
    length_cm: product.length_cm ?? null,
    width_cm: product.width_cm ?? null,
    height_cm: product.height_cm ?? null,
    weight_kg: product.weight_kg ?? null,
  });

  alert(`${product.name} added to cart!`);
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

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading amazing products for you...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>⚠️</div>
        <h2>Oops! Something went wrong</h2>
        <p>{error}</p>
        <button onClick={fetchHomeData} className={styles.retryButton}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className={styles.homePage}>
      {/* Main Slider Section with Search Bar */}
      <section className={styles.heroSlider}>
        <div className={styles.sliderContainer}>
          <div
            className={styles.sliderTrack}
            ref={sliderRef}
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {sliderData.map((slide, index) => (
              <div key={slide.id} className={styles.slide}>
                <div 
                  className={styles.slideColor}
                  style={{ backgroundColor: slide.backgroundColor }}
                />
                <div className="container">
                  <div className={styles.slideContent}>
                    <h1 className={styles.slideTitle}>{slide.title}</h1>
                    <p className={styles.slideSubtitle}>{slide.subtitle}</p>
                    <Link
                      to={slide.ctaLink}
                      className={`${styles.btn} ${styles.slideBtn}`}
                    >
                      {slide.ctaText}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Search Bar Overlay */}
          <div className={styles.searchOverlay}>
            <div className="container">
              <form onSubmit={handleSearch} className={styles.searchForm}>
                <div className={styles.searchInputGroup}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for products, sellers, or categories..."
                    className={styles.searchInput}
                  />
                  <button type="submit" className={styles.searchButton}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      fill="currentColor"
                      viewBox="0 0 16 16"
                    >
                      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
                    </svg>
                    Search
                  </button>
                </div>

                <div className={styles.searchCategories}>
                  <span className={styles.categoriesLabel}>Popular:</span>
                  {categories.slice(0, 5).map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSearchQuery(category.name)}
                      className={styles.categoryTag}
                    >
                      {getCategoryIcon(category.name)} {category.name}
                    </button>
                  ))}
                </div>
              </form>
            </div>
          </div>

          {/* Slider Controls */}
          <button
            className={styles.sliderPrev}
            onClick={prevSlide}
            aria-label="Previous slide"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="currentColor"
              viewBox="0 0 16 16"
            >
              <path
                fillRule="evenodd"
                d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"
              />
            </svg>
          </button>

          <button
            className={styles.sliderNext}
            onClick={nextSlide}
            aria-label="Next slide"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="currentColor"
              viewBox="0 0 16 16"
            >
              <path
                fillRule="evenodd"
                d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"
              />
            </svg>
          </button>

          {/* Slider Dots */}
          <div className={styles.sliderDots}>
            {sliderData.map((_, index) => (
              <button
                key={index}
                className={`${styles.sliderDot} ${index === currentSlide ? styles.active : ""}`}
                onClick={() => goToSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Categories Section - Now Shows Actual Product Counts */}
      <section className={styles.categoriesSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <div>
              <h2 className="section-title">Shop by Category</h2>
              <p className="section-subtitle">
                Browse products from different categories
              </p>
            </div>
            <Link to="/categories" className={styles.viewAllLink}>
              View All Categories →
            </Link>
          </div>

          <div className={styles.categoriesGrid}>
            {categories.map((category, index) => (
              <div
                key={category.id}
                className={`${styles.categoryCard} ${category.product_count === 0 ? styles.emptyCategory : ''}`}
                onClick={() => handleCategoryClick(category)}
              >
                <div className={styles.categoryImage}>
                  <img 
                    src={category.image || getCategoryImage(category, index)} 
                    alt={category.name}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = `<div class="${styles.categoryIcon}">${getCategoryIcon(category.name)}</div>`;
                    }}
                  />
                  <div className={styles.categoryOverlay} />
                  {category.product_count === 0 && (
                    <div className={styles.categoryEmptyBadge}>Coming Soon</div>
                  )}
                </div>
                <div className={styles.categoryContent}>
                  <h3 className={styles.categoryName}>{category.name}</h3>
                  <p className={styles.categoryCount}>
                    {category.product_count > 0 
                      ? `${category.product_count} product${category.product_count !== 1 ? 's' : ''}` 
                      : 'No products yet'}
                  </p>
                  {category.description && (
                    <p className={styles.categoryDescription}>{category.description}</p>
                  )}
                </div>
                
                {/* Show a few products from this category */}
                {category.products && category.products.length > 0 && (
                  <div className={styles.categoryProducts}>
                    {category.products.slice(0, 3).map(product => (
                      <div 
                        key={product.id} 
                        className={styles.categoryProductThumb}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/product/${product.slug || product.id}`);
                        }}
                      >
                        <img 
                          src={getProductImage(product)} 
                          alt={product.name}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = productPlaceholder;
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Show message if no categories */}
          {categories.length === 0 && (
            <div className={styles.noCategories}>
              <p>No categories available at the moment.</p>
            </div>
          )}
        </div>
      </section>

      {/* Featured Products Section */}
      <section className={styles.featuredSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <div>
              <h2 className="section-title">Featured Products</h2>
              <p className="section-subtitle">
                Popular items from local businesses
              </p>
            </div>
            <Link to="/products" className={styles.viewAllLink}>
              View All Products →
            </Link>
          </div>

          {featuredProducts.length > 0 ? (
            <>
              <div className={styles.productsCarouselContainer}>
                <button
                  className={`${styles.carouselArrow} ${styles.prevArrow}`}
                  onClick={handlePrevFeatured}
                  aria-label="Previous products"
                  disabled={featuredStartIndex === 0}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
                    <path
                      fillRule="evenodd"
                      d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"
                    />
                  </svg>
                </button>

                <div className={styles.productsCarousel}>
                  <div
                    className={styles.productsCarouselTrack}
                    style={{
                      transform: `translateX(-${featuredStartIndex * 25}%)`,
                    }}
                  >
                    {featuredProducts.map((product) => (
                      <div key={product.id} className={styles.productCard}>
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
                            aria-label="Add to wishlist"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              fill="currentColor"
                              viewBox="0 0 16 16"
                            >
                              <path d="m8 2.748-.717-.737C5.6.281 2.514.878 1.4 3.053c-.523 1.023-.641 2.5.314 4.385.92 1.815 2.834 3.989 6.286 6.357 3.452-2.368 5.365-4.542 6.286-6.357.955-1.886.838-3.362.314-4.385C13.486.878 10.4.28 8.717 2.01L8 2.748zM8 15C-7.333 4.868 3.279-3.04 7.824 1.143c.06.055.119.112.176.171a3.12 3.12 0 0 1 .176-.17C12.72-3.042 23.333 4.867 8 15z" />
                            </svg>
                          </button>
                          {product.is_featured && (
                            <div className={styles.productBadge}>Featured</div>
                          )}
                          {product.discount_percentage > 0 && (
                            <div className={`${styles.productBadge} ${styles.discountBadge}`}>
                              {product.discount_percentage}% OFF
                            </div>
                          )}
                        </div>
                        <div className={styles.productContent}>
                          <h3 className={styles.productName}>{product.name}</h3>
                          <p className={styles.productSeller}>
                            by {product.sme_name || 'Local Seller'}
                          </p>
                          {product.average_rating > 0 && (
                            <div className={styles.productRating}>
                              <div className={styles.stars}>
                                {[...Array(5)].map((_, i) => (
                                  <span
                                    key={i}
                                    className={`${styles.star} ${i < Math.floor(product.average_rating) ? styles.filled : ""}`}
                                  >
                                    ★
                                  </span>
                                ))}
                              </div>
                              <span className={styles.ratingValue}>
                                {product.average_rating}
                              </span>
                              <span className={styles.reviewCount}>
                                ({product.review_count || 0})
                              </span>
                            </div>
                          )}
                          <div className={styles.productPrice}>
                            <span className={styles.currentPrice}>
                              {formatPrice(product.selling_price || product.base_price)}
                            </span>
                            {product.discount_percentage > 0 && (
                              <span className={styles.originalPrice}>
                                {formatPrice(product.base_price)}
                              </span>
                            )}
                          </div>
                          <div className={styles.productBottom}>
                            <button
                              className={`${styles.btn} ${styles.viewDetailsBtn}`}
                              onClick={() => navigate(`/product/${product.slug || product.id}`)}
                            >
                              View Details
                            </button>
                            <button
                              className={`${styles.btn} ${styles.addToCartBtn}`}
                              onClick={(e) => handleAddToCart(product, e)}
                            >
                              Add to Cart
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  className={`${styles.carouselArrow} ${styles.nextArrow}`}
                  onClick={handleNextFeatured}
                  aria-label="Next products"
                  disabled={featuredStartIndex >= featuredProducts.length - 4}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"
                    />
                  </svg>
                </button>
              </div>

              <div className={styles.carouselDots}>
                {Array.from({ length: Math.ceil(featuredProducts.length / 4) }).map(
                  (_, index) => (
                    <button
                      key={index}
                      className={`${styles.carouselDot} ${Math.floor(featuredStartIndex / 4) === index ? styles.active : ""}`}
                      onClick={() => handleDotClick(index)}
                      aria-label={`Go to page ${index + 1}`}
                    />
                  )
                )}
              </div>
            </>
          ) : (
            <div className={styles.noProducts}>
              <p>No featured products available at the moment.</p>
            </div>
          )}
        </div>
      </section>

      {/* Category Product Previews - Show products from each category */}
      {categories.filter(c => c.product_count > 0).slice(0, 2).map(category => (
        <section key={category.id} className={styles.categoryPreviewSection}>
          <div className="container">
            <div className={styles.sectionHeader}>
              <div>
                <h2 className="section-title">Popular in {category.name}</h2>
                <p className="section-subtitle">
                  {category.product_count} product{category.product_count !== 1 ? 's' : ''} available
                </p>
              </div>
              <button 
                onClick={() => handleCategoryClick(category)}
                className={styles.viewAllLink}
              >
                View All in {category.name} →
              </button>
            </div>

            <div className={styles.categoryProductsGrid}>
              {category.products && category.products.slice(0, 4).map(product => (
                <div 
                  key={product.id} 
                  className={styles.categoryPreviewCard}
                  onClick={() => navigate(`/product/${product.slug || product.id}`)}
                >
                  <div className={styles.previewImage}>
                    <img 
                      src={getProductImage(product)} 
                      alt={product.name}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = productPlaceholder;
                      }}
                    />
                  </div>
                  <div className={styles.previewContent}>
                    <h4>{product.name}</h4>
                    <p className={styles.previewPrice}>
                      {formatPrice(product.selling_price || product.base_price)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* CTA Section - ADDED THIRD BUTTON */}
      <section className={styles.ctaSection}>
        <div className="container">
          <div className={styles.ctaContent}>
            <div className={styles.ctaText}>
              <h2 className={styles.ctaTitle}>Ready to Grow with Izozo?</h2>
              <p className={styles.ctaDescription}>
                Join our marketplace as a seller, agent, or delivery partner and
                be part of South Africa's fastest-growing community-driven
                e-commerce platform.
              </p>
            </div>
            <div className={styles.ctaButtons}>
              <Link
                to="/apply"
                className={`${styles.btn} ${styles.btnAccent}`}
              >
                Register as SME
              </Link>
              <Link
                to="/apply"
                className={`${styles.btn} ${styles.btnAccentOutline}`}
              >
                Become an Agent
              </Link>
              <Link
                to="/apply"
                className={`${styles.btn} ${styles.btnDeliveryOutline}`}
              >
                Become a Delivery Partner
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className={styles.statsSection}>
        <div className="container">
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>{stats.activeSMEs}+</span>
              <span className={styles.statLabel}>Active SMMEs</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>{stats.verifiedAgents}+</span>
              <span className={styles.statLabel}>Verified Agents</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>{stats.totalProducts}+</span>
              <span className={styles.statLabel}>Products Listed</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>24/7</span>
              <span className={styles.statLabel}>Support Available</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

