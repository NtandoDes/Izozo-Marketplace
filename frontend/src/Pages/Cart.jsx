import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../contexts/CartContext";
import { cartService } from "../services/cartService";
import styles from "./Cart.module.css";

// Import placeholder image
import productPlaceholder from "../assets/products/hoodie.jpg";

export default function Cart() {
  const navigate = useNavigate();
  const { 
    cartItems, 
    cartCount, 
    cartTotal, 
    updateQuantity, 
    removeFromCart, 
    clearCart,
    refreshCart 
  } = useCart();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  // Fetch recommended products when cart changes
  useEffect(() => {
    if (cartItems.length > 0) {
      fetchRecommendedProducts();
    }
  }, [cartItems]);

  const fetchRecommendedProducts = async () => {
    setLoadingRecommendations(true);
    try {
      // Get categories from cart items
      const categories = [...new Set(cartItems.map(item => item.category_id))];
      
      if (categories.length > 0) {
        // Fetch products from the same categories
        const response = await cartService.getRecommendedProducts(categories, cartItems.map(item => item.id));
        setRecommendedProducts(response.slice(0, 4));
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // Handle quantity change
  const handleQuantityChange = async (itemId, newQuantity) => {
    if (newQuantity < 1) {
      await handleRemoveItem(itemId);
    } else {
      setIsUpdating(true);
      try {
        await updateQuantity(itemId, newQuantity);
      } catch (error) {
        console.error('Error updating quantity:', error);
        alert('Failed to update quantity. Please try again.');
      } finally {
        setIsUpdating(false);
      }
    }
  };

  // Handle remove item
  const handleRemoveItem = async (itemId) => {
    if (window.confirm("Are you sure you want to remove this item from your cart?")) {
      setIsUpdating(true);
      try {
        await removeFromCart(itemId);
      } catch (error) {
        console.error('Error removing item:', error);
        alert('Failed to remove item. Please try again.');
      } finally {
        setIsUpdating(false);
      }
    }
  };

  // Handle apply coupon
  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    
    setIsLoading(true);
    
    try {
      const response = await cartService.validateCoupon(couponCode);
      if (response.valid) {
        setCouponDiscount(response.discount);
        setCouponApplied(true);
        alert(`Coupon applied! You saved ${response.discount}%`);
      } else {
        alert("Invalid coupon code. Please try again.");
      }
    } catch (error) {
      console.error('Error applying coupon:', error);
      alert("Failed to apply coupon. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate discount
  const discountAmount = couponApplied ? (cartTotal * couponDiscount) / 100 : 0;
  const deliveryFee = cartTotal > 500 ? 0 : 49;
  const finalTotal = cartTotal - discountAmount + deliveryFee;

  // Handle continue shopping
  const handleContinueShopping = () => {
    navigate("/products");
  };

  // Handle checkout
  const handleCheckout = () => {
    navigate("/checkout");
  };

  // Handle clear cart
  const handleClearCart = async () => {
    if (window.confirm("Are you sure you want to clear your cart?")) {
      setIsUpdating(true);
      try {
        await clearCart();
      } catch (error) {
        console.error('Error clearing cart:', error);
        alert('Failed to clear cart. Please try again.');
      } finally {
        setIsUpdating(false);
      }
    }
  };

  // Handle view product
  const handleViewProduct = (productId) => {
      navigate(`/product/${productId}`);
    };

  // Handle add to cart from recommendations
  const handleAddToCart = async (product, e) => {
    e.stopPropagation();
    try {
      await cartService.addToCart(product.id, 1);
      await refreshCart();
      alert(`${product.name} added to cart!`);
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Failed to add item to cart.');
    }
  };

  const formatPrice = (price) => {
    if (!price && price !== 0) return 'R0.00';
    return `R${parseFloat(price).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const getProductImage = (item) => {
    if (item.product_details?.featured_image) return item.product_details.featured_image;
    if (item.image) return item.image;
    return productPlaceholder;
  };

  if (cartCount === 0) {
    return (
      <div className={styles.cartPage}>
        <div className="container">
          <div className={styles.emptyCart}>
            <div className={styles.emptyCartIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="currentColor" viewBox="0 0 16 16">
                <path d="M0 1.5A.5.5 0 0 1 .5 1H2a.5.5 0 0 1 .485.379L2.89 3H14.5a.5.5 0 0 1 .491.592l-1.5 8A.5.5 0 0 1 13 12H4a.5.5 0 0 1-.491-.408L2.01 3.607 1.61 2H.5a.5.5 0 0 1-.5-.5zM3.102 4l1.313 7h8.17l1.313-7H3.102zM5 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-7 1a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
              </svg>
            </div>
            <h2 className={styles.emptyCartTitle}>Your cart is empty</h2>
            <p className={styles.emptyCartText}>
              Looks like you haven't added any items to your cart yet.
            </p>
            <button 
              className={`${styles.btn} ${styles.primaryBtn}`}
              onClick={handleContinueShopping}
              disabled={isUpdating}
            >
              Continue Shopping
            </button>
          </div>

          {/* Recommendations for empty cart */}
          {recommendedProducts.length > 0 && (
            <div className={styles.recommendations}>
              <h2 className={styles.sectionTitle}>Recommended for you</h2>
              <div className={styles.recommendedItems}>
                {recommendedProducts.map(product => (
                  <div 
                    key={product.id} 
                    className={styles.recommendedCard}
                    onClick={() => handleViewProduct(product.id)}
                  >
                    <div className={styles.recommendedImage}>
                      <img 
                        src={product.featured_image || productPlaceholder} 
                        alt={product.name}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = productPlaceholder;
                        }}
                      />
                    </div>
                    <div className={styles.recommendedInfo}>
                      <h3>{product.name}</h3>
                      <p className={styles.recommendedPrice}>
                        {formatPrice(product.selling_price || product.base_price)}
                      </p>
                      <button 
                        className={styles.addToCartBtn}
                        onClick={(e) => handleAddToCart(product, e)}
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.cartPage}>
      <div className="container">
        {/* Loading Overlay */}
        {isUpdating && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingSpinner}></div>
            <p>Updating cart...</p>
          </div>
        )}

        {/* Breadcrumb */}
        <nav className={styles.breadcrumb}>
          <Link to="/">Home</Link> &gt;
          <Link to="/products">Products</Link> &gt;
          <span>Shopping Cart</span>
        </nav>

        <h1 className={styles.pageTitle}>Shopping Cart</h1>
        <p className={styles.pageSubtitle}>
          You have {cartCount} item{cartCount !== 1 ? 's' : ''} in your cart
        </p>

        <div className={styles.cartLayout}>
          {/* Cart Items */}
          <div className={styles.cartItems}>
            <div className={styles.cartHeader}>
              <h2 className={styles.sectionTitle}>Cart Items</h2>
              <button 
                className={styles.clearCartBtn}
                onClick={handleClearCart}
                disabled={isUpdating}
              >
                Clear Cart
              </button>
            </div>

            {cartItems.map(item => (
              <div key={item.id} className={styles.cartItem}>
                <div className={styles.itemImage}>
                  <img 
                    src={getProductImage(item)} 
                    alt={item.product_name || item.name}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = productPlaceholder;
                    }}
                  />
                </div>
                
                <div className={styles.itemDetails}>
                  <div className={styles.itemHeader}>
                    <h3 className={styles.itemName}>
                      <Link to={`/product/${item.product_id || item.id}`}>
                        {item.product_name || item.name}
                      </Link>
                    </h3>
                    <button 
                      className={styles.removeBtn}
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={isUpdating}
                      aria-label="Remove item"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                      </svg>
                    </button>
                  </div>
                  
                  {item.sme_name && (
                    <p className={styles.itemSeller}>Sold by: {item.sme_name}</p>
                  )}
                  
                  {item.variant_name && (
                    <p className={styles.itemVariant}>Variant: {item.variant_name}</p>
                  )}
                  
                  <p className={styles.itemCategory}>
                    {item.product_details?.category_name || item.category || 'General'}
                  </p>
                  
                  <div className={styles.itemPrice}>
                    <span className={styles.currentPrice}>
                      {formatPrice(item.price)}
                    </span>
                    {item.product_details?.base_price > item.price && (
                      <span className={styles.originalPrice}>
                        {formatPrice(item.product_details.base_price)}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className={styles.itemQuantity}>
                  <div className={styles.quantityControls}>
                    <button
                      className={styles.quantityBtn}
                      onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                      disabled={isUpdating}
                      aria-label="Decrease quantity"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={item.product_details?.stock_quantity || 99}
                      value={item.quantity}
                      onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                      className={styles.quantityInput}
                      disabled={isUpdating}
                      aria-label="Quantity"
                    />
                    <button
                      className={styles.quantityBtn}
                      onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                      disabled={isUpdating || item.quantity >= (item.product_details?.stock_quantity || 99)}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <div className={styles.itemTotal}>
                    {formatPrice(item.price * item.quantity)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className={styles.orderSummary}>
            <h2 className={styles.sectionTitle}>Order Summary</h2>
            
            <div className={styles.summaryDetails}>
              <div className={styles.summaryRow}>
                <span>Subtotal ({cartCount} items)</span>
                <span>{formatPrice(cartTotal)}</span>
              </div>
              
              {couponApplied && (
                <div className={styles.summaryRow}>
                  <span>Discount ({couponDiscount}%)</span>
                  <span className={styles.discount}>-{formatPrice(discountAmount)}</span>
                </div>
              )}
              
            </div>

            {/* Coupon Code */}
            <div className={styles.couponSection}>
              <h3>Have a coupon code?</h3>
              <form onSubmit={handleApplyCoupon} className={styles.couponForm}>
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Enter coupon code"
                  className={styles.couponInput}
                  disabled={couponApplied || isUpdating}
                />
                <button
                  type="submit"
                  className={`${styles.couponBtn} ${couponApplied ? styles.applied : ''}`}
                  disabled={isLoading || couponApplied || isUpdating}
                >
                  {isLoading ? 'Applying...' : couponApplied ? 'Applied' : 'Apply'}
                </button>
              </form>
              {couponApplied && (
                <p className={styles.couponSuccess}>
                  Coupon "{couponCode}" applied! You saved {formatPrice(discountAmount)}
                </p>
              )}
            </div>

            {/* Checkout Button */}
            <button 
              className={`${styles.btn} ${styles.checkoutBtn}`}
              onClick={handleCheckout}
              disabled={isUpdating}
            >
              Proceed to Checkout
            </button>

            {/* Continue Shopping */}
            <button 
              className={`${styles.btn} ${styles.continueBtn}`}
              onClick={handleContinueShopping}
              disabled={isUpdating}
            >
              Continue Shopping
            </button>

            {/* Security Info */}
            <div className={styles.securityInfo}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
              </svg>
              <span>Secure checkout • SSL encrypted</span>
            </div>
          </div>
        </div>

        {/* Recommended Products */}
        {recommendedProducts.length > 0 && (
          <div className={styles.recommendations}>
            <h2 className={styles.sectionTitle}>You might also like</h2>
            {loadingRecommendations ? (
              <div className={styles.loadingRecommendations}>
                <div className={styles.smallSpinner}></div>
                <p>Loading recommendations...</p>
              </div>
            ) : (
              <div className={styles.recommendedItems}>
                {recommendedProducts.map(product => (
                  <div 
                    key={product.id} 
                    className={styles.recommendedCard}
                    onClick={() => handleViewProduct(product.id, product.slug)}
                  >
                    <div className={styles.recommendedImage}>
                      <img 
                        src={product.featured_image || productPlaceholder} 
                        alt={product.name}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = productPlaceholder;
                        }}
                      />
                    </div>
                    <div className={styles.recommendedInfo}>
                      <h3>{product.name}</h3>
                      <p className={styles.recommendedSeller}>by {product.sme_name || 'Local Seller'}</p>
                      <div className={styles.recommendedRating}>
                        {product.average_rating > 0 && (
                          <>
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
                            <span>({product.review_count || 0})</span>
                          </>
                        )}
                      </div>
                      <p className={styles.recommendedPrice}>
                        {formatPrice(product.selling_price || product.base_price)}
                      </p>
                      <button 
                        className={styles.addToCartBtn}
                        onClick={(e) => handleAddToCart(product, e)}
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}