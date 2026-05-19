/* eslint-disable no-unused-vars */


import { useState, useEffect } from 'react';
import { computeOrderPaxiTier, PAXI_TIERS } from '../services/checkoutService';

// ── Tiny inline styles so the component is self-contained ──────────────────

const styles = {
  wrapper: {
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  heading: {
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#6b7280',
    marginBottom: '4px',
  },
  card: (selected, disabled) => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    padding: '16px 18px',
    borderRadius: '12px',
    border: selected
      ? '2px solid #1d4ed8'
      : disabled
      ? '1.5px solid #e5e7eb'
      : '1.5px solid #d1d5db',
    background: selected
      ? '#eff6ff'
      : disabled
      ? '#f9fafb'
      : '#ffffff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
    boxShadow: selected ? '0 0 0 4px rgba(29,78,216,0.08)' : 'none',
    position: 'relative',
  }),
  radio: {
    width: '18px',
    height: '18px',
    marginTop: '2px',
    flexShrink: 0,
    accentColor: '#1d4ed8',
  },
  body: {
    flex: 1,
  },
  tierLabel: (selected) => ({
    fontWeight: 600,
    fontSize: '15px',
    color: selected ? '#1d4ed8' : '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }),
  badge: (category) => {
    const map = {
      SMALL:  { bg: '#d1fae5', color: '#065f46' },
      MEDIUM: { bg: '#fef3c7', color: '#92400e' },
      LARGE:  { bg: '#fee2e2', color: '#991b1b' },
    };
    const { bg, color } = map[category] || { bg: '#f3f4f6', color: '#374151' };
    return {
      display: 'inline-block',
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '0.06em',
      padding: '2px 8px',
      borderRadius: '999px',
      background: bg,
      color,
    };
  },
  description: {
    fontSize: '13px',
    color: '#6b7280',
    marginTop: '3px',
  },
  eta: {
    fontSize: '12px',
    color: '#9ca3af',
    marginTop: '2px',
  },
  price: {
    fontWeight: 700,
    fontSize: '16px',
    color: '#111827',
    alignSelf: 'center',
    flexShrink: 0,
    minWidth: '60px',
    textAlign: 'right',
  },
  requiredTag: {
    position: 'absolute',
    top: '10px',
    right: '14px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#1d4ed8',
    background: '#dbeafe',
    padding: '2px 8px',
    borderRadius: '999px',
  },
  breakdown: {
    marginTop: '4px',
    padding: '12px 14px',
    background: '#f8fafc',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
  },
  breakdownTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#64748b',
    marginBottom: '8px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  breakdownRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    color: '#475569',
    padding: '3px 0',
    borderBottom: '1px solid #f1f5f9',
  },
  breakdownCategory: (cat) => {
    const map = { SMALL: '#065f46', MEDIUM: '#92400e', LARGE: '#991b1b' };
    return { fontWeight: 600, color: map[cat] || '#374151' };
  },
  warning: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '10px 14px',
    background: '#fffbeb',
    border: '1px solid #fcd34d',
    borderRadius: '10px',
    fontSize: '13px',
    color: '#92400e',
  },
  noData: {
    padding: '14px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '10px',
    fontSize: '13px',
    color: '#b91c1c',
  },
};

// ── Component ──────────────────────────────────────────────────────────────

/**
 * PaxiDeliverySelector
 *
 * Props:
 *   cartItems       {Array}    – cart items with dimension fields
 *   selectedTierId  {string}   – id of the currently selected tier (controlled)
 *   onSelect        {Function} – called with the full tier object on selection
 *   showBreakdown   {boolean}  – show per-item size breakdown (default true)
 */
export default function PaxiDeliverySelector({
  cartItems = [],
  selectedTierId,
  onSelect,
  showBreakdown = true,
}) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // computeOrderPaxiTier is synchronous — wrap in timeout to allow spinner
    const timeout = setTimeout(() => {
      const computed = computeOrderPaxiTier(cartItems);
      setResult(computed);

      // Auto-select the recommended tier if nothing is selected yet
      if (!selectedTierId && computed?.tier) {
        onSelect?.(computed.tier);
      }
      setLoading(false);
    }, 80);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems, selectedTierId]);

  if (loading) {
    return (
      <div style={{ color: '#9ca3af', fontSize: '14px', padding: '12px 0' }}>
        Calculating delivery options…
      </div>
    );
  }

  if (!result) return null;

  const { category: recommendedCategory, tier: recommendedTier, itemBreakdown } = result;
  const rank = { SMALL: 0, MEDIUM: 1, LARGE: 2 };

  // Check if any item is missing dimensions
  const hasMissingDims = itemBreakdown.some((item) => !item.category);

  const tiers = Object.entries(PAXI_TIERS)
  .filter(([key]) => key === recommendedCategory)
  .map(([key, t]) => ({
    ...t,
    _key: key,
    isRecommended: true,
    isDisabled: false,
  }));

  return (
    <div style={styles.wrapper}>
      <p style={styles.heading}>Delivery Method</p>

      {tiers.map((tier) => {
        const selected = tier.id === selectedTierId;
        return (
          <div
            key={tier.id}
            style={styles.card(selected, tier.isDisabled)}
            onClick={() => {
              if (!tier.isDisabled) onSelect?.(tier);
            }}
            role="radio"
            aria-checked={selected}
            aria-disabled={tier.isDisabled}
            tabIndex={tier.isDisabled ? -1 : 0}
            onKeyDown={(e) => {
              if (!tier.isDisabled && (e.key === 'Enter' || e.key === ' ')) {
                onSelect?.(tier);
              }
            }}
          >
            <input
              type="radio"
              style={styles.radio}
              checked={selected}
              disabled={tier.isDisabled}
              readOnly
              tabIndex={-1}
            />

            <div style={styles.body}>
              <div style={styles.tierLabel(selected)}>
                <span>{tier.icon}</span>
                <span>{tier.label}</span>
                <span style={styles.badge(tier._key)}>{tier._key}</span>
              </div>
              <div style={styles.description}>{tier.description}</div>
              <div style={styles.eta}>🕐 {tier.estimatedDays}</div>
            </div>

            <div style={styles.price}>R{tier.price.toFixed(2)}</div>
           
          </div>
        );
      })}

    </div>
  );
}