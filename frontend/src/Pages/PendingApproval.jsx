import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styles from './PendingApproval.module.css';

const ROLE_LABELS = {
  sme: 'Business Owner',
  agent: 'Sales Agent',
  delivery: 'Delivery Partner',
};

const ROLE_EMOJIS = {
  sme: '🏢',
  agent: '🤝',
  delivery: '🚚',
};

export default function PendingApproval() {
  const { user, refreshUser, logout, getDashboardPath } = useAuth();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(false);
  const [justChecked, setJustChecked] = useState(false);

  const roleLabel = ROLE_LABELS[user?.role] || 'Partner';
  const roleEmoji = ROLE_EMOJIS[user?.role] || '👤';

  const handleCheckStatus = async () => {
    setIsChecking(true);
    setJustChecked(false);

    // Re-fetch user from /auth/me/ — if status changed to active,
    // refreshUser() updates the user object in AuthContext
    await refreshUser();

    // Small delay so the spinner feels intentional
    await new Promise(r => setTimeout(r, 600));

    setIsChecking(false);
    setJustChecked(true);

    // Re-read user from context after refresh
    // If now active, redirect to their dashboard
    const freshUser = user; // AuthContext updates user state in place
    if (freshUser?.status === 'active') {
      navigate(getDashboardPath());
    } else {
      // Reset "just checked" message after 4 seconds
      setTimeout(() => setJustChecked(false), 4000);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* Top accent bar */}
        <div className={styles.accentBar} />

        {/* Role badge */}
        <div className={styles.roleBadge}>
          <span>{roleEmoji}</span>
          <span>{roleLabel} Application</span>
        </div>

        {/* Icon + heading */}
        <div className={styles.iconWrap}>
          <span className={styles.icon}>⏳</span>
        </div>
        <h1 className={styles.title}>Your application is under review</h1>
        <p className={styles.subtitle}>
          Hi <strong>{user?.full_name?.split(' ')[0]}</strong>, your account has been created
          and our team is reviewing your details. You'll receive an email at{' '}
          <strong>{user?.email}</strong> once you're approved.
        </p>

        {/* Progress tracker */}
        <div className={styles.tracker}>
          <div className={styles.trackerStep}>
            <div className={`${styles.trackerDot} ${styles.dotDone}`}>✓</div>
            <div className={styles.trackerText}>
              <span className={styles.trackerLabel}>Application submitted</span>
              <span className={styles.trackerSub}>Your details have been received</span>
            </div>
          </div>

          <div className={styles.trackerLine} />

          <div className={styles.trackerStep}>
            <div className={`${styles.trackerDot} ${styles.dotActive}`}>
              <span className={styles.dotPulse} />
            </div>
            <div className={styles.trackerText}>
              <span className={styles.trackerLabel}>Admin review</span>
              <span className={styles.trackerSub}>Usually 2–3 business days</span>
            </div>
          </div>

          <div className={styles.trackerLine} />

          <div className={styles.trackerStep}>
            <div className={`${styles.trackerDot} ${styles.dotPending}`}>3</div>
            <div className={styles.trackerText}>
              <span className={styles.trackerLabel}>Account activated</span>
              <span className={styles.trackerSub}>You'll get an email confirmation</span>
            </div>
          </div>
        </div>

        {/* Check status button */}
        <button
          className={styles.checkBtn}
          onClick={handleCheckStatus}
          disabled={isChecking}
        >
          {isChecking ? (
            <>
              <span className={styles.spinner} />
              Checking…
            </>
          ) : (
            'Check my status'
          )}
        </button>

        {/* Feedback after checking */}
        {justChecked && !isChecking && (
          <p className={styles.stillPending}>
            Still pending — we'll email you at <strong>{user?.email}</strong> the moment you're approved.
          </p>
        )}

        {/* Info note */}
        <div className={styles.infoNote}>
          <span className={styles.infoIcon}>💡</span>
          <p>
            While you wait, make sure you have access to your email inbox. 
            Your approval notification will come from{' '}
            <strong>support@izozo.co.za</strong>.
          </p>
        </div>

        {/* Footer actions */}
        <div className={styles.footer}>
          <p>Not you, or registered by mistake?</p>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Sign out
          </button>
        </div>

      </div>
    </div>
  );
}