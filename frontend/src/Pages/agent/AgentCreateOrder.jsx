/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { agentService } from '../../services/agentService';
import { cartService } from '../../services/cartService';
import styles from './AgentCreateOrder.module.css';

const AgentCreateOrder = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // State management
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Data states
  const [assignedSMEs, setAssignedSMEs] = useState([]);
  const [selectedSME, setSelectedSME] = useState(null);
  const [products, setProducts] = useState([]);
  const [displayedProducts, setDisplayedProducts] = useState([]);
  
  // Carousel states
  const [currentPage, setCurrentPage] = useState(0);
  const [productsPerPage] = useState(4);
  const carouselRef = useRef(null);
  
  // Cart data
  const [cart, setCart] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [cartSubtotal, setCartSubtotal] = useState(0);
  const [cartLoading, setCartLoading] = useState(false);
  
  // Order form data
  const [formData, setFormData] = useState({
    customer_email: '',
    customer_phone: '',
    customer_full_name: '',
    shipping_address: {
      full_name: '',
      phone: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'South Africa'
    },
    billing_same_as_shipping: true,
    billing_address: {
      full_name: '',
      phone: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'South Africa'
    },
    shipping_method: 'standard',
    customer_notes: '',
    discount_amount: 0,
    shipping_amount: 0,
    tax_amount: 0
  });
  
  // UI states
  const [activeTab, setActiveTab] = useState('customer');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [updatingCart, setUpdatingCart] = useState(false);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load cart data
  useEffect(() => {
    loadCart();
  }, []);

  // Debug effect to track state changes
  useEffect(() => {
    console.log('Current state:', {
      selectedSME: selectedSME?.id,
      selectedSMEName: selectedSME?.business_name,
      displayedProducts: displayedProducts.length,
      products: products.length
    });
  }, [selectedSME, displayedProducts, products]);

  // Update displayed products when SME changes or products are loaded
  useEffect(() => {
    if (selectedSME) {
      console.log('='.repeat(50));
      console.log('FILTERING PRODUCTS FOR SME:', selectedSME.id, selectedSME.business_name);
      console.log('Total products available:', products.length);
      
      // Log sample product to verify structure
      if (products.length > 0) {
        console.log('Sample product structure:', {
          id: products[0].id,
          name: products[0].name,
          sme_id: products[0].sme_id,
          sme: products[0].sme
        });
        console.log('Selected SME id:', selectedSME.id);
      }
      
      // Filter products by sme_id (direct field)
      const smeProducts = products.filter(p => {
        // Check for direct sme_id field (most common)
        if (p.sme_id !== undefined) {
          return p.sme_id === selectedSME.id;
        }
        // Check for sme object with id
        else if (p.sme && typeof p.sme === 'object' && p.sme.id !== undefined) {
          return p.sme.id === selectedSME.id;
        }
        // Check for smeId field
        else if (p.smeId !== undefined) {
          return p.smeId === selectedSME.id;
        }
        return false;
      });
      
      console.log(`Found ${smeProducts.length} products for SME ${selectedSME.id}`);
      
      if (smeProducts.length > 0) {
        console.log('First filtered product:', {
          id: smeProducts[0].id,
          name: smeProducts[0].name,
          sme_id: smeProducts[0].sme_id
        });
      } else {
        console.log('No products found. Checking all products:');
        products.forEach((p, index) => {
          console.log(`Product ${index}:`, {
            id: p.id,
            name: p.name,
            sme_id: p.sme_id,
            sme: p.sme
          });
        });
      }
      console.log('='.repeat(50));
      
      setDisplayedProducts(smeProducts);
      setCurrentPage(0);
    } else {
      setDisplayedProducts([]);
    }
  }, [selectedSME, products]);

  // Load cart data
  const loadCart = async () => {
    setCartLoading(true);
    try {
      const cartData = await cartService.getCart();
      console.log('Cart loaded:', cartData);
      setCart(cartData);
      setCartItems(cartData.items || []);
      setCartSubtotal(cartData.subtotal || 0);
    } catch (err) {
      console.error('Error loading cart:', err);
    } finally {
      setCartLoading(false);
    }
  };

  // Calculate total pages for carousel
  const totalPages = Math.ceil(displayedProducts.length / productsPerPage);
  
  // Get current products for carousel
  const getCurrentProducts = () => {
    const start = currentPage * productsPerPage;
    return displayedProducts.slice(start, start + productsPerPage);
  };

  // Carousel navigation
  const nextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const loadInitialData = async () => {
    try {
      setInitialLoading(true);
      setError(null);
      
      console.log('📦 Loading order creation data...');
      
      // Get assigned SMEs
      const smes = await agentService.getAssignedSMEs();
      console.log('Assigned SMEs:', smes);
      setAssignedSMEs(smes);
      
      // Get all products from assigned SMEs
      const productsData = await agentService.getAssignedProducts({ limit: 100 });
      console.log('Products loaded:', productsData.length);
      
      if (productsData.length > 0) {
        console.log('First product full data:', JSON.stringify(productsData[0], null, 2));
        console.log('First product fields:', Object.keys(productsData[0]));
        console.log('First product sme_id:', productsData[0]?.sme_id);
        console.log('First product sme:', productsData[0]?.sme);
      }
      
      setProducts(productsData);
      
      if (smes.length === 0) {
        setError({
          title: 'No SMEs Assigned',
          message: 'You need to be assigned to at least one SME before you can create orders.'
        });
      }
      
    } catch (err) {
      console.error('❌ Error loading initial data:', err);
      setError({
        title: 'Failed to Load Data',
        message: err.message || 'Please try again later'
      });
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSMEChange = (e) => {
    const smeId = parseInt(e.target.value);
    const sme = assignedSMEs.find(s => s.id === smeId);
    console.log('Selected SMME:', sme);
    setSelectedSME(sme);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleBillingSameAsShippingChange = (e) => {
    const isSame = e.target.checked;
    setFormData(prev => ({
      ...prev,
      billing_same_as_shipping: isSame,
      billing_address: isSame ? { ...prev.shipping_address } : prev.billing_address
    }));
  };

  // Product selection
  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    
    if (product.variants && product.variants.length > 0) {
      setSelectedVariant(product.variants[0]);
    } else {
      setSelectedVariant(null);
    }
    
    setQuantity(1);
    setShowProductModal(true);
  };

  const handleAddToCart = async () => {
    if (!selectedProduct) return;
    
    setUpdatingCart(true);
    
    try {
      console.log('Adding to cart:', {
        productId: selectedProduct.id,
        quantity,
        variantId: selectedVariant?.id
      });
      
      await cartService.addToCart(
        selectedProduct.id,
        quantity,
        selectedVariant?.id
      );
      
      await loadCart();
      
      setShowProductModal(false);
      setSelectedProduct(null);
      setSelectedVariant(null);
      setQuantity(1);
      
    } catch (err) {
      console.error('Error adding to cart:', err);
      alert(err.error || 'Failed to add item to cart');
    } finally {
      setUpdatingCart(false);
    }
  };

  const handleUpdateQuantity = async (itemId, newQuantity) => {
    if (newQuantity < 1) return;
    
    setUpdatingCart(true);
    
    try {
      await cartService.updateCartItem(itemId, newQuantity);
      await loadCart();
    } catch (err) {
      console.error('Error updating cart:', err);
      alert(err.error || 'Failed to update cart');
    } finally {
      setUpdatingCart(false);
    }
  };

  const handleRemoveFromCart = async (itemId) => {
    setUpdatingCart(true);
    
    try {
      await cartService.removeFromCart(itemId);
      await loadCart();
    } catch (err) {
      console.error('Error removing from cart:', err);
      alert(err.error || 'Failed to remove item');
    } finally {
      setUpdatingCart(false);
    }
  };

  const handleClearCart = async () => {
    if (window.confirm('Are you sure you want to clear your cart?')) {
      setUpdatingCart(true);
      
      try {
        await cartService.clearCart();
        await loadCart();
      } catch (err) {
        console.error('Error clearing cart:', err);
        alert(err.error || 'Failed to clear cart');
      } finally {
        setUpdatingCart(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.customer_email) {
      alert('Customer email is required');
      return;
    }
    
    if (!formData.customer_full_name) {
      alert('Customer full name is required');
      return;
    }
    
    if (!formData.shipping_address.address_line1) {
      alert('Shipping address is required');
      return;
    }
    
    if (cartItems.length === 0) {
      alert('Please add at least one product to the order');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const orderData = {
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone,
        customer_full_name: formData.customer_full_name,
        order_type: 'agent',
        agent_id: user?.id,
        shipping_address: formData.shipping_address,
        billing_address: formData.billing_same_as_shipping 
          ? formData.shipping_address 
          : formData.billing_address,
        shipping_method: formData.shipping_method,
        customer_notes: formData.customer_notes,
        discount_amount: parseFloat(formData.discount_amount) || 0,
        shipping_amount: parseFloat(formData.shipping_amount) || 0,
        tax_amount: parseFloat(formData.tax_amount) || 0,
        items: cartItems.map(item => ({
          product_id: item.product,
          variant_id: item.variant,
          product_name: item.product_name,
          variant_name: item.variant_name,
          sku: item.product_sku,
          unit_price: item.price,
          quantity: item.quantity,
          commission_rate: item.commission_rate,
          sme_id: item.sme_id
        }))
      };
      
      console.log('Submitting order:', orderData);
      
      const response = await agentService.createAssistedOrder(orderData);
      
      await cartService.clearCart();
      await loadCart();
      
      setSuccess({
        title: 'Order Created Successfully!',
        message: `Order #${response.order_number} has been created and is now processing.`,
        order_number: response.order_number
      });
      
      setTimeout(() => {
        navigate('/agent/orders');
      }, 3000);
      
    } catch (err) {
      console.error('Error creating order:', err);
      setError({
        title: 'Failed to Create Order',
        message: err.message || err.detail || 'Please check your input and try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateSubtotal = () => cartSubtotal;
  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discount = parseFloat(formData.discount_amount) || 0;
    const shipping = parseFloat(formData.shipping_amount) || 0;
    const tax = parseFloat(formData.tax_amount) || 0;
    return subtotal - discount + shipping + tax;
  };

  if (initialLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading order creation form...</p>
      </div>
    );
  }

  if (error && assignedSMEs.length === 0) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>⚠️</div>
        <h2 className={styles.errorTitle}>{error.title}</h2>
        <p className={styles.errorMessage}>{error.message}</p>
        <button 
          onClick={() => navigate('/agent/dashboard')} 
          className={styles.primaryButton}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const subtotal = calculateSubtotal();
  const total = calculateTotal();
  const currentProducts = getCurrentProducts();

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Create Assisted Order</h1>
          <p className={styles.subtitle}>
            Create a new order for an online customer
          </p>
        </div>
        <Link to="/agent/orders" className={styles.cancelButton}>
          Cancel
        </Link>
      </div>

      {/* Success Message */}
      {success && (
        <div className={styles.successAlert}>
          <div className={styles.successIcon}>✅</div>
          <div className={styles.successContent}>
            <h3>{success.title}</h3>
            <p>{success.message}</p>
            <p className={styles.orderNumber}>Order #{success.order_number}</p>
            <p className={styles.redirectMessage}>Redirecting to orders list...</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && error.title !== 'No SMMEs Assigned' && (
        <div className={styles.errorAlert}>
          <div className={styles.errorIcon}>❌</div>
          <div className={styles.errorContent}>
            <h3>{error.title}</h3>
            <p>{error.message}</p>
          </div>
          <button onClick={() => setError(null)} className={styles.closeButton}>×</button>
        </div>
      )}

      {/* Cart Summary Banner */}
      {cartItems.length > 0 && (
        <div className={styles.cartBanner}>
          <div className={styles.cartBannerInfo}>
            <span className={styles.cartBannerCount}>{cartItems.length} items in cart</span>
            <span className={styles.cartBannerSubtotal}>Subtotal: {cartService.formatPrice(subtotal)}</span>
          </div>
          <button 
            onClick={handleClearCart}
            className={styles.clearCartButton}
            disabled={updatingCart || cartLoading}
          >
            Clear Cart
          </button>
        </div>
      )}

      {/* Cart Loading Indicator */}
      {cartLoading && (
        <div className={styles.cartLoading}>
          <span className={styles.cartLoadingSpinner}></span>
          Loading cart...
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Tab Navigation */}
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'customer' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('customer')}
          >
            👤 Customer Information
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'products' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('products')}
          >
            📦 Products & Cart
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'shipping' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('shipping')}
          >
            🚚 Shipping & Payment
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'review' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('review')}
          >
            ✓ Review Order
          </button>
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          {/* Customer Information Tab */}
          {activeTab === 'customer' && (
            <div className={styles.tabPane}>
              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Customer Details</h3>
                
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Full Name <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    name="customer_full_name"
                    value={formData.customer_full_name}
                    onChange={handleInputChange}
                    className={styles.input}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className={styles.row}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Email Address <span className={styles.required}>*</span>
                    </label>
                    <input
                      type="email"
                      name="customer_email"
                      value={formData.customer_email}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder="customer@example.com"
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Phone Number</label>
                    <input
                      type="tel"
                      name="customer_phone"
                      value={formData.customer_phone}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder="+27 12 345 6789"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Shipping Address</h3>
                
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Full Name <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    name="shipping_address.full_name"
                    value={formData.shipping_address.full_name}
                    onChange={handleInputChange}
                    className={styles.input}
                    placeholder="Recipient full name"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Phone Number</label>
                  <input
                    type="tel"
                    name="shipping_address.phone"
                    value={formData.shipping_address.phone}
                    onChange={handleInputChange}
                    className={styles.input}
                    placeholder="+27 12 345 6789"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Address Line 1 <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    name="shipping_address.address_line1"
                    value={formData.shipping_address.address_line1}
                    onChange={handleInputChange}
                    className={styles.input}
                    placeholder="Street address, P.O. box"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Address Line 2</label>
                  <input
                    type="text"
                    name="shipping_address.address_line2"
                    value={formData.shipping_address.address_line2}
                    onChange={handleInputChange}
                    className={styles.input}
                    placeholder="Apartment, suite, unit, building, floor"
                  />
                </div>

                <div className={styles.row}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      City <span className={styles.required}>*</span>
                    </label>
                    <input
                      type="text"
                      name="shipping_address.city"
                      value={formData.shipping_address.city}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder="Johannesburg"
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      State/Province <span className={styles.required}>*</span>
                    </label>
                    <input
                      type="text"
                      name="shipping_address.state"
                      value={formData.shipping_address.state}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder="Gauteng"
                      required
                    />
                  </div>
                </div>

                <div className={styles.row}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Postal Code <span className={styles.required}>*</span>
                    </label>
                    <input
                      type="text"
                      name="shipping_address.postal_code"
                      value={formData.shipping_address.postal_code}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder="2000"
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Country</label>
                    <input
                      type="text"
                      name="shipping_address.country"
                      value={formData.shipping_address.country}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder="South Africa"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.formSection}>
                <div className={styles.checkboxGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      name="billing_same_as_shipping"
                      checked={formData.billing_same_as_shipping}
                      onChange={handleBillingSameAsShippingChange}
                      className={styles.checkbox}
                    />
                    <span className={styles.checkboxText}>Billing address same as shipping</span>
                  </label>
                </div>

                {!formData.billing_same_as_shipping && (
                  <div className={styles.billingSection}>
                    <h3 className={styles.sectionTitle}>Billing Address</h3>
                    
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Full Name</label>
                      <input
                        type="text"
                        name="billing_address.full_name"
                        value={formData.billing_address.full_name}
                        onChange={handleInputChange}
                        className={styles.input}
                        placeholder="Billing contact name"
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Address Line 1</label>
                      <input
                        type="text"
                        name="billing_address.address_line1"
                        value={formData.billing_address.address_line1}
                        onChange={handleInputChange}
                        className={styles.input}
                        placeholder="Street address"
                      />
                    </div>

                    <div className={styles.row}>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>City</label>
                        <input
                          type="text"
                          name="billing_address.city"
                          value={formData.billing_address.city}
                          onChange={handleInputChange}
                          className={styles.input}
                          placeholder="City"
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label className={styles.label}>Postal Code</label>
                        <input
                          type="text"
                          name="billing_address.postal_code"
                          value={formData.billing_address.postal_code}
                          onChange={handleInputChange}
                          className={styles.input}
                          placeholder="Postal code"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  onClick={() => setActiveTab('products')}
                  className={styles.nextButton}
                >
                  Next: Products & Cart →
                </button>
              </div>
            </div>
          )}

          {/* Products & Cart Tab */}
          {activeTab === 'products' && (
            <div className={styles.tabPane}>
              {/* SME Selection */}
              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Select SMME</h3>
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Choose SMME <span className={styles.required}>*</span>
                  </label>
                  <select
                    value={selectedSME?.id || ''}
                    onChange={handleSMEChange}
                    className={styles.select}
                    required
                  >
                    <option value="">-- Select an SMME --</option>
                    {assignedSMEs.map(sme => (
                      <option key={sme.id} value={sme.id}>
                        {sme.business_name} - {sme.business_type || 'General'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product Carousel */}
              {selectedSME && (
                <div className={styles.formSection}>
                  <h3 className={styles.sectionTitle}>Browse Products</h3>
                  
                  {/* Debug Info - Shows when no products are found */}
                  {displayedProducts.length === 0 && (
                    <div style={{ 
                      marginBottom: '1rem', 
                      padding: '1rem', 
                      background: '#fff3cd', 
                      border: '1px solid #ffeeba',
                      borderRadius: '4px',
                      color: '#856404'
                    }}>
                      <p><strong>Debug Information:</strong></p>
                      <p>Selected SMME: {selectedSME.business_name} (ID: {selectedSME.id})</p>
                      <p>Total products in database: {products.length}</p>
                      <p>Products for this SMME: 0</p>
                      <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        Check the console for detailed product information.
                      </p>
                    </div>
                  )}
                  
                  {displayedProducts.length > 0 ? (
                    <div className={styles.carouselContainer}>
                      <button 
                        className={`${styles.carouselButton} ${styles.carouselLeft}`}
                        onClick={prevPage}
                        disabled={currentPage === 0}
                        type="button"
                      >
                        ←
                      </button>
                      
                      <div className={styles.carouselGrid} ref={carouselRef}>
                        {currentProducts.map(product => (
                          <div key={product.id} className={styles.productCard}>
                            <div className={styles.productCardImage}>
                              {product.featured_image ? (
                                <img src={product.featured_image} alt={product.name} />
                              ) : (
                                <span>📦</span>
                              )}
                            </div>
                            <div className={styles.productCardContent}>
                              <h4 className={styles.productCardTitle}>{product.name}</h4>
                              <p className={styles.productCardSku}>SKU: {product.sku || 'N/A'}</p>
                              <p className={styles.productCardPrice}>
                                {cartService.formatPrice(product.selling_price || product.base_price)}
                              </p>
                              <p className={styles.productCardStock}>
                                Stock: {product.stock_quantity || 0}
                              </p>
                              <button
                                type="button"
                                onClick={() => handleProductSelect(product)}
                                className={styles.productCardButton}
                                disabled={updatingCart || cartLoading}
                              >
                                Add to Cart
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <button 
                        className={`${styles.carouselButton} ${styles.carouselRight}`}
                        onClick={nextPage}
                        disabled={currentPage >= totalPages - 1}
                        type="button"
                      >
                        →
                      </button>
                    </div>
                  ) : (
                    <div className={styles.noProducts}>
                      <p>No products available for this SMME.</p>
                    </div>
                  )}

                  {/* Cart Items */}
                  <div className={styles.cartSection}>
                    <h3 className={styles.sectionTitle}>Shopping Cart</h3>
                    
                    {cartItems.length > 0 ? (
                      <>
                        <div className={styles.cartTable}>
                          <table className={styles.cartTable}>
                            <thead>
                              <tr>
                                <th>Product</th>
                                <th>Price</th>
                                <th>Quantity</th>
                                <th>Total</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {cartItems.map(item => (
                                <tr key={item.id}>
                                  <td>
                                    <div className={styles.cartItemInfo}>
                                      <div className={styles.cartItemImage}>
                                        {item.product_details?.featured_image ? (
                                          <img src={item.product_details.featured_image} alt={item.product_name} />
                                        ) : (
                                          <span>📦</span>
                                        )}
                                      </div>
                                      <div className={styles.cartItemDetails}>
                                        <span className={styles.cartItemName}>{item.product_name}</span>
                                        {item.variant_name && (
                                          <span className={styles.cartItemVariant}>{item.variant_name}</span>
                                        )}
                                        <span className={styles.cartItemSku}>SKU: {item.product_sku || 'N/A'}</span>
                                        <span className={styles.cartItemSme}>{item.sme_name}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td>{cartService.formatPrice(item.price)}</td>
                                  <td>
                                    <div className={styles.quantityControl}>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                        className={styles.quantityButton}
                                        disabled={updatingCart || cartLoading}
                                      >
                                        −
                                      </button>
                                      <span className={styles.quantityValue}>{item.quantity}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                        className={styles.quantityButton}
                                        disabled={updatingCart || cartLoading}
                                      >
                                        +
                                      </button>
                                    </div>
                                  </td>
                                  <td className={styles.cartItemTotal}>
                                    {cartService.formatPrice(item.subtotal)}
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveFromCart(item.id)}
                                      className={styles.removeButton}
                                      title="Remove item"
                                      disabled={updatingCart || cartLoading}
                                    >
                                      🗑️
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className={styles.cartSummary}>
                          <div className={styles.summaryRow}>
                            <span>Subtotal:</span>
                            <span>{cartService.formatPrice(subtotal)}</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className={styles.emptyCart}>
                        <div className={styles.emptyCartIcon}>🛒</div>
                        <h4>Your cart is empty</h4>
                        <p>Browse products above and add them to your cart</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className={styles.formActions}>
                <button
                  type="button"
                  onClick={() => setActiveTab('customer')}
                  className={styles.backButton}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('shipping')}
                  className={styles.nextButton}
                  disabled={cartItems.length === 0 || updatingCart || cartLoading}
                >
                  Next: Shipping & Payment →
                </button>
              </div>
            </div>
          )}

          {/* Shipping & Payment Tab */}
          {activeTab === 'shipping' && (
            <div className={styles.tabPane}>
              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Shipping Method</h3>
                
                <div className={styles.radioGroup}>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="shipping_method"
                      value="standard"
                      checked={formData.shipping_method === 'standard'}
                      onChange={handleInputChange}
                      className={styles.radio}
                    />
                    <div className={styles.radioContent}>
                      <span className={styles.radioTitle}>Standard Shipping</span>
                      <span className={styles.radioDescription}>3-5 business days</span>
                      <span className={styles.radioPrice}>R50.00</span>
                    </div>
                  </label>
                  
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="shipping_method"
                      value="express"
                      checked={formData.shipping_method === 'express'}
                      onChange={handleInputChange}
                      className={styles.radio}
                    />
                    <div className={styles.radioContent}>
                      <span className={styles.radioTitle}>Express Shipping</span>
                      <span className={styles.radioDescription}>1-2 business days</span>
                      <span className={styles.radioPrice}>R120.00</span>
                    </div>
                  </label>
                  
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="shipping_method"
                      value="free"
                      checked={formData.shipping_method === 'free'}
                      onChange={handleInputChange}
                      className={styles.radio}
                    />
                    <div className={styles.radioContent}>
                      <span className={styles.radioTitle}>Free Shipping</span>
                      <span className={styles.radioDescription}>5-7 business days</span>
                      <span className={styles.radioPrice}>R0.00</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Order Adjustments</h3>
                
                <div className={styles.row}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Discount Amount (R)</label>
                    <input
                      type="number"
                      name="discount_amount"
                      value={formData.discount_amount}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Shipping Amount (R)</label>
                    <input
                      type="number"
                      name="shipping_amount"
                      value={formData.shipping_amount}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>

                <div className={styles.row}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Tax Amount (R)</label>
                    <input
                      type="number"
                      name="tax_amount"
                      value={formData.tax_amount}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Order Notes</h3>
                
                <div className={styles.formGroup}>
                  <label className={styles.label}>Customer Notes</label>
                  <textarea
                    name="customer_notes"
                    value={formData.customer_notes}
                    onChange={handleInputChange}
                    className={styles.textarea}
                    rows="3"
                    placeholder="Any special instructions or notes from the customer..."
                  ></textarea>
                </div>
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  onClick={() => setActiveTab('products')}
                  className={styles.backButton}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('review')}
                  className={styles.nextButton}
                >
                  Next: Review Order →
                </button>
              </div>
            </div>
          )}

          {/* Review Order Tab */}
          {activeTab === 'review' && (
            <div className={styles.tabPane}>
              <div className={styles.reviewSection}>
                <h3 className={styles.sectionTitle}>Customer Information</h3>
                <div className={styles.reviewGrid}>
                  <div className={styles.reviewItem}>
                    <span className={styles.reviewLabel}>Name:</span>
                    <span className={styles.reviewValue}>{formData.customer_full_name || 'Not provided'}</span>
                  </div>
                  <div className={styles.reviewItem}>
                    <span className={styles.reviewLabel}>Email:</span>
                    <span className={styles.reviewValue}>{formData.customer_email || 'Not provided'}</span>
                  </div>
                  <div className={styles.reviewItem}>
                    <span className={styles.reviewLabel}>Phone:</span>
                    <span className={styles.reviewValue}>{formData.customer_phone || 'Not provided'}</span>
                  </div>
                </div>
              </div>

              <div className={styles.reviewSection}>
                <h3 className={styles.sectionTitle}>Shipping Address</h3>
                <div className={styles.reviewAddress}>
                  <p>{formData.shipping_address.full_name}</p>
                  <p>{formData.shipping_address.address_line1}</p>
                  {formData.shipping_address.address_line2 && (
                    <p>{formData.shipping_address.address_line2}</p>
                  )}
                  <p>{formData.shipping_address.city}, {formData.shipping_address.state} {formData.shipping_address.postal_code}</p>
                  <p>{formData.shipping_address.country}</p>
                  {formData.shipping_address.phone && (
                    <p>Phone: {formData.shipping_address.phone}</p>
                  )}
                </div>
              </div>

              <div className={styles.reviewSection}>
                <h3 className={styles.sectionTitle}>Order Items</h3>
                <div className={styles.reviewTable}>
                  <table className={styles.reviewTable}>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Price</th>
                        <th>Qty</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cartItems.map(item => (
                        <tr key={item.id}>
                          <td>
                            <div className={styles.reviewProductInfo}>
                              <span className={styles.reviewProductName}>{item.product_name}</span>
                              {item.variant_name && (
                                <span className={styles.reviewProductVariant}>{item.variant_name}</span>
                              )}
                            </div>
                          </td>
                          <td>{cartService.formatPrice(item.price)}</td>
                          <td>{item.quantity}</td>
                          <td>{cartService.formatPrice(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className={styles.reviewSection}>
                <h3 className={styles.sectionTitle}>Order Summary</h3>
                <div className={styles.orderSummary}>
                  <div className={styles.summaryRow}>
                    <span>Subtotal:</span>
                    <span>{cartService.formatPrice(subtotal)}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Discount:</span>
                    <span>-{cartService.formatPrice(formData.discount_amount || 0)}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Shipping:</span>
                    <span>{cartService.formatPrice(formData.shipping_amount || 0)}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Tax:</span>
                    <span>{cartService.formatPrice(formData.tax_amount || 0)}</span>
                  </div>
                  <div className={styles.summaryRowTotal}>
                    <span>Total:</span>
                    <span className={styles.totalAmount}>{cartService.formatPrice(total)}</span>
                  </div>
                </div>
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  onClick={() => setActiveTab('shipping')}
                  className={styles.backButton}
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading || cartItems.length === 0 || updatingCart || cartLoading}
                  className={`${styles.submitButton} ${loading ? styles.loading : ''}`}
                >
                  {loading ? (
                    <>
                      <span className={styles.spinner}></span>
                      Creating Order...
                    </>
                  ) : (
                    'Create Order'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Product Selection Modal */}
      {showProductModal && selectedProduct && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add Product to Cart</h3>
              <button
                onClick={() => {
                  setShowProductModal(false);
                  setSelectedProduct(null);
                  setSelectedVariant(null);
                }}
                className={styles.modalClose}
              >
                ×
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.modalProductInfo}>
                <div className={styles.modalProductImage}>
                  {selectedProduct.featured_image ? (
                    <img src={selectedProduct.featured_image} alt={selectedProduct.name} />
                  ) : (
                    <span>📦</span>
                  )}
                </div>
                <div className={styles.modalProductDetails}>
                  <h4>{selectedProduct.name}</h4>
                  <p className={styles.modalProductSku}>SKU: {selectedProduct.sku || 'N/A'}</p>
                  <p className={styles.modalProductSme}>{selectedProduct.sme_name}</p>
                  <p className={styles.modalProductPrice}>
                    {cartService.formatPrice(selectedProduct.selling_price || selectedProduct.base_price)}
                  </p>
                </div>
              </div>

              {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>Select Variant</label>
                  <select
                    value={selectedVariant?.id || ''}
                    onChange={(e) => {
                      const variant = selectedProduct.variants.find(v => v.id === parseInt(e.target.value));
                      setSelectedVariant(variant);
                    }}
                    className={styles.select}
                  >
                    {selectedProduct.variants.map(variant => (
                      <option key={variant.id} value={variant.id}>
                        {variant.name} - 
                        {variant.price_adjustment > 0 ? '+' : ''}
                        {cartService.formatPrice(variant.price_adjustment)} - 
                        Stock: {variant.stock_quantity || 0}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.label}>Quantity</label>
                <div className={styles.quantityControl}>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className={styles.quantityButton}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className={styles.quantityInput}
                    min="1"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className={styles.quantityButton}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className={styles.modalTotal}>
                <span>Total:</span>
                <span className={styles.modalTotalPrice}>
                  {cartService.formatPrice(
                    (selectedVariant 
                      ? (selectedProduct.selling_price || selectedProduct.base_price) + selectedVariant.price_adjustment
                      : (selectedProduct.selling_price || selectedProduct.base_price)
                    ) * quantity
                  )}
                </span>
              </div>
            </div>
            
            <div className={styles.modalFooter}>
              <button
                onClick={() => {
                  setShowProductModal(false);
                  setSelectedProduct(null);
                  setSelectedVariant(null);
                }}
                className={styles.secondaryButton}
              >
                Cancel
              </button>
              <button
                onClick={handleAddToCart}
                className={styles.primaryButton}
                disabled={updatingCart || cartLoading || (selectedProduct.stock_quantity < quantity)}
              >
                {updatingCart ? 'Adding...' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentCreateOrder;