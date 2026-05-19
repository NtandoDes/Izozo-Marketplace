/* eslint-disable no-unused-vars */
// frontend/src/components/Header.jsx
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../contexts/CartContext";
import { useAuth } from "../contexts/AuthContext";
import NotificationIcon from "./NotificationIcon";
import styles from "./Header.module.css";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const { cartCount } = useCart();
  const { user, logout } = useAuth();

  const userDropdownRef = useRef(null);

  // Handle scroll for sticky header
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle click outside to close user dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setIsUserDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    setIsUserDropdownOpen(false);
  };

  const toggleUserDropdown = () => {
    setIsUserDropdownOpen(!isUserDropdownOpen);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchTerm.trim())}`);
      setIsMenuOpen(false);
      setSearchTerm("");
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
    setIsMenuOpen(false);
    setIsUserDropdownOpen(false);
  };

  const closeMenus = () => {
    setIsMenuOpen(false);
    setIsUserDropdownOpen(false);
  };

  const userRole = user?.role || null;

  const getDashboardLink = () => {
    if (!userRole) return '/';
    if (userRole === 'admin') return '/admin';
    return `/${userRole}-dashboard`;
  };

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ""}`}>
      <div className={styles.container}>
        {/* Logo */}
        <div className={styles.logo}>
          <Link
            to={userRole === "customer" || !user ? "/" : getDashboardLink()}
            onClick={closeMenus}
          >
            <img
              src="/izozo.png"
              alt="Izozo Marketplace Logo"
              className={styles.logoImage}
            />
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className={styles.nav}>
          {userRole === "customer" || !user ? (
            <Link to="/products" className={styles.navLink} onClick={closeMenus}>
              All Products
            </Link>
          ) : (
            <Link to={getDashboardLink()} className={styles.navLink} onClick={closeMenus}>
              Dashboard
            </Link>
          )}
        </nav>

        {/* Right Side: Search + Action Icons */}
        <div className={styles.rightSection}>
          {/* Search Bar - Only show for customers */}
          {(userRole === "customer" || !user) && (
            <div className={styles.searchBar}>
              <form className={styles.searchForm} onSubmit={handleSearch}>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Find product"
                  className={styles.searchInput}
                  aria-label="Search for products"
                />
                <button type="submit" className={styles.searchButton} aria-label="Search">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
                  </svg>
                </button>
              </form>
            </div>
          )}

          {/* Action Icons */}
          <div className={styles.actionIcons}>

            {/* Notification Icon - standalone, shown for logged in users */}
            {user && <NotificationIcon />}

            {/* Account Dropdown - click based, no role badge */}
            {user ? (
              <div className={styles.userDropdown} ref={userDropdownRef}>
                <button
                  className={styles.userButton}
                  onClick={toggleUserDropdown}
                  aria-expanded={isUserDropdownOpen}
                  aria-label="User menu"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                    <path fillRule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z" />
                  </svg>
                </button>

                {/* Click-controlled dropdown */}
                {isUserDropdownOpen && (
                  <div className={styles.dropdownMenu}>
                    <div className={styles.dropdownHeader}>
                      <span className={styles.dropdownUserEmail}>{user?.email}</span>
                    </div>

                    <Link to={getDashboardLink()} className={styles.dropdownItem} onClick={closeMenus}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M0 2.5A1.5 1.5 0 0 1 1.5 1h13A1.5 1.5 0 0 1 16 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 13.5v-11zM1.5 2a.5.5 0 0 0-.5.5V8h4V2H1.5zM5 2v6h4V2H5zm4 7H5v5h4V9zm1 5V9h4V2.5a.5.5 0 0 0-.5-.5H10v12h.5a.5.5 0 0 0 .5-.5V14z" />
                      </svg>
                      My Account
                    </Link>

                    <Link to="/account" className={styles.dropdownItem} onClick={closeMenus}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                        <path fillRule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z" />
                      </svg>
                      Profile Settings
                    </Link>

                    <div className={styles.dropdownDivider}></div>

                    <button onClick={handleLogout} className={styles.dropdownItem}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path fillRule="evenodd" d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0v2z" />
                        <path fillRule="evenodd" d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z" />
                      </svg>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className={styles.iconButton} aria-label="Login" onClick={closeMenus}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                  <path fillRule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z" />
                </svg>
              </Link>
            )}

            {/* Cart Icon - Only show for customers */}
            {(userRole === "customer" || !user) && (
              <Link to="/cart" className={styles.cartButton} aria-label="Shopping Cart" onClick={closeMenus}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M0 1.5A.5.5 0 0 1 .5 1H2a.5.5 0 0 1 .485.379L2.89 3H14.5a.5.5 0 0 1 .491.592l-1.5 8A.5.5 0 0 1 13 12H4a.5.5 0 0 1-.491-.408L2.01 3.607 1.61 2H.5a.5.5 0 0 1-.5-.5zM3.102 4l1.313 7h8.17l1.313-7H3.102zM5 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-7 1a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
                </svg>
                {cartCount > 0 && (
                  <span className={styles.cartBadge}>{cartCount}</span>
                )}
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button
          className={styles.mobileMenuBtn}
          onClick={toggleMenu}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? "✕" : "☰"}
        </button>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className={styles.mobileMenu}>
            {/* Mobile Search - Only for customers */}
            {(userRole === "customer" || !user) && (
              <form className={styles.mobileSearch} onSubmit={handleSearch}>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Find product"
                  className={styles.mobileSearchInput}
                />
                <button type="submit" className={styles.mobileSearchButton}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
                  </svg>
                </button>
              </form>
            )}

            {/* Mobile Navigation Links */}
            {userRole === "customer" || !user ? (
              <Link to="/products" className={styles.mobileNavLink} onClick={closeMenus}>
                All Products
              </Link>
            ) : (
              <Link to={getDashboardLink()} className={styles.mobileNavLink} onClick={closeMenus}>
                All Products
              </Link>
            )}

            {/* Mobile Action Icons */}
            <div className={styles.mobileActionIcons}>
              {user ? (
                <>
                  <Link to="/notifications" className={styles.mobileIconButton} onClick={closeMenus}>
                    <div className={styles.mobileIconWrapper}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zM8 1.918l-.797.161A4.002 4.002 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4.002 4.002 0 0 0-3.203-3.92L8 1.917zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5.002 5.002 0 0 1 13 6c0 .88.32 4.2 1.22 6z" />
                      </svg>
                    </div>
                    <span>Notifications</span>
                  </Link>

                  <Link to={getDashboardLink()} className={styles.mobileIconButton} onClick={closeMenus}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M0 2.5A1.5 1.5 0 0 1 1.5 1h13A1.5 1.5 0 0 1 16 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 13.5v-11z" />
                    </svg>
                    <span>My Account</span>
                  </Link>

                  <Link to="/account" className={styles.mobileIconButton} onClick={closeMenus}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                      <path fillRule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z" />
                    </svg>
                    <span>Profile</span>
                  </Link>

                  <button onClick={handleLogout} className={styles.mobileIconButton}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                      <path fillRule="evenodd" d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0v2z" />
                      <path fillRule="evenodd" d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z" />
                    </svg>
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className={styles.mobileIconButton} onClick={closeMenus}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                      <path fillRule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z" />
                    </svg>
                    <span>Login</span>
                  </Link>
                  <Link to="/register" className={styles.mobileIconButton} onClick={closeMenus}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M8 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 4a4 4 0 1 1 4.5 3.969V13.5a.5.5 0 0 1-1 0V7.97A4 4 0 0 1 4 4z" />
                    </svg>
                    <span>Register</span>
                  </Link>
                </>
              )}

              {/* Cart - Only for customers */}
              {(userRole === "customer" || !user) && (
                <Link to="/cart" className={styles.mobileIconButton} onClick={closeMenus}>
                  <div className={styles.mobileIconWrapper}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M0 1.5A.5.5 0 0 1 .5 1H2a.5.5 0 0 1 .485.379L2.89 3H14.5a.5.5 0 0 1 .491.592l-1.5 8A.5.5 0 0 1 13 12H4a.5.5 0 0 1-.491-.408L2.01 3.607 1.61 2H.5a.5.5 0 0 1-.5-.5z" />
                    </svg>
                    {cartCount > 0 && (
                      <span className={styles.mobileCartBadge}>{cartCount}</span>
                    )}
                  </div>
                  <span>Cart</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;