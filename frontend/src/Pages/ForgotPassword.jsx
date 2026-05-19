/* eslint-disable no-unused-vars */
// frontend/src/Pages/ForgotPassword.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import passwordResetService from '../services/passwordResetService';
import styles from './ForgotPassword.module.css';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const response = await passwordResetService.requestReset(email);
      setSuccess(true);
      setSubmittedEmail(email);
      setEmail('');
    } catch (err) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!submittedEmail) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      await passwordResetService.requestReset(submittedEmail);
    } catch (err) {
      setError(err.message || 'Failed to resend email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.forgotPasswordPage}>
      <div className="container">
        <div className={styles.forgotPasswordContainer}>
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

          {!success ? (
            <>
              <h1 className={styles.title}>Forgot Password</h1>
              <p className={styles.subtitle}>
                Enter your email address and we'll send you a link to reset your password.
              </p>

              {error && (
                <div className={styles.errorAlert}>
                  <span className={styles.errorIcon}>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formGroup}>
                  <label htmlFor="email" className={styles.label}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className={styles.input}
                    required
                    disabled={isLoading}
                  />
                </div>

                <button 
                  type="submit" 
                  className={`${styles.submitButton} ${isLoading ? styles.loading : ''}`}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className={styles.spinner}></span>
                      Sending...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>

              <div className={styles.links}>
                <Link to="/login" className={styles.link}>
                  ← Back to Login
                </Link>
              </div>
            </>
          ) : (
            <div className={styles.successContainer}>
              <div className={styles.successIcon}>✉️</div>
              <h2 className={styles.successTitle}>Check Your Email</h2>
              <p className={styles.successMessage}>
                We've sent a password reset link to <strong>{submittedEmail}</strong>
              </p>
              <p className={styles.successInstructions}>
                Click the link in the email to reset your password. The link will expire in 24 hours.
              </p>
              
              <div className={styles.successActions}>
                <button 
                  onClick={handleResend}
                  className={styles.resendButton}
                  disabled={isLoading}
                >
                  {isLoading ? 'Sending...' : 'Resend Email'}
                </button>
                <Link to="/login" className={styles.backToLogin}>
                  Back to Login
                </Link>
              </div>

              <p className={styles.helpText}>
                Didn't receive the email? Check your spam folder or{' '}
                <button onClick={handleResend} className={styles.textButton}>
                  try again
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;