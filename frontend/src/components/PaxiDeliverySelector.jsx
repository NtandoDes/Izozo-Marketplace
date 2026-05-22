import { useState, useEffect, useRef } from 'react';
import { computeOrderPaxiTier, PAXI_TIERS } from '../services/checkoutService';

const s = {
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
  card: (selected) => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    padding: '16px 18px',
    borderRadius: '12px',
    border: selected ? '2px solid #fbbf24' : '1.5px solid #d1d5db',
    background: selected ? '#fffbeb' : '#ffffff',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
    boxShadow: selected ? '0 0 0 4px rgba(251,191,36,0.15)' : 'none',
  }),
  radio: {
    width: '18px',
    height: '18px',
    marginTop: '2px',
    flexShrink: 0,
    accentColor: '#fbbf24',
  },
  body: { flex: 1 },
  tierLabel: (selected) => ({
    fontWeight: 600,
    fontSize: '15px',
    color: selected ? '#92400e' : '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }),
  badge: (category) => {
    const map = {
      SMALL: { bg: '#fef9c3', color: '#92400e' },
      LARGE: { bg: '#fee2e2', color: '#991b1b' },
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
  description: { fontSize: '13px', color: '#6b7280', marginTop: '3px' },
  eta:         { fontSize: '12px', color: '#9ca3af', marginTop: '2px' },
  price: {
    fontWeight: 700,
    fontSize: '16px',
    color: '#111827',
    alignSelf: 'center',
    flexShrink: 0,
    minWidth: '60px',
    textAlign: 'right',
  },
};

export default function PaxiDeliverySelector({
  cartItems = [],
  selectedTierId,
  onSelect,
  showBreakdown = false, // unused — breakdown removed
}) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  // Key includes both identity AND quantity — any qty change triggers recompute
  const itemsKey = cartItems
    .map((i) => `${i.product_id ?? i.id}:${i.quantity}`)
    .join(',');

  const prevCategoryRef = useRef(null);

  useEffect(() => {
    if (!cartItems.length) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const timeout = setTimeout(() => {
      const computed = computeOrderPaxiTier(cartItems);
      setResult(computed);

      const newCategory = computed.category;

      // Always call onSelect when:
      //  a) nothing selected yet
      //  b) tier category changed (qty pushed SMALL → LARGE or back)
      if (!selectedTierId || prevCategoryRef.current !== newCategory) {
        onSelect?.(computed.tier);
      }

      prevCategoryRef.current = newCategory;
      setLoading(false);
    }, 80);

    return () => clearTimeout(timeout);
    // NOTE: intentionally exclude selectedTierId from deps — we don't want
    // a tier selection to re-trigger computation. Only item changes matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  if (loading) {
    return (
      <div style={{ color: '#9ca3af', fontSize: '14px', padding: '12px 0' }}>
        Calculating delivery options…
      </div>
    );
  }

  if (!result) return null;

  const { category: recommendedCategory } = result;

  const tiers = Object.entries(PAXI_TIERS)
    .filter(([key]) => key === recommendedCategory)
    .map(([key, t]) => ({ ...t, _key: key }));

  return (
    <div style={s.wrapper}>
      <p style={s.heading}>Delivery Method</p>

      {tiers.map((t) => {
        const selected = t.id === selectedTierId;
        return (
          <div
            key={t.id}
            style={s.card(selected)}
            onClick={() => onSelect?.(t)}
            role="radio"
            aria-checked={selected}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelect?.(t);
            }}
          >
            <input
              type="radio"
              style={s.radio}
              checked={selected}
              readOnly
              tabIndex={-1}
            />
            <div style={s.body}>
              <div style={s.tierLabel(selected)}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
                <span style={s.badge(t._key)}>{t._key}</span>
              </div>
              <div style={s.description}>{t.description}</div>
              <div style={s.eta}>🕐 {t.estimatedDays}</div>
            </div>
            <div style={s.price}>R{t.price.toFixed(2)}</div>
          </div>
        );
      })}
    </div>
  );
}