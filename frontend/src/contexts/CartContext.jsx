/* eslint-disable no-unused-vars */
import React, { createContext, useContext, useState, useEffect } from "react";

const CartContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }

  return context;
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    loadCartFromStorage();
  }, []);

  const loadCartFromStorage = () => {
    try {
      const savedCart = localStorage.getItem("izozo-cart");

      if (savedCart) {
        setCartItems(JSON.parse(savedCart));
      }
    } catch (err) {
      console.error("Error parsing cart from localStorage:", err);
      setError("Failed to load cart from storage");
    }
  };

  useEffect(() => {
    const count = cartItems.reduce(
      (total, item) => total + item.quantity,
      0
    );

    const total = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    setCartCount(count);
    setCartTotal(total);

    try {
      localStorage.setItem("izozo-cart", JSON.stringify(cartItems));
    } catch (err) {
      console.error("Error saving cart to localStorage:", err);
      setError("Failed to save cart");
    }
  }, [cartItems]);

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────

  const extractDimensions = (product) => ({
    length_cm: product.length_cm ?? null,
    width_cm: product.width_cm ?? null,
    height_cm: product.height_cm ?? null,
    weight_kg: product.weight_kg ?? null,
  });

  /**
   * Restrict cart to ONE SME at a time.
   */
  const validateSME = (product) => {
    if (cartItems.length === 0) {
      return true;
    }

    const existingSME = cartItems[0]?.sme_id;
    const incomingSME = product?.sme_id;

    return existingSME === incomingSME;
  };

  // ─────────────────────────────────────────────────────────────
  // CART MUTATIONS
  // ─────────────────────────────────────────────────────────────

  const addToCart = (product, quantity = 1) => {
    // SME restriction
    if (!validateSME(product)) {
      setError(
        "You can only order items from one SME at a time. Please clear your cart first."
      );

      return {
        success: false,
        message:
          "You can only order items from one SME at a time.",
      };
    }

    setError(null);

    setCartItems((prevItems) => {
      const existing = prevItems.find(
        (item) => item.id === product.id
      );

      if (existing) {
        return prevItems.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + quantity,
                price: product.price,
                originalPrice: product.originalPrice,
                seller: product.seller,
                sme_id: product.sme_id,
                commission_rate:
                  product.commission_rate,
                ...extractDimensions(product),
              }
            : item
        );
      }

      return [
        ...prevItems,
        {
          id: product.id,
          product_id: product.id,
          name: product.name,
          product_name: product.name,
          price: product.price,
          originalPrice: product.originalPrice,
          image: product.image,
          seller: product.seller,
          sme_id: product.sme_id ?? null,
          commission_rate:
            product.commission_rate ?? 10,
          quantity,
          category: product.category,
          sku: product.sku ?? "",
          variant_id: product.variant_id ?? null,
          variant_name:
            product.variant_name ?? null,
          ...extractDimensions(product),
        },
      ];
    });

    return {
      success: true,
    };
  };

  const addToCartWithDetails = (
    product,
    details = {}
  ) => {
    // SME restriction
    if (!validateSME(product)) {
      setError(
        "You can only order items from one SME at a time. Please clear your cart first."
      );

      return {
        success: false,
        message:
          "You can only order items from one SME at a time.",
      };
    }

    setError(null);

    setCartItems((prevItems) => {
      const existing = prevItems.find(
        (item) => item.id === product.id
      );

      if (existing) {
        return prevItems.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity:
                  item.quantity +
                  (details.quantity || 1),
                ...extractDimensions(product),
                ...details,
              }
            : item
        );
      }

      return [
        ...prevItems,
        {
          id: product.id,
          product_id: product.id,
          name: product.name,
          product_name: product.name,
          price: product.price,
          originalPrice: product.originalPrice,
          image: product.image,
          seller: product.seller,
          sme_id: product.sme_id ?? null,
          commission_rate:
            product.commission_rate ?? 10,
          quantity: details.quantity ?? 1,
          category: product.category,
          sku: product.sku ?? "",
          variant_id:
            details.variant_id ?? null,
          variant_name:
            details.variant_name ?? null,
          ...extractDimensions(product),
          ...details,
        },
      ];
    });

    return {
      success: true,
    };
  };

  const removeFromCart = (productId) => {
    setCartItems((prev) =>
      prev.filter((item) => item.id !== productId)
    );
  };

  const updateQuantity = (
    productId,
    quantity
  ) => {
    if (quantity < 1) {
      removeFromCart(productId);
      return;
    }

    setCartItems((prev) =>
      prev.map((item) =>
        item.id === productId
          ? { ...item, quantity }
          : item
      )
    );
  };

  const updateItemDetails = (
    productId,
    updates
  ) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === productId
          ? { ...item, ...updates }
          : item
      )
    );
  };

  const updateItemDimensions = (
    productId,
    dims
  ) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === productId ||
        item.product_id === productId
          ? {
              ...item,
              length_cm:
                dims.length_cm ??
                item.length_cm,
              width_cm:
                dims.width_cm ??
                item.width_cm,
              height_cm:
                dims.height_cm ??
                item.height_cm,
              weight_kg:
                dims.weight_kg ??
                item.weight_kg,
            }
          : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
    localStorage.removeItem("izozo-cart");
  };

  const getItemQuantity = (productId) => {
    return (
      cartItems.find(
        (item) => item.id === productId
      )?.quantity ?? 0
    );
  };

  const getCartItem = (productId) => {
    return cartItems.find(
      (item) => item.id === productId
    );
  };

  const getItemsBySME = (smeId) => {
    return cartItems.filter(
      (item) => item.sme_id === smeId
    );
  };

  const getCartSummary = () => {
    const summary = {
      totalItems: cartCount,
      totalAmount: cartTotal,
      itemsBySME: {},
      totalCommission: 0,
    };

    cartItems.forEach((item) => {
      const smeId = item.sme_id || "unknown";

      if (!summary.itemsBySME[smeId]) {
        summary.itemsBySME[smeId] = {
          smeId,
          smeName:
            item.seller || "Unknown Seller",
          items: [],
          subtotal: 0,
          commission: 0,
        };
      }

      summary.itemsBySME[smeId].items.push(item);

      summary.itemsBySME[smeId].subtotal +=
        item.price * item.quantity;

      const commission =
        (item.price *
          item.quantity *
          (item.commission_rate || 10)) /
        100;

      summary.itemsBySME[smeId].commission +=
        commission;

      summary.totalCommission += commission;
    });

    return summary;
  };

  const value = {
    cartItems,
    cartCount,
    cartTotal,
    loading,
    error,

    addToCart,
    addToCartWithDetails,

    removeFromCart,
    updateQuantity,
    updateItemDetails,
    updateItemDimensions,

    clearCart,

    getItemQuantity,
    getCartItem,
    getItemsBySME,
    getCartSummary,

    isEmpty: cartItems.length === 0,
    itemCount: cartItems.length,

    refreshCart: loadCartFromStorage,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};