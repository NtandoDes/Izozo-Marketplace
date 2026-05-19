/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import agentService from '../../services/agentService';
import styles from './AgentCreateProduct.module.css'; // reuse SME styles

// ── Commission rules (ALL FLAT RATE) ────────────────────────────────────────
const CATEGORY_COMMISSION_RULES = {
  small_items:     { label: 'Small Items',         desc: 'Clothing, accessories, jewellery',   commission: 5,  urgencyFactor: false },
  medium_items:    { label: 'Medium Items',        desc: 'Boxed goods, shoes, electronics',    commission: 10, urgencyFactor: false },
  large_bulky:     { label: 'Large / Bulky Items', desc: 'Furniture, bulk food, appliances',   commission: 20, urgencyFactor: false },
  perishable_food: { label: 'Perishable Food',     desc: 'Fresh produce, dairy, meat, bakery', commission: 10, urgencyFactor: true },
};

const URGENCY_OPTIONS = [
  { value: 'standard', label: 'Standard', surcharge: 0  },
  { value: 'priority', label: 'Priority', surcharge: 5  },
  { value: 'express',  label: 'Express',  surcharge: 15 },
];

const PACKAGING_OVERRIDES = [
  { value: 'none',  label: 'Auto-calculate from dimensions' },
  { value: 'small', label: 'Small  — R59  · 3–5 business days' },
  { value: 'large', label: 'Large  — R109 · 3–5 business days' },
];

const STEPS = [
  { key: 'basics',   label: 'Basics'   },
  { key: 'pricing',  label: 'Pricing'  },
  { key: 'delivery', label: 'Delivery' },
  { key: 'media',    label: 'Media'    },
  { key: 'variants', label: 'Variants' },
  { key: 'review',   label: 'Review'   },
];

// ── PAXI tier helper ────────────────────────────────────────────────────────
function getPaxiTier(l, w, h, kg, foldable = false, override = 'none') {
  if (override !== 'none') {
    const meta = {
      small: { price: 59,  eta: '3–5 business days', desc: 'Override: Small parcel' },
      large: { price: 109, eta: '3–5 business days', desc: 'Override: Large parcel' },
    };
    return { category: override.toUpperCase(), ...meta[override], vol: null, source: 'override' };
  }
  if (foldable) return { category: 'SMALL', price: 59, eta: '3–5 business days', desc: 'Foldable — always SMALL', vol: null, source: 'foldable' };
  const vol    = Number(l) * Number(w) * Number(h);
  const weight = Number(kg);
  if (!vol || !weight || isNaN(vol) || isNaN(weight) || vol <= 0 || weight <= 0) return null;
  if (vol <= 3000 && weight <= 5)  return { category: 'SMALL', price: 59,  eta: '3–5 business days', desc: 'Up to 3 000 cm³ and 5 kg',  vol, source: 'dimensions' };
  if (vol <= 8000 && weight <= 10) return { category: 'LARGE', price: 109, eta: '3–5 business days', desc: 'Up to 8 000 cm³ and 10 kg', vol, source: 'dimensions' };
  return null;
}

// ── Component ───────────────────────────────────────────────────────────────
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
    urgency_level:       'standard',
    base_price:          '',
    selling_price:       '',
    discount_percentage: '',
    commission_rate:     '10.00',
    sku:                 '',
    barcode:             '',
    stock_quantity:      '0',
    low_stock_threshold: '5',
    length_cm:           '',
    width_cm:            '',
    height_cm:           '',
    weight_kg:           '',
    is_foldable:         false,
    packaging_override:  'none',
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
    formData.is_foldable, formData.packaging_override,
  );
  const dimensionsRequired = !formData.is_foldable && formData.packaging_override === 'none';

  const commissionRule = formData.commission_type ? CATEGORY_COMMISSION_RULES[formData.commission_type] : null;
  const urgencyOption  = URGENCY_OPTIONS.find(o => o.value === formData.urgency_level) || URGENCY_OPTIONS[0];
  
  // Get the raw commission rate (flat fee in Rands)
  const rawCommissionRate = commissionRule
    ? (commissionRule.urgencyFactor ? commissionRule.commission + urgencyOption.surcharge : commissionRule.commission)
    : parseFloat(formData.commission_rate) || 0;
    
  const basePrice    = parseFloat(formData.base_price) || 0;
  const discountPct  = parseFloat(formData.discount_percentage) || 0;
  const sellingPrice = formData.selling_price
    ? parseFloat(formData.selling_price)
    : basePrice > 0 && discountPct > 0
      ? Math.round(basePrice * (1 - discountPct / 100) * 100) / 100
      : basePrice;

  // FLAT RATE commission - direct Rand amount
  const commissionAmt = sellingPrice > 0 ? rawCommissionRate : 0;
  
  const netPayout = sellingPrice > 0 
    ? Math.max(0, Math.round((sellingPrice - commissionAmt) * 100) / 100)
    : 0;

  const progressPct = Math.round(((currentStep + 1) / STEPS.length) * 100);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => { loadInitialData(); }, []);

  useEffect(() => {
    if (selectedCategory) loadCategoryAttributes(selectedCategory);
    else setCategoryAttributes([]);
  }, [selectedCategory]);

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
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(p => ({ ...p, [name]: type === 'checkbox' ? checked : type === 'number' ? (value === '' ? '' : parseFloat(value)) : value }));
  };

  const handleCategorySelect = (cat) => {
    if (!selectedCategories.find(c => c.id === cat.id)) {
      const next = [...selectedCategories, cat];
      setSelectedCategories(next);
      setFormData(p => ({ ...p, category_ids: next.map(c => c.id) }));
      if (!selectedCategory) setSelectedCategory(cat.id);
    }
    setCategorySearchTerm('');
    setShowCategoryDropdown(false);
  };

  const handleCategoryRemove = (id) => {
    const next = selectedCategories.filter(c => c.id !== id);
    setSelectedCategories(next);
    setFormData(p => ({ ...p, category_ids: next.map(c => c.id) }));
    if (selectedCategory === id) setSelectedCategory(next[0]?.id || null);
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
    }
    if (step === 1) {
      if (!formData.base_price || parseFloat(formData.base_price) <= 0) { alert('Please enter a valid base price'); return false; }
      if (!formData.commission_type)           { alert('Please select a commission category'); return false; }
    }
    if (step === 2 && dimensionsRequired) {
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
      const submitData = {
        ...formData,
        base_price:          parseFloat(formData.base_price),
        selling_price:       sellingPrice || null,
        discount_percentage: parseFloat(formData.discount_percentage || 0),
        commission_rate:     rawCommissionRate,
        commission_type:     'flat', // Force flat rate commission
        stock_quantity:      parseInt(formData.stock_quantity || 0),
        low_stock_threshold: parseInt(formData.low_stock_threshold || 5),
      };
      if (dimensionsRequired) {
        ['length_cm','width_cm','height_cm','weight_kg'].forEach(k => { submitData[k] = parseFloat(formData[k]); });
      } else {
        ['length_cm','width_cm','height_cm','weight_kg'].forEach(k => delete submitData[k]);
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

          {commissionRule && sellingPrice > 0 && (
            <div className={styles.sidebarCommission}>
              <div className={styles.sidebarCommissionLabel}>Commission</div>
              <div className={styles.sidebarCommissionAmount}>R{rawCommissionRate}</div>
              <div className={styles.sidebarCommissionType}>
                {commissionRule.label}
                <span style={{ fontSize: 10, display: 'block', opacity: 0.7 }}>Flat rate per sale</span>
              </div>
              {sellingPrice > 0 && (
                <div className={styles.sidebarCommissionPayout}>
                  Payout: <strong>R{netPayout.toFixed(2)}</strong>
                </div>
              )}
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
                    <label className={styles.label} style={{ fontSize: 12 }}>Primary category (for attributes)</label>
                    <select className={styles.select} value={selectedCategory || ''} onChange={e => setSelectedCategory(parseInt(e.target.value))}>
                      {selectedCategories.map(c => <option key={c.id} value={c.id}>{c.full_path || c.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

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
              {/* Commission category */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.cardTitle}>Commission Category <span className={styles.req}>*</span></h2>
                    <p className={styles.cardSubtitle}>Select the type that best matches your product</p>
                  </div>
                </div>
                <div className={styles.categoryGrid}>
                  {Object.entries(CATEGORY_COMMISSION_RULES).map(([key, rule]) => (
                    <div
                      key={key}
                      className={`${styles.categoryCard} ${formData.commission_type === key ? styles.selected : ''}`}
                      onClick={() => setFormData(p => ({ ...p, commission_type: key }))}
                    >
                      <div className={styles.categoryCardTitle}>{rule.label}</div>
                      <div className={styles.categoryCardDesc}>{rule.desc}</div>
                      <span className={styles.commissionTag}>R{rule.commission} flat{rule.urgencyFactor ? ' + urgency' : ''}</span>
                    </div>
                  ))}
                </div>

                {formData.commission_type === 'perishable_food' && (
                  <>
                    <span className={styles.sectionLabel}>Urgency / Delivery Speed</span>
                    <div className={styles.urgencyGrid}>
                      {URGENCY_OPTIONS.map(opt => (
                        <div
                          key={opt.value}
                          className={`${styles.urgencyCard} ${formData.urgency_level === opt.value ? styles.selected : ''}`}
                          onClick={() => setFormData(p => ({ ...p, urgency_level: opt.value }))}
                        >
                          <div className={styles.urgencyLabel}>{opt.label}</div>
                          <div className={styles.urgencySub}>{opt.surcharge > 0 ? `+R${opt.surcharge}` : 'Base rate'}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {commissionRule && (
                  <div className={styles.commissionPanel}>
                    <div>
                      <div className={styles.sidebarCommissionLabel}>Commission Rate</div>
                      <div className={styles.commissionAmount}>R{rawCommissionRate} flat</div>
                    </div>
                    <div className={styles.commissionDivider} />
                    <div className={styles.commissionInfo}>
                      <strong>{commissionRule.label}</strong><br />
                      Flat fee of R{rawCommissionRate} per sale
                      {commissionRule.urgencyFactor && formData.urgency_level !== 'standard' && ` (includes R${urgencyOption.surcharge} urgency surcharge)`}
                    </div>
                  </div>
                )}
              </div>

              {/* Pricing */}
              <div className={styles.card}>
                <div className={styles.cardHeader}><h2 className={styles.cardTitle}>Pricing</h2></div>
                <div className={styles.row2}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Base Price (R) <span className={styles.req}>*</span></label>
                    <input className={styles.input} type="number" name="base_price" value={formData.base_price} onChange={handleInputChange} placeholder="0.00" step="0.01" min="0" />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Discount (%)</label>
                    <input className={styles.input} type="number" name="discount_percentage" value={formData.discount_percentage} onChange={handleInputChange} placeholder="0" step="0.1" min="0" max="100" />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Selling Price (R)</label>
                  <input className={styles.input} type="number" name="selling_price" value={formData.selling_price} onChange={handleInputChange} placeholder="Auto-calculated" step="0.01" min="0" />
                  <span className={styles.helper}>Leave blank to auto-calculate from discount</span>
                </div>
                {sellingPrice > 0 && (
                  <div className={styles.priceSummary}>
                    <div className={styles.priceLine}><span>Selling price</span><span>R{sellingPrice.toFixed(2)}</span></div>
                    <div className={styles.priceLine}><span>Commission (R{rawCommissionRate} flat)</span><span style={{ color: '#dc2626' }}>- R{commissionAmt.toFixed(2)}</span></div>
                    <div className={styles.priceLineTotal}><span>Your payout</span><span style={{ color: '#16a34a' }}>R{netPayout.toFixed(2)}</span></div>
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
                  <p className={styles.cardSubtitle}>Measure the product as packaged — determines your PAXI tier</p>
                </div>
              </div>

              {paxiTier ? (
                <div className={`${styles.paxiPreview} ${paxiTier.category === 'SMALL' ? styles.paxiSmall : styles.paxiLarge}`}>
                  <span style={{ fontSize: 32 }}>📦</span>
                  <div>
                    <div className={styles.paxiTierName}>
                      PAXI {paxiTier.category} Parcel
                      {paxiTier.source !== 'dimensions' && <span style={{ fontSize: 12, marginLeft: 8, fontWeight: 400, opacity: 0.7 }}>({paxiTier.source})</span>}
                    </div>
                    <div className={styles.paxiTierDesc}>{paxiTier.desc} · Fee: <strong>R{paxiTier.price}</strong> · {paxiTier.eta}</div>
                  </div>
                </div>
              ) : (
                <div className={styles.paxiEmpty}>📐 Fill in dimensions or select an option below to see the PAXI tier.</div>
              )}

              <div className={styles.foldablePanel}>
                <label className={styles.foldableLabel}>
                  <input type="checkbox" name="is_foldable" checked={formData.is_foldable} onChange={handleInputChange} style={{ marginTop: 3 }} />
                  <div>
                    <div className={styles.foldableTitle}>This product is foldable</div>
                    <div className={styles.foldableDesc}>Clothing and textiles fold flat — always SMALL regardless of unfolded size.</div>
                  </div>
                </label>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Packaging Override <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 12 }}>(optional)</span></label>
                <select className={styles.select} name="packaging_override" value={formData.packaging_override} onChange={handleInputChange}>
                  {PACKAGING_OVERRIDES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span className={styles.helper}>Use when dimensions don't reflect how the product ships.</span>
              </div>

              <span className={styles.sectionLabel}>
                Parcel Dimensions {dimensionsRequired ? <span className={styles.req}>*</span> : <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>(optional)</span>}
              </span>
              <div className={styles.row2}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Length {dimensionsRequired && <span className={styles.req}>*</span>} <span style={{ fontWeight: 400, color: '#9ca3af' }}>(cm)</span></label>
                  <input className={styles.input} type="number" name="length_cm" value={formData.length_cm} onChange={handleInputChange} placeholder="e.g., 30" min="1" step="1" />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Width {dimensionsRequired && <span className={styles.req}>*</span>} <span style={{ fontWeight: 400, color: '#9ca3af' }}>(cm)</span></label>
                  <input className={styles.input} type="number" name="width_cm" value={formData.width_cm} onChange={handleInputChange} placeholder="e.g., 20" min="1" step="1" />
                </div>
              </div>
              <div className={styles.row2}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Height {dimensionsRequired && <span className={styles.req}>*</span>} <span style={{ fontWeight: 400, color: '#9ca3af' }}>(cm)</span></label>
                  <input className={styles.input} type="number" name="height_cm" value={formData.height_cm} onChange={handleInputChange} placeholder="e.g., 10" min="1" step="1" />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Weight {dimensionsRequired && <span className={styles.req}>*</span>} <span style={{ fontWeight: 400, color: '#9ca3af' }}>(kg)</span></label>
                  <input className={styles.input} type="number" name="weight_kg" value={formData.weight_kg} onChange={handleInputChange} placeholder="e.g., 0.5" min="0.01" step="0.01" />
                </div>
              </div>

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
              <span className={styles.helper} style={{ marginTop: 8, display: 'block' }}>Foldable items are always SMALL. Manual override supersedes all other logic.</span>
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
                ['SME', assignedSMEs.find(s => String(s.id) === String(formData.sme_id))?.business_name || '—'],
                ['Name', formData.name || '—'],
                ['Short description', formData.short_description || '—'],
                ['Categories', selectedCategories.map(c => c.full_path || c.name).join(', ') || '—'],
              ].map(([k, v]) => (
                <div key={k} className={styles.reviewRow}><span className={styles.reviewKey}>{k}</span><span className={styles.reviewVal}>{v}</span></div>
              ))}

              <span className={styles.sectionLabel} style={{ marginTop: 20 }}>Pricing</span>
              {[
                ['Base price', `R${parseFloat(formData.base_price || 0).toFixed(2)}`],
                ['Selling price', `R${sellingPrice.toFixed(2)}`],
                ['Discount', formData.discount_percentage ? `${formData.discount_percentage}%` : 'None'],
                ['Commission type', commissionRule?.label || '—'],
                ['Commission fee', `R${rawCommissionRate} (flat rate)`],
                ['Your payout', `R${netPayout.toFixed(2)}`],
              ].map(([k, v]) => (
                <div key={k} className={styles.reviewRow}>
                  <span className={styles.reviewKey}>{k}</span>
                  <span className={`${styles.reviewVal} ${k === 'Your payout' ? styles.reviewValGreen : ''}`}>{v}</span>
                </div>
              ))}

              <span className={styles.sectionLabel} style={{ marginTop: 20 }}>Delivery</span>
              {[
                ['PAXI tier', paxiTier ? `${paxiTier.category} (R${paxiTier.price})` : 'Not determined'],
                ['Foldable', formData.is_foldable ? 'Yes' : 'No'],
                ['Packaging override', formData.packaging_override !== 'none' ? formData.packaging_override : 'None (auto)'],
                ['Dimensions', !formData.is_foldable && formData.packaging_override === 'none' && formData.length_cm ? `${formData.length_cm} × ${formData.width_cm} × ${formData.height_cm} cm, ${formData.weight_kg} kg` : '—'],
              ].map(([k, v]) => (
                <div key={k} className={styles.reviewRow}><span className={styles.reviewKey}>{k}</span><span className={styles.reviewVal}>{v}</span></div>
              ))}

              <span className={styles.sectionLabel} style={{ marginTop: 20 }}>Inventory</span>
              {[
                ['SKU', formData.sku || '—'],
                ['Barcode', formData.barcode || '—'],
                ['Stock', formData.stock_quantity],
                ['Low stock alert', formData.low_stock_threshold],
                ['Variants', formData.variants.length ? `${formData.variants.length} variant(s)` : 'None'],
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