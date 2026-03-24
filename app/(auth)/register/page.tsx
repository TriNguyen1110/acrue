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
          <Link href="/" className="inline-flex flex-col items-center gap-2 group">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="575 90 910 910" width="44" height="44" style={{ filter: "drop-shadow(0 0 8px rgba(247,243,229,0.3))" }}>
              <path fill="#d8c498" d="M1036.69,2.55l-4.24-2.55-449.82,270.01v539.98l445.58,267.46,4.24,2.55,449.82-270.01V270.01L1036.69,2.55ZM1443.47,786.73l-411.03,246.72-411.03-246.72v-493.43l411.03-246.72,411.03,246.72v493.43Z"/>
              <polygon fill="#eadfc7" points="642.77 306.38 642.77 773.59 816.47 877.86 816.81 878.07 911.02 934.63 911.35 934.83 911.35 821.3 911.35 614.63 911.36 614.63 911.36 414.89 846.63 476.75 846.6 476.75 816.81 505.23 816.81 505.25 751.87 567.29 816.81 567.29 816.81 764.55 816.47 764.35 737.31 716.84 737.31 363.14 1031.96 186.28 1326.6 363.14 1326.6 716.84 1246.84 764.73 1246.84 566.58 1312.05 566.58 1247.1 504.52 1246.16 503.62 1217.32 476.04 1152.56 414.17 1152.56 476.75 1152.3 476.75 1152.3 821.49 1152.3 934.97 1152.3 935.17 1246.84 878.42 1246.84 878.22 1421.14 773.59 1421.14 306.38 1031.96 72.77 642.77 306.38"/>
              <polygon fill="#fcedcd" points="1145.07 407.02 1079.24 344.12 1079.23 344.12 1079.23 344.11 1076.5 341.49 1076.49 341.49 1032.3 299.28 988.14 341.49 988.13 341.49 984.68 344.79 984.68 344.8 919.58 407.02 984.68 407.02 984.68 865.33 984.68 978.55 1032.21 1007.06 1032.44 1007.21 1079.23 979.13 1079.23 978.83 1079.23 865.33 1079.23 458.89 1079.24 458.89 1079.24 426.91 1079.23 426.91 1079.23 407.02 1145.07 407.02"/>
            </svg>
            <h1 className="font-display text-4xl text-gold-400 group-hover:opacity-80 transition-opacity"
              style={{ textShadow: "0 0 24px rgba(247,243,229,0.4)" }}>
              Acrue
            </h1>
          </Link>
          <p className="mt-2 text-text-muted text-xs tracking-[0.2em] uppercase">
            Built to Accrue.
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
            className="btn-ghost w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border text-sm font-medium text-text-primary hover:border-gold-500/40 hover:bg-navy-700/50 mb-6"
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
              className="btn-gold w-full py-3 px-4 rounded-xl text-sm font-medium mt-2"
              style={{
                background: "linear-gradient(135deg, #ede4cc 0%, #f7f3e5 100%)",
                color: "#050d1a",
                boxShadow: "0 0 12px rgba(247,243,229,0.4), 0 0 28px rgba(247,243,229,0.15)",
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
