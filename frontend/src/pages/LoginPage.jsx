import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginApi, signupApi } from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import { attachToken } from "../api/client";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");

    if (mode === "signup" && form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const payload = { email: form.email, password: form.password };
      const result = mode === "signup" ? await signupApi(payload) : await loginApi(payload);
      login(result.token, result.admin);
      attachToken(result.token);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>{mode === "signup" ? "Admin Sign Up" : "Admin Sign In"}</h1>
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
            required
          />
        </label>
        {mode === "signup" ? (
          <label>
            Confirm Password
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm((s) => ({ ...s, confirmPassword: e.target.value }))}
              required
            />
          </label>
        ) : null}
        {error ? <p className="error-text">{error}</p> : null}
        <button className="button" disabled={loading} type="submit">
          {loading ? "Please wait..." : mode === "signup" ? "Sign Up" : "Sign In"}
        </button>
        <button
          className="button ghost"
          type="button"
          onClick={() => {
            setError("");
            setMode((m) => (m === "signup" ? "signin" : "signup"));
          }}
        >
          {mode === "signup" ? "Already have an account? Sign In" : "Create account? Sign Up"}
        </button>
      </form>
    </div>
  );
}
