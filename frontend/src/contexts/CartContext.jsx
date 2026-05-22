/* eslint-disable no-unused-vars */
import React, { createContext, useContext, useState, useEffect } from "react";

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  useEffect(() => { loadCartFromStorage(); }, []);

  const loadCartFromStorage = () => {
    try {
      const saved = localStorage.getItem("izozo-cart");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Re-hydrate delivery fields that may have been lost —
        // fall back to product_details if the flat fields are missing.
        const hydrated = parsed.map((item) => {
          const pd = item.product_details || {};
          return {
            ...item,
            is_foldable:     item.is_foldable     ?? pd.is_foldable     ?? false,
            length_cm:       item.length_cm       ?? pd.length_cm       ?? null,
            width_cm:        item.width_cm        ?? pd.width_cm        ?? null,
            height_cm:       item.height_cm       ?? pd.height_cm       ?? null,
            weight_kg:       item.weight_kg       ?? pd.weight_kg       ?? null,
            commission_type: item.commission_type ?? pd.commission_type ?? null,
          };
        });
        setCartItems(hydrated);
      }
    } catch (err) {
      console.error("Error parsing cart from localStorage:", err);
      setError("Failed to load cart from storage");
    }
  };

  useEffect(() => {
    const count = cartItems.reduce((t, i) => t + i.quantity, 0);
    const total = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
    setCartCount(count);
    setCartTotal(total);
    try {
      localStorage.setItem("izozo-cart", JSON.stringify(cartItems));
    } catch (err) {
      console.error("Error saving cart to localStorage:", err);
      setError("Failed to save cart");
    }
  }, [cartItems]);

  // ── Dimension extraction ─────────────────────────────────────────────────
  //
  // Reads delivery fields from either the product object directly OR from
  // product_details (the nested object returned by CartItemSerializer).
  // is_foldable is the most critical field — if it's missing the PAXI tier
  // logic falls back to dimension math and produces wrong tiers.

  const extractDimensions = (product) => {
    const pd = product.product_details || {};
    return {
      length_cm:       product.length_cm       ?? pd.length_cm       ?? null,
      width_cm:        product.width_cm        ?? pd.width_cm        ?? null,
      height_cm:       product.height_cm       ?? pd.height_cm       ?? null,
      weight_kg:       product.weight_kg       ?? pd.weight_kg       ?? null,
      is_foldable:     product.is_foldable     ?? pd.is_foldable     ?? false,
      commission_type: product.commission_type ?? pd.commission_type ?? null,
    };
  };

  const validateSME = (product) => {
    if (cartItems.length === 0) return true;
    return cartItems[0]?.sme_id === product?.sme_id;
  };

  // ── Cart mutations ───────────────────────────────────────────────────────

  const addToCart = (product, quantity = 1) => {
    if (!validateSME(product)) {
      setError("You can only order items from one SME at a time. Please clear your cart first.");
      return { success: false, message: "You can only order items from one SME at a time." };
    }
    setError(null);
    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id
            ? {
                ...i,
                quantity: i.quantity + quantity,
                price:           product.price,
                originalPrice:   product.originalPrice,
                seller:          product.seller,
                sme_id:          product.sme_id,
                commission_rate: product.commission_rate,
                ...extractDimensions(product),
              }
            : i
        );
      }
      return [
        ...prev,
        {
          id:              product.id,
          product_id:      product.id,
          name:            product.name,
          product_name:    product.name,
          price:           product.price,
          originalPrice:   product.originalPrice,
          image:           product.image,
          seller:          product.seller,
          sme_id:          product.sme_id          ?? null,
          commission_rate: product.commission_rate  ?? 0,
          quantity,
          category:        product.category,
          sku:             product.sku              ?? "",
          slug:            product.slug             ?? null,
          variant_id:      product.variant_id       ?? null,
          variant_name:    product.variant_name     ?? null,
          ...extractDimensions(product),
        },
      ];
    });
    return { success: true };
  };

  const addToCartWithDetails = (product, details = {}) => {
    if (!validateSME(product)) {
      setError("You can only order items from one SME at a time. Please clear your cart first.");
      return { success: false, message: "You can only order items from one SME at a time." };
    }
    setError(null);
    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id
            ? { ...i, quantity: i.quantity + (details.quantity || 1), ...extractDimensions(product), ...details }
            : i
        );
      }
      return [
        ...prev,
        {
          id:              product.id,
          product_id:      product.id,
          name:            product.name,
          product_name:    product.name,
          price:           product.price,
          originalPrice:   product.originalPrice,
          image:           product.image,
          seller:          product.seller,
          sme_id:          product.sme_id          ?? null,
          commission_rate: product.commission_rate  ?? 0,
          quantity:        details.quantity         ?? 1,
          category:        product.category,
          sku:             product.sku              ?? "",
          slug:            product.slug             ?? null,
          variant_id:      details.variant_id       ?? null,
          variant_name:    details.variant_name     ?? null,
          ...extractDimensions(product),
          ...details,
        },
      ];
    });
    return { success: true };
  };

  const removeFromCart = (productId) => {
    setCartItems((prev) => prev.filter((i) => i.id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity < 1) { removeFromCart(productId); return; }
    setCartItems((prev) =>
      prev.map((i) => i.id === productId ? { ...i, quantity } : i)
    );
  };

  const updateItemDetails = (productId, updates) => {
    setCartItems((prev) =>
      prev.map((i) => i.id === productId ? { ...i, ...updates } : i)
    );
  };

  // Merges enriched dimension data back onto a cart item after API fetch.
  // Always preserves is_foldable and commission_type.
  const updateItemDimensions = (productId, dims) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === productId || item.product_id === productId
          ? {
              ...item,
              length_cm:       dims.length_cm       ?? item.length_cm,
              width_cm:        dims.width_cm        ?? item.width_cm,
              height_cm:       dims.height_cm       ?? item.height_cm,
              weight_kg:       dims.weight_kg       ?? item.weight_kg,
              is_foldable:     dims.is_foldable     ?? item.is_foldable     ?? false,
              commission_type: dims.commission_type ?? item.commission_type ?? null,
            }
          : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
    localStorage.removeItem("izozo-cart");
  };

  const getItemQuantity  = (productId) => cartItems.find((i) => i.id === productId)?.quantity ?? 0;
  const getCartItem      = (productId) => cartItems.find((i) => i.id === productId);
  const getItemsBySME    = (smeId)     => cartItems.filter((i) => i.sme_id === smeId);

  const getCartSummary = () => {
    const summary = { totalItems: cartCount, totalAmount: cartTotal, itemsBySME: {}, totalCommission: 0 };
    cartItems.forEach((item) => {
      const smeId = item.sme_id || "unknown";
      if (!summary.itemsBySME[smeId]) {
        summary.itemsBySME[smeId] = {
          smeId, smeName: item.seller || "Unknown Seller",
          items: [], subtotal: 0, commission: 0,
        };
      }
      summary.itemsBySME[smeId].items.push(item);
      summary.itemsBySME[smeId].subtotal += item.price * item.quantity;
      const commission = (item.price * item.quantity * (item.commission_rate || 0)) / 100;
      summary.itemsBySME[smeId].commission += commission;
      summary.totalCommission += commission;
    });
    return summary;
  };

  const value = {
    cartItems, cartCount, cartTotal, loading, error,
    addToCart, addToCartWithDetails, removeFromCart,
    updateQuantity, updateItemDetails, updateItemDimensions, clearCart,
    getItemQuantity, getCartItem, getItemsBySME, getCartSummary,
    isEmpty:     cartItems.length === 0,
    itemCount:   cartItems.length,
    refreshCart: loadCartFromStorage,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};