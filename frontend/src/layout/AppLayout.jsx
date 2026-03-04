import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { attachToken } from "../api/client";

export default function AppLayout() {
  const { admin, logout, token } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    attachToken(token);
  }, [token]);

  return (
    <div className="app-shell">
      <aside className={`sidebar${mobileNavOpen ? " open" : ""}`}>
        <div className="sidebar-top">
          <Link to="/" className="brand" onClick={() => setMobileNavOpen(false)}>
            Paymenty
          </Link>
          <button
            className="button ghost nav-toggle"
            type="button"
            onClick={() => setMobileNavOpen((prev) => !prev)}
          >
            {mobileNavOpen ? "Close" : "Menu"}
          </button>
        </div>
        <nav>
          <NavLink to="/" end onClick={() => setMobileNavOpen(false)}>
            Businesses
          </NavLink>
          <NavLink to="/business/tailor" onClick={() => setMobileNavOpen(false)}>
            Tailor
          </NavLink>
          <NavLink to="/business/butcher" onClick={() => setMobileNavOpen(false)}>
            Butcher
          </NavLink>
          <NavLink to="/owners" onClick={() => setMobileNavOpen(false)}>
            Owner Expenditure
          </NavLink>
          <NavLink to="/payments" onClick={() => setMobileNavOpen(false)}>
            Payments
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <p>{admin?.email}</p>
          <button className="button ghost" onClick={logout} type="button">
            Logout
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
