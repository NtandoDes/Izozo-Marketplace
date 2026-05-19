// App.jsx
import { Routes, Route } from "react-router-dom";
import { CartProvider } from "./contexts/CartContext";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import Home from "./Pages/Home";
import ProductDetails from "./Pages/ProductDetails";
import Products from "./Pages/Products";
import Cart from "./Pages/Cart";
import Checkout from "./Pages/Checkout";
import Category from "./Pages/Category";
import Login from "./Pages/Login";
import Register from "./Pages/Register";
import Apply from "./Pages/Apply";
import AdminRegister from "./Pages/AdminRegister";
import Account from "./Pages/Account";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import NotificationsPage from './pages/NotificationsPage';

// Customer Pages
import CustomerDashboard from "./components/dashboards/CustomerDashboard";
import CustomerOrders from "./components/dashboards/CustomerOrders";
import CustomerOrderDetail from "./components/dashboards/CustomerOrderDetail";

// SME Pages
import SMEDashboard from './components/dashboards/SMEDashboard';
import SMEOrders from "./Pages/sme/SMEOrders";
import SMEOrderDetail from "./Pages/sme/SMEOrderDetail";
import PackageOrder from "./Pages/sme/PackageOrder";
import SMEProducts from "./Pages/sme/SMEProducts";
import SMEProductDetail from "./Pages/sme/SMEProductDetail";
import SMECreateProduct from "./Pages/sme/SMECreateProduct";

// Agent Pages
import AgentDashboard from './components/dashboards/AgentDashboard';
import AgentProducts from "./Pages/agent/AgentProducts";
import AgentProductDetail from "./Pages/agent/AgentProductDetail";
import AgentEditProduct from "./Pages/agent/AgentEditProduct";
import AgentCreateProduct from "./Pages/agent/AgentCreateProduct";
import AgentOrders from './Pages/agent/AgentOrders';
import AgentOrderDetail from "./Pages/agent/AgentOrderDetail";
import AgentCreateOrder from './Pages/agent/AgentCreateOrder';
import AgentCommission from "./Pages/agent/AgentCommission";
import AgentCollectionDashboard from './Pages/agent/AgentCollectionDashboard';
import AgentShippingDashboard from './Pages/agent/AgentShippingDashboard';
import AgentCommissionDashboard from './Pages/agent/AgentCommissionDashboard';

// Delivery Pages
import DeliveryDashboard from './components/dashboards/DeliveryDashboard';

// Admin Pages
import AdminDashboard from "./components/dashboards/AdminDashboard";

import ForgotPassword from "./Pages/ForgotPassword";
import ResetPassword from "./Pages/ResetPassword";

