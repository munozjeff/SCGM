import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { store } from './store/store';
import { checkAuthState } from './store/slices/authSlice';
import MainLayout from './layouts/MainLayout';
import SalesUpdate from './pages/SalesUpdate';
import IncomeUpdate from './pages/IncomeUpdate';
import ClientUpdate from './pages/ClientUpdate';
import ActivationUpdate from './pages/ActivationUpdate';
import SimStatusUpdate from './pages/SimStatusUpdate';
import SalesTypeUpdate from './pages/SalesTypeUpdate';
import ManagementStatusUpdate from './pages/ManagementStatusUpdate';
import PortfolioUpdate from './pages/PortfolioUpdate';
import GuidesUpdate from './pages/GuidesUpdate';
import UserManagement from './pages/UserManagement';
import DatabaseView from './pages/DatabaseView';
import ProtectedRoute from './layouts/ProtectedRoute';
import Login from './pages/Login';

// Placeholder Pages
const Dashboard = () => <div className="glass-panel" style={{ padding: '2rem' }}><h2>Dashboard</h2><p>Bienvenido al sistema de gestión.</p></div>;

function AppContent() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(checkAuthState());
  }, [dispatch]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="sales/update" element={<SalesUpdate />} />
          <Route path="income/update" element={<IncomeUpdate />} />
          <Route path="client/update" element={<ClientUpdate />} />
          <Route path="activation/update" element={<ActivationUpdate />} />
          <Route path="sim/update" element={<SimStatusUpdate />} />
          <Route path="sales-type/update" element={<SalesTypeUpdate />} />
          <Route path="management/update" element={<ManagementStatusUpdate />} />
          <Route path="portfolio/update" element={<PortfolioUpdate />} />
          <Route path="guides/update" element={<GuidesUpdate />} />
          <Route path="database" element={<DatabaseView />} />

          <Route path="admin/users" element={
            <ProtectedRoute requiredRole="admin">
              <UserManagement />
            </ProtectedRoute>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}

export default App;
