import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import BusinessSelectionPage from "./pages/BusinessSelectionPage";
import BusinessDashboardPage from "./pages/BusinessDashboardPage";
import OwnerExpenditurePage from "./pages/OwnerExpenditurePage";
import { useAuth } from "./context/AuthContext";
import AppLayout from "./layout/AppLayout";

function PrivateRoute({ children }) {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<BusinessSelectionPage />} />
        <Route path="/business/:businessType" element={<BusinessDashboardPage />} />
        <Route path="/owners" element={<OwnerExpenditurePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
