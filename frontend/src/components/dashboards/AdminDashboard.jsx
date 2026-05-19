import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { adminService } from '../../services/adminService';
import styles from './AdminDashboard.module.css';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  
  // Data states
  const [users, setUsers] = useState([]);
  const [smes, setSmes] = useState([]);
  const [agents, setAgents] = useState([]);
  const [delivery, setDelivery] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [stats, setStats] = useState({
    total_users: 0,
    pending_users: 0,
    active_users: 0,
    suspended_users: 0,
    total_smes: 0,
    total_agents: 0,
    total_delivery: 0,
    total_customers: 0,
    total_assignments: 0,
    active_assignments: 0,
    recent_registrations: 0,
    recent_logins: 0,
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedSME, setSelectedSME] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');

  // Error state
  const [error, setError] = useState(null);

  // Fetch all dashboard data
  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch all data in parallel
      const [
        statsData,
        usersData,
        smesData,
        agentsData,
        deliveryData,
        assignmentsData
      ] = await Promise.all([
        adminService.getDashboardStats(),
        adminService.getUsers({}),
        adminService.getSMEs(),
        adminService.getAgents(),
        adminService.getDelivery(),
        adminService.getAssignments()
      ]);

      setStats(statsData);
      setUsers(usersData);
      setSmes(smesData);
      setAgents(agentsData);
      setDelivery(deliveryData);
      setAssignments(assignmentsData);
      
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Fetch filtered users
  const fetchFilteredUsers = useCallback(async () => {
    try {
      const filters = {};
      if (searchTerm) filters.search = searchTerm;
      if (filterRole !== 'all') filters.role = filterRole;
      if (filterStatus !== 'all') filters.status = filterStatus;
      
      const filteredUsers = await adminService.getUsers(filters);
      setUsers(filteredUsers);
    } catch (err) {
      console.error('Failed to fetch filtered users:', err);
    }
  }, [searchTerm, filterRole, filterStatus]);

  // Apply filters when they change
  useEffect(() => {
    if (!isLoading) {
      fetchFilteredUsers();
    }
  }, [searchTerm, filterRole, filterStatus, fetchFilteredUsers]);

  // Handle user status update
  const handleUpdateStatus = async (userId, newStatus) => {
    try {
      await adminService.updateUserStatus(userId, newStatus);
      
      // Update local state
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, status: newStatus } : user
      ));
      
      // Update stats
      setStats(prev => ({
        ...prev,
        pending_users: users.filter(u => u.status === 'pending').length,
        active_users: users.filter(u => u.status === 'active').length,
        suspended_users: users.filter(u => u.status === 'suspended').length,
      }));
      
    } catch (err) {
      console.error('Failed to update status:', err);
      alert(err.message || 'Failed to update user status');
    }
  };

  // Handle user deletion
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    try {
      await adminService.deleteUser(selectedUser.id);
      
      // Update local state
      setUsers(prev => prev.filter(user => user.id !== selectedUser.id));
      
      // Update stats
      setStats(prev => ({
        ...prev,
        total_users: prev.total_users - 1,
        pending_users: selectedUser.status === 'pending' ? prev.pending_users - 1 : prev.pending_users,
        active_users: selectedUser.status === 'active' ? prev.active_users - 1 : prev.active_users,
        suspended_users: selectedUser.status === 'suspended' ? prev.suspended_users - 1 : prev.suspended_users,
        ...(selectedUser.role === 'sme' && { total_smes: prev.total_smes - 1 }),
        ...(selectedUser.role === 'agent' && { total_agents: prev.total_agents - 1 }),
        ...(selectedUser.role === 'delivery' && { total_delivery: prev.total_delivery - 1 }),
        ...(selectedUser.role === 'customer' && { total_customers: prev.total_customers - 1 }),
      }));
      
      setShowDeleteModal(false);
      setSelectedUser(null);
      
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert(err.message || 'Failed to delete user');
    }
  };

  // Handle agent assignment
  const handleAssignAgent = async () => {
    if (!selectedAgent || !selectedSME) {
      alert('Please select both an agent and an SME');
      return;
    }
    
    try {
      const newAssignment = await adminService.createAssignment({
        agent: parseInt(selectedAgent),
        sme: parseInt(selectedSME),
        active: true,
        notes: assignmentNotes
      });
      
      // Update local state
      setAssignments(prev => [newAssignment, ...prev]);
      
      // Update stats
      setStats(prev => ({
        ...prev,
        total_assignments: prev.total_assignments + 1,
        active_assignments: prev.active_assignments + 1
      }));
      
      // Reset and close modal
      setShowAssignModal(false);
      setSelectedAgent('');
      setSelectedSME('');
      setAssignmentNotes('');
      
    } catch (err) {
      console.error('Failed to assign agent:', err);
      alert(err.message || 'Failed to assign agent');
    }
  };

  // Handle assignment toggle
  const handleToggleAssignment = async (assignmentId, currentStatus) => {
    try {
      await adminService.updateAssignment(assignmentId, {
        active: !currentStatus
      });
      
      setAssignments(prev => prev.map(assignment =>
        assignment.id === assignmentId
          ? { ...assignment, active: !currentStatus }
          : assignment
      ));
      
      // Update stats
      setStats(prev => ({
        ...prev,
        active_assignments: currentStatus 
          ? prev.active_assignments - 1 
          : prev.active_assignments + 1
      }));
      
    } catch (err) {
      console.error('Failed to toggle assignment:', err);
      alert(err.message || 'Failed to update assignment');
    }
  };

  // Handle assignment deletion
  const handleDeleteAssignment = async (assignmentId, isActive) => {
    if (!confirm('Are you sure you want to remove this assignment?')) return;
    
    try {
      await adminService.deleteAssignment(assignmentId);
      
      setAssignments(prev => prev.filter(assignment => assignment.id !== assignmentId));
      
      // Update stats
      setStats(prev => ({
        ...prev,
        total_assignments: prev.total_assignments - 1,
        active_assignments: isActive 
          ? prev.active_assignments - 1 
          : prev.active_assignments
      }));
      
    } catch (err) {
      console.error('Failed to delete assignment:', err);
      alert(err.message || 'Failed to remove assignment');
    }
  };

  // Get filtered users
  const getFilteredUsers = () => {
    return users.filter(user => {
      const matchesSearch = 
        (user.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.phone || '').includes(searchTerm);
      
      const matchesRole = filterRole === 'all' || user.role === filterRole;
      const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
      
      return matchesSearch && matchesRole && matchesStatus;
    });
  };

  // Get pending users count
  const getPendingUsersCount = () => {
    return users.filter(user => user.status === 'pending').length;
  };

  if (isLoading) {
    return (
      <div className={styles.dashboardLoading}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading admin dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <div className={styles.errorIcon}>⚠️</div>
        <h3>Error Loading Dashboard</h3>
        <p>{error}</p>
        <button 
          className={styles.primaryButton}
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  const pendingUsersCount = getPendingUsersCount();

  return (
    <div className={styles.adminDashboard}>
      {/* Header */}
      <div className={styles.dashboardHeader}>
        <div>
          <h1 className={styles.dashboardTitle}>Admin Dashboard</h1>
          <p className={styles.dashboardSubtitle}>
            Welcome back, {user?.full_name || 'Administrator'}!
          </p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.adminBadge}>
            <span className={styles.adminRole}>Administrator</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#3b82f6" viewBox="0 0 16 16">
              <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
              <path fillRule="evenodd" d="M5.216 14A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216z"/>
              <path d="M4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/>
            </svg>
          </div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{stats.total_users}</h3>
            <p className={styles.statLabel}>Total Users</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#f59e0b" viewBox="0 0 16 16">
              <path d="M8.5 3.5a.5.5 0 0 1 .5.5v3.5a.5.5 0 0 1-.5.5H5a.5.5 0 0 1 0-1h3V4a.5.5 0 0 1 .5-.5z"/>
              <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
            </svg>
          </div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{stats.pending_users}</h3>
            <p className={styles.statLabel}>Pending Approval</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#22c55e" viewBox="0 0 16 16">
              <path d="M2.5 8a5.5 5.5 0 0 1 8.25-4.764.5.5 0 0 0 .5-.866A6.5 6.5 0 1 0 14.5 8a.5.5 0 0 0-1 0 5.5 5.5 0 1 1-11 0z"/>
              <path d="M15.354 3.354a.5.5 0 0 0-.708-.708L8 9.293 5.354 6.646a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l7-7z"/>
            </svg>
          </div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{stats.active_users}</h3>
            <p className={styles.statLabel}>Active Users</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#8b5cf6" viewBox="0 0 16 16">
              <path d="M0 2.5A1.5 1.5 0 0 1 1.5 1h13A1.5 1.5 0 0 1 16 2.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 10.5v-8zM1.5 2a.5.5 0 0 0-.5.5V7h4V2H1.5zM5 8H1v2.5a.5.5 0 0 0 .5.5H5V8zm1 0v3h4V8H6zm4-1V2H6v5h4zm1 1v3h3.5a.5.5 0 0 0 .5-.5V8h-4zm0-1h4V3.5a.5.5 0 0 0-.5-.5H11v4z"/>
            </svg>
          </div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{stats.total_smes}</h3>
            <p className={styles.statLabel}>Total SMEs</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(236, 72, 153, 0.1)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#ec4899" viewBox="0 0 16 16">
              <path d="M13 2.5a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h10zm0-1H3a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z"/>
              <path d="M5 10h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1zm0-3h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1zm0-3h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1z"/>
            </svg>
          </div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{stats.total_agents}</h3>
            <p className={styles.statLabel}>Total Agents</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(249, 115, 22, 0.1)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#f97316" viewBox="0 0 16 16">
              <path d="M0 3.5A1.5 1.5 0 0 1 1.5 2h13A1.5 1.5 0 0 1 16 3.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 11.5v-8zM1.5 3a.5.5 0 0 0-.5.5V7h4V3H1.5zM5 8H1v3.5a.5.5 0 0 0 .5.5H5V8zm1 0v4h4V8H6zm4-1V3H6v4h4zm1 1v4h3.5a.5.5 0 0 0 .5-.5V8h-4zm0-1h4V3.5a.5.5 0 0 0-.5-.5H11v4z"/>
            </svg>
          </div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{stats.total_delivery}</h3>
            <p className={styles.statLabel}>Delivery Partners</p>
          </div>
        </div>
      </div>

      {/* Pending Approvals Alert */}
      {pendingUsersCount > 0 && (
        <div className={styles.pendingAlert}>
          <div className={styles.alertIcon}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
            </svg>
          </div>
          <div className={styles.alertContent}>
            <h3>Pending Approvals</h3>
            <p>You have {pendingUsersCount} user{pendingUsersCount > 1 ? 's' : ''} waiting for approval.</p>
          </div>
          <button 
            className={styles.alertButton}
            onClick={() => {
              setActiveTab('users');
              setFilterStatus('pending');
            }}
          >
            Review Now
          </button>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className={styles.dashboardTabs}>
        <button
          className={`${styles.tabButton} ${activeTab === 'users' ? styles.active : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
            <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
            <path fillRule="evenodd" d="M5.216 14A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216z"/>
            <path d="M4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/>
          </svg>
          User Management
          {pendingUsersCount > 0 && <span className={styles.tabBadge}>{pendingUsersCount}</span>}
        </button>
        
        <button
          className={`${styles.tabButton} ${activeTab === 'assignments' ? styles.active : ''}`}
          onClick={() => setActiveTab('assignments')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
            <path d="M2.5 0A2.5 2.5 0 0 0 0 2.5v9A2.5 2.5 0 0 0 2.5 14h9a2.5 2.5 0 0 0 2.5-2.5v-9A2.5 2.5 0 0 0 11.5 0h-9zM1 2.5A1.5 1.5 0 0 1 2.5 1h9A1.5 1.5 0 0 1 13 2.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 1 11.5v-9z"/>
            <path d="M5.5 5a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 2a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3z"/>
          </svg>
          Agent Assignments
          <span className={styles.tabBadge}>{stats.active_assignments}</span>
        </button>
        
        <button
          className={`${styles.tabButton} ${activeTab === 'smes' ? styles.active : ''}`}
          onClick={() => setActiveTab('smes')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
            <path d="M0 2.5A1.5 1.5 0 0 1 1.5 1h13A1.5 1.5 0 0 1 16 2.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 10.5v-8zM1.5 2a.5.5 0 0 0-.5.5V7h4V2H1.5zM5 8H1v2.5a.5.5 0 0 0 .5.5H5V8zm1 0v3h4V8H6zm4-1V2H6v5h4zm1 1v3h3.5a.5.5 0 0 0 .5-.5V8h-4zm0-1h4V3.5a.5.5 0 0 0-.5-.5H11v4z"/>
          </svg>
          SMEs
          <span className={styles.tabBadge}>{stats.total_smes}</span>
        </button>
        
        <button
          className={`${styles.tabButton} ${activeTab === 'agents' ? styles.active : ''}`}
          onClick={() => setActiveTab('agents')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
            <path d="M13 2.5a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h10zm0-1H3a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z"/>
            <path d="M5 10h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1zm0-3h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1zm0-3h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1z"/>
          </svg>
          Agents
          <span className={styles.tabBadge}>{stats.total_agents}</span>
        </button>
        
        <button
          className={`${styles.tabButton} ${activeTab === 'delivery' ? styles.active : ''}`}
          onClick={() => setActiveTab('delivery')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
            <path d="M0 3.5A1.5 1.5 0 0 1 1.5 2h13A1.5 1.5 0 0 1 16 3.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 11.5v-8zM1.5 3a.5.5 0 0 0-.5.5V7h4V3H1.5zM5 8H1v3.5a.5.5 0 0 0 .5.5H5V8zm1 0v4h4V8H6zm4-1V3H6v5h4zm1 1v4h3.5a.5.5 0 0 0 .5-.5V8h-4zm0-1h4V3.5a.5.5 0 0 0-.5-.5H11v4z"/>
          </svg>
          Delivery Partners
          <span className={styles.tabBadge}>{stats.total_delivery}</span>
        </button>
      </div>

      {/* Content Sections */}
      <div className={styles.dashboardContent}>
        {/* User Management Tab */}
        {activeTab === 'users' && (
          <div className={styles.contentSection}>
            <div className={styles.sectionHeader}>
              <h2>User Management</h2>
              <div className={styles.filterControls}>
                <div className={styles.searchBox}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={styles.searchInput}
                  />
                </div>
                
                <select 
                  className={styles.filterSelect}
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                >
                  <option value="all">All Roles</option>
                  <option value="sme">SME</option>
                  <option value="agent">Agent</option>
                  <option value="delivery">Delivery</option>
                  <option value="customer">Customer</option>
                  <option value="admin">Admin</option>
                </select>
                
                <select 
                  className={styles.filterSelect}
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            <div className={styles.tableContainer}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Contact</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredUsers().map(user => (
                    <tr key={user.id}>
                      <td>
                        <div className={styles.userCell}>
                          <div className={styles.userAvatar}>
                            {user.full_name?.charAt(0) || user.email.charAt(0)}
                          </div>
                          <div className={styles.userInfo}>
                            <span className={styles.userName}>{user.full_name || 'No name'}</span>
                            <span className={styles.userEmail}>{user.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>{user.phone || 'N/A'}</td>
                      <td>
                        <span className={`${styles.roleBadge} ${styles[user.role]}`}>
                          {user.role_display || user.role}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles[user.status]}`}>
                          {user.status_display || user.status}
                        </span>
                      </td>
                      <td>{new Date(user.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className={styles.actionButtons}>
                          {user.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(user.id, 'active')}
                                className={`${styles.actionButton} ${styles.approveButton}`}
                                title="Approve User"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                  <path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 0 1 .02-.022z"/>
                                </svg>
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(user.id, 'suspended')}
                                className={`${styles.actionButton} ${styles.rejectButton}`}
                                title="Reject User"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                                </svg>
                              </button>
                            </>
                          )}
                          {user.status === 'active' && (
                            <button
                              onClick={() => handleUpdateStatus(user.id, 'suspended')}
                              className={`${styles.actionButton} ${styles.suspendButton}`}
                              title="Suspend User"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M5.5 3.5A2.5 2.5 0 0 1 8 1h0a2.5 2.5 0 0 1 2.5 2.5v4A2.5 2.5 0 0 1 8 10h0a2.5 2.5 0 0 1-2.5-2.5v-4z"/>
                                <path d="M11 5.5h-1v4a3 3 0 1 1-6 0v-4H3v4a4 4 0 0 0 8 0v-4z"/>
                              </svg>
                            </button>
                          )}
                          {user.status === 'suspended' && (
                            <button
                              onClick={() => handleUpdateStatus(user.id, 'active')}
                              className={`${styles.actionButton} ${styles.activateButton}`}
                              title="Activate User"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                                <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowDeleteModal(true);
                            }}
                            className={`${styles.actionButton} ${styles.deleteButton}`}
                            title="Delete User"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                              <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1z"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {getFilteredUsers().length === 0 && (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>🔍</div>
                  <h3>No users found</h3>
                  <p>Try adjusting your search or filters</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Agent Assignments Tab */}
        {activeTab === 'assignments' && (
          <div className={styles.contentSection}>
            <div className={styles.sectionHeader}>
              <h2>Agent-SME Assignments</h2>
              <button 
                className={styles.primaryButton}
                onClick={() => setShowAssignModal(true)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                </svg>
                Assign Agent to SME
              </button>
            </div>

            <div className={styles.assignmentsGrid}>
              {assignments.map(assignment => {
                const agentDetails = assignment.agent_details || {};
                const smeDetails = assignment.sme_details || {};
                
                return (
                  <div key={assignment.id} className={styles.assignmentCard}>
                    <div className={styles.assignmentHeader}>
                      <div className={styles.assignmentStatus}>
                        <span className={`${styles.statusBadge} ${assignment.active ? styles.active : styles.inactive}`}>
                          {assignment.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className={styles.assignmentActions}>
                        <button
                          onClick={() => handleToggleAssignment(assignment.id, assignment.active)}
                          className={`${styles.iconButton} ${styles.editButton}`}
                          title={assignment.active ? 'Deactivate' : 'Activate'}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteAssignment(assignment.id, assignment.active)}
                          className={`${styles.iconButton} ${styles.deleteButton}`}
                          title="Remove Assignment"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                            <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1z"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    <div className={styles.assignmentContent}>
                      <div className={styles.assignmentAgent}>
                        <div className={styles.assignmentIcon}>🤝</div>
                        <div>
                          <h4>Agent</h4>
                          <p className={styles.assignmentName}>{agentDetails.name || 'N/A'}</p>
                          <p className={styles.assignmentDetail}>{agentDetails.email || ''}</p>
                        </div>
                      </div>
                      
                      <div className={styles.assignmentArrow}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                          <path fillRule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
                        </svg>
                      </div>
                      
                      <div className={styles.assignmentSME}>
                        <div className={styles.assignmentIcon}>🏢</div>
                        <div>
                          <h4>SME</h4>
                          <p className={styles.assignmentName}>{smeDetails.business_name || 'N/A'}</p>
                          <p className={styles.assignmentDetail}>{smeDetails.owner_name || ''}</p>
                        </div>
                      </div>
                    </div>
                    
                    {assignment.notes && (
                      <div className={styles.assignmentNotes}>
                        <span className={styles.notesLabel}>Notes:</span>
                        <p>{assignment.notes}</p>
                      </div>
                    )}
                    
                    <div className={styles.assignmentFooter}>
                      <span className={styles.assignmentDate}>
                        Assigned: {new Date(assignment.assigned_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
              
              {assignments.length === 0 && (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>📋</div>
                  <h3>No assignments yet</h3>
                  <p>Assign an agent to an SME to get started</p>
                  <button 
                    className={styles.primaryButton}
                    onClick={() => setShowAssignModal(true)}
                  >
                    Create Assignment
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SMEs Tab */}
        {activeTab === 'smes' && (
          <div className={styles.contentSection}>
            <div className={styles.sectionHeader}>
              <h2>SME Businesses</h2>
            </div>
            
            <div className={styles.businessGrid}>
              {smes.map(sme => {
                const user = sme.user || {};
                const smeAssignments = assignments.filter(a => a.sme === sme.id && a.active);
                
                return (
                  <div key={sme.id} className={styles.businessCard}>
                    <div className={styles.businessHeader}>
                      <div className={styles.businessIcon}>🏢</div>
                      <div className={styles.businessInfo}>
                        <h3>{sme.business_name}</h3>
                        <p className={styles.businessOwner}>{sme.owner_name}</p>
                      </div>
                      <span className={`${styles.statusBadge} ${styles[user.status || 'pending']}`}>
                        {user.status_display || user.status || 'Pending'}
                      </span>
                    </div>
                    
                    <div className={styles.businessDetails}>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Business Type:</span>
                        <span className={styles.detailValue}>{sme.business_type || 'Not specified'}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Address:</span>
                        <span className={styles.detailValue}>{sme.business_address || sme.address || 'Not specified'}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Contact:</span>
                        <span className={styles.detailValue}>
                          {user.email || ''} | {user.phone || ''}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Assigned Agents:</span>
                        <span className={styles.detailValue}>{smeAssignments.length}</span>
                      </div>
                    </div>
                    
                    <div className={styles.businessFooter}>
                      <button 
                        className={styles.secondaryButton}
                        onClick={() => {
                          setSelectedSME(sme.id);
                          setShowAssignModal(true);
                        }}
                      >
                        Assign Agent
                      </button>
                      <Link to={`/admin/smes/${sme.id}`} className={styles.textLink}>
                        View Details →
                      </Link>
                    </div>
                  </div>
                );
              })}
              
              {smes.length === 0 && (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>🏢</div>
                  <h3>No SMEs registered</h3>
                  <p>No SME businesses have registered yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Agents Tab */}
        {activeTab === 'agents' && (
          <div className={styles.contentSection}>
            <div className={styles.sectionHeader}>
              <h2>Sales Agents</h2>
            </div>
            
            <div className={styles.agentGrid}>
              {agents.map(agent => {
                const user = agent.user || {};
                const agentAssignments = assignments.filter(a => a.agent === agent.id && a.active);
                
                return (
                  <div key={agent.id} className={styles.agentCard}>
                    <div className={styles.agentHeader}>
                      <div className={styles.agentAvatar}>
                        {user.full_name?.charAt(0) || 'A'}
                      </div>
                      <div className={styles.agentInfo}>
                        <h3>{user.full_name || 'N/A'}</h3>
                        <p className={styles.agentEmail}>{user.email || ''}</p>
                      </div>
                      <span className={`${styles.statusBadge} ${styles[user.status || 'pending']}`}>
                        {user.status_display || user.status || 'Pending'}
                      </span>
                    </div>
                    
                    <div className={styles.agentDetails}>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Address:</span>
                        <span className={styles.detailValue}>{agent.home_address || 'Not specified'}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Resources:</span>
                        <span className={styles.detailValue}>
                          {agent.has_smartphone ? '📱' : '📱❌'} 
                          {agent.has_internet ? ' 🌐' : ' 🌐❌'}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Assigned SMEs:</span>
                        <span className={styles.detailValue}>{agentAssignments.length}</span>
                      </div>
                    </div>
                    
                    <div className={styles.agentFooter}>
                      <button 
                        className={styles.secondaryButton}
                        onClick={() => {
                          setSelectedAgent(agent.id);
                          setShowAssignModal(true);
                        }}
                      >
                        Assign to SME
                      </button>
                      <Link to={`/admin/agents/${agent.id}`} className={styles.textLink}>
                        View Details →
                      </Link>
                    </div>
                  </div>
                );
              })}
              
              {agents.length === 0 && (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>🤝</div>
                  <h3>No agents registered</h3>
                  <p>No sales agents have registered yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delivery Partners Tab */}
        {activeTab === 'delivery' && (
          <div className={styles.contentSection}>
            <div className={styles.sectionHeader}>
              <h2>Delivery Partners</h2>
            </div>
            
            <div className={styles.deliveryGrid}>
              {delivery.map(partner => {
                const user = partner.user || {};
                
                return (
                  <div key={partner.id} className={styles.deliveryCard}>
                    <div className={styles.deliveryHeader}>
                      <div className={styles.deliveryAvatar}>
                        {user.full_name?.charAt(0) || 'D'}
                      </div>
                      <div className={styles.deliveryInfo}>
                        <h3>{user.full_name || 'N/A'}</h3>
                        <p className={styles.deliveryEmail}>{user.email || ''}</p>
                      </div>
                      <span className={`${styles.statusBadge} ${styles[user.status || 'pending']}`}>
                        {user.status_display || user.status || 'Pending'}
                      </span>
                    </div>
                    
                    <div className={styles.deliveryDetails}>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Vehicle:</span>
                        <span className={styles.detailValue}>
                          {partner.vehicle_type === 'Motorcycle' && '🏍️'}
                          {partner.vehicle_type === 'Car' && '🚗'}
                          {partner.vehicle_type === 'Bakkie' && '🛻'}
                          {partner.vehicle_type === 'Bicycle' && '🚲'}
                          {partner.vehicle_type || 'Not specified'}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Address:</span>
                        <span className={styles.detailValue}>{partner.home_address || 'Not specified'}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Resources:</span>
                        <span className={styles.detailValue}>
                          {partner.has_smartphone ? '📱' : '📱❌'} 
                          {partner.has_internet ? ' 🌐' : ' 🌐❌'}
                        </span>
                      </div>
                    </div>
                    
                    <div className={styles.deliveryFooter}>
                      <Link to={`/admin/delivery/${partner.id}`} className={styles.textLink}>
                        View Details →
                      </Link>
                    </div>
                  </div>
                );
              })}
              
              {delivery.length === 0 && (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>🚚</div>
                  <h3>No delivery partners registered</h3>
                  <p>No delivery partners have registered yet</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Assign Agent Modal */}
      {showAssignModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAssignModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Assign Agent to SME</h2>
              <button 
                className={styles.modalClose}
                onClick={() => setShowAssignModal(false)}
              >
                &times;
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label htmlFor="agent-select">Select Agent</label>
                <select
                  id="agent-select"
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className={styles.formSelect}
                >
                  <option value="">-- Choose an agent --</option>
                  {agents.map(agent => {
                    const user = agent.user || {};
                    return (
                      <option key={agent.id} value={agent.id}>
                        {user.full_name || 'N/A'} ({user.email || 'No email'})
                      </option>
                    );
                  })}
                </select>
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="sme-select">Select SME</label>
                <select
                  id="sme-select"
                  value={selectedSME}
                  onChange={(e) => setSelectedSME(e.target.value)}
                  className={styles.formSelect}
                >
                  <option value="">-- Choose an SME --</option>
                  {smes.map(sme => (
                    <option key={sme.id} value={sme.id}>
                      {sme.business_name} ({sme.owner_name})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="assignment-notes">Notes (Optional)</label>
                <textarea
                  id="assignment-notes"
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  className={styles.formTextarea}
                  placeholder="Add any notes about this assignment..."
                  rows="3"
                />
              </div>
            </div>
            
            <div className={styles.modalFooter}>
              <button 
                className={styles.cancelButton}
                onClick={() => setShowAssignModal(false)}
              >
                Cancel
              </button>
              <button 
                className={styles.submitButton}
                onClick={handleAssignAgent}
              >
                Assign Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {showDeleteModal && selectedUser && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Delete User</h2>
              <button 
                className={styles.modalClose}
                onClick={() => setShowDeleteModal(false)}
              >
                &times;
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.warningIcon}>⚠️</div>
              <p className={styles.warningText}>
                Are you sure you want to delete <strong>{selectedUser.full_name || selectedUser.email}</strong>?
              </p>
              <p className={styles.warningSubtext}>
                This action cannot be undone. All user data and associated records will be permanently deleted.
              </p>
            </div>
            
            <div className={styles.modalFooter}>
              <button 
                className={styles.cancelButton}
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button 
                className={styles.deleteButton}
                onClick={handleDeleteUser}
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}