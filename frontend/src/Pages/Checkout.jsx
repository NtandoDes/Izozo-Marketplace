/* eslint-disable no-unused-vars */
import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { checkoutService } from "../services/checkoutService";
import { paymentService } from "../services/paymentService";
import { addressService } from "../services/addressService";
import PaxiDeliverySelector from "../components/PaxiDeliverySelector";
import styles from "./Checkout.module.css";

const loadPaystackScript = () =>
  new Promise((resolve) => {
    if (window.PaystackPop) return resolve();

    if (document.getElementById("paystack-script")) {
      document
        .getElementById("paystack-script")
        .addEventListener("load", resolve);
      return;
    }

    const script = document.createElement("script");
    script.id = "paystack-script";
    script.src = "https://js.paystack.co/v1/inline.js";
    script.onload = resolve;

    document.body.appendChild(script);
  });

const hasDimensions = (item) =>
  item.length_cm != null &&
  item.width_cm != null &&
  item.height_cm != null &&
  item.weight_kg != null;

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const {
    cartItems,
    cartTotal,
    clearCart,
    refreshCart,
    updateItemDimensions,
  } = useCart();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [completedPaymentId, setCompletedPaymentId] = useState("");

  const [savedPaymentMethods, setSavedPaymentMethods] = useState([]);
  const [savedAddresses, setSavedAddresses] = useState([]);

  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [enrichedItems, setEnrichedItems] = useState([]);
  const [enriching, setEnriching] = useState(false);

  const [selectedDelivery, setSelectedDelivery] = useState(null);

  /**
   * ============================================================================
   * SINGLE SME VALIDATION
   * ============================================================================
   * Customers may ONLY checkout products from ONE SME at a time
   * due to delivery/logistics limitations.
   */

  const uniqueSmeIds = useMemo(() => {
    return [
      ...new Set(
        cartItems
          .map((item) => item.sme_id)
          .filter((smeId) => smeId !== null && smeId !== undefined)
      ),
    ];
  }, [cartItems]);

  const hasMultipleSMEs = uniqueSmeIds.length > 1;

  useEffect(() => {
    if (hasMultipleSMEs) {
      setErrorMessage(
        "Your cart contains products from multiple SMEs. Please checkout items from one SME at a time."
      );
    } else {
      setErrorMessage("");
    }
  }, [hasMultipleSMEs]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login", {
        state: { from: location.pathname },
      });
    }
  }, [isAuthenticated, authLoading, navigate, location]);

  const [shippingInfo, setShippingInfo] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    province: "",
    postalCode: "",
    useSavedAddress: false,
    savedAddressId: null,
  });

  const [billingInfo, setBillingInfo] = useState({
    sameAsShipping: true,
    fullName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    province: "",
    postalCode: "",
    useSavedAddress: false,
    savedAddressId: null,
  });

  const [paymentMethod, setPaymentMethod] = useState("card");
  const [savedMethodId, setSavedMethodId] = useState(null);

  useEffect(() => {
    if (user) {
      const base = {
        fullName: user.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
      };

      setShippingInfo((p) => ({
        ...p,
        ...base,
      }));

      setBillingInfo((p) => ({
        ...p,
        ...base,
      }));
    }
  }, [user]);

  useEffect(() => {
    if (billingInfo.sameAsShipping) {
      setBillingInfo((p) => ({
        ...p,
        fullName: shippingInfo.fullName,
        email: shippingInfo.email,
        phone: shippingInfo.phone,
        address: shippingInfo.address,
        city: shippingInfo.city,
        province: shippingInfo.province,
        postalCode: shippingInfo.postalCode,
      }));
    }
  }, [shippingInfo, billingInfo.sameAsShipping]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSavedPaymentMethods();
      fetchSavedAddresses();
    }

    loadPaystackScript();
  }, [isAuthenticated]);

  const fetchSavedPaymentMethods = async () => {
    try {
      setSavedPaymentMethods(
        await paymentService.getPaymentMethods()
      );
    } catch {
      /* silent */
    }
  };

  const fetchSavedAddresses = async () => {
    try {
      const addresses = await addressService.getAddresses();

      setSavedAddresses(addresses);

      const defS = addresses.find(
        (a) => a.address_type === "shipping" && a.is_default
      );

      const defB = addresses.find(
        (a) => a.address_type === "billing" && a.is_default
      );

      if (defS) {
        setShippingInfo((p) => ({
          ...p,
          useSavedAddress: true,
          savedAddressId: defS.id,
          fullName: defS.full_name,
          phone: defS.phone,
          address: defS.address_line1,
          city: defS.city,
          province: defS.state,
          postalCode: defS.postal_code,
        }));
      }

      if (defB && !billingInfo.sameAsShipping) {
        setBillingInfo((p) => ({
          ...p,
          useSavedAddress: true,
          savedAddressId: defB.id,
          fullName: defB.full_name,
          phone: defB.phone,
          address: defB.address_line1,
          city: defB.city,
          province: defB.state,
          postalCode: defB.postal_code,
        }));
      }
    } catch {
      /* silent */
    }
  };

  /**
   * ============================================================================
   * ENRICH DIMENSIONS
   * ============================================================================
   */

  useEffect(() => {
    if (cartItems.length === 0) {
      setEnrichedItems([]);
      return;
    }

    const missing = cartItems.filter((i) => !hasDimensions(i));

    if (missing.length === 0) {
      setEnrichedItems(cartItems);
      return;
    }

    const enrich = async () => {
      setEnriching(true);

      try {
        const fetchDims = (item) => {
          const slug = item.slug || null;
          const pid = item.product_id || item.id;

          const url = slug
            ? `http://localhost:8000/api/products/${slug}/`
            : `http://localhost:8000/api/agent/products/${pid}/`;

          return fetch(url)
            .then((data) => ({
              product_id: pid,

              length_cm: data.length_cm ?? null,
              width_cm: data.width_cm ?? null,
              height_cm: data.height_cm ?? null,
              weight_kg: data.weight_kg ?? null,

              // NEW
              is_foldable: data.is_foldable ?? false,
              packaging_override: data.packaging_override ?? "none",
            }));
        };

        const results = await Promise.allSettled(
          missing.map(fetchDims)
        );

        const dimsMap = {};

        results.forEach((r) => {
          if (r.status === "fulfilled") {
            dimsMap[r.value.product_id] = r.value;
          }
        });

        Object.entries(dimsMap).forEach(([pid, dims]) => {
          updateItemDimensions(Number(pid), dims);
        });

        setEnrichedItems(
          cartItems.map((item) => {
            if (hasDimensions(item)) return item;

            const d = dimsMap[item.product_id || item.id];

            return d ? { ...item, ...d } : item;
          })
        );
      } catch (err) {
        console.error(
          "Could not enrich cart items with dimensions:",
          err
        );

        setEnrichedItems(cartItems);
      } finally {
        setEnriching(false);
      }
    };

    enrich();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems.map((i) => i.product_id || i.id).join(",")]);

  const deliveryFee = selectedDelivery?.price ?? 0;
  const finalTotal = cartTotal + deliveryFee;

  const handleShippingChange = (e) => {
    const { name, value, checked } = e.target;

    if (name === "useSavedAddress") {
      setShippingInfo((p) => ({
        ...p,
        useSavedAddress: checked,
        savedAddressId: checked ? p.savedAddressId : null,
      }));
    } else if (name === "savedAddressId") {
      const addr = savedAddresses.find(
        (a) => a.id === parseInt(value)
      );

      if (addr) {
        setShippingInfo((p) => ({
          ...p,
          savedAddressId: addr.id,
          fullName: addr.full_name,
          phone: addr.phone,
          address: addr.address_line1,
          city: addr.city,
          province: addr.state,
          postalCode: addr.postal_code,
        }));
      }
    } else {
      setShippingInfo((p) => ({
        ...p,
        [name]: value,
      }));
    }
  };

  const handleBillingChange = (e) => {
    const { name, value, checked } = e.target;

    if (name === "sameAsShipping") {
      setBillingInfo((p) => ({
        ...p,
        sameAsShipping: checked,
      }));
    } else if (name === "useSavedAddress") {
      setBillingInfo((p) => ({
        ...p,
        useSavedAddress: checked,
        savedAddressId: checked ? p.savedAddressId : null,
      }));
    } else if (name === "savedAddressId") {
      const addr = savedAddresses.find(
        (a) => a.id === parseInt(value)
      );

      if (addr) {
        setBillingInfo((p) => ({
          ...p,
          savedAddressId: addr.id,
          fullName: addr.full_name,
          phone: addr.phone,
          address: addr.address_line1,
          city: addr.city,
          province: addr.state,
          postalCode: addr.postal_code,
        }));
      }
    } else {
      setBillingInfo((p) => ({
        ...p,
        [name]: value,
      }));
    }
  };

  const validateStep1 = () => {
    if (hasMultipleSMEs) {
      setErrorMessage(
        "You can only checkout items from one SME at a time."
      );

      return false;
    }

    if (!shippingInfo.useSavedAddress) {
      if (
        [
          "fullName",
          "email",
          "phone",
          "address",
          "city",
          "province",
        ].some((f) => !shippingInfo[f])
      ) {
        setErrorMessage(
          "Please fill in all required shipping fields."
        );

        return false;
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          shippingInfo.email
        )
      ) {
        setErrorMessage(
          "Please enter a valid email address."
        );

        return false;
      }

      if (
        !/^(\+27|0)[0-9]{9}$/.test(
          shippingInfo.phone.replace(/\s/g, "")
        )
      ) {
        setErrorMessage(
          "Please enter a valid South African phone number."
        );

        return false;
      }
    }

    if (!selectedDelivery) {
      setErrorMessage(
        "Please wait for delivery options to load, then select one."
      );

      return false;
    }

    setErrorMessage("");

    return true;
  };

  const handleNextStep = () => {
    if (step === 1 && !validateStep1()) return;

    setErrorMessage("");
    setStep((s) => s + 1);
  };

  const handlePrevStep = () => {
    setErrorMessage("");
    setStep((s) => s - 1);
  };

  const createOrGetAddress = async (info, type) => {
    if (info.useSavedAddress && info.savedAddressId) {
      return info.savedAddressId;
    }

    const existing = savedAddresses.find(
      (a) =>
        a.address_type === type &&
        a.address_line1 === info.address &&
        a.city === info.city &&
        a.state === info.province
    );

    if (existing) return existing.id;

    const addr = await addressService.createAddress({
      address_type: type,
      full_name: info.fullName,
      phone: info.phone,
      address_line1: info.address,
      address_line2: "",
      city: info.city,
      state: info.province,
      postal_code: info.postalCode || "",
      country: "South Africa",
      is_default: false,
    });

    fetchSavedAddresses();

    return addr.id;
  };

  const buildAndCreateOrder = async () => {
    if (hasMultipleSMEs) {
      throw new Error(
        "You can only place orders from one SME at a time."
      );
    }

    const fmt = (n) => Math.round(n * 100) / 100;

    const shippingAddressId =
      await createOrGetAddress(
        shippingInfo,
        "shipping"
      );

    const billingAddressId = billingInfo.sameAsShipping
      ? shippingAddressId
      : await createOrGetAddress(
          billingInfo,
          "billing"
        );

    return checkoutService.createOrder({
      customer_email: shippingInfo.email,
      customer_phone: shippingInfo.phone,
      customer_full_name: shippingInfo.fullName,

      order_type: "platform",

      shipping_address_id: shippingAddressId,
      billing_address_id: billingAddressId,

      shipping_method:
        selectedDelivery?.id ?? "paxi_large",

      shipping_amount: fmt(deliveryFee),

      delivery_size_category:
        selectedDelivery?._key ?? null,

      paxi_tier_id: selectedDelivery?.id ?? null,

      discount_amount: 0,

      /**
       * SINGLE SME ORDER ONLY
       */
      sme_id: uniqueSmeIds[0] || null,

      items: cartItems.map((item) => ({
        product_id: item.product_id || item.id,
        variant_id: item.variant_id || null,

        product_name:
          item.product_name || item.name,

        sku: item.sku || "",

        unit_price: parseFloat(item.price).toFixed(2),

        quantity: parseInt(item.quantity),

        commission_rate: parseFloat(
          item.commission_rate || 10
        ).toFixed(2),

        sme_id: item.sme_id || null,
      })),
    });
  };

  const finaliseSuccess = useCallback(
    async (orderResponse, pId) => {
      try {
        await checkoutService.markOrderAsPaid(
          orderResponse.order_number
        );
      } catch {
        /* best-effort */
      }

      await clearCart();

      if (refreshCart) {
        await refreshCart();
      }

      setOrderNumber(orderResponse.order_number);
      setCompletedPaymentId(pId);
      setOrderComplete(true);
    },
    [clearCart, refreshCart]
  );

  const handlePaystackPayment = useCallback(
    async (orderResponse) => {
      const initRes =
        await paymentService.processPayment({
          order: orderResponse.id,
          payment_method: "card",
          amount:
            Math.round(finalTotal * 100) / 100,
          ...(savedMethodId
            ? {
                saved_method_id: savedMethodId,
              }
            : {}),
        });

      const paymentId =
        initRes.payment?.payment_id ||
        initRes.payment_id;

      if (!initRes.authorization_url) {
        throw new Error(
          "Paystack did not return an authorization URL."
        );
      }

      await loadPaystackScript();

      return new Promise((resolve, reject) => {
        window.PaystackPop.setup({
          key: import.meta.env
            .VITE_PAYSTACK_PUBLIC_KEY,

          email: shippingInfo.email,

          amount: Math.round(finalTotal * 100),

          ref: paymentId,

          currency: "ZAR",

          metadata: {
            order_id: orderResponse.id,
          },

          callback: () =>
            paymentService
              .confirmPayment(paymentId)
              .then(() => resolve(paymentId))
              .catch(reject),

          onClose: () =>
            reject(new Error("CANCELLED")),
        }).openIframe();
      });
    },
    [
      finalTotal,
      shippingInfo.email,
      savedMethodId,
    ]
  );

  const handlePlaceOrder = async () => {
    if (hasMultipleSMEs) {
      setErrorMessage(
        "Your cart contains products from multiple SMEs. Please remove items until only one SME remains."
      );

      return;
    }

    if (!agreeToTerms) {
      setErrorMessage(
        "Please agree to the Terms & Conditions."
      );

      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    let orderResponse = null;

    try {
      orderResponse = await buildAndCreateOrder();

      const pId =
        paymentMethod === "card"
          ? await handlePaystackPayment(
              orderResponse
            )
          : await handleOfflinePayment(
              orderResponse,
              paymentMethod
            );

      await finaliseSuccess(orderResponse, pId);
    } catch (err) {
      if (err.message === "CANCELLED") {
        if (orderResponse?.order_number) {
          try {
            await checkoutService.cancelOrder(
              orderResponse.order_number
            );
          } catch {
            console.warn(
              "Could not clean up cancelled order:",
              orderResponse.order_number
            );
          }
        }

        setErrorMessage(
          "Payment was cancelled. No order was placed."
        );
      } else if (err.response?.data) {
        const d = err.response.data;

        setErrorMessage(
          (
            typeof d === "object"
              ? Object.entries(d).map(
                  ([k, v]) =>
                    `${k}: ${
                      Array.isArray(v)
                        ? v.join(", ")
                        : v
                    }`
                )
              : [d]
          ).join("\n")
        );
      } else {
        setErrorMessage(
          err.message ||
            "Failed to place order. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.checkoutPage}>
        <div className="container">
          <div className={styles.emptyCheckout}>
            <h2>Please Login</h2>

            <p>
              You need to be logged in to proceed
              with checkout.
            </p>

            <button
              className={`${styles.btn} ${styles.primaryBtn}`}
              onClick={() =>
                navigate("/login", {
                  state: { from: "/checkout" },
                })
              }
            >
              Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  /**
   * ============================================================================
   * MULTIPLE SME BLOCK SCREEN
   * ============================================================================
   */

  if (hasMultipleSMEs) {
    return (
      <div className={styles.checkoutPage}>
        <div className="container">
          <div className={styles.emptyCheckout}>
            <h2>Multiple SMEs Detected</h2>

            <p>
              Your cart currently contains products
              from multiple SMEs.
            </p>

            <p>
              Due to delivery limitations, you can
              only checkout products from one SME at
              a time.
            </p>

            <button
              className={`${styles.btn} ${styles.primaryBtn}`}
              onClick={() => navigate("/cart")}
            >
              Return to Cart
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0 && !orderComplete) {
    return (
      <div className={styles.checkoutPage}>
        <div className="container">
          <div className={styles.emptyCheckout}>
            <h2>Your cart is empty</h2>

            <p>
              Add items to your cart before
              proceeding to checkout.
            </p>

            <button
              className={`${styles.btn} ${styles.primaryBtn}`}
              onClick={() =>
                navigate("/products")
              }
            >
              Browse Products
            </button>
          </div>
        </div>
      </div>
    );
  }


  if (authLoading) return <div className={styles.loadingContainer}><div className={styles.loadingSpinner}/><p>Loading...</p></div>;
  if (!isAuthenticated) return <div className={styles.checkoutPage}><div className="container"><div className={styles.emptyCheckout}><h2>Please Login</h2><p>You need to be logged in to proceed with checkout.</p><button className={`${styles.btn} ${styles.primaryBtn}`} onClick={() => navigate("/login",{state:{from:"/checkout"}})}>Login</button></div></div></div>;
  if (cartItems.length === 0 && !orderComplete) return <div className={styles.checkoutPage}><div className="container"><div className={styles.emptyCheckout}><h2>Your cart is empty</h2><p>Add items to your cart before proceeding to checkout.</p><button className={`${styles.btn} ${styles.primaryBtn}`} onClick={() => navigate("/products")}>Browse Products</button></div></div></div>;

  if (orderComplete) return (
    <div className={styles.checkoutPage}><div className="container"><div className={styles.orderComplete}>
      <div className={styles.successIcon}><svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg></div>
      <h1 className={styles.pageTitle}>Order Confirmed!</h1>
      <p className={styles.orderNumber}>Order Number: {orderNumber}</p>
      <p className={styles.paymentId}>Payment ID: {completedPaymentId}</p>
      <p className={styles.confirmationText}>Thank you for your order! We've sent a confirmation email to {shippingInfo.email}.</p>
      <div className={styles.orderSummary}><h3>Order Summary</h3><div className={styles.summaryGrid}>
        <div className={styles.summaryItem}><span>Items ({cartItems.length})</span><span>R{cartTotal.toFixed(2)}</span></div>
        <div className={styles.summaryItem}><span>Delivery ({selectedDelivery?.label ?? "PAXI"})</span><span>{deliveryFee===0?"Free":`R${deliveryFee.toFixed(2)}`}</span></div>
        <div className={`${styles.summaryItem} ${styles.total}`}><span>Total</span><span>R{finalTotal.toFixed(2)}</span></div>
      </div></div>
      <div className={styles.actionButtons}>
        <button className={`${styles.btn} ${styles.primaryBtn}`} onClick={() => navigate(`/account/orders/${orderNumber}`)}>View Order</button>
        <button className={`${styles.btn} ${styles.secondaryBtn}`} onClick={() => navigate("/products")}>Continue Shopping</button>
      </div>
    </div></div></div>
  );

  const provinces = ["Gauteng","Western Cape","KwaZulu-Natal","Eastern Cape","Free State","Mpumalanga","North West","Limpopo","Northern Cape"];

  return (
    <div className={styles.checkoutPage}>
      <div className="container">
        <nav className={styles.breadcrumb}><Link to="/">Home</Link> &gt; <Link to="/cart">Cart</Link> &gt; <span>Checkout</span></nav>
        <h1 className={styles.pageTitle}>Checkout</h1>
        <div className={styles.checkoutLayout}>
          <div className={styles.checkoutSteps}>

            {/* Progress */}
            <div className={styles.progressBar}>
              <div className={styles.progressSteps}>
                {[1,2,3].map((n) => (
                  <div key={n} className={`${styles.progressStep} ${step>=n?styles.active:""}`}>
                    <div className={styles.stepCircle}>{n}</div>
                    <span className={styles.stepLabel}>{n===1?"Shipping":n===2?"Payment":"Confirmation"}</span>
                  </div>
                ))}
              </div>
              <div className={styles.progressLine}><div className={styles.progressFill} style={{width:`${((step-1)/2)*100}%`}}/></div>
            </div>

            {errorMessage && <div className={styles.errorBanner} role="alert">{errorMessage}</div>}

            {/* Step 1 */}
            {step === 1 && (
              <div className={styles.checkoutStep}>
                <h2 className={styles.stepTitle}>Shipping Information</h2>
                {savedAddresses.length > 0 && (
                  <div className={styles.savedAddresses}>
                    <h3>Saved Addresses</h3>
                    <label className={styles.checkboxLabel}><input type="checkbox" name="useSavedAddress" checked={shippingInfo.useSavedAddress} onChange={handleShippingChange} className={styles.checkbox}/>Use a saved address</label>
                    {shippingInfo.useSavedAddress && (
                      <select name="savedAddressId" value={shippingInfo.savedAddressId||""} onChange={handleShippingChange} className={styles.formInput}>
                        <option value="">Select an address</option>
                        {savedAddresses.filter((a)=>a.address_type==="shipping").map((a)=><option key={a.id} value={a.id}>{a.full_name} – {a.address_line1}, {a.city}</option>)}
                      </select>
                    )}
                    <div className={styles.orDivider}><span>OR</span></div>
                  </div>
                )}
                {!shippingInfo.useSavedAddress && (
                  <div className={styles.formGrid}>
                    {[{id:"fullName",label:"Full Name",type:"text"},{id:"email",label:"Email Address",type:"email"},{id:"phone",label:"Phone Number",type:"tel",placeholder:"+27 12 345 6789"}].map(({id,label,type,placeholder})=>(
                      <div key={id} className={styles.formGroup}><label htmlFor={id}>{label} *</label><input id={id} name={id} type={type} value={shippingInfo[id]} onChange={handleShippingChange} placeholder={placeholder} required className={styles.formInput}/></div>
                    ))}
                    <div className={`${styles.formGroup} ${styles.fullWidth}`}><label htmlFor="address">Street Address *</label><input id="address" name="address" type="text" value={shippingInfo.address} onChange={handleShippingChange} placeholder="House number, street name" required className={styles.formInput}/></div>
                    <div className={styles.formGroup}><label htmlFor="city">City *</label><input id="city" name="city" type="text" value={shippingInfo.city} onChange={handleShippingChange} required className={styles.formInput}/></div>
                    <div className={styles.formGroup}><label htmlFor="province">Province *</label><select id="province" name="province" value={shippingInfo.province} onChange={handleShippingChange} required className={styles.formInput}><option value="">Select Province</option>{provinces.map((p)=><option key={p} value={p}>{p}</option>)}</select></div>
                    <div className={styles.formGroup}><label htmlFor="postalCode">Postal Code</label><input id="postalCode" name="postalCode" type="text" value={shippingInfo.postalCode} onChange={handleShippingChange} className={styles.formInput}/></div>
                  </div>
                )}

                {/* PAXI Delivery Selector */}
                <div className={styles.deliveryOptions}>
                  {enriching || enrichedItems.length === 0 ? (
      <div style={{padding:"12px 0",color:"#9ca3af",fontSize:14}}>⏳ Calculating delivery options from product dimensions…</div>
    ) : (
      <PaxiDeliverySelector
        cartItems={enrichedItems}
        selectedTierId={selectedDelivery?.id}
        onSelect={(tier) => setSelectedDelivery(tier)}
        showBreakdown={true}
      />
    )}
                    </div>
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div className={styles.checkoutStep}>
                <h2 className={styles.stepTitle}>Payment Information</h2>
                <div className={styles.billingSection}>
                  <h3>Billing Address</h3>
                  <label className={styles.checkboxLabel}><input type="checkbox" name="sameAsShipping" checked={billingInfo.sameAsShipping} onChange={handleBillingChange} className={styles.checkbox}/>Same as shipping address</label>
                  {!billingInfo.sameAsShipping && (
                    <>
                      {savedAddresses.length > 0 && (
                        <div className={styles.savedAddresses}>
                          <label className={styles.checkboxLabel}><input type="checkbox" name="useSavedAddress" checked={billingInfo.useSavedAddress} onChange={handleBillingChange} className={styles.checkbox}/>Use a saved billing address</label>
                          {billingInfo.useSavedAddress && <select name="savedAddressId" value={billingInfo.savedAddressId||""} onChange={handleBillingChange} className={styles.formInput}><option value="">Select an address</option>{savedAddresses.filter((a)=>a.address_type==="billing").map((a)=><option key={a.id} value={a.id}>{a.full_name} – {a.address_line1}, {a.city}</option>)}</select>}
                          <div className={styles.orDivider}><span>OR</span></div>
                        </div>
                      )}
                      {!billingInfo.useSavedAddress && (
                        <div className={styles.formGrid}>
                          {[{id:"billingFullName",name:"fullName",label:"Full Name",type:"text"},{id:"billingEmail",name:"email",label:"Email Address",type:"email"},{id:"billingPhone",name:"phone",label:"Phone Number",type:"tel",placeholder:"+27 12 345 6789"}].map(({id,name,label,type,placeholder})=>(
                            <div key={id} className={styles.formGroup}><label htmlFor={id}>{label} *</label><input id={id} name={name} type={type} value={billingInfo[name]} onChange={handleBillingChange} placeholder={placeholder} required className={styles.formInput}/></div>
                          ))}
                          <div className={`${styles.formGroup} ${styles.fullWidth}`}><label htmlFor="billingAddress">Street Address *</label><input id="billingAddress" name="address" type="text" value={billingInfo.address} onChange={handleBillingChange} placeholder="House number, street name" required className={styles.formInput}/></div>
                          <div className={styles.formGroup}><label htmlFor="billingCity">City *</label><input id="billingCity" name="city" type="text" value={billingInfo.city} onChange={handleBillingChange} required className={styles.formInput}/></div>
                          <div className={styles.formGroup}><label htmlFor="billingProvince">Province *</label><select id="billingProvince" name="province" value={billingInfo.province} onChange={handleBillingChange} required className={styles.formInput}><option value="">Select Province</option>{provinces.map((p)=><option key={p} value={p}>{p}</option>)}</select></div>
                          <div className={styles.formGroup}><label htmlFor="billingPostalCode">Postal Code</label><input id="billingPostalCode" name="postalCode" type="text" value={billingInfo.postalCode} onChange={handleBillingChange} className={styles.formInput}/></div>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {savedPaymentMethods.length > 0 && (
                  <div className={styles.savedMethods}>
                    <h3>Saved Payment Methods</h3>
                    {savedPaymentMethods.map((m)=>(
                      <label key={m.id} className={styles.methodOption}>
                        <input type="radio" name="savedMethod" value={m.id} checked={savedMethodId===m.id} onChange={()=>{setSavedMethodId(m.id);setPaymentMethod(m.payment_type);}} className={styles.methodRadio}/>
                        <span className={styles.methodIcon}>{m.payment_type==="card"?"💳":m.payment_type==="eft"?"🏦":"📱"}</span>
                        <span className={styles.methodName}>{m.display_name}</span>
                        {m.is_default && <span className={styles.defaultBadge}>Default</span>}
                      </label>
                    ))}
                    <div className={styles.orDivider}><span>OR USE A NEW METHOD</span></div>
                  </div>
                )}
                <div className={styles.paymentTabs}>
                  {[{id:"card",label:"💳 Pay by Card"}].map(({id,label})=>(
                    <button key={id} className={`${styles.paymentTab} ${paymentMethod===id&&!savedMethodId?styles.active:""}`} onClick={()=>{setPaymentMethod(id);setSavedMethodId(null);}}>{label}</button>
                  ))}
                </div>
                {paymentMethod==="card"&&!savedMethodId&&<div className={styles.paystackNotice}><div className={styles.paystackLogo}><svg width="120" viewBox="0 0 120 28" fill="none" xmlns="http://www.w3.org/2000/svg"><text y="22" fontSize="20" fontWeight="700" fill="#0BA4DB">Paystack</text></svg></div><p>You'll be redirected to Paystack's secure payment page.</p><p>We accept Visa, Mastercard, and Verve cards.</p><div className={styles.cardIcons}><span className={styles.cardIcon}>VISA</span><span className={styles.cardIcon}>MC</span><span className={styles.cardIcon}>VERVE</span></div></div>}
                <div className={styles.securityNote}>🔒 <span>Your payment information is secure and encrypted</span></div>
              </div>
            )}

          
            <div className={styles.stepNavigation}>
              {step>1 && <button className={`${styles.btn} ${styles.prevBtn}`} onClick={handlePrevStep} disabled={isLoading}>Back</button>}
              
               
                <button className={`${styles.btn} ${styles.placeOrderBtn}`} onClick={handlePlaceOrder} disabled={isLoading||!agreeToTerms}>
                    {isLoading?"Processing...":paymentMethod==="card"?"Place Order & Pay with Paystack":"Place Order"}
                  </button>
              
            </div>
          </div>

          {/* Sidebar */}
          <div className={styles.orderSummarySidebar}>
            <h2 className={styles.summaryTitle}>Order Summary</h2>
            <div className={styles.summaryItems}>
              {cartItems.map((item)=>(
                <div key={item.id} className={styles.summaryItem}>
                  <div className={styles.itemInfo}><span className={styles.itemName}>{item.product_name||item.name}</span><span className={styles.itemQuantity}>× {item.quantity}</span></div>
                  <span className={styles.itemPrice}>R{(item.price*item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className={styles.summaryTotals}>
              <div className={styles.totalRow}><span>Subtotal</span><span>R{cartTotal.toFixed(2)}</span></div>
              <div className={styles.totalRow}>
                <span>Delivery{selectedDelivery&&<span style={{fontSize:11,color:"#6b7280",marginLeft:6}}>({selectedDelivery._key})</span>}</span>
                <span>{deliveryFee===0?"Free":`R${deliveryFee.toFixed(2)}`}</span>
              </div>
            
              <div className={`${styles.totalRow} ${styles.grandTotal}`}><span>Total</span><span>R{finalTotal.toFixed(2)}</span></div>
            </div>
            <div className={styles.securityInfo}>🔒 Secure checkout • SSL encrypted</div>
            <div className={styles.helpSection}>
              <h3>Need help?</h3>
              <a href="tel:+27812524406" className={styles.helpLink}>📞 +27 81 252 4406</a>
              <a href="mailto:support@izozo.co.za" className={styles.helpLink}>✉️ support@izozo.co.za</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}