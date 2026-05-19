/* eslint-disable react-hooks/set-state-in-effect */
// frontend/src/Pages/Account.jsx
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import styles from "./Account.module.css";

export default function Account() {
  const navigate = useNavigate();
  const { user, profile, logout, updateUserProfile, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
  });

  // Role-specific state
  const [smeData, setSmeData] = useState({
    business_name: "",
    business_type: "",
    business_address: "",
  });

  const [agentData, setAgentData] = useState({
    home_address: "",
    has_internet: false,
    has_smartphone: false,
  });

  const [deliveryData, setDeliveryData] = useState({
    home_address: "",
    vehicle_type: "",
    has_internet: false,
    has_smartphone: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [activeTab, setActiveTab] = useState("profile");

  // Initialize form data when user/profile loads
  useEffect(() => {
    if (user) {
      // Basic user data
      setFormData({
        full_name: user.full_name || "",
        phone: user.phone || "",
        email: user.email || "",
      });

      // Role-specific data
      if (profile) {
        if (user.role === "sme") {
          setSmeData({
            business_name: profile.business_name || "",
            business_type: profile.business_type || "",
            business_address: profile.business_address || profile.address || "",
          });
        } else if (user.role === "agent") {
          setAgentData({
            home_address: profile.home_address || "",
            has_internet: profile.has_internet || false,
            has_smartphone: profile.has_smartphone || false,
          });
        } else if (user.role === "delivery") {
          setDeliveryData({
            home_address: profile.home_address || "",
            vehicle_type: profile.vehicle_type || "",
            has_internet: profile.has_internet || false,
            has_smartphone: profile.has_smartphone || false,
          });
        }
      }
    }
  }, [user, profile]);

  const handleBasicChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSMEChange = (e) => {
    const { name, value } = e.target;
    setSmeData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAgentChange = (e) => {
    const { name, value, type, checked } = e.target;
    setAgentData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleDeliveryChange = (e) => {
    const { name, value, type, checked } = e.target;
    setDeliveryData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // In Account.jsx, update handleSubmit to ensure all fields are included

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: "", text: "" });

    // Prepare data based on user role
    let submitData = {
      full_name: formData.full_name,
      phone: formData.phone,
    };

    // Add role-specific data
    if (user.role === "sme") {
      submitData = {
        ...submitData,
        business_name: smeData.business_name,
        business_type: smeData.business_type,
        business_address: smeData.business_address,
        address: smeData.business_address, // Also send as address for backward compatibility
      };
    } else if (user.role === "agent") {
      submitData = {
        ...submitData,
        home_address: agentData.home_address,
        has_internet: agentData.has_internet,
        has_smartphone: agentData.has_smartphone,
      };
    } else if (user.role === "delivery") {
      submitData = {
        ...submitData,
        home_address: deliveryData.home_address,
        vehicle_type: deliveryData.vehicle_type,
        has_internet: deliveryData.has_internet,
        has_smartphone: deliveryData.has_smartphone,
      };
    } else if (user.role === "customer") {
      // For customers, we only update name and phone
      submitData = {
        full_name: formData.full_name,
        phone: formData.phone,
      };
    }

    console.log("📝 Submitting profile update:", submitData);

    const result = await updateUserProfile(submitData);
    setIsLoading(false);

    if (result.success) {
      setMessage({ type: "success", text: "Profile updated successfully!" });
      setIsEditing(false);

      // Refresh user data to get updated information
      await refreshUser();

      // Force a re-render by updating local state with the response data
      if (result.data) {
        if (result.data.user) {
          setFormData((prev) => ({
            ...prev,
            full_name: result.data.user.full_name || prev.full_name,
            phone: result.data.user.phone || prev.phone,
          }));
        }
      }
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to update profile",
      });
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const getDashboardLink = () => {
    if (!user) return "/";

    switch (user.role) {
      case "agent":
        return "/agent-dashboard";
      case "sme":
        return "/sme-dashboard";
      case "delivery":
        return "/delivery-dashboard";
      case "admin":
        return "/admin";
      default:
        return "/customer-dashboard";
    }
  };

  const getOrdersLink = () => {
    if (!user) return "/orders";

    switch (user.role) {
      case "agent":
        return "/agent/orders";
      case "sme":
        return "/sme/orders";
      case "delivery":
        return "/delivery/orders";
      case "customer":
        return "/account/orders";
      default:
        return "/orders";
    }
  };

  const getProductsLink = () => {
    if (!user) return "/products";

    switch (user.role) {
      case "agent":
        return "/agent/products";
      case "sme":
        return "/sme/products";
      default:
        return "/products";
    }
  };

  const getDashboardLabel = () => {
    if (!user) return "Dashboard";

    switch (user.role) {
      case "agent":
        return "Agent Dashboard";
      case "sme":
        return "SME Dashboard";
      case "delivery":
        return "Delivery Dashboard";
      default:
        return "Dashboard";
    }
  };

  const getCombinedData = () => {
    if (!user) return null;

    const base = {
      ...user,
      ...formData,
    };

    if (user.role === "sme") {
      return {
        ...base,
        ...smeData,
      };
    } else if (user.role === "agent") {
      return {
        ...base,
        ...agentData,
      };
    } else if (user.role === "delivery") {
      return {
        ...base,
        ...deliveryData,
      };
    }

    return base;
  };

  if (!user) {
    return (
      <div className={styles.accountPage}>
        <div className="container">
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading account information...</p>
          </div>
        </div>
      </div>
    );
  }

  const combinedData = getCombinedData();

  return (
    <div className={styles.accountPage}>
      <div className="container">
        <div className={styles.accountContainer}>
          {/* Sidebar */}
          <aside className={styles.sidebar}>
            <div className={styles.profileSummary}>
              <div className={styles.profileAvatar}>
                <span className={styles.avatarInitial}>
                  {user.full_name?.charAt(0) || "U"}
                </span>
              </div>
              <div className={styles.profileInfo}>
                <h3 className={styles.profileName}>{user.full_name}</h3>
                <span className={`${styles.roleBadge} ${styles[user.role]}`}>
                  {user.role === "customer" && "👤 Customer"}
                  {user.role === "sme" && "🏢 Business Owner"}
                  {user.role === "agent" && "🤝 Sales Agent"}
                  {user.role === "delivery" && "🚚 Delivery Partner"}
                </span>
                <p className={styles.profileEmail}>{user.email}</p>
              </div>
            </div>

            <nav className={styles.sidebarNav}>
              {/* Profile Tab */}
              <button
                onClick={() => setActiveTab("profile")}
                className={`${styles.navItem} ${activeTab === "profile" ? styles.active : ""}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                  <path
                    fillRule="evenodd"
                    d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z"
                  />
                </svg>
                Profile
              </button>

              {/* Orders Tab */}
              <Link to={getOrdersLink()} className={styles.navItem}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M0 1.5A.5.5 0 0 1 .5 1H2a.5.5 0 0 1 .485.379L2.89 3H14.5a.5.5 0 0 1 .491.592l-1.5 8A.5.5 0 0 1 13 12H4a.5.5 0 0 1-.491-.408L2.01 3.607 1.61 2H.5a.5.5 0 0 1-.5-.5zM3.102 4l1.313 7h8.17l1.313-7H3.102zM5 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-7 1a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
                </svg>
                My Orders
                <span className={styles.navBadge}>View All</span>
              </Link>

              {/* Dashboard Link */}
              <Link to={getDashboardLink()} className={styles.navItem}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M0 2.5A1.5 1.5 0 0 1 1.5 1h13A1.5 1.5 0 0 1 16 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 13.5v-11zM1.5 2a.5.5 0 0 0-.5.5V8h4V2H1.5zM5 2v6h4V2H5zm4 7H5v5h4V9zm1 5V9h4V2.5a.5.5 0 0 0-.5-.5H10v12h.5a.5.5 0 0 0 .5-.5V14z" />
                </svg>
                {getDashboardLabel()}
              </Link>

              {/* Products Link */}
              {(user.role === "agent" || user.role === "sme") && (
                <Link to={getProductsLink()} className={styles.navItem}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
                    <path d="M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5 8 5.961 14.154 3.5 8.186 1.113zM15 4.239l-6.5 2.6v7.922l6.5-2.6V4.24zM7.5 14.762V6.838L1 4.239v7.923l6.5 2.6zM7.443.184a1.5 1.5 0 0 1 1.114 0l7.129 2.852A.5.5 0 0 1 16 3.5v8.662a1 1 0 0 1-.629.928l-7.185 2.874a.5.5 0 0 1-.372 0L.63 13.09a1 1 0 0 1-.63-.928V3.5a.5.5 0 0 1 .314-.464L7.443.184z" />
                  </svg>
                  {user.role === "agent" ? "Manage Products" : "My Products"}
                </Link>
              )}

              <button onClick={handleLogout} className={styles.logoutButton}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0v2z"
                  />
                  <path
                    fillRule="evenodd"
                    d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z"
                  />
                </svg>
                Sign Out
              </button>
            </nav>
          </aside>

          {/* Main Content */}
          <main className={styles.mainContent}>
            {activeTab === "profile" ? (
              <>
                <div className={styles.contentHeader}>
                  <h1 className={styles.pageTitle}>Profile Settings</h1>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className={styles.editButton}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                      >
                        <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z" />
                      </svg>
                      Edit Profile
                    </button>
                  )}
                </div>

                {message.text && (
                  <div className={`${styles.message} ${styles[message.type]}`}>
                    {message.type === "success" ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                      >
                        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z" />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                      >
                        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8 4a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 4zm.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
                      </svg>
                    )}
                    {message.text}
                  </div>
                )}

                {isEditing ? (
                  <form onSubmit={handleSubmit} className={styles.editForm}>
                    {/* Personal Information Section */}
                    <div className={styles.formSection}>
                      <h3 className={styles.sectionTitle}>
                        Personal Information
                      </h3>
                      <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                          <label
                            htmlFor="full_name"
                            className={styles.formLabel}
                          >
                            Full Name *
                          </label>
                          <input
                            type="text"
                            id="full_name"
                            name="full_name"
                            value={formData.full_name}
                            onChange={handleBasicChange}
                            className={styles.formInput}
                            required
                            disabled={isLoading}
                          />
                        </div>

                        <div className={styles.formGroup}>
                          <label htmlFor="email" className={styles.formLabel}>
                            Email Address
                          </label>
                          <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            className={styles.formInput}
                            disabled
                          />
                          <p className={styles.helpText}>
                            Email cannot be changed
                          </p>
                        </div>

                        <div className={styles.formGroup}>
                          <label htmlFor="phone" className={styles.formLabel}>
                            Phone Number *
                          </label>
                          <input
                            type="tel"
                            id="phone"
                            name="phone"
                            value={formData.phone}
                            onChange={handleBasicChange}
                            className={styles.formInput}
                            required
                            disabled={isLoading}
                            placeholder="+27 12 345 6789"
                          />
                        </div>
                      </div>
                    </div>

                    {/* SME-specific fields */}
                    {user.role === "sme" && (
                      <div className={styles.formSection}>
                        <h3 className={styles.sectionTitle}>
                          Business Information
                        </h3>
                        <div className={styles.formGrid}>
                          <div className={styles.formGroup}>
                            <label
                              htmlFor="business_name"
                              className={styles.formLabel}
                            >
                              Business Name *
                            </label>
                            <input
                              type="text"
                              id="business_name"
                              name="business_name"
                              value={smeData.business_name}
                              onChange={handleSMEChange}
                              className={styles.formInput}
                              required
                              disabled={isLoading}
                            />
                          </div>

                          <div className={styles.formGroup}>
                            <label
                              htmlFor="business_type"
                              className={styles.formLabel}
                            >
                              Business Type
                            </label>
                            <input
                              type="text"
                              id="business_type"
                              name="business_type"
                              value={smeData.business_type}
                              onChange={handleSMEChange}
                              className={styles.formInput}
                              disabled={isLoading}
                              placeholder="e.g., Retail, Manufacturing, Services"
                            />
                          </div>

                          <div className={styles.formGroup}>
                            <label
                              htmlFor="business_address"
                              className={styles.formLabel}
                            >
                              Business Address *
                            </label>
                            <textarea
                              id="business_address"
                              name="business_address"
                              value={smeData.business_address}
                              onChange={handleSMEChange}
                              className={`${styles.formInput} ${styles.textarea}`}
                              rows="3"
                              required
                              disabled={isLoading}
                              placeholder="Street address, city, province, postal code"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Agent-specific fields */}
                    {user.role === "agent" && (
                      <div className={styles.formSection}>
                        <h3 className={styles.sectionTitle}>
                          Agent Information
                        </h3>
                        <div className={styles.formGrid}>
                          <div className={styles.formGroup}>
                            <label
                              htmlFor="home_address"
                              className={styles.formLabel}
                            >
                              Home Address *
                            </label>
                            <textarea
                              id="home_address"
                              name="home_address"
                              value={agentData.home_address}
                              onChange={handleAgentChange}
                              className={`${styles.formInput} ${styles.textarea}`}
                              rows="3"
                              required
                              disabled={isLoading}
                              placeholder="Street address, city, province, postal code"
                            />
                          </div>

                          <div className={styles.checkboxGroup}>
                            <label className={styles.checkboxLabel}>
                              <input
                                type="checkbox"
                                name="has_smartphone"
                                checked={agentData.has_smartphone}
                                onChange={handleAgentChange}
                                className={styles.checkbox}
                                disabled={isLoading}
                              />
                              <span className={styles.checkboxText}>
                                I have a smartphone
                              </span>
                            </label>
                          </div>

                          <div className={styles.checkboxGroup}>
                            <label className={styles.checkboxLabel}>
                              <input
                                type="checkbox"
                                name="has_internet"
                                checked={agentData.has_internet}
                                onChange={handleAgentChange}
                                className={styles.checkbox}
                                disabled={isLoading}
                              />
                              <span className={styles.checkboxText}>
                                I have internet access
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Delivery-specific fields */}
                    {user.role === "delivery" && (
                      <div className={styles.formSection}>
                        <h3 className={styles.sectionTitle}>
                          Delivery Partner Information
                        </h3>
                        <div className={styles.formGrid}>
                          <div className={styles.formGroup}>
                            <label
                              htmlFor="home_address"
                              className={styles.formLabel}
                            >
                              Home Address *
                            </label>
                            <textarea
                              id="home_address"
                              name="home_address"
                              value={deliveryData.home_address}
                              onChange={handleDeliveryChange}
                              className={`${styles.formInput} ${styles.textarea}`}
                              rows="3"
                              required
                              disabled={isLoading}
                              placeholder="Street address, city, province, postal code"
                            />
                          </div>

                          <div className={styles.formGroup}>
                            <label
                              htmlFor="vehicle_type"
                              className={styles.formLabel}
                            >
                              Vehicle Type
                            </label>
                            <select
                              id="vehicle_type"
                              name="vehicle_type"
                              value={deliveryData.vehicle_type}
                              onChange={handleDeliveryChange}
                              className={styles.formInput}
                              disabled={isLoading}
                            >
                              <option value="">Select vehicle type</option>
                              <option value="bicycle">Bicycle</option>
                              <option value="motorcycle">Motorcycle</option>
                              <option value="car">Car</option>
                              <option value="bakkie">Bakkie/Truck</option>
                              <option value="other">Other</option>
                            </select>
                          </div>

                          <div className={styles.checkboxGroup}>
                            <label className={styles.checkboxLabel}>
                              <input
                                type="checkbox"
                                name="has_smartphone"
                                checked={deliveryData.has_smartphone}
                                onChange={handleDeliveryChange}
                                className={styles.checkbox}
                                disabled={isLoading}
                              />
                              <span className={styles.checkboxText}>
                                I have a smartphone
                              </span>
                            </label>
                          </div>

                          <div className={styles.checkboxGroup}>
                            <label className={styles.checkboxLabel}>
                              <input
                                type="checkbox"
                                name="has_internet"
                                checked={deliveryData.has_internet}
                                onChange={handleDeliveryChange}
                                className={styles.checkbox}
                                disabled={isLoading}
                              />
                              <span className={styles.checkboxText}>
                                I have internet access
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className={styles.formActions}>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className={styles.cancelButton}
                        disabled={isLoading}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className={`${styles.saveButton} ${isLoading ? styles.loading : ""}`}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <span className={styles.spinner}></span>
                            Saving...
                          </>
                        ) : (
                          "Save Changes"
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className={styles.profileDetails}>
                    {/* Personal Information Display */}
                    <div className={styles.detailSection}>
                      <h3 className={styles.sectionTitle}>
                        Personal Information
                      </h3>
                      <div className={styles.detailGrid}>
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>Full Name</span>
                          <span className={styles.detailValue}>
                            {combinedData.full_name}
                          </span>
                        </div>
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>Email</span>
                          <span className={styles.detailValue}>
                            {combinedData.email}
                          </span>
                        </div>
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>Phone</span>
                          <span className={styles.detailValue}>
                            {combinedData.phone}
                          </span>
                        </div>
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>
                            Account Type
                          </span>
                          <span
                            className={`${styles.detailValue} ${styles[user.role]}`}
                          >
                            {user.role === "customer" && "Customer"}
                            {user.role === "sme" && "Business Owner"}
                            {user.role === "agent" && "Sales Agent"}
                            {user.role === "delivery" && "Delivery Partner"}
                          </span>
                        </div>
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>
                            Account Status
                          </span>
                          <span
                            className={`${styles.detailValue} ${styles[user.status]}`}
                          >
                            {user.status === "active" && "Active"}
                            {user.status === "pending" && "Pending Approval"}
                            {user.status === "suspended" && "Suspended"}
                          </span>
                        </div>
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>
                            Member Since
                          </span>
                          <span className={styles.detailValue}>
                            {new Date(user.created_at).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              },
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* SME Information Display */}
                    {user.role === "sme" && (
                      <div className={styles.detailSection}>
                        <h3 className={styles.sectionTitle}>
                          Business Information
                        </h3>
                        <div className={styles.detailGrid}>
                          <div className={styles.detailItem}>
                            <span className={styles.detailLabel}>
                              Business Name
                            </span>
                            <span className={styles.detailValue}>
                              {smeData.business_name}
                            </span>
                          </div>
                          {smeData.business_type && (
                            <div className={styles.detailItem}>
                              <span className={styles.detailLabel}>
                                Business Type
                              </span>
                              <span className={styles.detailValue}>
                                {smeData.business_type}
                              </span>
                            </div>
                          )}
                          {smeData.business_address && (
                            <div className={styles.detailItem}>
                              <span className={styles.detailLabel}>
                                Business Address
                              </span>
                              <span className={styles.detailValue}>
                                {smeData.business_address}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Agent Information Display */}
                    {user.role === "agent" && (
                      <div className={styles.detailSection}>
                        <h3 className={styles.sectionTitle}>
                          Agent Information
                        </h3>
                        <div className={styles.detailGrid}>
                          <div className={styles.detailItem}>
                            <span className={styles.detailLabel}>
                              Home Address
                            </span>
                            <span className={styles.detailValue}>
                              {agentData.home_address}
                            </span>
                          </div>
                          <div className={styles.detailItem}>
                            <span className={styles.detailLabel}>
                              Smartphone
                            </span>
                            <span className={styles.detailValue}>
                              {agentData.has_smartphone
                                ? "✓ Available"
                                : "✗ Not Available"}
                            </span>
                          </div>
                          <div className={styles.detailItem}>
                            <span className={styles.detailLabel}>
                              Internet Access
                            </span>
                            <span className={styles.detailValue}>
                              {agentData.has_internet
                                ? "✓ Available"
                                : "✗ Not Available"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Delivery Information Display */}
                    {user.role === "delivery" && (
                      <div className={styles.detailSection}>
                        <h3 className={styles.sectionTitle}>
                          Delivery Partner Information
                        </h3>
                        <div className={styles.detailGrid}>
                          <div className={styles.detailItem}>
                            <span className={styles.detailLabel}>
                              Home Address
                            </span>
                            <span className={styles.detailValue}>
                              {deliveryData.home_address}
                            </span>
                          </div>
                          {deliveryData.vehicle_type && (
                            <div className={styles.detailItem}>
                              <span className={styles.detailLabel}>
                                Vehicle Type
                              </span>
                              <span className={styles.detailValue}>
                                {deliveryData.vehicle_type
                                  .charAt(0)
                                  .toUpperCase() +
                                  deliveryData.vehicle_type.slice(1)}
                              </span>
                            </div>
                          )}
                          <div className={styles.detailItem}>
                            <span className={styles.detailLabel}>
                              Smartphone
                            </span>
                            <span className={styles.detailValue}>
                              {deliveryData.has_smartphone
                                ? "✓ Available"
                                : "✗ Not Available"}
                            </span>
                          </div>
                          <div className={styles.detailItem}>
                            <span className={styles.detailLabel}>
                              Internet Access
                            </span>
                            <span className={styles.detailValue}>
                              {deliveryData.has_internet
                                ? "✓ Available"
                                : "✗ Not Available"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}
