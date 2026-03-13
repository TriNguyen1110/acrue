"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.message || "Registration failed.");
      setLoading(false);
      return;
    }

    await signIn("credentials", { email, password, callbackUrl: "/dashboard" });
  }

  async function handleGoogle() {
    await signIn("google", { callbackUrl: "/dashboard" });
  }

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(247,243,229,0.07) 0%, transparent 70%)",
        }}
      />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <h1
            className="font-display text-5xl font-light tracking-widest text-gold-400"
            style={{ textShadow: "0 0 24px rgba(247,243,229,0.4)" }}
          >
            ACRUE
          </h1>
          <p className="mt-2 text-text-secondary text-sm tracking-widest uppercase font-light">
            Market Intelligence
          </p>
        </div>

        <div
          className="rounded-2xl p-8 border"
          style={{
            background: "rgba(10, 22, 40, 0.8)",
            borderColor: "rgba(247,243,229,0.15)",
            backdropFilter: "blur(12px)",
          }}
        >
          <h2 className="font-display text-2xl font-light text-white mb-1">
            Create your account
          </h2>
          <p className="text-sm text-text-secondary mb-8">
            Start tracking markets with intelligence
          </p>

          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border text-sm font-medium text-text-primary transition-all duration-200 hover:border-gold-500/40 hover:bg-navy-700/50 mb-6"
            style={{ borderColor: "rgba(255,255,255,0.1)" }}
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-navy-600" />
            <span className="text-xs text-text-muted">or</span>
            <div className="flex-1 h-px bg-navy-600" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1.5 tracking-wide uppercase">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full bg-navy-800 border rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted outline-none transition-all duration-200"
                style={{ borderColor: "rgba(26,45,74,1)" }}
                onFocus={(e) => {
                  e.target.style.borderColor = "rgba(247,243,229,0.5)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(247,243,229,0.06)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(26,45,74,1)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            <div>
              <label className="block text-xs text-text-secondary mb-1.5 tracking-wide uppercase">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-navy-800 border rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted outline-none transition-all duration-200"
                style={{ borderColor: "rgba(26,45,74,1)" }}
                onFocus={(e) => {
                  e.target.style.borderColor = "rgba(247,243,229,0.5)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(247,243,229,0.06)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(26,45,74,1)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            <div>
              <label className="block text-xs text-text-secondary mb-1.5 tracking-wide uppercase">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-navy-800 border rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted outline-none transition-all duration-200"
                style={{ borderColor: "rgba(26,45,74,1)" }}
                onFocus={(e) => {
                  e.target.style.borderColor = "rgba(247,243,229,0.5)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(247,243,229,0.06)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(26,45,74,1)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs py-2 px-3 rounded-lg bg-red-400/10 border border-red-400/20">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #ede4cc 0%, #f7f3e5 100%)",
                color: "#050d1a",
                boxShadow: "0 0 12px rgba(247,243,229,0.4), 0 0 28px rgba(247,243,229,0.15)",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.boxShadow =
                  "0 0 20px rgba(247,243,229,0.6), 0 0 48px rgba(247,243,229,0.25)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.boxShadow =
                  "0 0 12px rgba(247,243,229,0.4), 0 0 28px rgba(247,243,229,0.15)";
              }}
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm text-text-secondary">
          Already have an account?{" "}
          <Link href="/login" className="text-gold-500 hover:text-gold-400 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" />
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" />
    </svg>
  );
}
