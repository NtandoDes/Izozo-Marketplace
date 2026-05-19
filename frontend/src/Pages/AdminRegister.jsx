import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styles from './AdminRegister.module.css';

export default function AdminRegister() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    phone: '',
    admin_secret_key: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    // Validate password strength
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      setIsLoading(false);
      return;
    }

    const result = await register({
      ...formData,
      role: 'admin'
    });
    
    setIsLoading(false);
    
    if (result.success) {
      navigate('/admin-dashboard', { replace: true });
    } else {
      setError(result.error || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className={styles.adminRegisterPage}>
      <div className="container">
        <div className={styles.registerContainer}>
          <div className={styles.registerCard}>
            <div className={styles.registerHeader}>
              <h1 className={styles.registerTitle}>Create Admin Account</h1>
              <p className={styles.registerSubtitle}>Register as an Izozo Administrator</p>
            </div>

            {error && (
              <div className={styles.errorAlert}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8 4a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 4zm.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className={styles.registerForm}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="full_name" className={styles.formLabel}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="full_name"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    className={styles.formInput}
                    placeholder="Enter your full name"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="email" className={styles.formLabel}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={styles.formInput}
                    placeholder="admin@izozo.com"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="phone" className={styles.formLabel}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className={styles.formInput}
                    placeholder="e.g., 0712345678"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="admin_secret_key" className={styles.formLabel}>
                    Admin Secret Key
                  </label>
                  <input
                    type="password"
                    id="admin_secret_key"
                    name="admin_secret_key"
                    value={formData.admin_secret_key}
                    onChange={handleChange}
                    className={styles.formInput}
                    placeholder="Enter admin registration key"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="password" className={styles.formLabel}>
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={styles.formInput}
                    placeholder="Create a strong password"
                    required
                    disabled={isLoading}
                    minLength={8}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="confirmPassword" className={styles.formLabel}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={styles.formInput}
                    placeholder="Re-enter your password"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className={styles.formInfo}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
                </svg>
                <span>
                  Admin accounts have full system access. Keep your admin secret key secure and never share it.
                </span>
              </div>

              <button
                type="submit"
                className={`${styles.registerButton} ${isLoading ? styles.loading : ''}`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className={styles.spinner}></span>
                    Creating Admin Account...
                  </>
                ) : (
                  'Create Admin Account'
                )}
              </button>
            </form>

            <div className={styles.registerFooter}>
              <p>
                Already have an account?{' '}
                <Link to="/login" className={styles.loginLink}>
                  Sign in
                </Link>
              </p>
              <p className={styles.securityNote}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                </svg>
                This is a secure, protected registration page
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}