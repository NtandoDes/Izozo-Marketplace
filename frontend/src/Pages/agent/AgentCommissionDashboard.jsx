// frontend/src/components/agent/AgentCommissionDashboard.jsx
import React, { useState, useEffect } from 'react';
import { agentService } from '../../services/agentService';
import styles from './AgentCommissionDashboard.module.css';

const AgentCommissionDashboard = () => {
  const [commission, setCommission] = useState({
    total_commission: 0,
    pending_commission: 0,
    paid_commission: 0,
    this_month: 0,
    last_month: 0,
    by_sme: []
  });
  
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState('month');

  useEffect(() => {
    fetchCommissionData();
  }, [dateRange]);

  const fetchCommissionData = async () => {
    setLoading(true);
    try {
      const [summary, historyData] = await Promise.all([
        agentService.getCommissionSummary(),
        agentService.getCommissionHistory({ limit: 20 })
      ]);
      
      setCommission(summary);
      setHistory(historyData);
    } catch (error) {
      console.error('Error fetching commission data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'R0.00';
    return `R${parseFloat(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const growthPercentage = commission.last_month > 0 
    ? ((commission.this_month - commission.last_month) / commission.last_month * 100).toFixed(1)
    : commission.this_month > 0 ? 100 : 0;

  return (
    <div className={styles.commissionSection}>
      <div className={styles.sectionHeader}>
        <h2>Commission Dashboard</h2>
        <select 
          value={dateRange} 
          onChange={(e) => setDateRange(e.target.value)}
          className={styles.rangeSelect}
        >
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="year">This Year</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Loading commission data...</p>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}>
                💰
              </div>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>Total Commission</span>
                <span className={styles.statValue}>{formatCurrency(commission.total_commission)}</span>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ backgroundColor: 'rgba(33, 150, 243, 0.1)' }}>
                ⏳
              </div>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>Pending</span>
                <span className={styles.statValue}>{formatCurrency(commission.pending_commission)}</span>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ backgroundColor: 'rgba(0, 200, 83, 0.1)' }}>
                ✅
              </div>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>Paid</span>
                <span className={styles.statValue}>{formatCurrency(commission.paid_commission)}</span>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ backgroundColor: 'rgba(156, 39, 176, 0.1)' }}>
                📈
              </div>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>This Month</span>
                <span className={styles.statValue}>{formatCurrency(commission.this_month)}</span>
                <span className={`${styles.growthBadge} ${growthPercentage >= 0 ? styles.positive : styles.negative}`}>
                  {growthPercentage >= 0 ? '↑' : '↓'} {Math.abs(growthPercentage)}%
                </span>
              </div>
            </div>
          </div>

          {/* Commission by SME */}
          {commission.by_sme && commission.by_sme.length > 0 && (
            <div className={styles.smeSection}>
              <h3>Commission by SMME</h3>
              <div className={styles.smeList}>
                {commission.by_sme.map((item, index) => (
                  <div key={index} className={styles.smeItem}>
                    <span className={styles.smeName}>{item.sme_name}</span>
                    <div className={styles.smeStats}>
                      <span className={styles.smeOrders}>{item.orders_count} orders</span>
                      <span className={styles.smeCommission}>{formatCurrency(item.commission)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Commission History */}
          {history.length > 0 && (
            <div className={styles.historySection}>
              <h3>Recent Commission</h3>
              <div className={styles.historyList}>
                {history.map((item, index) => (
                  <div key={index} className={styles.historyItem}>
                    <div className={styles.historyHeader}>
                      <span className={styles.historyOrder}>Order #{item.order_number}</span>
                      <span className={`${styles.historyStatus} ${styles[item.status]}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className={styles.historyDetails}>
                      <span className={styles.historySME}>{item.sme_name}</span>
                      <span className={styles.historyDate}>{formatDate(item.date)}</span>
                      <span className={styles.historyAmount}>{formatCurrency(item.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AgentCommissionDashboard;