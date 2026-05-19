import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import styles from './ForgotPassword.module.css';

const ResetPassword = () => {
  const { uid, token } = useParams();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!uid || !token) {
      setError('Invalid reset link. Please request a new password reset.');
    }
  }, [uid, token]);

  const checkPasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    if (/[^A-Za-z0-9]/.test(password)) strength += 25;
    return strength;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (name === 'newPassword') {
      setPasswordStrength(checkPasswordStrength(value));
    }
    
    // Clear errors when user types
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!formData.newPassword || !formData.confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (passwordStrength < 75) {
      setError('Password is too weak. Please use a stronger password.');
      return;
    }

    setIsLoading(true);

    try {
      // Replace with your actual API endpoint
      const response = await fetch('/api/auth/password/reset/confirm/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid,
          token,
          new_password: formData.newPassword,
          re_new_password: formData.confirmPassword
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Password has been reset successfully!');
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setError(data.error || 'Failed to reset password. The link may have expired.');
      }
    // eslint-disable-next-line no-unused-vars
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStrengthColor = () => {
    if (passwordStrength < 25) return '#f44336';
    if (passwordStrength < 50) return '#ff9800';
    if (passwordStrength < 75) return '#ffeb3b';
    return '#4caf50';
  };

  const getStrengthText = () => {
    if (passwordStrength < 25) return 'Very Weak';
    if (passwordStrength < 50) return 'Weak';
    if (passwordStrength < 75) return 'Fair';
    if (passwordStrength < 100) return 'Good';
    return 'Strong';
  };

  if (!uid || !token) {
    return (
      <div className={styles.forgotPasswordContainer}>
        <div className={styles.forgotPasswordCard}>
          <div className={styles.logoSection}>
            <Link to="/" className={styles.logoLink}>
              <img 
                src="/izozo.png" 
                alt="Izozo Marketplace" 
                className={styles.logo}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "https://via.placeholder.com/120x40/150c09/ffffff?text=IZOZO";
                }}
              />
            </Link>
          </div>
          
          <div className={styles.errorMessage}>
            <div className={styles.errorIcon}>!</div>
            <p>Invalid reset link. Please request a new password reset.</p>
          </div>
          
          <div className={styles.additionalLinks}>
            <Link to="/forgot-password" className={styles.backToLoginButton}>
              Request New Reset Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.forgotPasswordContainer}>
      <div className={styles.forgotPasswordCard}>
        {/* Logo */}
        <div className={styles.logoSection}>
          <Link to="/" className={styles.logoLink}>
            <img 
              src="/izozo.png" 
              alt="Izozo Marketplace" 
              className={styles.logo}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "https://via.placeholder.com/120x40/150c09/ffffff?text=IZOZO";
              }}
            />
          </Link>
        </div>

        {/* Title */}
        <div className={styles.headerSection}>
          <h1 className={styles.title}>Reset Your Password</h1>
          <p className={styles.subtitle}>
            Create a new password for your account
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className={styles.successMessage}>
            <div className={styles.successIcon}>✓</div>
            <p>{success}</p>
            <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>
              Redirecting to login page...
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className={styles.errorMessage}>
            <div className={styles.errorIcon}>!</div>
            <p>{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="newPassword" className={styles.label}>
              New Password
            </label>
            <div className={styles.inputGroup}>
              <span className={styles.inputIcon}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                </svg>
              </span>
              <input
                type={showPassword ? "text" : "password"}
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                className={styles.input}
                placeholder="Enter new password"
                disabled={isLoading || success}
                required
              />
              <button
                type="button"
                className={styles.showPasswordButton}
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
                    <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
                    <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
                    <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
                  </svg>
                )}
              </button>
            </div>
            
            {/* Password Strength Meter */}
            {formData.newPassword && (
              <div className={styles.passwordStrength}>
                <div className={styles.strengthMeter}>
                  <div 
                    className={styles.strengthBar} 
                    style={{ 
                      width: `${passwordStrength}%`,
                      backgroundColor: getStrengthColor()
                    }}
                  ></div>
                </div>
                <div className={styles.strengthText}>
                  <span>Strength: </span>
                  <strong style={{ color: getStrengthColor() }}>
                    {getStrengthText()}
                  </strong>
                </div>
              </div>
            )}
            
            {/* Password Requirements */}
            <div className={styles.passwordRequirements}>
              <p className={styles.requirementsTitle}>Password must contain:</p>
              <ul className={styles.requirementsList}>
                <li className={formData.newPassword.length >= 8 ? styles.requirementMet : ''}>
                  At least 8 characters
                </li>
                <li className={/[A-Z]/.test(formData.newPassword) ? styles.requirementMet : ''}>
                  One uppercase letter
                </li>
                <li className={/[0-9]/.test(formData.newPassword) ? styles.requirementMet : ''}>
                  One number
                </li>
                <li className={/[^A-Za-z0-9]/.test(formData.newPassword) ? styles.requirementMet : ''}>
                  One special character
                </li>
              </ul>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>
              Confirm New Password
            </label>
            <div className={styles.inputGroup}>
              <span className={styles.inputIcon}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                </svg>
              </span>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={styles.input}
                placeholder="Confirm new password"
                disabled={isLoading || success}
                required
              />
            </div>
            {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
              <p className={styles.passwordError}>Passwords do not match</p>
            )}
          </div>

          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={isLoading || success || passwordStrength < 75 || formData.newPassword !== formData.confirmPassword}
          >
            {isLoading ? (
              <>
                <span className={styles.spinner}></span>
                Resetting Password...
              </>
            ) : (
              'Reset Password'
            )}
          </button>

          <div className={styles.backToLogin}>
            <Link to="/login" className={styles.backLink}>
              ← Back to Login
            </Link>
          </div>
        </form>

        {/* Additional Links */}
        <div className={styles.additionalLinks}>
          <p className={styles.accountText}>
            Remembered your password? <Link to="/login" className={styles.registerLink}>Login here</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;