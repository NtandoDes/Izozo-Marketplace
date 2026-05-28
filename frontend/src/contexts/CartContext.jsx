/* eslint-disable no-unused-vars */
import React, { createContext, useContext, useState, useEffect } from "react";
import { computeOrderPaxiTier, PAXI_TIERS, estimateFoldableVolume } from "../services/checkoutService";

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the maximum quantity a customer can order for a product,
 * respecting both:
 *   1. Available stock  (product_details.stock_quantity or product.stock_quantity)
 *   2. PAXI LARGE tier limits — we never allow the cart to exceed LARGE
 *      (volume > 8 000 cm³ OR weight > 10 kg total).
 *
 * Returns an object: { max, reason }
 *   max    – the hard ceiling (≥ 0; 0 means "cannot add any more")
 *   reason – human-readable explanation when max < requested qty
 */
export function computeMaxQuantity(product, currentCartItems = [], currentItemId = null) {
  // ── 1. Stock ceiling ────────────────────────────────────────────────────
  const stock =
    product.stock_quantity ??
    product.product_details?.stock_quantity ??
    Infinity; // unknown stock → no stock ceiling

  // ── 2. PAXI ceiling ─────────────────────────────────────────────────────
  // Build a "hypothetical" cart where this item has qty = 0
  // so we can binary-search the max we can add.
  const otherItems = currentCartItems.filter(
    (i) => i.id !== (currentItemId ?? product.id)
  );

  // Fast check: what volume/weight does one unit of this product add?
  const pd = product.product_details || {};
  const is_foldable = product.is_foldable ?? pd.is_foldable ?? false;
  const weight_kg   = Number(product.weight_kg ?? pd.weight_kg ?? 0);

  let unitVol;
  if (is_foldable) {
    unitVol = estimateFoldableVolume(product);
  } else {
    const l = Number(product.length_cm ?? pd.length_cm ?? 0);
    const w = Number(product.width_cm  ?? pd.width_cm  ?? 0);
    const h = Number(product.height_cm ?? pd.height_cm ?? 0);
    unitVol = l * w * h;
  }

  // Current totals from the rest of the cart
  const baseResult = computeOrderPaxiTier(otherItems);
  const baseVol    = baseResult.totalVolume;
  const baseWeight = baseResult.totalWeight;

  const LARGE = PAXI_TIERS.LARGE;

  let paxiMax = Infinity;
  if (unitVol > 0) {
    paxiMax = Math.min(paxiMax, Math.floor((LARGE.maxVolumeCm3 - baseVol) / unitVol));
  }
  if (weight_kg > 0) {
    paxiMax = Math.min(paxiMax, Math.floor((LARGE.maxWeightKg - baseWeight) / weight_kg));
  }
  // If we have no dimensional data at all, don't impose a PAXI ceiling
  if (unitVol === 0 && weight_kg === 0) paxiMax = Infinity;

  paxiMax = Math.max(0, paxiMax); // never negative

  const max = Math.min(
    stock === Infinity ? 9999 : stock,
    paxiMax === Infinity ? 9999 : paxiMax
  );

  let reason = null;
  if (max <= 0) {
    if (stock !== Infinity && stock <= 0) {
      reason = "Out of stock";
    } else if (paxiMax <= 0) {
      reason = "PAXI delivery limit reached";
    }
  } else if (max < 9999) {
    if (paxiMax <= stock || stock === Infinity) {
      if (paxiMax !== Infinity) reason = `Max ${max} — PAXI delivery limit`;
    } else {
      reason = `Max ${max} in stock`;
    }
  }

  return { max, reason };
}

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
            stock_quantity:  item.stock_quantity  ?? pd.stock_quantity  ?? null,
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

  const extractDimensions = (product) => {
    const pd = product.product_details || {};
    return {
      length_cm:       product.length_cm       ?? pd.length_cm       ?? null,
      width_cm:        product.width_cm        ?? pd.width_cm        ?? null,
      height_cm:       product.height_cm       ?? pd.height_cm       ?? null,
      weight_kg:       product.weight_kg       ?? pd.weight_kg       ?? null,
      is_foldable:     product.is_foldable     ?? pd.is_foldable     ?? false,
      commission_type: product.commission_type ?? pd.commission_type ?? null,
      stock_quantity:  product.stock_quantity  ?? pd.stock_quantity  ?? null,
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

    // Check stock + PAXI limits
    const existing   = cartItems.find((i) => i.id === product.id);
    const currentQty = existing?.quantity ?? 0;
    const { max, reason } = computeMaxQuantity(product, cartItems, product.id);

    if (currentQty >= max) {
      const msg = reason ?? `Cannot add more (limit: ${max})`;
      setError(msg);
      return { success: false, message: msg };
    }

    // Clamp to ceiling
    const allowed = Math.min(quantity, max - currentQty);

    setError(null);
    setCartItems((prev) => {
      const existingItem = prev.find((i) => i.id === product.id);
      if (existingItem) {
        return prev.map((i) =>
          i.id === product.id
            ? {
                ...i,
                quantity:        i.quantity + allowed,
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
          quantity:        allowed,
          category:        product.category,
          sku:             product.sku              ?? "",
          slug:            product.slug             ?? null,
          variant_id:      product.variant_id       ?? null,
          variant_name:    product.variant_name     ?? null,
          stock_quantity:  product.stock_quantity   ?? product.product_details?.stock_quantity ?? null,
          ...extractDimensions(product),
        },
      ];
    });
    return { success: true, quantityAdded: allowed };
  };

  const addToCartWithDetails = (product, details = {}) => {
    if (!validateSME(product)) {
      setError("You can only order items from one SME at a time. Please clear your cart first.");
      return { success: false, message: "You can only order items from one SME at a time." };
    }

    const requestedQty = details.quantity ?? 1;
    const existing     = cartItems.find((i) => i.id === product.id);
    const currentQty   = existing?.quantity ?? 0;
    const { max, reason } = computeMaxQuantity(product, cartItems, product.id);

    if (currentQty >= max) {
      const msg = reason ?? `Cannot add more (limit: ${max})`;
      setError(msg);
      return { success: false, message: msg };
    }

    const allowed = Math.min(requestedQty, max - currentQty);

    setError(null);
    setCartItems((prev) => {
      const existingItem = prev.find((i) => i.id === product.id);
      if (existingItem) {
        return prev.map((i) =>
          i.id === product.id
            ? { ...i, quantity: i.quantity + allowed, ...extractDimensions(product), ...details, quantity: i.quantity + allowed }
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
          quantity:        allowed,
          category:        product.category,
          sku:             product.sku              ?? "",
          slug:            product.slug             ?? null,
          variant_id:      details.variant_id       ?? null,
          variant_name:    details.variant_name     ?? null,
          stock_quantity:  product.stock_quantity   ?? product.product_details?.stock_quantity ?? null,
          ...extractDimensions(product),
          ...details,
          quantity:        allowed, // always use clamped value
        },
      ];
    });
    return { success: true, quantityAdded: allowed };
  };

  const removeFromCart = (productId) => {
    setCartItems((prev) => prev.filter((i) => i.id !== productId));
  };

  /**
   * updateQuantity now enforces stock + PAXI limits.
   * Returns { success, message, clampedTo } so callers can show feedback.
   */
  const updateQuantity = (productId, quantity) => {
    if (quantity < 1) {
      removeFromCart(productId);
      return { success: true };
    }

    const item = cartItems.find((i) => i.id === productId);
    if (!item) return { success: false, message: "Item not found in cart" };

    const { max, reason } = computeMaxQuantity(item, cartItems, productId);

    if (quantity > max) {
      // Clamp to the allowed maximum rather than silently refusing
      const clamped = Math.max(1, max);
      setCartItems((prev) =>
        prev.map((i) => i.id === productId ? { ...i, quantity: clamped } : i)
      );
      return {
        success:   false,
        clampedTo: clamped,
        message:   reason ?? `Quantity limited to ${clamped}`,
      };
    }

    setCartItems((prev) =>
      prev.map((i) => i.id === productId ? { ...i, quantity } : i)
    );
    return { success: true };
  };

  /**
   * Exposed helper so Cart.jsx can derive the max for a given cart item
   * without duplicating logic.
   */
  const getItemMax = (productId) => {
    const item = cartItems.find((i) => i.id === productId);
    if (!item) return { max: 0, reason: "Item not found" };
    return computeMaxQuantity(item, cartItems, productId);
  };

  const updateItemDetails = (productId, updates) => {
    setCartItems((prev) =>
      prev.map((i) => i.id === productId ? { ...i, ...updates } : i)
    );
  };

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
    getItemQuantity, getCartItem, getItemsBySME, getCartSummary, getItemMax,
    isEmpty:     cartItems.length === 0,
    itemCount:   cartItems.length,
    refreshCart: loadCartFromStorage,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};