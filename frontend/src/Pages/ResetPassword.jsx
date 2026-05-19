// frontend/src/Pages/ResetPassword.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import passwordResetService from '../services/passwordResetService';
import styles from './ResetPassword.module.css';

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Extract token from URL on component mount
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlToken = params.get('token');
    
    if (!urlToken) {
      setError('No reset token provided. Please request a new password reset link.');
      setIsValidating(false);
      return;
    }
    
    setToken(urlToken);
    validateToken(urlToken);
  }, [location]);

  const validateToken = async (token) => {
    setIsValidating(true);
    setError('');
    
    try {
      await passwordResetService.validateToken(token);
      // Token is valid
    } catch (err) {
      setError(err.message || 'Invalid or expired reset link. Please request a new one.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate passwords
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      await passwordResetService.resetPassword(token, newPassword, confirmPassword);
      setSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrength = (password) => {
    if (!password) return { strength: 0, text: '' };
    
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (password.match(/[a-z]/)) strength += 1;
    if (password.match(/[A-Z]/)) strength += 1;
    if (password.match(/[0-9]/)) strength += 1;
    if (password.match(/[^a-zA-Z0-9]/)) strength += 1;
    
    const strengthMap = {
      0: { text: 'Very Weak', class: styles.strength0 },
      1: { text: 'Very Weak', class: styles.strength1 },
      2: { text: 'Weak', class: styles.strength2 },
      3: { text: 'Fair', class: styles.strength3 },
      4: { text: 'Good', class: styles.strength4 },
      5: { text: 'Strong', class: styles.strength5 }
    };
    
    return strengthMap[strength] || strengthMap[0];
  };

  if (isValidating) {
    return (
      <div className={styles.resetPasswordPage}>
        <div className="container">
          <div className={styles.resetPasswordContainer}>
            <div className={styles.logoSection}>
              <Link to="/">
                <img 
                  src="/izozo.png" 
                  alt="Izozo Marketplace" 
                  className={styles.logo}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://via.placeholder.com/180x60/f2c01a/150c09?text=IZOZO';
                  }}
                />
              </Link>
            </div>
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
              <p>Validating your reset link...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !token) {
    return (
      <div className={styles.resetPasswordPage}>
        <div className="container">
          <div className={styles.resetPasswordContainer}>
            <div className={styles.logoSection}>
              <Link to="/">
                <img 
                  src="/izozo.png" 
                  alt="Izozo Marketplace" 
                  className={styles.logo}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://via.placeholder.com/180x60/f2c01a/150c09?text=IZOZO';
                  }}
                />
              </Link>
            </div>
            <div className={styles.errorContainer}>
              <div className={styles.errorIcon}>⚠️</div>
              <h2 className={styles.errorTitle}>Invalid Reset Link</h2>
              <p className={styles.errorMessage}>{error}</p>
              <div className={styles.errorActions}>
                <Link to="/forgot-password" className={styles.primaryButton}>
                  Request New Link
                </Link>
                <Link to="/login" className={styles.secondaryButton}>
                  Back to Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className={styles.resetPasswordPage}>
        <div className="container">
          <div className={styles.resetPasswordContainer}>
            <div className={styles.logoSection}>
              <Link to="/">
                <img 
                  src="/izozo.png" 
                  alt="Izozo Marketplace" 
                  className={styles.logo}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://via.placeholder.com/180x60/f2c01a/150c09?text=IZOZO';
                  }}
                />
              </Link>
            </div>
            <div className={styles.successContainer}>
              <div className={styles.successIcon}>✅</div>
              <h2 className={styles.successTitle}>Password Reset Successful!</h2>
              <p className={styles.successMessage}>
                Your password has been reset successfully.
              </p>
              <p className={styles.redirectMessage}>
                Redirecting to login page in 3 seconds...
              </p>
              <Link to="/login" className={styles.primaryButton}>
                Go to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const passwordStrength = getPasswordStrength(newPassword);

  return (
    <div className={styles.resetPasswordPage}>
      <div className="container">
        <div className={styles.resetPasswordContainer}>
          <div className={styles.logoSection}>
            <Link to="/">
              <img 
                src="/izozo.png" 
                alt="Izozo Marketplace" 
                className={styles.logo}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://via.placeholder.com/180x60/f2c01a/150c09?text=IZOZO';
                }}
              />
            </Link>
          </div>

          <h1 className={styles.title}>Create New Password</h1>
          <p className={styles.subtitle}>
            Enter your new password below.
          </p>

          {error && (
            <div className={styles.errorAlert}>
              <span className={styles.errorIcon}>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="newPassword" className={styles.label}>
                New Password
              </label>
              <div className={styles.passwordInputWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className={styles.input}
                  required
                  disabled={isLoading}
                  minLength={8}
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {newPassword && (
                <>
                  <div className={styles.strengthBar}>
                    <div className={`${styles.strengthFill} ${passwordStrength.class}`} 
                         style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}>
                    </div>
                  </div>
                  <p className={styles.strengthText}>
                    Password strength: {passwordStrength.text}
                  </p>
                  <ul className={styles.passwordRequirements}>
                    <li className={newPassword.length >= 8 ? styles.valid : ''}>
                      At least 8 characters
                    </li>
                    <li className={/[a-z]/.test(newPassword) ? styles.valid : ''}>
                      Contains lowercase letter
                    </li>
                    <li className={/[A-Z]/.test(newPassword) ? styles.valid : ''}>
                      Contains uppercase letter
                    </li>
                    <li className={/[0-9]/.test(newPassword) ? styles.valid : ''}>
                      Contains number
                    </li>
                    <li className={/[^a-zA-Z0-9]/.test(newPassword) ? styles.valid : ''}>
                      Contains special character
                    </li>
                  </ul>
                </>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword" className={styles.label}>
                Confirm Password
              </label>
              <div className={styles.passwordInputWrapper}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className={styles.input}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className={styles.errorText}>Passwords do not match</p>
              )}
            </div>

            <button 
              type="submit" 
              className={`${styles.submitButton} ${isLoading ? styles.loading : ''}`}
              disabled={isLoading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            >
              {isLoading ? (
                <>
                  <span className={styles.spinner}></span>
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>

          <div className={styles.links}>
            <Link to="/login" className={styles.link}>
              ← Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;