import "./App.css";

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <NotificationProvider>
          <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            <Header />
            <main className="main-content">
              <Routes>
                {/* ============= PUBLIC ROUTES ============= */}
                <Route path="/" element={<Home />} />
                <Route path="/product/:id" element={<ProductDetails />} />
                <Route path="/products" element={<Products />} />
                <Route path="/category" element={<Category />} />
                <Route path="/cart" element={<Cart />} />
                
                {/* ============= AUTH ROUTES ============= */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/apply" element={<Apply />} />
                <Route path="/admin/register" element={<AdminRegister />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                
                {/* ============= PROTECTED ROUTES ============= */}
                <Route path="/checkout" element={
                  <ProtectedRoute allowedRoles={['customer', 'sme', 'agent', 'delivery']}>
                    <Checkout />
                  </ProtectedRoute>
                } />
                
                <Route path="/account" element={
                  <ProtectedRoute>
                    <Account />
                  </ProtectedRoute>
                } />

                <Route path="/notifications" element={
                  <ProtectedRoute>
                    <NotificationsPage />
                  </ProtectedRoute>
                } />

                {/* ============= CUSTOMER ROUTES ============= */}
                <Route path="/customer-dashboard" element={
                  <ProtectedRoute allowedRoles={['customer']}>
                    <CustomerDashboard />
                  </ProtectedRoute>
                } />

                <Route path="/account/orders" element={
                  <ProtectedRoute allowedRoles={['customer']}>
                    <CustomerOrders />
                  </ProtectedRoute>
                } />

                <Route path="/account/orders/:orderNumber" element={
                  <ProtectedRoute allowedRoles={['customer']}>
                    <CustomerOrderDetail />
                  </ProtectedRoute>
                } />

                {/* ============= SME ROUTES ============= */}
                <Route path="/sme-dashboard" element={
                  <ProtectedRoute allowedRoles={['sme']}>
                    <SMEDashboard />
                  </ProtectedRoute>
                } />

                <Route path="/sme/products" element={
                  <ProtectedRoute allowedRoles={['sme']}>
                    <SMEProducts />
                  </ProtectedRoute>
                } />

                <Route path="/sme/products/:id" element={
                  <ProtectedRoute allowedRoles={['sme']}>
                    <SMEProductDetail />
                  </ProtectedRoute>
                } />

                <Route path="/sme/products/create" element={
                    <ProtectedRoute allowedRoles={['sme']}>
                      <SMECreateProduct />
                    </ProtectedRoute>
                  } />

                <Route path="/sme/products/:id/edit" element={
                    <ProtectedRoute allowedRoles={['sme']}>
                      <SMEProductDetail />  
                    </ProtectedRoute>
                  } />

                <Route path="/sme/orders" element={
                  <ProtectedRoute allowedRoles={['sme']}>
                    <SMEOrders />
                  </ProtectedRoute>
                } />

                <Route path="/sme/orders/:orderNumber" element={
                  <ProtectedRoute allowedRoles={['sme']}>
                    <SMEOrderDetail />
                  </ProtectedRoute>
                } />

                <Route path="/sme/orders/:orderNumber/package" element={
                  <ProtectedRoute allowedRoles={['sme']}>
                    <PackageOrder />
                  </ProtectedRoute>
                } />
                
                {/* ============= AGENT ROUTES ============= */}
                <Route path="/agent-dashboard" element={
                  <ProtectedRoute allowedRoles={['agent']}>
                    <AgentDashboard />
                  </ProtectedRoute>
                } />

                {/* Agent Product Routes */}
                <Route path="/agent/products" element={
                  <ProtectedRoute allowedRoles={['agent']}>
                    <AgentProducts />
                  </ProtectedRoute>
                } />
                
                <Route path="/agent/products/create" element={
                  <ProtectedRoute allowedRoles={['agent']}>
                    <AgentCreateProduct />
                  </ProtectedRoute>
                } />
                
                <Route path="/agent/products/:id" element={
                  <ProtectedRoute allowedRoles={['agent']}>
                    <AgentProductDetail />
                  </ProtectedRoute>
                } />
                
                <Route path="/agent/products/:id/edit" element={
                  <ProtectedRoute allowedRoles={['agent']}>
                    <AgentEditProduct />
                  </ProtectedRoute>
                } />

                {/* Agent Order Routes */}
                <Route path="/agent/orders" element={
                  <ProtectedRoute allowedRoles={['agent']}>
                    <AgentOrders />
                  </ProtectedRoute>
                } />
                
                <Route path="/agent/orders/create" element={
                  <ProtectedRoute allowedRoles={['agent']}>
                    <AgentCreateOrder />
                  </ProtectedRoute>
                } />

                <Route path="/agent/orders/:orderId" element={
                  <ProtectedRoute allowedRoles={['agent']}>
                    <AgentOrderDetail />
                  </ProtectedRoute>
                } />

                {/* Agent Collection Routes */}
                <Route path="/agent/collection" element={
                  <ProtectedRoute allowedRoles={['agent']}>
                    <AgentCollectionDashboard />
                  </ProtectedRoute>
                } />

                {/* Agent Shipping Routes */}
                <Route path="/agent/shipping" element={
                  <ProtectedRoute allowedRoles={['agent']}>
                    <AgentShippingDashboard />
                  </ProtectedRoute>
                } />

                {/* Agent Commission Routes */}
                <Route path="/agent/commission" element={
                  <ProtectedRoute allowedRoles={['agent']}>
                    <AgentCommission />
                  </ProtectedRoute>
                } />

                <Route path="/agent/commission-dashboard" element={
                  <ProtectedRoute allowedRoles={['agent']}>
                    <AgentCommissionDashboard />
                  </ProtectedRoute>
                } />
                
                {/* ============= DELIVERY ROUTES ============= */}
                <Route path="/delivery-dashboard" element={
                  <ProtectedRoute allowedRoles={['delivery']}>
                    <DeliveryDashboard />
                  </ProtectedRoute>
                } />
                
                {/* ============= ADMIN ROUTES ============= */}
                <Route path="/admin" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } />

                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                
                {/* ============= 404 ROUTE ============= */}
                <Route path="*" element={
                  <div className="not-found-page">
                    <h1>404 - Page Not Found</h1>
                    <p>The page you are looking for does not exist.</p>
                    <a href="/" className="home-link">Go to Homepage</a>
                  </div>
                } />
              </Routes>
            </main>
            <Footer />
          </div>
        </NotificationProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;