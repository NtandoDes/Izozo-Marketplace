import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; // ✅ Add this missing import
import { useAuth } from '../../contexts/AuthContext';
import styles from './DeliveryDashboard.module.css';

export default function DeliveryDashboard() {
  const { user, profile, refreshUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDeliveries: 0,
    completedDeliveries: 0,
    pendingDeliveries: 0,
    earnings: 0,
    rating: 0,
  });
  const [recentDeliveries, setRecentDeliveries] = useState([]);

  useEffect(() => {
    const initializeDashboard = async () => {
      setIsLoading(true);
      try {
        // Fetch dashboard data
        // For now, use mock data
        setStats({
          totalDeliveries: 12,
          completedDeliveries: 10,
          pendingDeliveries: 2,
          earnings: 2450.50,
          rating: 4.8,
        });

        setRecentDeliveries([
          {
            id: 1,
            orderNumber: 'ORD-001',
            customer: 'John Doe',
            pickup: 'Shoprite Mall',
            dropoff: 'Soweto Zone 5',
            status: 'completed',
            amount: 250.00,
            date: '2024-01-15',
          },
          {
            id: 2,
            orderNumber: 'ORD-002',
            customer: 'Jane Smith',
            pickup: 'Pick n Pay',
            dropoff: 'Alexandra',
            status: 'pending',
            amount: 180.00,
            date: '2024-01-16',
          },
          {
            id: 3,
            orderNumber: 'ORD-003',
            customer: 'Mike Johnson',
            pickup: 'Checkers',
            dropoff: 'Diepsloot',
            status: 'completed',
            amount: 320.00,
            date: '2024-01-14',
          },
        ]);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeDashboard();
  }, []);

  const handleRefresh = async () => {
    await refreshUser();
  };

  const handleAcceptDelivery = (deliveryId) => {
    alert(`Delivery ${deliveryId} accepted!`);
    setRecentDeliveries(prev =>
      prev.map(delivery =>
        delivery.id === deliveryId
          ? { ...delivery, status: 'in-progress' }
          : delivery
      )
    );
  };

  const handleCompleteDelivery = (deliveryId) => {
    alert(`Delivery ${deliveryId} marked as completed!`);
    setRecentDeliveries(prev =>
      prev.map(delivery =>
        delivery.id === deliveryId
          ? { ...delivery, status: 'completed' }
          : delivery
      )
    );
  };

  if (isLoading) {
    return (
      <div className={styles.dashboardLoading}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className={styles.deliveryDashboard}>
      {/* Header */}
      <div className={styles.dashboardHeader}>
        <div>
          <h1 className={styles.dashboardTitle}>Delivery Dashboard</h1>
          <p className={styles.dashboardSubtitle}>
            Welcome back, {user?.full_name || 'Delivery Partner'}!
          </p>
        </div>
        <div className={styles.headerActions}>
          <button onClick={handleRefresh} className={styles.refreshButton}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
              <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
            </svg>
            Refresh
          </button>
          <div className={styles.profileBadge}>
            <span className={styles.vehicleBadge}>
              {profile?.vehicle_type || 'Vehicle'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#3b82f6" viewBox="0 0 16 16">
              <path d="M0 3.5A1.5 1.5 0 0 1 1.5 2h13A1.5 1.5 0 0 1 16 3.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 11.5v-8zM1.5 3a.5.5 0 0 0-.5.5V7h4V3H1.5zM5 8H1v3.5a.5.5 0 0 0 .5.5H5V8zm1 0v4h4V8H6zm4-1V3H6v4h4zm1 1v4h3.5a.5.5 0 0 0 .5-.5V8h-4zm0-1h4V3.5a.5.5 0 0 0-.5-.5H11v4z"/>
            </svg>
          </div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{stats.totalDeliveries}</h3>
            <p className={styles.statLabel}>Total Deliveries</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#22c55e" viewBox="0 0 16 16">
              <path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 0 1 .02-.022z"/>
            </svg>
          </div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{stats.completedDeliveries}</h3>
            <p className={styles.statLabel}>Completed</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#f59e0b" viewBox="0 0 16 16">
              <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
              <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
            </svg>
          </div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{stats.pendingDeliveries}</h3>
            <p className={styles.statLabel}>Pending</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#8b5cf6" viewBox="0 0 16 16">
              <path d="M4 10.781c.148 1.667 1.513 2.85 3.591 3.003V15h1.043v-1.216c2.27-.179 3.678-1.438 3.678-3.3 0-1.59-.947-2.51-2.956-3.028l-.722-.187V3.467c1.122.11 1.879.714 2.07 1.616h1.47c-.166-1.6-1.54-2.748-3.54-2.875V1H7.591v1.233c-1.939.23-3.27 1.472-3.27 3.156 0 1.454.966 2.483 2.661 2.917l.61.162v4.031c-1.149-.17-1.94-.8-2.131-1.718H4zm3.391-3.836c-1.043-.263-1.6-.825-1.6-1.616 0-.944.704-1.641 1.8-1.828v3.495l-.2-.05zm1.591 1.872c1.287.323 1.852.859 1.852 1.769 0 1.097-.826 1.828-2.2 1.939V8.73l.348.086z"/>
            </svg>
          </div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>R{stats.earnings.toFixed(2)}</h3>
            <p className={styles.statLabel}>Total Earnings</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(236, 72, 153, 0.1)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#ec4899" viewBox="0 0 16 16">
              <path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>
            </svg>
          </div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{stats.rating}/5</h3>
            <p className={styles.statLabel}>Average Rating</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className={styles.quickActions}>
        <h2 className={styles.sectionTitle}>Quick Actions</h2>
        <div className={styles.actionsGrid}>
          <button className={styles.actionButton}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
              <path d="M0 3.5A1.5 1.5 0 0 1 1.5 2h13A1.5 1.5 0 0 1 16 3.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 11.5v-8zM1.5 3a.5.5 0 0 0-.5.5V7h4V3H1.5zM5 8H1v3.5a.5.5 0 0 0 .5.5H5V8zm1 0v4h4V8H6zm4-1V3H6v4h4zm1 1v4h3.5a.5.5 0 0 0 .5-.5V8h-4zm0-1h4V3.5a.5.5 0 0 0-.5-.5H11v4z"/>
            </svg>
            View Available Deliveries
          </button>
          <button className={styles.actionButton}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
              <path d="M0 1.5A.5.5 0 0 1 .5 1H2a.5.5 0 0 1 .485.379L2.89 3H14.5a.5.5 0 0 1 .491.592l-1.5 8A.5.5 0 0 1 13 12H4a.5.5 0 0 1-.491-.408L2.01 3.607 1.61 2H.5a.5.5 0 0 1-.5-.5zM3.102 4l1.313 7h8.17l1.313-7H3.102zM5 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-7 1a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
            </svg>
            My Delivery History
          </button>
          <button className={styles.actionButton}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
              <path d="M4 10.781c.148 1.667 1.513 2.85 3.591 3.003V15h1.043v-1.216c2.27-.179 3.678-1.438 3.678-3.3 0-1.59-.947-2.51-2.956-3.028l-.722-.187V3.467c1.122.11 1.879.714 2.07 1.616h1.47c-.166-1.6-1.54-2.748-3.54-2.875V1H7.591v1.233c-1.939.23-3.27 1.472-3.27 3.156 0 1.454.966 2.483 2.661 2.917l.61.162v4.031c-1.149-.17-1.94-.8-2.131-1.718H4zm3.391-3.836c-1.043-.263-1.6-.825-1.6-1.616 0-.944.704-1.641 1.8-1.828v3.495l-.2-.05zm1.591 1.872c1.287.323 1.852.859 1.852 1.769 0 1.097-.826 1.828-2.2 1.939V8.73l.348.086z"/>
            </svg>
            View Earnings
          </button>
          <button className={styles.actionButton}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
              <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
            </svg>
            Update Profile
          </button>
        </div>
      </div>

      {/* Recent Deliveries */}
      <div className={styles.recentDeliveries}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Recent Deliveries</h2>
          <Link to="/delivery/history" className={styles.viewAllLink}> {/* ✅ Fixed typo: removed ] */}
            View All →
          </Link>
        </div>
        
        <div className={styles.deliveriesTable}>
          <div className={styles.tableHeader}>
            <div className={styles.tableCell}>Order #</div>
            <div className={styles.tableCell}>Customer</div>
            <div className={styles.tableCell}>Pickup</div>
            <div className={styles.tableCell}>Dropoff</div>
            <div className={styles.tableCell}>Amount</div>
            <div className={styles.tableCell}>Status</div>
            <div className={styles.tableCell}>Actions</div>
          </div>
          
          {recentDeliveries.map((delivery) => (
            <div key={delivery.id} className={styles.tableRow}>
              <div className={styles.tableCell}>
                <strong>{delivery.orderNumber}</strong>
              </div>
              <div className={styles.tableCell}>{delivery.customer}</div>
              <div className={styles.tableCell}>{delivery.pickup}</div>
              <div className={styles.tableCell}>{delivery.dropoff}</div>
              <div className={styles.tableCell}>
                <strong>R{delivery.amount.toFixed(2)}</strong>
              </div>
              <div className={styles.tableCell}>
                <span className={`${styles.statusBadge} ${styles[delivery.status.replace('-', '')]}`}>
                  {delivery.status === 'completed' && '✓ Completed'}
                  {delivery.status === 'pending' && '⏳ Pending'}
                  {delivery.status === 'in-progress' && '🚚 In Progress'}
                </span>
              </div>
              <div className={styles.tableCell}>
                <div className={styles.actionButtons}>
                  {delivery.status === 'pending' && (
                    <button
                      onClick={() => handleAcceptDelivery(delivery.id)}
                      className={styles.acceptButton}
                    >
                      Accept
                    </button>
                  )}
                  {delivery.status === 'in-progress' && (
                    <button
                      onClick={() => handleCompleteDelivery(delivery.id)}
                      className={styles.completeButton}
                    >
                      Complete
                    </button>
                  )}
                  <Link to={`/delivery/${delivery.id}`} className={styles.detailsButton}>
                    Details
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vehicle Information */}
      {profile?.vehicle_type && (
        <div className={styles.vehicleInfo}>
          <h2 className={styles.sectionTitle}>Vehicle Information</h2>
          <div className={styles.vehicleCard}>
            <div className={styles.vehicleIcon}>
              {profile.vehicle_type.toLowerCase().includes('motorcycle') && '🏍️'}
              {profile.vehicle_type.toLowerCase().includes('car') && '🚗'}
              {profile.vehicle_type.toLowerCase().includes('bakkie') && '🛻'}
              {profile.vehicle_type.toLowerCase().includes('bicycle') && '🚲'}
              {profile.vehicle_type.toLowerCase().includes('fleet') && '🚚'}
              {!profile.vehicle_type.toLowerCase().includes('motorcycle') && 
               !profile.vehicle_type.toLowerCase().includes('car') && 
               !profile.vehicle_type.toLowerCase().includes('bakkie') && 
               !profile.vehicle_type.toLowerCase().includes('bicycle') && 
               !profile.vehicle_type.toLowerCase().includes('fleet') && '🚛'}
            </div>
            <div className={styles.vehicleDetails}>
              <h3>{profile.vehicle_type}</h3>
              <p>Vehicle type registered for deliveries</p>
              <div className={styles.vehicleStatus}>
                <span className={styles.statusActive}>✓ Active for deliveries</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tips Section */}
      <div className={styles.tipsSection}>
        <h2 className={styles.sectionTitle}>Delivery Tips</h2>
        <div className={styles.tipsGrid}>
          <div className={styles.tipCard}>
            <h3>📱 Always confirm pickup</h3>
            <p>Contact the merchant before pickup to ensure order is ready.</p>
          </div>
          <div className={styles.tipCard}>
            <h3>✅ Verify customer details</h3>
            <p>Double-check delivery address and contact information.</p>
          </div>
          <div className={styles.tipCard}>
            <h3>💰 Collect payment securely</h3>
            <p>Use cash-on-delivery option only for cash orders.</p>
          </div>
          <div className={styles.tipCard}>
            <h3>⭐ Rate your experience</h3>
            <p>Rate merchants after delivery to help improve service.</p>
          </div>
        </div>
      </div>
    </div>
  );
}