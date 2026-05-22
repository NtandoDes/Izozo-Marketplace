/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import agentService from '../../services/agentService';
import styles from './AgentCreateProduct.module.css'; // reuse SME styles

// ── Commission rules (PERCENTAGE-BASED) ─────────────────────────────────────
const CATEGORY_COMMISSION_RULES = {
  hair_cosmetics:    { label: 'Hair, Hair Products & Cosmetics', desc: 'Shampoo, conditioner, weaves, makeup, skincare', commission: 12, foldable: true  },
  clothing:          { label: 'Clothing',                        desc: 'All garments, jerseys, activewear, underwear',  commission: 5,  foldable: true  },
  shoes:             { label: 'Shoes',                           desc: 'Sneakers, heels, sandals, boots',               commission: 10, foldable: false },
  fragrances:        { label: 'Fragrances',                      desc: 'Perfumes, body sprays, cologne',                commission: 12, foldable: false },
  local_handmade:    { label: 'Local Handmade Products',         desc: 'Crafts, candles, jewellery, artwork',           commission: 15, foldable: false },
  cleaning_products: { label: 'Cleaning Products (SABS)',        desc: 'Detergents, disinfectants, SABS-approved items', commission: 8,  foldable: false },
};

// ── Auto-detect commission type from a category name / full_path ─────────────
function inferCommissionType(categoryName, fullPath) {
  var t = ((categoryName || '') + ' ' + (fullPath || '')).toLowerCase().trim();
  var has = function() { var words = Array.prototype.slice.call(arguments); return words.some(function(w) { return t.indexOf(w) !== -1; }); };
  if (has('hair', 'weave', 'wig', 'cosmetic', 'makeup', 'make-up', 'skincare', 'shampoo', 'conditioner', 'mascara', 'lipstick', 'foundation', 'serum', 'lotion', 'beauty')) return 'hair_cosmetics';
  if (has('perfume', 'fragrance', 'cologne', 'body spray')) return 'fragrances';
  if (has('shoe', 'sneaker', 'heel', 'sandal', 'boot', 'trainer', 'footwear', 'slipper')) return 'shoes';
  if (has('clothing', 'clothes', 'garment', 'jersey', 'activewear', 'underwear', 'shirt', 'dress', 'trouser', 'jean', 'skirt', 'jacket', 'hoodie', 'apparel', 'fashion', 'outfit', 'blouse', 'legging', 'uniform')) return 'clothing';
  if (has('handmade', 'hand-made', 'craft', 'candle', 'jewel', 'artwork', 'pottery', 'woven', 'knit', 'bead')) return 'local_handmade';
  if (has('clean', 'detergent', 'disinfect', 'sabs', 'bleach', 'sanitiz', 'hygiene', 'laundry', 'household')) return 'cleaning_products';
  return null;
}

const STEPS = [
  { key: 'basics',   label: 'Basics'   },
  { key: 'pricing',  label: 'Pricing'  },
  { key: 'delivery', label: 'Delivery' },
  { key: 'media',    label: 'Media'    },
  { key: 'variants', label: 'Variants' },
  { key: 'review',   label: 'Review'   },
];

// ── PAXI tier helper ─────────────────────────────────────────────────────────
function getPaxiTier(l, w, h, kg, foldable = false) {
  if (foldable) return { category: 'SMALL', price: 59, eta: '3–5 business days', desc: 'Foldable item — always SMALL', vol: null };
  const vol    = Number(l) * Number(w) * Number(h);
  const weight = Number(kg);
  if (!vol || !weight || isNaN(vol) || isNaN(weight) || vol <= 0 || weight <= 0) return null;
  if (vol <= 3_000 && weight <= 5)  return { category: 'SMALL', price: 59,  eta: '3–5 business days', desc: 'Up to 3 000 cm³ and 5 kg',  vol };
  if (vol <= 8_000 && weight <= 10) return { category: 'LARGE', price: 109, eta: '3–5 business days', desc: 'Up to 8 000 cm³ and 10 kg', vol };
  return null;
}

// ── Small tooltip component ───────────────────────────────────────────────────
const InfoTip = ({ text }) => {
  const [visible, setVisible] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 6, verticalAlign: 'middle' }}>
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onClick={() => setVisible(v => !v)}
        style={{
          width: 17, height: 17, borderRadius: '50%', border: '1.5px solid #fbbf24',
          background: '#fefce8', color: '#fbbf24', fontWeight: 700, fontSize: 11,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1, padding: 0, flexShrink: 0,
        }}
        aria-label="More info"
      >
        i
      </button>
      {visible && (
        <span style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
          background: '#78350f', color: '#fef9c3', fontSize: 12, lineHeight: 1.5,
          padding: '8px 12px', borderRadius: 8, width: 220, zIndex: 100,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)', pointerEvents: 'none',
          whiteSpace: 'normal', textAlign: 'left', fontWeight: 400,
        }}>
          {text}
          <span style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
            borderTop: '6px solid #78350f',
          }} />
        </span>
      )}
    </span>
  );
};

// ── Component ────────────────────────────────────────────────────────────────
const AgentCreateProduct = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading]               = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError]                   = useState(null);
  const [success, setSuccess]               = useState(null);
  const [currentStep, setCurrentStep]       = useState(0);

  const [assignedSMEs, setAssignedSMEs]               = useState([]);
  const [categories, setCategories]                   = useState([]);
  const [categoriesLoading, setCategoriesLoading]     = useState(false);
  const [selectedCategory, setSelectedCategory]       = useState(null);
  const [categoryAttributes, setCategoryAttributes]   = useState([]);
  const [loadingAttributes, setLoadingAttributes]     = useState(false);

  const [formData, setFormData] = useState({
    sme_id:              '',
    name:                '',
    description:         '',
    short_description:   '',
    category_ids:        [],
    commission_type:     '',
    base_price:          '',
    selling_price:       '',
    discount_percentage: '',
    sku:                 '',
    barcode:             '',
    stock_quantity:      '0',
    low_stock_threshold: '5',
    length_cm:           '',
    width_cm:            '',
    height_cm:           '',
    weight_kg:           '',
    is_foldable:         false,
    featured_image:      null,
    images:              [],
    attributes:          {},
    variants:            [],
  });

  const [imagePreviews, setImagePreviews]               = useState([]);
  const [featuredImagePreview, setFeaturedImagePreview] = useState(null);
  const [selectedCategories, setSelectedCategories]     = useState([]);
  const [categorySearchTerm, setCategorySearchTerm]     = useState('');
  const [attributeErrors, setAttributeErrors]           = useState({});
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showVariantModal, setShowVariantModal]         = useState(false);
  const [currentVariant, setCurrentVariant]             = useState(null);

  const categoryDropdownRef = useRef(null);
  const categoryInputRef    = useRef(null);

  // ── Derived values ────────────────────────────────────────────────────────
  const paxiTier = getPaxiTier(
    formData.length_cm, formData.width_cm, formData.height_cm, formData.weight_kg,
    formData.is_foldable,
  );

  const commissionRule = formData.commission_type ? CATEGORY_COMMISSION_RULES[formData.commission_type] : null;
  const commissionPct  = commissionRule ? commissionRule.commission : 0;

  const basePrice    = parseFloat(formData.base_price)          || 0;
  const discountPct  = parseFloat(formData.discount_percentage) || 0;
  const sellingPrice = formData.selling_price
    ? parseFloat(formData.selling_price)
    : basePrice > 0 && discountPct > 0
      ? Math.round(basePrice * (1 - discountPct / 100) * 100) / 100
      : basePrice;

  const commissionAmt = sellingPrice > 0 ? Math.round(sellingPrice * commissionPct / 100 * 100) / 100 : 0;
  const netPayout     = sellingPrice > 0 ? Math.max(0, Math.round((sellingPrice - commissionAmt) * 100) / 100) : 0;

  const progressPct = Math.round(((currentStep + 1) / STEPS.length) * 100);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => { loadInitialData(); }, []);

  useEffect(() => {
    if (selectedCategory) loadCategoryAttributes(selectedCategory);
    else setCategoryAttributes([]);
  }, [selectedCategory]);

  // Auto-set foldable whenever commission_type changes
  useEffect(() => {
    if (commissionRule) {
      setFormData(p => ({ ...p, is_foldable: commissionRule.foldable }));
    }
  }, [formData.commission_type]);

  useEffect(() => {
    const handle = (e) => {
      if (
        categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target) &&
        categoryInputRef.current    && !categoryInputRef.current.contains(e.target)
      ) setShowCategoryDropdown(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  useEffect(() => {
    if (basePrice > 0 && discountPct > 0 && !formData.selling_price) {
      setFormData(p => ({ ...p, selling_price: (Math.round(basePrice * (1 - discountPct / 100) * 100) / 100).toString() }));
    }
  }, [formData.base_price, formData.discount_percentage]);

  // ── Loaders ───────────────────────────────────────────────────────────────
  const loadInitialData = async () => {
    try {
      setInitialLoading(true);
      setError(null);
      const smes = await agentService.getAssignedSMEs();
      setAssignedSMEs(smes);
      await loadCategories();
      if (smes.length === 0) setError({ title: 'No SMEs Assigned', message: 'You need to be assigned to at least one SME before you can add products.' });
    } catch (err) {
      setError({ title: 'Failed to Load Data', message: err.message || 'Please try again later' });
    } finally {
      setInitialLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      setCategoriesLoading(true);
      let data = [];
      try { data = await agentService.getCategories(); }    catch { /**/ }
      if (!data?.length) {
        try { data = await agentService.getAllCategories(); } catch { /**/ }
      }
      if (data?.length) {
        const isFlat = data[0]?.full_path !== undefined;
        if (isFlat) {
          setCategories(data.map(c => ({ ...c, full_path: c.full_path || c.name })));
        } else {
          const flatten = (cats, parent = '') => {
            let out = [];
            cats.forEach(c => {
              const fp = parent ? `${parent} > ${c.name}` : c.name;
              out.push({ ...c, full_path: fp });
              if (c.children?.length) out = [...out, ...flatten(c.children, fp)];
            });
            return out;
          };
          setCategories(flatten(data));
        }
      }
    } catch { /**/ } finally { setCategoriesLoading(false); }
  };

  const loadCategoryAttributes = async (categoryId) => {
    try {
      setLoadingAttributes(true);
      let attrs = [];
      try { attrs = await agentService.getCategoryAttributes(categoryId); } catch { /**/ }
      setCategoryAttributes(attrs);
      const init = { ...formData.attributes };
      attrs.forEach(a => {
        if (!init[a.id]) init[a.id] = a.attribute_type === 'boolean' ? false : a.attribute_type === 'multiselect' ? [] : '';
      });
      setFormData(p => ({ ...p, attributes: init }));
      setAttributeErrors({});
    } catch { /**/ } finally { setLoadingAttributes(false); }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  // FIX: cast sme_id to integer at point of entry so it's never a string
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(p => ({
      ...p,
      [name]: type === 'checkbox'
        ? checked
        : type === 'number'
          ? (value === '' ? '' : parseFloat(value))
          : name === 'sme_id'
            ? (value === '' ? '' : parseInt(value, 10))
            : value,
    }));
  };

  // When a product category is selected, auto-infer commission_type from its name
  const handleCategorySelect = (cat) => {
    if (!selectedCategories.find(c => c.id === cat.id)) {
      const next = [...selectedCategories, cat];
      setSelectedCategories(next);

      const inferred = inferCommissionType(cat.name, cat.full_path || '');

      setFormData(p => ({
        ...p,
        category_ids: next.map(c => c.id),
        ...(inferred && next.length === 1 ? { commission_type: inferred } : {}),
        ...(inferred && !p.commission_type ? { commission_type: inferred } : {}),
      }));

      if (!selectedCategory) setSelectedCategory(cat.id);
    }
    setCategorySearchTerm('');
    setShowCategoryDropdown(false);
  };

  const handleCategoryRemove = (id) => {
    const next = selectedCategories.filter(c => c.id !== id);
    setSelectedCategories(next);

    const newPrimary = next[0];
    const inferred = newPrimary ? inferCommissionType(newPrimary.name, newPrimary.full_path || '') : null;
    setFormData(p => ({
      ...p,
      category_ids: next.map(c => c.id),
      commission_type: inferred || '',
    }));
    if (selectedCategory === id) setSelectedCategory(next[0]?.id || null);
  };

  // Re-infer when primary category changes
  const handlePrimaryCategoryChange = (categoryId) => {
    const numId = parseInt(categoryId);
    setSelectedCategory(numId);
    const cat = selectedCategories.find(c => c.id === numId);
    if (cat) {
      const inferred = inferCommissionType(cat.name, cat.full_path || '');
      if (inferred) setFormData(p => ({ ...p, commission_type: inferred }));
    }
  };

  const handleAttributeChange = (attrId, value) => {
    setFormData(p => ({ ...p, attributes: { ...p.attributes, [attrId]: value } }));
    if (attributeErrors[attrId]) setAttributeErrors(p => { const e = { ...p }; delete e[attrId]; return e; });
  };

  const handleFeaturedImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFormData(p => ({ ...p, featured_image: file }));
    const r = new FileReader();
    r.onloadend = () => setFeaturedImagePreview(r.result);
    r.readAsDataURL(file);
  };

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setFormData(p => ({ ...p, images: [...p.images, ...files] }));
    files.forEach(f => {
      const r = new FileReader();
      r.onloadend = () => setImagePreviews(p => [...p, r.result]);
      r.readAsDataURL(f);
    });
  };

  const removeImage = (i) => {
    setFormData(p => ({ ...p, images: p.images.filter((_, idx) => idx !== i) }));
    setImagePreviews(p => p.filter((_, idx) => idx !== i));
  };

  const handleAddVariant    = () => { setCurrentVariant({ name: '', sku: '', price_adjustment: 0, stock_quantity: 0, is_active: true }); setShowVariantModal(true); };
  const handleEditVariant   = (i) => { setCurrentVariant({ ...formData.variants[i], index: i }); setShowVariantModal(true); };
  const handleDeleteVariant = (i) => setFormData(p => ({ ...p, variants: p.variants.filter((_, idx) => idx !== i) }));
  const handleSaveVariant = () => {
    if (!currentVariant?.name?.trim()) { alert('Variant name is required'); return; }
    setFormData(p => {
      const variants = [...p.variants];
      if (currentVariant.index !== undefined) { const { index, ...v } = currentVariant; variants[index] = v; }
      else variants.push(currentVariant);
      return { ...p, variants };
    });
    setShowVariantModal(false);
    setCurrentVariant(null);
  };

  const filteredCategories = categories.filter(c =>
    c.name?.toLowerCase().includes(categorySearchTerm.toLowerCase()) ||
    c.full_path?.toLowerCase().includes(categorySearchTerm.toLowerCase())
  );

  const validateStep = (step) => {
    if (step === 0) {
      if (!formData.sme_id)                    { alert('Please select an SME'); return false; }
      if (!formData.name)                      { alert('Product name is required'); return false; }
      if (!formData.description)               { alert('Product description is required'); return false; }
      if (!selectedCategories.length)          { alert('Please select at least one category'); return false; }
      if (!formData.commission_type) {
        alert('We could not automatically determine a commission category for your product. Please ensure your product category is specific enough (e.g. "Clothing", "Shoes", "Hair Products").'); return false;
      }
    }
    if (step === 1) {
      if (!formData.base_price || parseFloat(formData.base_price) <= 0) { alert('Please enter a valid base price'); return false; }
    }
    if (step === 2 && !formData.is_foldable) {
      const missing = ['length_cm','width_cm','height_cm','weight_kg'].filter(k => !formData[k] || Number(formData[k]) <= 0);
      if (missing.length) { alert(`Please fill in: ${missing.map(k => k.replace('_cm','').replace('_kg','')).join(', ')}`); return false; }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep(s => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleBack = () => { setCurrentStep(s => Math.max(s - 1, 0)); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const handleSubmit = async () => {
    setLoading(true); setError(null);
    try {
      // FIX: ensure sme_id is an integer, and send null (not delete) for
      // dimensions when foldable so the API doesn't reject missing fields
      const submitData = {
        ...formData,
        sme_id:              parseInt(formData.sme_id, 10),
        base_price:          parseFloat(formData.base_price),
        selling_price:       sellingPrice || null,
        discount_percentage: parseFloat(formData.discount_percentage || 0),
        commission_rate:     commissionPct,
        commission_type:     formData.commission_type,
        stock_quantity:      parseInt(formData.stock_quantity || 0, 10),
        low_stock_threshold: parseInt(formData.low_stock_threshold || 5, 10),
        attributes:          formData.attributes || {},
        variants:            formData.variants || [],
      };
      if (!formData.is_foldable) {
        ['length_cm','width_cm','height_cm','weight_kg'].forEach(k => {
          submitData[k] = parseFloat(formData[k]);
        });
      } else {
        // Send null instead of deleting — Django REST serializers handle null
        // for optional numeric fields; missing keys can trigger validation errors
        ['length_cm','width_cm','height_cm','weight_kg'].forEach(k => {
          submitData[k] = null;
        });
      }
      const response = await agentService.createProduct(submitData);
      const isActive = response.status === 'active' || response.is_active === true;
      setSuccess({ title: isActive ? 'Product Live!' : 'Product Submitted!', message: response.message || (isActive ? 'Your product is now live.' : 'Pending admin approval.'), isActive });
      setTimeout(() => navigate('/agent/products'), 3500);
    } catch (err) {
      setError({ title: 'Failed to create product', message: err.message || err.detail || 'Please check your input and try again.' });
    } finally { setLoading(false); }
  };

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (initialLoading) return (
    <div className={styles.loadingPage}>
      <div className={styles.spinner} />
      Loading…
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');`}</style>

      {/* Top bar */}
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <div className={styles.brandDot}>A</div>
          <span className={styles.brandText}>Agent Hub</span>
        </div>
        <div className={styles.breadcrumb}>
          <span>Products</span>
          <span>›</span>
          <strong>Add New Product</strong>
        </div>
        <button onClick={() => navigate('/agent/products')} className={styles.btnSecondary} style={{ fontSize: 13 }}>
          ✕ Cancel
        </button>
      </header>

      {/* Banners */}
      {success && (
        <div className={styles.bannerSuccess}>
          <span style={{ fontSize: 26 }}>{success.isActive ? '🎉' : '✅'}</span>
          <div>
            <p className={styles.bannerTitle}>{success.title}</p>
            <p className={styles.bannerMessage}>{success.message} — redirecting…</p>
          </div>
        </div>
      )}
      {error && (
        <div className={styles.bannerError}>
          <span>❌</span>
          <div style={{ flex: 1 }}>
            <p className={styles.bannerTitle}>{error.title}</p>
            <p className={styles.bannerMessage}>{error.message}</p>
          </div>
          <button className={styles.bannerClose} onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className={styles.layout}>
        {/* Sidebar / step nav */}
        <nav className={styles.sidebar}>
          <div className={styles.sidebarLabel}>Steps</div>
          {STEPS.map((step, i) => {
            const active = i === currentStep;
            const done   = i < currentStep;
            return (
              <div
                key={step.key}
                className={`${styles.stepItem} ${active ? styles.active : ''} ${done ? styles.done : ''}`}
                onClick={() => (done || active) && setCurrentStep(i)}
              >
                <div className={styles.stepNum}>{done ? '✓' : i + 1}</div>
                <span className={styles.stepLabel}>{step.label}</span>
              </div>
            );
          })}

          {/* Live commission preview */}
          {commissionRule && sellingPrice > 0 && (
            <div className={styles.sidebarCommission}>
              <div className={styles.sidebarCommissionLabel}>Commission</div>
              <div className={styles.sidebarCommissionAmount}>{commissionPct}%</div>
              <div className={styles.sidebarCommissionType}>
                {commissionRule.label}
                <span style={{ fontSize: 10, display: 'block', opacity: 0.7 }}>of selling price</span>
              </div>
              <div className={styles.sidebarCommissionPayout}>
                = R{commissionAmt.toFixed(2)} deducted
              </div>
              <div className={styles.sidebarCommissionPayout} style={{ marginTop: 4 }}>
                Payout: <strong>R{netPayout.toFixed(2)}</strong>
              </div>
            </div>
          )}
        </nav>

        {/* Main content */}
        <main className={styles.main}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
          </div>

          {/* ── Step 0: Basics ─────────────────────────────────────────── */}
          {currentStep === 0 && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Product Basics</h2>
                  <p className={styles.cardSubtitle}>Tell customers what you're selling</p>
                </div>
              </div>

              {/* SME selector — agent-specific */}
              <div className={styles.formGroup}>
                <label className={styles.label}>SME <span className={styles.req}>*</span></label>
                <select className={styles.select} name="sme_id" value={formData.sme_id} onChange={handleInputChange}>
                  <option value="">— Select an SME —</option>
                  {assignedSMEs.map(s => (
                    <option key={s.id} value={s.id}>{s.business_name} — {s.business_type || 'General'}</option>
                  ))}
                </select>
                {assignedSMEs.length === 0 && (
                  <span className={styles.helper} style={{ color: '#dc2626' }}>No SMEs assigned. Please contact an administrator.</span>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Product Name <span className={styles.req}>*</span></label>
                <input className={styles.input} type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g., Men's Cotton T-Shirt — Black" />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Short Description</label>
                <input className={styles.input} type="text" name="short_description" value={formData.short_description} onChange={handleInputChange} placeholder="One-liner shown in search results" maxLength={500} />
                <span className={styles.helper}>{formData.short_description?.length || 0} / 500 characters</span>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Full Description <span className={styles.req}>*</span></label>
                <textarea className={styles.textarea} name="description" value={formData.description} onChange={handleInputChange} placeholder="Detailed description, materials, care instructions, sizes…" />
              </div>

              {/* Category selector */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Categories <span className={styles.req}>*</span></label>
                <div className={styles.catTagsWrap}>
                  {selectedCategories.map(c => (
                    <span key={c.id} className={styles.catTag}>
                      {c.full_path || c.name}
                      <button type="button" className={styles.catTagRemove} onClick={() => handleCategoryRemove(c.id)}>×</button>
                    </span>
                  ))}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={categoryInputRef}
                    className={styles.input}
                    type="text"
                    placeholder={categoriesLoading ? 'Loading categories…' : 'Search and add categories…'}
                    value={categorySearchTerm}
                    onChange={e => { setCategorySearchTerm(e.target.value); setShowCategoryDropdown(true); }}
                    onFocus={() => setShowCategoryDropdown(true)}
                    disabled={categoriesLoading}
                  />
                  {showCategoryDropdown && !categoriesLoading && (
                    <div ref={categoryDropdownRef} className={styles.catDropdown}>
                      {(categorySearchTerm === '' ? categories : filteredCategories).map(c => (
                        <button key={c.id} type="button" className={styles.catOption} onClick={() => handleCategorySelect(c)}>
                          {c.full_path || c.name}
                        </button>
                      ))}
                      {categorySearchTerm !== '' && !filteredCategories.length && (
                        <div className={styles.catEmpty}>No categories matching "{categorySearchTerm}"</div>
                      )}
                    </div>
                  )}
                </div>
                {selectedCategories.length > 1 && (
                  <div style={{ marginTop: 12 }}>
                    <label className={styles.label} style={{ fontSize: 12 }}>Primary category (for attributes & commission)</label>
                    <select className={styles.select} value={selectedCategory || ''} onChange={e => handlePrimaryCategoryChange(e.target.value)}>
                      {selectedCategories.map(c => <option key={c.id} value={c.id}>{c.full_path || c.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Auto-detected commission notice */}
              {formData.commission_type && commissionRule && (
                <div style={{
                  marginTop: 4, marginBottom: 16,
                  background: 'linear-gradient(135deg, #fefce8 0%, #fefce8 100%)',
                  border: '1.5px solid #fbbf24',
                  borderRadius: 12, padding: '14px 18px',
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>🏷️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e', marginBottom: 2 }}>
                      Commission auto-detected from your category
                    </div>
                    <div style={{ fontSize: 13, color: '#374151' }}>
                      Your product falls under <strong>{commissionRule.label}</strong>. The platform will deduct{' '}
                      <strong style={{ color: '#fbbf24' }}>{commissionPct}% of each sale</strong> as commission.
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                      {commissionRule.desc}
                      {commissionRule.foldable && <span style={{ color: '#fbbf24', marginLeft: 8 }}>📦 Ships as foldable parcel</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Warning if no commission could be inferred */}
              {selectedCategories.length > 0 && !formData.commission_type && (
                <div style={{
                  marginTop: 4, marginBottom: 16,
                  background: '#fffbeb', border: '1.5px solid #fcd34d',
                  borderRadius: 12, padding: '14px 18px',
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>⚠️</span>
                  <div style={{ fontSize: 13, color: '#92400e' }}>
                    <strong>Could not determine commission category</strong> from your selected categories.
                    Please choose a more specific category (e.g. "Clothing", "Shoes", "Hair Products", "Fragrances", "Handmade Crafts", or "Cleaning Products") to continue.
                  </div>
                </div>
              )}

              {/* Attributes */}
              {selectedCategories.length > 0 && selectedCategory && (
                loadingAttributes ? (
                  <div className={styles.helper}>Loading attributes…</div>
                ) : categoryAttributes.length > 0 ? (
                  <>
                    <span className={styles.sectionLabel}>Product Attributes</span>
                    {categoryAttributes.map(attr => (
                      <div key={attr.id} className={styles.formGroup}>
                        <label className={styles.label}>
                          {attr.name}{attr.required && <span className={styles.req}>*</span>}
                          {attr.unit && <span style={{ fontWeight: 400, color: '#9ca3af' }}> ({attr.unit})</span>}
                        </label>
                        {attributeErrors[attr.id] && <span className={styles.fieldError}>{attributeErrors[attr.id]}</span>}
                        {attr.attribute_type === 'text'        && <input className={styles.input} type="text" value={formData.attributes[attr.id] || ''} onChange={e => handleAttributeChange(attr.id, e.target.value)} placeholder={`Enter ${attr.name.toLowerCase()}`} />}
                        {attr.attribute_type === 'number'      && <input className={styles.input} type="number" value={formData.attributes[attr.id] || ''} onChange={e => handleAttributeChange(attr.id, e.target.value)} step="0.01" />}
                        {attr.attribute_type === 'boolean'     && <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}><input type="checkbox" checked={formData.attributes[attr.id] || false} onChange={e => handleAttributeChange(attr.id, e.target.checked)} /><span>Yes</span></label>}
                        {attr.attribute_type === 'select'      && attr.options && <select className={styles.select} value={formData.attributes[attr.id] || ''} onChange={e => handleAttributeChange(attr.id, e.target.value)}><option value="">— Select {attr.name} —</option>{attr.options.map(o => <option key={o} value={o}>{o}</option>)}</select>}
                        {attr.attribute_type === 'multiselect' && attr.options && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{attr.options.map(o => <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={(formData.attributes[attr.id] || []).includes(o)} onChange={e => { const cur = formData.attributes[attr.id] || []; handleAttributeChange(attr.id, e.target.checked ? [...cur, o] : cur.filter(v => v !== o)); }} /><span>{o}</span></label>)}</div>}
                        {attr.attribute_type === 'color'       && <div style={{ display: 'flex', gap: 8 }}><input type="color" value={formData.attributes[attr.id] || '#000000'} onChange={e => handleAttributeChange(attr.id, e.target.value)} /><input className={styles.input} type="text" value={formData.attributes[attr.id] || ''} onChange={e => handleAttributeChange(attr.id, e.target.value)} placeholder="Color name" /></div>}
                        {attr.attribute_type === 'size'        && <select className={styles.select} value={formData.attributes[attr.id] || ''} onChange={e => handleAttributeChange(attr.id, e.target.value)}><option value="">— Select Size —</option>{['XS','S','M','L','XL','XXL','XXXL'].map(s => <option key={s} value={s}>{s}</option>)}</select>}
                      </div>
                    ))}
                  </>
                ) : null
              )}
            </div>
          )}

          {/* ── Step 1: Pricing & Stock ─────────────────────────────────── */}
          {currentStep === 1 && (
            <>
              {/* Commission — READ-ONLY, derived from category */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.cardTitle}>Commission</h2>
                    <p className={styles.cardSubtitle}>Automatically determined from the product category — this cannot be changed</p>
                  </div>
                </div>

                {commissionRule ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 20,
                    background: 'linear-gradient(135deg, #fefce8 0%, #fefce8 100%)',
                    border: '2px solid #fbbf24', borderRadius: 14,
                    padding: '20px 24px',
                  }}>
                    <div style={{
                      flexShrink: 0, width: 72, height: 72, borderRadius: 16,
                      background: '#fbbf24', color: '#78350f',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, lineHeight: 1,
                    }}>
                      <span style={{ fontSize: 26 }}>{commissionPct}%</span>
                      <span style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>commission</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#78350f', marginBottom: 4 }}>
                        {commissionRule.label}
                      </div>
                      <div style={{ fontSize: 13, color: '#4b5563', marginBottom: 4 }}>
                        {commissionRule.desc}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {commissionPct}% of the selling price is deducted per sale as a platform fee.
                        {commissionRule.foldable && (
                          <span style={{ display: 'block', marginTop: 4, color: '#fbbf24', fontWeight: 600 }}>
                            📦 This category ships as a foldable (SMALL) parcel.
                          </span>
                        )}
                      </div>
                    </div>   
                  </div>
                ) : (
                  <div style={{
                    background: '#fef3c7', border: '1.5px solid #fbbf24',
                    borderRadius: 12, padding: '16px 20px', fontSize: 13, color: '#92400e',
                  }}>
                    ⚠️ No commission category detected. Go back to Basics and select a recognised product category.
                  </div>
                )}
              </div>

              {/* Pricing */}
              <div className={styles.card}>
                <div className={styles.cardHeader}><h2 className={styles.cardTitle}>Pricing</h2></div>
                <div className={styles.row2}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Base Price (R) <span className={styles.req}>*</span>
                      <InfoTip text="The original price of the product before any discounts. This is what the SME considers the full value of the item." />
                    </label>
                    <input className={styles.input} type="number" name="base_price" value={formData.base_price} onChange={handleInputChange} placeholder="0.00" step="0.01" min="0" />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Discount (%)</label>
                    <input className={styles.input} type="number" name="discount_percentage" value={formData.discount_percentage} onChange={handleInputChange} placeholder="0" step="0.1" min="0" max="100" />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Selling Price (R)
                    <InfoTip text="The actual price customers will pay. If you enter a discount above, this is auto-calculated. Commission is calculated as a percentage of this selling price." />
                  </label>
                  <input className={styles.input} type="number" name="selling_price" value={formData.selling_price} onChange={handleInputChange} placeholder="Auto-calculated from discount" step="0.01" min="0" />
                  <span className={styles.helper}>Leave blank to auto-calculate from discount. Commission is deducted from this amount.</span>
                </div>

                {sellingPrice > 0 && (
                  <div className={styles.priceSummary}>
                    <div className={styles.priceLine}><span>Selling price</span><span>R{sellingPrice.toFixed(2)}</span></div>
                    <div className={styles.priceLine}>
                      <span>Commission ({commissionPct}% of R{sellingPrice.toFixed(2)})</span>
                      <span style={{ color: '#dc2626' }}>− R{commissionAmt.toFixed(2)}</span>
                    </div>
                    <div className={styles.priceLineTotal}>
                      <span>SME payout</span>
                      <span style={{ color: '#16a34a' }}>R{netPayout.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Inventory */}
              <div className={styles.card}>
                <div className={styles.cardHeader}><h2 className={styles.cardTitle}>Inventory</h2></div>
                <div className={styles.row2}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>SKU</label>
                    <input className={styles.input} type="text" name="sku" value={formData.sku} onChange={handleInputChange} placeholder="e.g., TSHIRT-BLK-M" />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Barcode (UPC/EAN)</label>
                    <input className={styles.input} type="text" name="barcode" value={formData.barcode} onChange={handleInputChange} placeholder="Optional" />
                  </div>
                </div>
                <div className={styles.row2}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Stock Quantity</label>
                    <input className={styles.input} type="number" name="stock_quantity" value={formData.stock_quantity} onChange={handleInputChange} placeholder="0" min="0" />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Low Stock Alert</label>
                    <input className={styles.input} type="number" name="low_stock_threshold" value={formData.low_stock_threshold} onChange={handleInputChange} placeholder="5" min="1" />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Step 2: Delivery ────────────────────────────────────────── */}
          {currentStep === 2 && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Delivery & Packaging</h2>
                  <p className={styles.cardSubtitle}>Measure the product as packaged — determines the PAXI tier</p>
                </div>
              </div>

              {paxiTier ? (
                <div className={`${styles.paxiPreview} ${paxiTier.category === 'SMALL' ? styles.paxiSmall : styles.paxiLarge}`}>
                  <span style={{ fontSize: 32 }}>📦</span>
                  <div>
                    <div className={styles.paxiTierName}>PAXI {paxiTier.category} Parcel</div>
                    <div className={styles.paxiTierDesc}>{paxiTier.desc} · Fee: <strong>R{paxiTier.price}</strong> · {paxiTier.eta}</div>
                  </div>
                </div>
              ) : (
                <div className={styles.paxiEmpty}>📐 Fill in dimensions below to see the PAXI tier.</div>
              )}

              <div className={styles.foldablePanel}>
                <label className={styles.foldableLabel}>
                  <input
                    type="checkbox"
                    name="is_foldable"
                    checked={formData.is_foldable}
                    onChange={handleInputChange}
                    style={{ marginTop: 3 }}
                  />
                  <div>
                    <div className={styles.foldableTitle}>This item ships as a foldable parcel</div>
                    <div className={styles.foldableDesc}>
                      Clothing, hair products, and fabric items fold flat — always SMALL regardless of unfolded dimensions.
                      {commissionRule?.foldable && (
                        <span style={{ display: 'block', color: '#fbbf24', marginTop: 4 }}>
                          ✓ Auto-ticked because the selected category ({commissionRule.label}) is foldable.
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              </div>

              {!formData.is_foldable && (
                <>
                  <span className={styles.sectionLabel}>
                    Parcel Dimensions <span className={styles.req}>*</span>
                  </span>
                  <div className={styles.row2}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Length <span className={styles.req}>*</span> <span style={{ fontWeight: 400, color: '#9ca3af' }}>(cm)</span></label>
                      <input className={styles.input} type="number" name="length_cm" value={formData.length_cm} onChange={handleInputChange} placeholder="e.g., 30" min="1" step="1" />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Width <span className={styles.req}>*</span> <span style={{ fontWeight: 400, color: '#9ca3af' }}>(cm)</span></label>
                      <input className={styles.input} type="number" name="width_cm" value={formData.width_cm} onChange={handleInputChange} placeholder="e.g., 20" min="1" step="1" />
                    </div>
                  </div>
                  <div className={styles.row2}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Height <span className={styles.req}>*</span> <span style={{ fontWeight: 400, color: '#9ca3af' }}>(cm)</span></label>
                      <input className={styles.input} type="number" name="height_cm" value={formData.height_cm} onChange={handleInputChange} placeholder="e.g., 10" min="1" step="1" />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Weight <span className={styles.req}>*</span> <span style={{ fontWeight: 400, color: '#9ca3af' }}>(kg)</span></label>
                      <input className={styles.input} type="number" name="weight_kg" value={formData.weight_kg} onChange={handleInputChange} placeholder="e.g., 0.5" min="0.01" step="0.01" />
                    </div>
                  </div>
                </>
              )}

              <span className={styles.sectionLabel}>PAXI Tier Reference</span>
              <div className={styles.tableWrap}>
                <table className={styles.refTable}>
                  <thead>
                    <tr><th>Tier</th><th>Max Volume</th><th>Max Weight</th><th>Fee</th><th>ETA</th></tr>
                  </thead>
                  <tbody>
                    <tr style={{ background: paxiTier?.category === 'SMALL' ? '#d1fae5' : '#fff' }}>
                      <td className={styles.refSmall}>SMALL</td>
                      <td>3 000 cm³</td>
                      <td>5 kg</td>
                      <td>R59</td>
                      <td>3–5 days</td>
                    </tr>
                    <tr style={{ background: paxiTier?.category === 'LARGE' ? '#fee2e2' : '#fff' }}>
                      <td className={styles.refLarge}>LARGE</td>
                      <td>8 000 cm³</td>
                      <td>10 kg</td>
                      <td>R109</td>
                      <td>3–5 days</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <span className={styles.helper} style={{ marginTop: 8, display: 'block' }}>Foldable items always ship as SMALL parcels.</span>
            </div>
          )}

          {/* ── Step 3: Media ───────────────────────────────────────────── */}
          {currentStep === 3 && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Product Images</h2>
                  <p className={styles.cardSubtitle}>High quality images significantly increase conversion rates</p>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Featured Image</label>
                {featuredImagePreview ? (
                  <div className={styles.featuredWrap}>
                    <img src={featuredImagePreview} alt="Featured" className={styles.featuredImg} />
                    <button type="button" className={styles.featuredRemove} onClick={() => { setFormData(p => ({ ...p, featured_image: null })); setFeaturedImagePreview(null); }}>×</button>
                  </div>
                ) : (
                  <label htmlFor="agent_featured_image" className={styles.imgUpload}>
                    <div className={styles.imgUploadTitle}>Click to upload featured image</div>
                    <div className={styles.imgUploadHint}>Recommended: 1200×1200 px · JPG or PNG</div>
                    <input type="file" id="agent_featured_image" accept="image/*" onChange={handleFeaturedImageChange} style={{ display: 'none' }} />
                  </label>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Additional Images</label>
                <div className={styles.imgGrid}>
                  {imagePreviews.map((preview, i) => (
                    <div key={i} className={styles.imgThumb}>
                      <img src={preview} alt={`img-${i}`} />
                      <button type="button" className={styles.imgRemove} onClick={() => removeImage(i)}>×</button>
                    </div>
                  ))}
                  {imagePreviews.length < 10 && (
                    <label htmlFor="agent_additional_images" className={styles.imgAddSlot}>
                      <span>Add image</span>
                      <input type="file" id="agent_additional_images" accept="image/*" multiple onChange={handleImagesChange} style={{ display: 'none' }} />
                    </label>
                  )}
                </div>
                <span className={styles.helper}>Up to 10 images. {10 - imagePreviews.length} slots remaining.</span>
              </div>
            </div>
          )}

          {/* ── Step 4: Variants ────────────────────────────────────────── */}
          {currentStep === 4 && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Product Variants</h2>
                  <p className={styles.cardSubtitle}>Add variants for different sizes, colours, or configurations</p>
                </div>
                <button type="button" onClick={handleAddVariant} className={styles.btnPrimary} style={{ fontSize: 13 }}>+ Add Variant</button>
              </div>

              {formData.variants.length === 0 ? (
                <div className={styles.variantEmpty}>
                  <p className={styles.variantEmptyTitle}>No variants yet</p>
                  <p style={{ fontSize: 13 }}>Optional — skip if your product has no variations.</p>
                </div>
              ) : (
                <div className={styles.variantTableWrap}>
                  <table className={styles.variantTable}>
                    <thead>
                      <tr><th>Name</th><th>SKU</th><th>Price adj.</th><th>Stock</th><th>Status</th><th></th></tr>
                    </thead>
                    <tbody>
                      {formData.variants.map((v, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 500 }}>{v.name}</td>
                          <td style={{ color: '#6b7280' }}>{v.sku || '—'}</td>
                          <td style={{ color: v.price_adjustment > 0 ? '#16a34a' : v.price_adjustment < 0 ? '#dc2626' : '#6b7280' }}>
                            {v.price_adjustment > 0 ? '+' : ''}R{parseFloat(v.price_adjustment || 0).toLocaleString()}
                          </td>
                          <td>{v.stock_quantity || 0}</td>
                          <td><span className={v.is_active ? styles.badgeGreen : styles.badgeGray}>{v.is_active ? 'Active' : 'Inactive'}</span></td>
                          <td style={{ display: 'flex', gap: 6 }}>
                            <button type="button" className={styles.btnSecondary} style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => handleEditVariant(i)}>Edit</button>
                            <button type="button" className={styles.btnDanger} onClick={() => handleDeleteVariant(i)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Step 5: Review & Submit ─────────────────────────────────── */}
          {currentStep === 5 && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Review Your Listing</h2>
                  <p className={styles.cardSubtitle}>Double-check everything before submitting</p>
                </div>
              </div>

              <span className={styles.sectionLabel}>Product Info</span>
              {[
                ['SME',              assignedSMEs.find(s => String(s.id) === String(formData.sme_id))?.business_name || '—'],
                ['Name',             formData.name || '—'],
                ['Short description',formData.short_description || '—'],
                ['Categories',       selectedCategories.map(c => c.full_path || c.name).join(', ') || '—'],
              ].map(([k, v]) => (
                <div key={k} className={styles.reviewRow}><span className={styles.reviewKey}>{k}</span><span className={styles.reviewVal}>{v}</span></div>
              ))}

              <span className={styles.sectionLabel} style={{ marginTop: 20 }}>Pricing</span>
              {[
                ['Base price',      `R${parseFloat(formData.base_price || 0).toFixed(2)}`],
                ['Selling price',   `R${sellingPrice.toFixed(2)}`],
                ['Discount',        formData.discount_percentage ? `${formData.discount_percentage}%` : 'None'],
                ['Commission type', commissionRule?.label || '—'],
                ['Commission rate', `${commissionPct}% of selling price`],
                ['Commission (R)',  `R${commissionAmt.toFixed(2)}`],
                ['SME payout',      `R${netPayout.toFixed(2)}`],
              ].map(([k, v]) => (
                <div key={k} className={styles.reviewRow}>
                  <span className={styles.reviewKey}>{k}</span>
                  <span className={`${styles.reviewVal} ${k === 'SME payout' ? styles.reviewValGreen : ''}`}>{v}</span>
                </div>
              ))}

              <span className={styles.sectionLabel} style={{ marginTop: 20 }}>Delivery</span>
              {[
                ['PAXI tier',  paxiTier ? `${paxiTier.category} (R${paxiTier.price})` : 'Not determined'],
                ['Foldable',   formData.is_foldable ? 'Yes — always ships SMALL' : 'No'],
                ['Dimensions', !formData.is_foldable && formData.length_cm ? `${formData.length_cm} × ${formData.width_cm} × ${formData.height_cm} cm, ${formData.weight_kg} kg` : '—'],
              ].map(([k, v]) => (
                <div key={k} className={styles.reviewRow}><span className={styles.reviewKey}>{k}</span><span className={styles.reviewVal}>{v}</span></div>
              ))}

              <span className={styles.sectionLabel} style={{ marginTop: 20 }}>Inventory</span>
              {[
                ['SKU',             formData.sku || '—'],
                ['Barcode',         formData.barcode || '—'],
                ['Stock',           formData.stock_quantity],
                ['Low stock alert', formData.low_stock_threshold],
                ['Variants',        formData.variants.length ? `${formData.variants.length} variant(s)` : 'None'],
              ].map(([k, v]) => (
                <div key={k} className={styles.reviewRow}><span className={styles.reviewKey}>{k}</span><span className={styles.reviewVal}>{v}</span></div>
              ))}
            </div>
          )}

          {/* Nav buttons */}
          <div className={styles.navButtons}>
            <button type="button" className={styles.btnSecondary} onClick={currentStep === 0 ? () => navigate('/agent/products') : handleBack}>
              {currentStep === 0 ? '✕ Cancel' : '← Back'}
            </button>
            {currentStep < STEPS.length - 1 ? (
              <button type="button" className={styles.btnPrimary} onClick={handleNext}>Continue →</button>
            ) : (
              <button type="button" className={styles.btnSubmit} onClick={handleSubmit} disabled={loading}>
                {loading ? '⏳ Submitting…' : ' Submit Product'}
              </button>
            )}
          </div>
        </main>
      </div>

      {/* ── Variant modal ─────────────────────────────────────────────────── */}
      {showVariantModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{currentVariant?.index !== undefined ? 'Edit Variant' : 'Add Variant'}</h3>
              <button className={styles.modalClose} onClick={() => setShowVariantModal(false)}>×</button>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Variant Name <span className={styles.req}>*</span></label>
              <input className={styles.input} type="text" value={currentVariant?.name || ''} onChange={e => setCurrentVariant({ ...currentVariant, name: e.target.value })} placeholder="e.g., Small, Yellow, 500ml" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>SKU</label>
              <input className={styles.input} type="text" value={currentVariant?.sku || ''} onChange={e => setCurrentVariant({ ...currentVariant, sku: e.target.value })} placeholder="Unique SKU for this variant" />
            </div>
            <div className={styles.row2}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Price Adjustment (R)</label>
                <input className={styles.input} type="number" value={currentVariant?.price_adjustment || 0} onChange={e => setCurrentVariant({ ...currentVariant, price_adjustment: parseFloat(e.target.value) || 0 })} step="0.01" />
                <span className={styles.helper}>+ or − from base price</span>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Stock Quantity</label>
                <input className={styles.input} type="number" value={currentVariant?.stock_quantity || 0} onChange={e => setCurrentVariant({ ...currentVariant, stock_quantity: parseInt(e.target.value) || 0 })} min="0" />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, marginBottom: 20 }}>
              <input type="checkbox" checked={currentVariant?.is_active || false} onChange={e => setCurrentVariant({ ...currentVariant, is_active: e.target.checked })} />
              <span>Active</span>
            </label>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setShowVariantModal(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleSaveVariant}>Save Variant</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentCreateProduct;