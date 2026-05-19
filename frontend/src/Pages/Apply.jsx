/**
 * Apply.jsx — Partner Registration Page
 * 
 * Used by: SME (Business Owner), Sales Agent, Delivery Partner
 * Route: /apply
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styles from './Apply.module.css';

// ── Constants ────────────────────────────────────────────────────────────────

const ROLES = [
  {
    value: 'sme',
    label: 'Business Owner',
    emoji: '🏢',
    description: 'Sell your products through our agent network',
  },
  {
    value: 'agent',
    label: 'Sales Agent',
    emoji: '🤝',
    description: 'Help SMEs sell and earn commissions',
  },
  {
    value: 'delivery',
    label: 'Delivery Partner',
    emoji: '🚚',
    description: 'Deliver orders to customers and earn money',
  },
];

const SOURCE_OPTIONS = [
  'Facebook', 'Instagram', 'TikTok', 'Twitter/X',
  'WhatsApp', 'Friend/Family', 'Radio', 'Other',
];

const VEHICLE_OPTIONS = [
  { value: 'bicycle', label: 'Bicycle' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'car', label: 'Car' },
  { value: 'bakkie', label: 'Bakkie/Truck' },
  { value: 'other', label: 'Other' },
];

// ── Checklist steps per role ─────────────────────────────────────────────────

const ROLE_CHECKLIST = {
  sme: [
    { icon: '👤', text: 'Your full name & contact details' },
    { icon: '🏢', text: 'Your business name and type' },
    { icon: '📍', text: 'Your business address' },
    { icon: '📧', text: 'An email address & password' },
  ],
  agent: [
    { icon: '👤', text: 'Your full name & contact details' },
    { icon: '🏠', text: 'Your home address' },
    { icon: '📱', text: 'Whether you have a smartphone & internet' },
    { icon: '📧', text: 'An email address & password' },
  ],
  delivery: [
    { icon: '👤', text: 'Your full name & contact details' },
    { icon: '🏠', text: 'Your home address' },
    { icon: '🚗', text: 'Your vehicle type' },
    { icon: '📱', text: 'Whether you have a smartphone & internet' },
    { icon: '📧', text: 'An email address & password' },
  ],
};

// ── Component ────────────────────────────────────────────────────────────────

export default function Apply() {
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState(null);
  const [showChecklist, setShowChecklist] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    source: '',
    otherSource: '',
    // SME
    businessName: '',
    ownerName: '',
    businessType: '',
    address: '',
    // Agent + Delivery
    homeAddress: '',
    hasInternet: false,
    hasSmartphone: false,
    // Delivery only
    vehicleType: '',
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { register } = useAuth();

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setShowChecklist(true);
    setErrors({});
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'source' && value !== 'Other' ? { otherSource: '' } : {}),
    }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validateStep1 = () => {
    if (!selectedRole) {
      setErrors({ role: 'Please select a role to continue' });
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const e = {};

    // Common fields
    if (!formData.fullName.trim()) e.fullName = 'Full name is required';
    if (!formData.phone.trim()) e.phone = 'Phone number is required';
    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
      e.email = 'A valid email address is required';
    }
    if (!formData.password) {
      e.password = 'Password is required';
    } else if (formData.password.length < 6) {
      e.password = 'Password must be at least 6 characters';
    }
    if (!formData.confirmPassword) {
      e.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      e.confirmPassword = 'Passwords do not match';
    }
    if (!formData.source) {
      e.source = 'Please tell us where you heard about us';
    } else if (formData.source === 'Other' && (!formData.otherSource || !formData.otherSource.trim())) {
      e.otherSource = 'Please specify where you heard about us';
    }

    // SME-specific
    if (selectedRole.value === 'sme') {
      if (!formData.businessName.trim()) e.businessName = 'Business name is required';
      if (!formData.ownerName.trim()) e.ownerName = 'Owner / contact name is required';
      if (!formData.address.trim()) e.address = 'Business address is required';
    }

    // Agent-specific
    if (selectedRole.value === 'agent') {
      if (!formData.homeAddress.trim()) e.homeAddress = 'Home address is required';
    }

    // Delivery-specific
    if (selectedRole.value === 'delivery') {
      if (!formData.homeAddress.trim()) e.homeAddress = 'Home address is required';
      if (!formData.vehicleType) e.vehicleType = 'Please select a vehicle type';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const formatPhoneNumber = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('0')) {
      if (cleaned.length <= 3) return cleaned;
      if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 10)}`;
    } else if (cleaned.startsWith('27')) {
      if (cleaned.length <= 2) return cleaned;
      if (cleaned.length <= 5) return `+${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
      if (cleaned.length <= 8) return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5)}`;
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 11)}`;
    }
    return phone;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep2()) return;

    setIsLoading(true);

    // Process source field exactly like LandingPage does
    const finalSource = formData.source === 'Other'
      ? formData.otherSource.trim()
      : formData.source;

    // Format phone number to remove spaces
    const formattedPhone = formData.phone.replace(/\s/g, '');

    // Prepare registration data
    const registrationData = {
      role: selectedRole.value,
      email: formData.email.trim(),
      password: formData.password,
      full_name: formData.fullName.trim(),
      phone: formattedPhone,
      source: finalSource,  // ✅ This is the key - properly formatted source

      // SME fields
      ...(selectedRole.value === 'sme' && {
        business_name: formData.businessName.trim(),
        owner_name: formData.ownerName.trim(),
        business_type: formData.businessType.trim() || '',
        business_address: formData.address.trim(),
        address: formData.address.trim(),
      }),

      // Agent fields
      ...(selectedRole.value === 'agent' && {
        home_address: formData.homeAddress.trim(),
        has_internet: formData.hasInternet,
        has_smartphone: formData.hasSmartphone,
      }),

      // Delivery fields
      ...(selectedRole.value === 'delivery' && {
        home_address: formData.homeAddress.trim(),
        vehicle_type: formData.vehicleType,
        has_internet: formData.hasInternet,
        has_smartphone: formData.hasSmartphone,
      }),
    };

    console.log('=' .repeat(60));
    console.log('📝 SUBMITTING REGISTRATION');
    console.log('=' .repeat(60));
    console.log('Selected Role:', selectedRole.value);
    console.log('Form Data Source:', formData.source);
    console.log('Form Data Other Source:', formData.otherSource);
    console.log('Final Source Value:', finalSource);
    console.log('Formatted Phone:', formattedPhone);
    console.log('\n📦 Full Registration Payload:');
    console.log(JSON.stringify(registrationData, null, 2));
    console.log('=' .repeat(60));

    // Call the register function from AuthContext
    const result = await register(registrationData);

    console.log('\n✅ REGISTRATION RESULT:');
    console.log(result);

    if (result.success) {
      setStep(3);
    } else {
      setErrors({ submit: result.error });
      console.error('❌ Registration failed:', result.error);
    }

    setIsLoading(false);
  };

  // ── Step 3: Pending approval ───────────────────────────────────────────────

  if (step === 3) {
    return (
      <div className={styles.page}>
        <div className={styles.pendingCard}>
          <div className={styles.pendingIcon}>⏳</div>
          <h1 className={styles.pendingTitle}>You're on the list!</h1>
          <p className={styles.pendingText}>
            Your <strong>{selectedRole?.label}</strong> account has been created.
            Our team will review your details and approve your account within{' '}
            <strong>2–3 business days</strong>.
          </p>
          <p className={styles.pendingText}>
            We'll send a confirmation to <strong>{formData.email}</strong> once you're approved.
            You can then log in and access your dashboard.
          </p>
          <div className={styles.pendingSteps}>
            <div className={styles.pendingStep}>
              <span className={styles.pendingStepNum}>1</span>
              <span>Application submitted ✓</span>
            </div>
            <div className={styles.pendingStepLine} />
            <div className={`${styles.pendingStep} ${styles.pendingStepMuted}`}>
              <span className={styles.pendingStepNum}>2</span>
              <span>Admin review (2–3 days)</span>
            </div>
            <div className={styles.pendingStepLine} />
            <div className={`${styles.pendingStep} ${styles.pendingStepMuted}`}>
              <span className={styles.pendingStepNum}>3</span>
              <span>Account approved — you're live!</span>
            </div>
          </div>
          <Link to="/login" className={styles.primaryBtn} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Go to login
          </Link>
          <p className={styles.footerNote} style={{ marginTop: '1rem' }}>
            Just shopping?{' '}
            <Link to="/register" className={styles.loginLink}>Create a customer account →</Link>
          </p>
        </div>
      </div>
    );
  }

  // ── Step 1: Role picker + checklist ───────────────────────────────────────

  if (step === 1) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <Link to="/register" className={styles.backLink}>← Back to sign up</Link>

          <h1 className={styles.cardTitle}>Join as a partner</h1>
          <p className={styles.cardSubtitle}>
            Choose your role. We'll collect the relevant details and our team will approve your account within 2–3 days.
          </p>

          {errors.role && <p className={styles.roleError}>{errors.role}</p>}

          <div className={styles.roleGrid}>
            {ROLES.map(role => (
              <button
                key={role.value}
                type="button"
                className={`${styles.roleCard} ${selectedRole?.value === role.value ? styles.roleSelected : ''}`}
                onClick={() => handleRoleSelect(role)}
              >
                <span className={styles.roleEmoji}>{role.emoji}</span>
                <span className={styles.roleLabel}>{role.label}</span>
                <span className={styles.roleDesc}>{role.description}</span>
              </button>
            ))}
          </div>

          {showChecklist && selectedRole && (
            <div className={styles.checklist}>
              <p className={styles.checklistTitle}>
                Here's what you'll need to complete your <strong>{selectedRole.label}</strong> application:
              </p>
              <ul className={styles.checklistItems}>
                {ROLE_CHECKLIST[selectedRole.value].map((item, i) => (
                  <li key={i} className={styles.checklistItem}>
                    <span className={styles.checklistIcon}>{item.icon}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            className={styles.primaryBtn}
            onClick={() => { if (validateStep1()) setStep(2); }}
          >
            {selectedRole ? `Continue as ${selectedRole.label} →` : 'Continue →'}
          </button>

          <p className={styles.footerNote}>
            Just shopping?{' '}
            <Link to="/register" className={styles.loginLink}>Create a free customer account →</Link>
          </p>
        </div>
      </div>
    );
  }

  // ── Step 2: Application form ───────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <button className={styles.backBtn} onClick={() => setStep(1)}>← Back</button>

        <div className={styles.rolePill}>
          {selectedRole?.emoji} {selectedRole?.label} application
        </div>

        <h1 className={styles.cardTitle}>Complete your application</h1>
        <p className={styles.cardSubtitle}>
          Fill in the details below. Your account will be reviewed and activated within 2–3 business days.
        </p>

        {errors.submit && (
          <div className={styles.errorAlert}>{errors.submit}</div>
        )}

        <form onSubmit={handleSubmit} noValidate>

          {/* ── Account credentials ── */}
          <div className={styles.sectionLabel}>Account details</div>

          <div className={styles.row}>
            <Field label="Full name *" error={errors.fullName}>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className={`${styles.input} ${errors.fullName ? styles.inputError : ''}`}
                placeholder="Your full name"
                autoFocus
              />
            </Field>
            <Field label="Phone number *" error={errors.phone}>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={(e) => {
                  const formatted = formatPhoneNumber(e.target.value);
                  handleChange({ target: { name: 'phone', value: formatted } });
                }}
                className={`${styles.input} ${errors.phone ? styles.inputError : ''}`}
                placeholder="e.g. 083 123 4567"
              />
            </Field>
          </div>

          <Field label="Email address *" error={errors.email}>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
              placeholder="you@example.com"
            />
          </Field>

          <div className={styles.row}>
            <Field label="Password *" error={errors.password}>
              <div className={styles.passwordWrap}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(v => !v)} aria-label="Toggle password">
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </Field>
            <Field label="Confirm password *" error={errors.confirmPassword}>
              <div className={styles.passwordWrap}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`${styles.input} ${errors.confirmPassword ? styles.inputError : ''}`}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowConfirmPassword(v => !v)} aria-label="Toggle confirm password">
                  {showConfirmPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </Field>
          </div>

          {/* ── Source ── */}
          <Field label="Where did you hear about us? *" error={errors.source}>
            <select
              name="source"
              value={formData.source}
              onChange={handleChange}
              className={`${styles.input} ${errors.source ? styles.inputError : ''}`}
            >
              <option value="">-- Select --</option>
              {SOURCE_OPTIONS.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>

          {formData.source === 'Other' && (
            <Field label="Please specify *" error={errors.otherSource}>
              <input
                type="text"
                name="otherSource"
                value={formData.otherSource}
                onChange={handleChange}
                className={`${styles.input} ${errors.otherSource ? styles.inputError : ''}`}
                placeholder="Where did you hear about Izozo?"
              />
            </Field>
          )}

          {/* ── SME fields ── */}
          {selectedRole?.value === 'sme' && (
            <>
              <div className={styles.sectionLabel}>Business details</div>
              <div className={styles.row}>
                <Field label="Business name *" error={errors.businessName}>
                  <input
                    type="text"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleChange}
                    className={`${styles.input} ${errors.businessName ? styles.inputError : ''}`}
                    placeholder="Your business name"
                  />
                </Field>
                <Field label="Owner / contact person *" error={errors.ownerName}>
                  <input
                    type="text"
                    name="ownerName"
                    value={formData.ownerName}
                    onChange={handleChange}
                    className={`${styles.input} ${errors.ownerName ? styles.inputError : ''}`}
                    placeholder="Owner name"
                  />
                </Field>
              </div>
              <Field label="Business type" error={null}>
                <input
                  type="text"
                  name="businessType"
                  value={formData.businessType}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="e.g. Clothing, Beauty, Electronics"
                />
              </Field>
              <Field label="Business address *" error={errors.address}>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className={`${styles.input} ${styles.textarea} ${errors.address ? styles.inputError : ''}`}
                  placeholder="Full business address"
                  rows="3"
                />
              </Field>
            </>
          )}

          {/* ── Agent fields ── */}
          {selectedRole?.value === 'agent' && (
            <>
              <div className={styles.sectionLabel}>Your details</div>
              <Field label="Home address *" error={errors.homeAddress}>
                <textarea
                  name="homeAddress"
                  value={formData.homeAddress}
                  onChange={handleChange}
                  className={`${styles.input} ${styles.textarea} ${errors.homeAddress ? styles.inputError : ''}`}
                  placeholder="Your home address"
                  rows="3"
                />
              </Field>
              <CheckboxField name="hasSmartphone" checked={formData.hasSmartphone} onChange={handleChange} label="I have a smartphone" />
              <CheckboxField name="hasInternet" checked={formData.hasInternet} onChange={handleChange} label="I have internet access" />
            </>
          )}

          {/* ── Delivery fields ── */}
          {selectedRole?.value === 'delivery' && (
            <>
              <div className={styles.sectionLabel}>Your details</div>
              <Field label="Home address *" error={errors.homeAddress}>
                <textarea
                  name="homeAddress"
                  value={formData.homeAddress}
                  onChange={handleChange}
                  className={`${styles.input} ${styles.textarea} ${errors.homeAddress ? styles.inputError : ''}`}
                  placeholder="Your home address"
                  rows="3"
                />
              </Field>
              <Field label="Vehicle type *" error={errors.vehicleType}>
                <select
                  name="vehicleType"
                  value={formData.vehicleType}
                  onChange={handleChange}
                  className={`${styles.input} ${errors.vehicleType ? styles.inputError : ''}`}
                >
                  <option value="">Select vehicle</option>
                  {VEHICLE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <CheckboxField name="hasSmartphone" checked={formData.hasSmartphone} onChange={handleChange} label="I have a smartphone" />
              <CheckboxField name="hasInternet" checked={formData.hasInternet} onChange={handleChange} label="I have internet access" />
            </>
          )}

          <button type="submit" className={styles.primaryBtn} disabled={isLoading}>
            {isLoading ? <span className={styles.spinner} /> : 'Submit application'}
          </button>
        </form>

        <p className={styles.footerNote}>
          Just shopping?{' '}
          <Link to="/register" className={styles.loginLink}>Create a free customer account →</Link>
        </p>
      </div>
    </div>
  );
}

// ── Helper sub-components ─────────────────────────────────────────────────────

function Field({ label, error, children }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      {children}
      {error && <span className={styles.fieldError}>{error}</span>}
    </div>
  );
}

function CheckboxField({ name, checked, onChange, label }) {
  return (
    <label className={styles.checkboxLabel}>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        className={styles.checkbox}
      />
      <span>{label}</span>
    </label>
  );
}

function Eye() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
      <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
      <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
    </svg>
  );
}

function EyeOff() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
      <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
      <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
      <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
    </svg>
  );
}