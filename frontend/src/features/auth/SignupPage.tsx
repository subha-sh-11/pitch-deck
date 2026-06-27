"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { projectRoutes } from "@/lib/routes";

type AuthMode = "signup" | "login";

export function SignupPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signup");
  const [transitioning, setTransitioning] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => clearTimeout(t));
  }, []);

  // Blur in (~250ms), then swap the form and blur back out at the peak — a clean
  // symmetric ~0.5s frosted morph.
  function switchMode(next: AuthMode) {
    if (transitioning || next === mode) return;
    setTransitioning(true);
    timers.current.push(
      window.setTimeout(() => {
        setMode(next);
        setTransitioning(false);
      }, 250),
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // No auth backend yet — treat submit as success.
    router.push(projectRoutes.dashboard());
  }

  return (
    <div className="landing-page relative h-screen overflow-hidden bg-black">
      {/* Cinematic background video */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src="/auth-bg.mp4"
        poster="/auth-cinema.jpg"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
      />
      {/* Readability scrim — darkest behind the centered form, lighter at the edges */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_58%_78%_at_50%_50%,rgba(0,0,0,0.8)_0%,rgba(0,0,0,0.45)_42%,rgba(0,0,0,0.12)_100%)]"
        aria-hidden
      />
      <div className="auth-enter relative z-10 flex h-screen">
        {/* Auth form — full width */}
        <div className="flex w-full flex-col px-6 py-8 sm:px-10">
          <div className="flex flex-1 flex-col justify-center">
            <Link
              href="/"
              className={`mx-auto mb-7 flex h-14 w-14 cursor-pointer items-center justify-center rounded-xl landing-glass font-display text-2xl font-bold text-accent-neon transition-[filter,transform,opacity] duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:scale-105 ${
                transitioning ? "scale-[0.97] blur-sm opacity-80" : "blur-0 opacity-100"
              }`}
            >
              P
            </Link>
            <div
              className={`mx-auto w-full max-w-sm py-2 transition-[filter,transform,opacity] duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
                transitioning ? "scale-[0.99] blur-sm opacity-80" : "blur-0 opacity-100"
              }`}
            >
              {mode === "signup" ? (
                <>
                  <h1 className="font-canela text-center text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
                    Create your free account
                  </h1>

                  <button
                    type="button"
                    onClick={() => router.push(projectRoutes.dashboard())}
                    className="landing-btn-glass mt-8 flex w-full items-center justify-center gap-3 rounded-xl px-5 py-3.5 text-sm font-medium text-text-primary"
                  >
                    <GoogleIcon />
                    Continue with Google
                  </button>

                  <div className="my-6 flex items-center gap-4">
                    <span className="h-px flex-1 bg-white/[0.08]" />
                    <span className="text-xs font-medium uppercase tracking-widest text-text-dim">
                      or
                    </span>
                    <span className="h-px flex-1 bg-white/[0.08]" />
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <FloatingField
                        id="su-first"
                        label="First name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        autoComplete="given-name"
                        required
                      />
                      <FloatingField
                        id="su-last"
                        label="Last name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        autoComplete="family-name"
                        required
                      />
                    </div>
                    <FloatingField
                      id="su-email"
                      label="Email address"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                    <FloatingField
                      id="su-password"
                      label="Password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="submit"
                      className="w-full cursor-pointer rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-zinc-950 shadow-[0_4px_24px_rgba(255,255,255,0.12)] transition-all hover:-translate-y-0.5 hover:bg-white/90"
                    >
                      Sign Up
                    </button>
                  </form>

                  <p className="mt-5 text-xs leading-relaxed text-text-dim">
                    By continuing, you agree to Pitch Deck Studio&apos;s{" "}
                    <Link href="/" className="text-text-muted underline underline-offset-2 hover:text-accent-neon">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/" className="text-text-muted underline underline-offset-2 hover:text-accent-neon">
                      Privacy Policy
                    </Link>
                    .
                  </p>

                  <p className="mt-8 text-center text-sm text-text-muted">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("login")}
                      className="cursor-pointer font-semibold text-text-primary transition-colors hover:text-accent-neon"
                    >
                      Log in
                    </button>
                  </p>
                </>
              ) : (
                <>
                  <h1 className="font-canela text-center text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
                    Welcome Back
                  </h1>
                  <p className="mt-3 text-center text-sm text-text-muted">
                    Enter your email and password to access your account
                  </p>

                  <form onSubmit={handleSubmit} className="mt-8 space-y-3">
                    <FloatingField
                      id="login-email"
                      label="Enter your email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />

                    <FloatingField
                      id="login-password"
                      label="Enter your password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      trailing={
                        <button
                          type="button"
                          onClick={() => setShowPassword((s) => !s)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-text-dim transition-colors hover:text-text-primary"
                        >
                          <EyeIcon off={showPassword} />
                        </button>
                      }
                    />

                    <div className="flex items-center justify-between pt-0.5">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-text-muted">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border-glass bg-white/[0.04] accent-[#f8c9a4]"
                        />
                        Remember me
                      </label>
                      <Link
                        href="/"
                        className="cursor-pointer text-sm text-text-muted transition-colors hover:text-accent-neon"
                      >
                        Forgot Password
                      </Link>
                    </div>

                    <button
                      type="submit"
                      className="mt-2 w-full cursor-pointer rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-zinc-950 shadow-[0_4px_24px_rgba(255,255,255,0.12)] transition-all hover:-translate-y-0.5 hover:bg-white/90"
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(projectRoutes.dashboard())}
                      className="landing-btn-glass flex w-full items-center justify-center gap-3 rounded-xl px-5 py-3.5 text-sm font-medium text-text-primary"
                    >
                      <GoogleIcon />
                      Sign In with Google
                    </button>
                  </form>

                  <p className="mt-8 text-center text-sm text-text-muted">
                    Don&apos;t have an account?{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("signup")}
                      className="cursor-pointer font-semibold text-text-primary transition-colors hover:text-accent-neon"
                    >
                      Sign Up
                    </button>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function FloatingField({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  required,
  trailing,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required={required}
        placeholder=" "
        className={`peer w-full rounded-xl border border-white/15 bg-white/[0.06] py-3.5 pl-4 ${
          trailing ? "pr-12" : "pr-4"
        } text-sm text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-md transition-colors focus:border-accent-neon/50 focus:bg-white/[0.1] focus:outline-none`}
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-text-dim transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] peer-focus:-translate-x-6 peer-focus:opacity-0 peer-[:not(:placeholder-shown)]:-translate-x-6 peer-[:not(:placeholder-shown)]:opacity-0"
      >
        {label}
      </label>
      {trailing}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="m4 4 16 16" />}
    </svg>
  );
}
