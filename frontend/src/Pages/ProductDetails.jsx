/* eslint-disable no-unused-vars */
import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useCart } from "../contexts/CartContext";
import { productsService } from "../services/productsService";
import styles from "./ProductDetails.module.css";

import productPlaceholder from "../assets/products/hoodie.jpg";

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [product, setProduct]               = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [quantity, setQuantity]             = useState(1);
  const [selectedImage, setSelectedImage]   = useState(0);
  const [selectedSize, setSelectedSize]     = useState("");
  const [selectedColor, setSelectedColor]   = useState("");
  const [isLoading, setIsLoading]           = useState(true);
  const [error, setError]                   = useState(null);
  const [isInWishlist, setIsInWishlist]     = useState(false);

  useEffect(() => { window.scrollTo(0, 0); fetchProductDetails(); }, [id]);

  const fetchProductDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const productData = await productsService.getProduct(id);
      setProduct(productData);

      if (productData.colors?.length > 0) {
        const inStock = productData.colors.find(c => c.inStock) || productData.colors[0];
        setSelectedColor(inStock.name);
      }
      if (productData.sizes?.length > 0) setSelectedSize(productData.sizes[0]);

      if (productData.category_id) {
        const related = await productsService.getProductsByCategory(productData.category_id, 4);
        setRelatedProducts(related.filter(p => p.id !== productData.id).slice(0, 3));
      }
    } catch (err) {
      console.error("Error fetching product details:", err);
      setError("Failed to load product details. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };


  // ── Build cart item — includes ALL product fields so dimensions are stored ──
  const buildCartItem = (p, qty = quantity) => ({
    id:              p.id,
    product_id:      p.id,
    name:            p.name,
    product_name:    p.name,
    price:           p.selling_price || p.base_price,
    originalPrice:   p.base_price,
    image:           p.featured_image || productPlaceholder,
    sme_id:          p.sme || p.sme_id || null,
    commission_rate: p.commission_rate || p.commissionRate || 0,
    sku:             p.sku || "",
    seller:          p.sme_name || "",
    slug:            p.slug || "",
    // ── PAXI delivery dimensions ─────────────────────────────────────────────
    length_cm:       p.length_cm  ?? null,
    width_cm:        p.width_cm   ?? null,
    height_cm:       p.height_cm  ?? null,
    weight_kg:       p.weight_kg  ?? null,
  });

  

  const handleAddToCart = () => {
    addToCart(buildCartItem(product), quantity);
    alert(`${quantity} ${product.name}(s) added to cart!`);
  };

  const handleBuyNow = () => {
    addToCart(buildCartItem(product), quantity);
    navigate("/checkout");
  };

  const toggleWishlist = () => {
    setIsInWishlist(!isInWishlist);
    alert(`${product.name} ${isInWishlist ? "removed from" : "added to"} wishlist`);
  };

  const incrementQuantity = () => { if (quantity < product.stock_quantity) setQuantity(quantity + 1); };
  const decrementQuantity = () => { if (quantity > 1) setQuantity(quantity - 1); };
  const handleImageSelect = (i) => setSelectedImage(i);

  const handleViewRelatedProduct = (productId, e) => { e.preventDefault(); e.stopPropagation(); navigate(`/product/${productId}`); };

  const scrollToReviews = (e) => { e.preventDefault(); document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" }); };
  const scrollToTop     = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const formatPrice = (price) => price ? `R${parseFloat(price).toLocaleString()}` : "R0";

  const getProductImages = () => {
    const images = [];
    if (product.featured_image) images.push(product.featured_image);
    product.images?.forEach(img => { if (img.image !== product.featured_image) images.push(img.image); });
    return images.length > 0 ? images : [productPlaceholder];
  };

  const getCategoryName = () => product.category_name || product.category?.name || "Category";

  const getDiscountPercentage = () => {
    if (product.base_price && product.selling_price && product.base_price > product.selling_price)
      return Math.round(((product.base_price - product.selling_price) / product.base_price) * 100);
    return 0;
  };

  const getStockStatus = () => {
    if (!product.stock_quantity || product.stock_quantity === 0) return { text: "Out of Stock", class: styles.outOfStock };
    if (product.stock_quantity <= product.low_stock_threshold) return { text: `Only ${product.stock_quantity} left!`, class: styles.lowStock };
    return { text: `In Stock (${product.stock_quantity} available)`, class: styles.inStock };
  };

  // ── PAXI delivery tier derived from product dimensions ───────────────────────
  const getPaxiInfo = (p) => {
    if (!p) return null;
    const vol = Number(p.length_cm) * Number(p.width_cm) * Number(p.height_cm);
    const kg  = Number(p.weight_kg);
    if (!vol || !kg || isNaN(vol) || isNaN(kg) || vol <= 0 || kg <= 0) return null;
    if (vol <= 3000 && kg <= 5)  return { tier: "SMALL",  price: 59,  days: "3–5 business days" };
    if (vol <= 8000 && kg <= 10) return { tier: "MEDIUM", price: 89,  days: "3–5 business days" };
    return                              { tier: "LARGE",  price: 139, days: "5–7 business days" };
  };

  if (isLoading) return <div className={styles.loadingContainer}><div className={styles.loadingSpinner} /><p>Loading product details...</p></div>;

  if (error || !product) return (
    <div className={styles.errorContainer}>
      <div className={styles.errorIcon}>⚠️</div>
      <h2>Oops! Something went wrong</h2>
      <p>{error || "Product not found"}</p>
      <button onClick={() => navigate("/products")} className={styles.backButton}>Back to Products</button>
    </div>
  );

  const images            = getProductImages();
  const stockStatus       = getStockStatus();
  const discountPercentage = getDiscountPercentage();
  const categoryName      = getCategoryName();
  const finalPrice        = product.selling_price || product.base_price;
  const paxiInfo          = getPaxiInfo(product);

  return (
    <div className={styles.productDetailsPage}>
      <button className={styles.scrollToTopBtn} onClick={scrollToTop} aria-label="Scroll to top">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M8 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L7.5 2.707V14.5a.5.5 0 0 0 .5.5z"/></svg>
      </button>

      <nav className={styles.breadcrumb}>
        <div className="container">
          <Link to="/" onClick={scrollToTop}>Home</Link> &gt;
          <Link to="/products" onClick={scrollToTop}>Products</Link> &gt;
          <Link to={`/products?category=${product.category_id || product.category_slug}`} onClick={scrollToTop}>{categoryName}</Link> &gt;
          <span>{product.name}</span>
        </div>
      </nav>

      <div className="container">
        <div className={styles.productMain}>
          {/* Gallery */}
          <div className={styles.productGallery}>
            <div className={styles.mainImage}>
              <img src={images[selectedImage]} alt={product.name} className={styles.productMainImage} onError={(e) => { e.target.onerror = null; e.target.src = productPlaceholder; }} />
              {discountPercentage > 0 && <div className={styles.discountBadge}>-{discountPercentage}%</div>}
              <button className={styles.wishlistButton} onClick={toggleWishlist} aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill={isInWishlist ? "#B03E3B" : "currentColor"} viewBox="0 0 16 16">
                  <path fill={isInWishlist ? "#B03E3B" : "none"} stroke={isInWishlist ? "#B03E3B" : "#333"} strokeWidth="1.5" d="M8 2.748l-.717-.737C5.6.281 2.514.878 1.4 3.053c-.523 1.023-.641 2.5.314 4.385.92 1.815 2.834 3.989 6.286 6.357 3.452-2.368 5.365-4.542 6.286-6.357.955-1.886.838-3.362.314-4.385C13.486.878 10.4.28 8.717 2.01L8 2.748z"/>
                </svg>
              </button>
            </div>
            {images.length > 1 && (
              <div className={styles.thumbnailList}>
                {images.map((img, i) => (
                  <button key={i} className={`${styles.thumbnail} ${selectedImage === i ? styles.active : ""}`} onClick={() => handleImageSelect(i)} aria-label={`View image ${i + 1}`}>
                    <img src={img} alt={`${product.name} view ${i + 1}`} onError={(e) => { e.target.onerror = null; e.target.src = productPlaceholder; }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className={styles.productInfo}>
            <div className={styles.productHeader}>
              <div className={styles.tags}>
                <span className={styles.tag}>{categoryName}</span>
                {product.is_featured  && <span className={styles.tag}>Featured</span>}
                {product.is_new       && <span className={styles.tag}>New Arrival</span>}
                {product.is_best_seller && <span className={styles.tag}>Best Seller</span>}
              </div>
              <h1 className={styles.productTitle}>{product.name}</h1>
              {product.sme_name && (
                <div className={styles.sellerInfo}>
                  <div className={styles.sellerImage}><div className={styles.sellerInitial}>{product.sme_name.charAt(0)}</div></div>
                  <div className={styles.sellerDetails}>
                    <span className={styles.sellerName}>{product.sme_name}</span>
                    {product.sme_location && <div className={styles.sellerLocation}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></svg>{product.sme_location}</div>}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.priceSection}>
              <div className={styles.priceContainer}>
                <span className={styles.currentPrice}>{formatPrice(finalPrice)}</span>
                {product.base_price && product.base_price > finalPrice && <span className={styles.originalPrice}>{formatPrice(product.base_price)}</span>}
                {discountPercentage > 0 && <span className={styles.discount}>Save {formatPrice(product.base_price - finalPrice)} ({discountPercentage}% off)</span>}
              </div>
              {(product.average_rating > 0 || product.review_count > 0) && (
                <div className={styles.productRating}>
                  <div className={styles.ratingOverview}>
                    <span className={styles.ratingStars}>{[...Array(5)].map((_, i) => <span key={i} className={`${styles.star} ${i < Math.floor(product.average_rating) ? styles.filled : ""}`}>★</span>)}</span>
                    <span className={styles.ratingValue}>{product.average_rating?.toFixed(1)}</span>
                    <span className={styles.totalReviews}>({product.review_count || 0} reviews)</span>
                  </div>
                  <Link to="#reviews" className={styles.viewReviews} onClick={scrollToReviews}>View all reviews</Link>
                </div>
              )}
            </div>

            <div className={styles.description}>
              <h3>Description</h3>
              <p>{product.description}</p>
              {product.short_description && <p>{product.short_description}</p>}
            </div>

            {product.attributes?.some(a => a.attribute_name?.toLowerCase().includes("color")) && (
              <div className={styles.colorSelection}>
                <h3>Color: <span className={styles.selectedColor}>{selectedColor}</span></h3>
                <div className={styles.colorOptions}>
                  {product.attributes.filter(a => a.attribute_name?.toLowerCase().includes("color")).map((attr, i) => (
                    <button key={i} className={`${styles.colorOption} ${selectedColor === attr.value ? styles.selected : ""}`} onClick={() => setSelectedColor(attr.value)} aria-label={`Select ${attr.value} color`}>
                      <span className={styles.colorSwatch} style={{ backgroundColor: attr.value.toLowerCase() }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.sizes?.length > 0 && (
              <div className={styles.sizeSelection}>
                <h3>Size</h3>
                <div className={styles.sizeOptions}>
                  {product.sizes.map(size => <button key={size} className={`${styles.sizeOption} ${selectedSize === size ? styles.selected : ""}`} onClick={() => setSelectedSize(size)}>{size}</button>)}
                </div>
              </div>
            )}

            <div className={styles.quantitySection}>
              <h3>Quantity</h3>
              <div className={styles.quantityControls}>
                <button className={styles.quantityBtn} onClick={decrementQuantity} disabled={quantity <= 1} aria-label="Decrease quantity">-</button>
                <input type="number" min="1" max={product.stock_quantity} value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.min(product.stock_quantity, parseInt(e.target.value) || 1)))} className={styles.quantityInput} aria-label="Product quantity" />
                <button className={styles.quantityBtn} onClick={incrementQuantity} disabled={quantity >= product.stock_quantity} aria-label="Increase quantity">+</button>
                <div className={styles.stockStatus}><span className={stockStatus.class}>{stockStatus.text}</span></div>
              </div>
            </div>

            <div className={styles.actionButtons}>
              <button className={`${styles.btn} ${styles.addToCartBtn}`} onClick={handleAddToCart} disabled={product.stock_quantity === 0}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M0 1.5A.5.5 0 0 1 .5 1H2a.5.5 0 0 1 .485.379L2.89 3H14.5a.5.5 0 0 1 .491.592l-1.5 8A.5.5 0 0 1 13 12H4a.5.5 0 0 1-.491-.408L2.01 3.607 1.61 2H.5a.5.5 0 0 1-.5-.5zM3.102 4l1.313 7h8.17l1.313-7H3.102zM5 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-7 1a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>
                Add to Cart
              </button>
              <button className={`${styles.btn} ${styles.buyNowBtn}`} onClick={handleBuyNow} disabled={product.stock_quantity === 0}>Buy Now</button>
            </div>

            {/* ── PAXI Delivery info on product detail page ────────────────── */}
            <div className={styles.deliveryOptions}>
              <h3>Delivery</h3>
              {paxiInfo ? (
                <div className={styles.deliveryList}>
                  <div className={styles.deliveryOption}>
                    <label className={styles.deliveryLabel}>
                      <span className={styles.deliveryType}>📦 PAXI {paxiInfo.tier} Parcel</span>
                      <span className={styles.deliveryDetails}>R{paxiInfo.price} • {paxiInfo.days}</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className={styles.deliveryList}>
                  <div className={styles.deliveryOption}>
                    <label className={styles.deliveryLabel}>
                      <span className={styles.deliveryType}>📦 PAXI Delivery</span>
                      <span className={styles.deliveryDetails}>Delivery cost calculated at checkout</span>
                    </label>
                  </div>
                </div>
              )}
              <div className={styles.deliveryInfo}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>
                Free returns within 30 days • Cash on delivery available
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.productTabs}>
          <nav className={styles.tabNavigation}>
            <button className={`${styles.tabBtn} ${styles.active}`} onClick={scrollToTop}>Specifications</button>
            <button className={styles.tabBtn} onClick={scrollToReviews}>Reviews ({product.review_count || 0})</button>
            <button className={styles.tabBtn} onClick={scrollToTop}>Shipping & Returns</button>
          </nav>
          <div className={styles.tabContent}>
            <div className={styles.specifications}>
              <h3>Product Specifications</h3>
              <div className={styles.specsGrid}>
                {product.attributes?.length > 0 ? (
                  product.attributes.map((attr, i) => (
                    <div key={i} className={styles.specItem}>
                      <span className={styles.specKey}>{attr.attribute_name}:</span>
                      <span className={styles.specValue}>{attr.display_value || attr.value}{attr.attribute_unit && ` ${attr.attribute_unit}`}</span>
                    </div>
                  ))
                ) : (
                  <div className={styles.specItem}><span className={styles.specKey}>No specifications available</span></div>
                )}
                {product.sku     && <div className={styles.specItem}><span className={styles.specKey}>SKU:</span><span className={styles.specValue}>{product.sku}</span></div>}
                {product.barcode && <div className={styles.specItem}><span className={styles.specKey}>Barcode:</span><span className={styles.specValue}>{product.barcode}</span></div>}
                {/* PAXI sizing visible in specs */}
                {product.length_cm && (
                  <>
                    <div className={styles.specItem}><span className={styles.specKey}>Dimensions (L×W×H):</span><span className={styles.specValue}>{product.length_cm} × {product.width_cm} × {product.height_cm} cm</span></div>
                    <div className={styles.specItem}><span className={styles.specKey}>Weight:</span><span className={styles.specValue}>{product.weight_kg} kg</span></div>
                    {paxiInfo && <div className={styles.specItem}><span className={styles.specKey}>PAXI Tier:</span><span className={styles.specValue}>{paxiInfo.tier}</span></div>}
                  </>
                )}
              </div>
            </div>

            <div id="reviews" className={styles.reviewsSection}>
              <h3>Customer Reviews</h3>
              {product.reviews?.length > 0 ? (
                <>
                  <div className={styles.reviewsHeader}>
                    <div className={styles.overallRating}>
                      <span className={styles.overallRatingValue}>{product.average_rating?.toFixed(1) || "0.0"}</span>
                      <div className={styles.overallStars}>{[...Array(5)].map((_, i) => <span key={i} className={`${styles.star} ${i < Math.floor(product.average_rating) ? styles.filled : ""}`}>★</span>)}</div>
                      <span className={styles.totalReviewsCount}>{product.review_count || 0} reviews</span>
                    </div>
                    <button className={styles.writeReviewBtn}>Write a Review</button>
                  </div>
                  <div className={styles.reviewsList}>
                    {product.reviews.slice(0, 5).map(review => (
                      <div key={review.id} className={styles.reviewItem}>
                        <div className={styles.reviewHeader}>
                          <div className={styles.reviewerInfo}>
                            <span className={styles.reviewerName}>{review.user_name || "Anonymous"}</span>
                            {review.is_verified_purchase && <span className={styles.verifiedPurchase}>✓ Verified Purchase</span>}
                          </div>
                          <div className={styles.reviewMeta}>
                            <div className={styles.reviewStars}>{[...Array(5)].map((_, i) => <span key={i} className={`${styles.star} ${i < review.rating ? styles.filled : ""}`}>★</span>)}</div>
                            <span className={styles.reviewDate}>{new Date(review.created_at).toLocaleDateString("en-ZA")}</span>
                          </div>
                        </div>
                        {review.title && <h4>{review.title}</h4>}
                        <p className={styles.reviewComment}>{review.comment}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className={styles.noReviews}>
                  <p>No reviews yet. Be the first to review this product!</p>
                  <button className={styles.writeReviewBtn}>Write a Review</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Related products */}
        {relatedProducts.length > 0 && (
          <div className={styles.relatedProducts}>
            <h2>You May Also Like</h2>
            <div className={styles.relatedGrid}>
              {relatedProducts.map(related => {
                const relatedPrice = related.selling_price || related.base_price;
                return (
                  <div key={related.id} className={styles.relatedProductCard}>
                    <div onClick={(e) => handleViewRelatedProduct(related.id, e)}>
                      <div className={styles.relatedImage}><img src={related.featured_image || productPlaceholder} alt={related.name} onError={(e) => { e.target.onerror = null; e.target.src = productPlaceholder; }} /></div>
                      <div className={styles.relatedInfo}>
                        <h4>{related.name}</h4>
                        {related.sme_name && <p className={styles.relatedSeller}>by {related.sme_name}</p>}
                        {related.average_rating > 0 && (
                          <div className={styles.relatedRating}>
                            <span className={styles.relatedStars}>{[...Array(5)].map((_, i) => <span key={i} className={`${styles.star} ${i < Math.floor(related.average_rating) ? styles.filled : ""}`}>★</span>)}</span>
                            <span>{related.average_rating.toFixed(1)}</span>
                          </div>
                        )}
                        <div className={styles.relatedPrice}>{formatPrice(relatedPrice)}</div>
                        <button className={styles.viewProductBtn} onClick={(e) => handleViewRelatedProduct(related.id, e)}>View Product</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}