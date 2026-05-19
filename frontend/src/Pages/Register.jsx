import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styles from './Register.module.css';

export default function Register() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!formData.fullName.trim()) e.fullName = 'Full name is required';
    if (!formData.email) {
      e.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      e.email = 'Please enter a valid email';
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
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);

    // Calls AuthContext register() → POST /auth/register/customer/
    // phone and source are optional for customers — passed as empty strings
    const result = await register({
      role: 'customer',
      email: formData.email,
      password: formData.password,
      full_name: formData.fullName,
      phone: '',
      source: '',
    });

    if (result.success) {
      navigate('/');
    } else {
      setErrors({ submit: result.error });
    }
    setIsLoading(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* ── Left brand panel ── */}
        <div className={styles.panel}>
          <div className={styles.panelInner}>
            <h2 className={styles.panelTitle}>Shop local.<br />Support your community.</h2>
            <p className={styles.panelText}>
              Create a free account in seconds and start buying from businesses in your neighbourhood.
            </p>
            <div className={styles.panelDivider} />
            <p className={styles.panelCta}>Want to sell, agent, or deliver?</p>
            <Link to="/apply" className={styles.applyLink}>
              Apply to join as a partner →
            </Link>
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className={styles.formPanel}>
          <div className={styles.formCard}>
            <h1 className={styles.formTitle}>Create account</h1>
            <p className={styles.formSubtitle}>Free. Takes 30 seconds.</p>

            {errors.submit && (
              <div className={styles.errorAlert}>{errors.submit}</div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className={styles.field}>
                <label htmlFor="fullName" className={styles.label}>Full name</label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className={`${styles.input} ${errors.fullName ? styles.inputError : ''}`}
                  placeholder="Jane Dube"
                  autoComplete="name"
                  autoFocus
                />
                {errors.fullName && <span className={styles.fieldError}>{errors.fullName}</span>}
              </div>

              <div className={styles.field}>
                <label htmlFor="email" className={styles.label}>Email address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
              </div>

              <div className={styles.field}>
                <label htmlFor="password" className={styles.label}>Password</label>
                <div className={styles.passwordWrap}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
                    placeholder="Min. 6 characters"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowPassword(v => !v)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
                {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
              </div>

              <div className={styles.field}>
                <label htmlFor="confirmPassword" className={styles.label}>Confirm password</label>
                <div className={styles.passwordWrap}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={`${styles.input} ${errors.confirmPassword ? styles.inputError : ''}`}
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowConfirmPassword(v => !v)}
                    aria-label="Toggle confirm password visibility"
                  >
                    {showConfirmPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <span className={styles.fieldError}>{errors.confirmPassword}</span>
                )}
              </div>

              <button type="submit" className={styles.submitBtn} disabled={isLoading}>
                {isLoading ? <span className={styles.spinner} /> : 'Create my account'}
              </button>
            </form>

            <p className={styles.loginPrompt}>
              Already have an account?{' '}
              <Link to="/login" className={styles.loginLink}>Sign in</Link>
            </p>

            <p className={styles.terms}>
              By signing up you agree to our{' '}
              <a href="/terms" className={styles.termsLink}>Terms</a> and{' '}
              <a href="/privacy" className={styles.termsLink}>Privacy Policy</a>.
            </p>
          </div>
        </div>

      </div>
    </div>
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
