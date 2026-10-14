"use client";

import { useState } from "react";
import { Layers3, Mail, Lock, Eye, EyeOff, ArrowRight, Github, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, mode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Authentication failed.");
      if (data.user) {
        localStorage.setItem("evalboard_user", JSON.stringify(data.user));
      }
      window.location.href = "/";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSocialLogin(provider: string) {
    const demoUser = { id: "demo-" + provider.toLowerCase(), email: `demo@${provider.toLowerCase()}.com` };
    localStorage.setItem("evalboard_user", JSON.stringify(demoUser));
    window.location.href = "/";
  }

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-left-content">
          <div className="login-art-grid" />
          <div className="login-art-orbit orbit-a" />
          <div className="login-art-orbit orbit-b" />
          <div className="login-art-orb">
            <Sparkles size={28} />
          </div>
          <div className="login-tagline">
            <h2>Know what a model<br />can <span>actually do.</span></h2>
            <p>A clear, considered view of AI evaluation results. Explore benchmark scores, understand the context, and see where every number comes from.</p>
          </div>
          <div className="login-stats-row">
            <div className="login-stat"><strong>500+</strong><span>Evaluations</span></div>
            <div className="login-stat"><strong>40+</strong><span>Models</span></div>
            <div className="login-stat"><strong>4</strong><span>Categories</span></div>
          </div>
        </div>
      </div>

      <div className="login-right">
        <div className="login-form-container">
          <a className="brand login-brand" href="/">
            <span className="brand-mark"><Layers3 size={19} strokeWidth={2.3} /></span>
            <span>evalboard<span className="brand-dot">.</span></span>
          </a>

          <div className="login-header">
            <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
            <p>{mode === "login" ? "Sign in to access your evaluation dashboard." : "Get started with your free Evalboard account."}</p>
          </div>

          <div className="login-tabs">
            <button className={`login-tab ${mode === "login" ? "active" : ""}`} onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
            <button className={`login-tab ${mode === "signup" ? "active" : ""}`} onClick={() => { setMode("signup"); setError(""); }}>Create account</button>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <label className="login-field">
              <span className="login-label">Email address</span>
              <div className="login-input-wrap">
                <Mail size={15} className="login-input-icon" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </label>

            <label className="login-field">
              <span className="login-label">Password</span>
              <div className="login-input-wrap">
                <Lock size={15} className="login-input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button type="button" className="login-eye" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            {mode === "login" && (
              <div className="login-extras">
                <label className="login-remember">
                  <input type="checkbox" defaultChecked />
                  <span>Remember me</span>
                </label>
                <a href="#" className="login-forgot">Forgot password?</a>
              </div>
            )}

            {error && <p className="login-error">{error}</p>}

            <button className="button button-dark login-submit" type="submit" disabled={loading}>
              {loading ? (
                <><span className="spinner light-spinner" /> {mode === "login" ? "Signing in…" : "Creating account…"}</>
              ) : (
                <>{mode === "login" ? "Sign in" : "Create account"} <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          <div className="login-divider">
            <span>or continue with</span>
          </div>

          <div className="login-socials">
            <button type="button" className="login-social-btn" onClick={() => handleSocialLogin("Google")}>
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google
            </button>
            <button type="button" className="login-social-btn" onClick={() => handleSocialLogin("GitHub")}>
              <Github size={16} />
              GitHub
            </button>
          </div>

          <p className="login-footer-text">
            {mode === "login" ? (
              <>Don&apos;t have an account? <button type="button" className="login-switch" onClick={() => { setMode("signup"); setError(""); }}>Sign up</button></>
            ) : (
              <>Already have an account? <button type="button" className="login-switch" onClick={() => { setMode("login"); setError(""); }}>Sign in</button></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
