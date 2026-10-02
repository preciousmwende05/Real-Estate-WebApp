import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, HOME_BY_ROLE } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Browse from './pages/Browse';
import PropertyDetails from './pages/PropertyDetails';
import MyOffers from './pages/MyOffers';
import Saved from './pages/Saved';
import SellerDashboard from './pages/seller/SellerDashboard';
import ListingEditor from './pages/seller/ListingEditor';
import ReceivedOffers from './pages/seller/ReceivedOffers';
import NotFound from './pages/NotFound';
import { Spinner } from './components/UI';

// Admin pages (and the charting library) are only downloaded by admins
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminListings = lazy(() => import('./pages/admin/AdminListings'));
const AdminActivity = lazy(() => import('./pages/admin/AdminActivity'));

function HomeRedirect() {
  const { user } = useAuth();
  return user ? <Navigate to={HOME_BY_ROLE[user.role]} replace /> : <Landing />;
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
        <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Buyers & renters — what they see is decided by their role */}
          <Route element={<ProtectedRoute roles={['buyer', 'renter']} />}>
            <Route path="/browse" element={<Browse />} />
            <Route path="/my-offers" element={<MyOffers />} />
            <Route path="/saved" element={<Saved />} />
          </Route>

          <Route element={<ProtectedRoute roles={['buyer', 'renter', 'seller', 'admin']} />}>
            <Route path="/properties/:id" element={<PropertyDetails />} />
          </Route>

          {/* Sellers */}
          <Route element={<ProtectedRoute roles={['seller']} />}>
            <Route path="/seller" element={<SellerDashboard />} />
            <Route path="/seller/listings/new" element={<ListingEditor />} />
            <Route path="/seller/listings/:id/edit" element={<ListingEditor />} />
            <Route path="/seller/offers" element={<ReceivedOffers />} />
          </Route>

          {/* Admin */}
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/listings" element={<AdminListings />} />
            <Route path="/admin/activity" element={<AdminActivity />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
