/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import agentService from '../../services/agentService';
import styles from './AgentCommission.module.css';

const AgentCommission = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Commission data
  const [summary, setSummary] = useState({
    total_commission: 0,
    pending_commission: 0,
    paid_commission: 0,
    this_month: 0,
    last_month: 0,
    currency: 'ZAR'
  });
  
  const [commissionHistory, setCommissionHistory] = useState([]);
  const [commissionBySME, setCommissionBySME] = useState([]);
  const [recentPayouts, setRecentPayouts] = useState([]);
  
  // Filter states
  const [dateRange, setDateRange] = useState('this_month');
  const [selectedSME, setSelectedSME] = useState('all');
  const [assignedSMEs, setAssignedSMEs] = useState([]);
  
  // Payout modal
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('bank_transfer');
  const [processingPayout, setProcessingPayout] = useState(false);

  // Load initial data
  useEffect(() => {
    loadCommissionData();
    loadAssignedSMEs();
  }, []);

  // Reload when date range changes
  useEffect(() => {
    if (!loading) {
      loadCommissionHistory();
    }
  }, [dateRange, selectedSME]);

  const loadCommissionData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get commission summary
      const summaryData = await agentService.getCommissionSummary();
      setSummary(summaryData);
      
      // Get commission history
      await loadCommissionHistory();
      
      // Get commission by SME
      await loadCommissionBySME();
      
      // Get recent payouts
      await loadRecentPayouts();
      
    } catch (err) {
      console.error('Error loading commission data:', err);
      setError('Failed to load commission data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCommissionHistory = async () => {
    try {
      const filters = {};
      
      // Set date range filter
      const now = new Date();
      if (dateRange === 'this_month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        filters.start_date = startOfMonth.toISOString().split('T')[0];
        filters.end_date = now.toISOString().split('T')[0];
      } else if (dateRange === 'last_month') {
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        filters.start_date = startOfLastMonth.toISOString().split('T')[0];
        filters.end_date = endOfLastMonth.toISOString().split('T')[0];
      } else if (dateRange === 'last_90_days') {
        const ninetyDaysAgo = new Date(now.setDate(now.getDate() - 90));
        filters.start_date = ninetyDaysAgo.toISOString().split('T')[0];
        filters.end_date = new Date().toISOString().split('T')[0];
      }
      
      // Add SME filter
      if (selectedSME !== 'all') {
        filters.sme_id = selectedSME;
      }
      
      const history = await agentService.getCommissionHistory(filters);
      setCommissionHistory(history);
      
    } catch (err) {
      console.error('Error loading commission history:', err);
    }
  };

  const loadCommissionBySME = async () => {
    try {
      // This would come from a separate endpoint in production
      // For now, we'll simulate with dashboard stats
      const stats = await agentService.getDashboardStats();
      setCommissionBySME(stats.smeStats || []);
    } catch (err) {
      console.error('Error loading commission by SME:', err);
      setCommissionBySME([]);
    }
  };

  const loadAssignedSMEs = async () => {
    try {
      const smes = await agentService.getAssignedSMEs();
      setAssignedSMEs(smes);
    } catch (err) {
      console.error('Error loading assigned SMEs:', err);
    }
  };

  const loadRecentPayouts = async () => {
    try {
      // This would come from a separate endpoint in production
      // For now, we'll use a subset of commission history with 'paid' status
      const history = await agentService.getCommissionHistory({ limit: 5 });
      const payouts = history.filter(item => item.status === 'paid').slice(0, 5);
      setRecentPayouts(payouts);
    } catch (err) {
      console.error('Error loading recent payouts:', err);
      setRecentPayouts([]);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadCommissionData();
  };

  const handleRequestPayout = async () => {
    if (!payoutAmount || parseFloat(payoutAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (parseFloat(payoutAmount) > summary.pending_commission) {
      alert(`Amount exceeds your available pending commission of ${formatCurrency(summary.pending_commission)}`);
      return;
    }

    setProcessingPayout(true);
    setError(null);

    try {
      await agentService.requestPayout(parseFloat(payoutAmount));
      
      // Show success message
      alert(`Payout request of ${formatCurrency(parseFloat(payoutAmount))} submitted successfully!`);
      
      // Close modal and reset
      setShowPayoutModal(false);
      setPayoutAmount('');
      setPayoutMethod('bank_transfer');
      
      // Refresh data
      await loadCommissionData();
      
    } catch (err) {
      console.error('Error requesting payout:', err);
      setError(err.message || 'Failed to request payout. Please try again.');
    } finally {
      setProcessingPayout(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return 'R0.00';
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return styles.statusPaid;
      case 'pending':
        return styles.statusPending;
      case 'processing':
        return styles.statusProcessing;
      case 'cancelled':
        return styles.statusCancelled;
      default:
        return styles.statusPending;
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading your commission dashboard...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Commission Dashboard</h1>
          <p className={styles.subtitle}>
            Track your earnings and manage payouts
          </p>
        </div>
        <div className={styles.headerActions}>
          <button 
            onClick={handleRefresh} 
            className={styles.refreshButton}
            disabled={refreshing}
          >
            {refreshing ? '⟳ Refreshing...' : '⟳ Refresh'}
          </button>
          <button 
            onClick={() => setShowPayoutModal(true)}
            className={styles.payoutButton}
            disabled={summary.pending_commission <= 0}
          >
            💰 Request Payout
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.errorAlert}>
          <div className={styles.errorIcon}>❌</div>
          <div className={styles.errorContent}>
            <h3>Error</h3>
            <p>{error}</p>
          </div>
          <button onClick={() => setError(null)} className={styles.closeButton}>×</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={styles.cardIcon} style={{ backgroundColor: 'rgba(242, 192, 26, 0.1)' }}>
            💰
          </div>
          <div className={styles.cardContent}>
            <span className={styles.cardLabel}>Total Commission</span>
            <span className={styles.cardValue}>{formatCurrency(summary.total_commission)}</span>
            <span className={styles.cardSubtext}>Lifetime earnings</span>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.cardIcon} style={{ backgroundColor: 'rgba(255, 152, 0, 0.1)' }}>
            ⏳
          </div>
          <div className={styles.cardContent}>
            <span className={styles.cardLabel}>Pending Commission</span>
            <span className={styles.cardValue}>{formatCurrency(summary.pending_commission)}</span>
            <span className={styles.cardSubtext}>Available for payout</span>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.cardIcon} style={{ backgroundColor: 'rgba(0, 200, 83, 0.1)' }}>
            ✅
          </div>
          <div className={styles.cardContent}>
            <span className={styles.cardLabel}>Paid Commission</span>
            <span className={styles.cardValue}>{formatCurrency(summary.paid_commission)}</span>
            <span className={styles.cardSubtext}>Total paid out</span>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.cardIcon} style={{ backgroundColor: 'rgba(33, 150, 243, 0.1)' }}>
            📊
          </div>
          <div className={styles.cardContent}>
            <span className={styles.cardLabel}>This Month</span>
            <span className={styles.cardValue}>{formatCurrency(summary.this_month)}</span>
            <span className={styles.cardSubtext}>
              {summary.last_month > 0 && (
                <>
                  {((summary.this_month - summary.last_month) / summary.last_month * 100).toFixed(1)}% vs last month
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className={styles.quickActions}>
        <div className={styles.quickActionCard}>
          <div className={styles.quickActionIcon}>📈</div>
          <div className={styles.quickActionContent}>
            <h4>Available for Payout</h4>
            <p className={styles.quickActionAmount}>{formatCurrency(summary.pending_commission)}</p>
            <button 
              onClick={() => setShowPayoutModal(true)}
              className={styles.quickActionButton}
              disabled={summary.pending_commission <= 0}
            >
              Request Payout
            </button>
          </div>
        </div>
        
        <div className={styles.quickActionCard}>
          <div className={styles.quickActionIcon}>🏦</div>
          <div className={styles.quickActionContent}>
            <h4>Payout Methods</h4>
            <p>Bank Transfer • Instant EFT</p>
            <Link to="/account" className={styles.quickActionLink}>
              Manage Payment Methods
            </Link>
          </div>
        </div>
        
        <div className={styles.quickActionCard}>
          <div className={styles.quickActionIcon}>📋</div>
          <div className={styles.quickActionContent}>
            <h4>Commission Rate</h4>
            <p className={styles.commissionRate}>10% on all sales</p>
            <span className={styles.commissionBadge}>Standard Rate</span>
          </div>
        </div>
      </div>

      {/* Commission by SME */}
      {commissionBySME.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Commission by SMME</h2>
            <Link to="/agent/smes" className={styles.viewAllLink}>
              View All SMMEs →
            </Link>
          </div>
          <div className={styles.smeGrid}>
            {commissionBySME.slice(0, 4).map(sme => (
              <div key={sme.id} className={styles.smeCard}>
                <div className={styles.smeHeader}>
                  <div className={styles.smeAvatar}>
                    {sme.business_name?.charAt(0) || 'B'}
                  </div>
                  <div className={styles.smeInfo}>
                    <h4>{sme.business_name}</h4>
                    <span className={styles.smeType}>{sme.business_type || 'General'}</span>
                  </div>
                </div>
                <div className={styles.smeStats}>
                  <div className={styles.smeStat}>
                    <span className={styles.statLabel}>Products</span>
                    <span className={styles.statValue}>{sme.productsCount || 0}</span>
                  </div>
                  <div className={styles.smeStat}>
                    <span className={styles.statLabel}>Orders</span>
                    <span className={styles.statValue}>{sme.ordersCount || 0}</span>
                  </div>
                  <div className={styles.smeStat}>
                    <span className={styles.statLabel}>Revenue</span>
                    <span className={styles.statValue}>{formatCurrency(sme.totalRevenue || 0)}</span>
                  </div>
                  <div className={styles.smeStat}>
                    <span className={styles.statLabel}>Your Commission</span>
                    <span className={styles.statValueCommission}>
                      {formatCurrency((sme.totalRevenue || 0) * 0.1)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commission History */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Commission History</h2>
          <div className={styles.filterControls}>
            <select 
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="last_90_days">Last 90 Days</option>
              <option value="all_time">All Time</option>
            </select>
            
            <select 
              value={selectedSME} 
              onChange={(e) => setSelectedSME(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All SMEs</option>
              {assignedSMEs.map(sme => (
                <option key={sme.id} value={sme.id}>
                  {sme.business_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {commissionHistory.length > 0 ? (
          <div className={styles.tableContainer}>
            <table className={styles.historyTable}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Order ID</th>
                  <th>SMME</th>
                  <th>Product</th>
                  <th>Order Amount</th>
                  <th>Commission</th>
                  <th>Status</th>
                  <th>Paid Date</th>
                </tr>
              </thead>
              <tbody>
                {commissionHistory.map((item, index) => (
                  <tr key={index}>
                    <td>{formatDate(item.created_at || item.date)}</td>
                    <td>
                      <Link to={`/agent/orders/${item.order_id}`} className={styles.orderLink}>
                        #{item.order_id}
                      </Link>
                    </td>
                    <td>{item.sme_name || item.sme?.business_name || 'Unknown'}</td>
                    <td>{item.product_name || 'Multiple Items'}</td>
                    <td>{formatCurrency(item.order_amount || 0)}</td>
                    <td className={styles.commissionAmount}>
                      {formatCurrency(item.commission_amount || 0)}
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${getStatusBadgeClass(item.status)}`}>
                        {item.status || 'Pending'}
                      </span>
                    </td>
                    <td>{item.paid_at ? formatDate(item.paid_at) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>💰</div>
            <h3>No Commission History</h3>
            <p>You haven't earned any commission yet. Start selling to see your earnings here!</p>
            <Link to="/agent/products/create" className={styles.emptyButton}>
              Create Your First Product
            </Link>
          </div>
        )}
      </div>

      {/* Recent Payouts */}
      {recentPayouts.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Recent Payouts</h2>
            <Link to="/agent/payouts" className={styles.viewAllLink}>
              View All Payouts →
            </Link>
          </div>
          <div className={styles.payoutsList}>
            {recentPayouts.map((payout, index) => (
              <div key={index} className={styles.payoutItem}>
                <div className={styles.payoutIcon}>
                  {payout.status === 'paid' ? '✅' : '⏳'}
                </div>
                <div className={styles.payoutDetails}>
                  <div className={styles.payoutHeader}>
                    <span className={styles.payoutAmount}>
                      {formatCurrency(payout.commission_amount || 0)}
                    </span>
                    <span className={`${styles.payoutStatus} ${getStatusBadgeClass(payout.status)}`}>
                      {payout.status}
                    </span>
                  </div>
                  <div className={styles.payoutMeta}>
                    <span>Requested: {formatDate(payout.created_at)}</span>
                    {payout.paid_at && (
                      <span>Paid: {formatDate(payout.paid_at)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payout Request Modal */}
      {showPayoutModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Request Payout</h3>
              <button 
                onClick={() => {
                  setShowPayoutModal(false);
                  setPayoutAmount('');
                  setError(null);
                }} 
                className={styles.modalClose}
              >
                ×
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.availableBalance}>
                <span>Available Balance</span>
                <strong>{formatCurrency(summary.pending_commission)}</strong>
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Payout Amount <span className={styles.required}>*</span>
                </label>
                <div className={styles.amountInput}>
                  <span className={styles.currencySymbol}>R</span>
                  <input
                    type="number"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    max={summary.pending_commission}
                    step="0.01"
                    className={styles.input}
                  />
                </div>
                {summary.pending_commission > 0 && (
                  <button 
                    type="button"
                    onClick={() => setPayoutAmount(summary.pending_commission)}
                    className={styles.maxButton}
                  >
                    Max
                  </button>
                )}
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.label}>Payout Method</label>
                <select 
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  className={styles.select}
                >
                  <option value="bank_transfer">Bank Transfer (1-2 business days)</option>
                  <option value="instant_eft">Instant EFT (Immediate)</option>
                  <option value="paypal">PayPal</option>
                </select>
              </div>
              
              <div className={styles.payoutInfo}>
                <div className={styles.infoRow}>
                  <span>Payout Amount:</span>
                  <strong>{formatCurrency(parseFloat(payoutAmount) || 0)}</strong>
                </div>
                <div className={styles.infoRow}>
                  <span>Processing Fee:</span>
                  <strong>{formatCurrency(parseFloat(payoutAmount || 0) * 0.02)}</strong>
                </div>
                <div className={styles.infoRowTotal}>
                  <span>You'll Receive:</span>
                  <strong>{formatCurrency(parseFloat(payoutAmount || 0) * 0.98)}</strong>
                </div>
              </div>
              
              {error && (
                <div className={styles.modalError}>
                  {error}
                </div>
              )}
            </div>
            
            <div className={styles.modalFooter}>
              <button 
                onClick={() => {
                  setShowPayoutModal(false);
                  setPayoutAmount('');
                  setError(null);
                }} 
                className={styles.cancelButton}
              >
                Cancel
              </button>
              <button 
                onClick={handleRequestPayout}
                disabled={processingPayout || !payoutAmount || parseFloat(payoutAmount) <= 0}
                className={styles.confirmButton}
              >
                {processingPayout ? (
                  <>
                    <span className={styles.buttonSpinner}></span>
                    Processing...
                  </>
                ) : (
                  'Request Payout'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentCommission;