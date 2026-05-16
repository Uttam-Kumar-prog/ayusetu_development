import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const defaultError = 'Authentication failed. Please try again.';

const loadGoogleScript = () =>
  new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector('script[data-google-gsi="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google script')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleGsi = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google script'));
    document.body.appendChild(script);
  });

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const { startOtpFlow } = useAuth();
  const googleButtonRef = useRef(null);

  const [mode, setMode] = useState('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    role: 'patient',
  });

  const redirectPath = location.state?.from || '/dashboard';

  const isLogin = mode === 'login';

  const pageTitle = useMemo(
    () => (isLogin ? 'Sign in to AyuSetu' : 'Create your AyuSetu account'),
    [isLogin]
  );

  const handleAuthChallenge = (data, fallbackPurpose) => {
    const resolvedPurpose = data?.purpose || fallbackPurpose || 'login';
    startOtpFlow({
      otpFlowToken: data?.otpFlowToken,
      expiresAt: data?.expiresAt,
      resendAfterSeconds: data?.resendAfterSeconds,
      email: formData.email,
      purpose: resolvedPurpose,
    });
    navigate('/verify-otp', {
      state: {
        from: redirectPath,
        purpose: resolvedPurpose,
      },
      replace: true,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      if (isLogin) {
        const { data } = await authAPI.login({
          email: String(formData.email).trim().toLowerCase(),
          password: formData.password,
        });
        handleAuthChallenge(data, 'login');
      } else {
        const { data } = await authAPI.signup({
          fullName: formData.fullName,
          email: String(formData.email).trim().toLowerCase(),
          phone: formData.phone || undefined,
          password: formData.password,
          role: formData.role,
        });
        handleAuthChallenge(data, 'signup');
      }
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || defaultError);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initializeGoogleButton = async () => {
      if (!isLogin) return;
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId || !googleButtonRef.current) return;

      try {
        await loadGoogleScript();
        if (cancelled || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            if (!response?.credential) return;
            setIsSubmitting(true);
            setErrorMessage('');
            try {
              const { data } = await authAPI.googleLogin({ googleToken: response.credential });
              handleAuthChallenge(data, 'google_login');
            } catch (error) {
              setErrorMessage(error?.response?.data?.message || 'Google sign-in failed');
            } finally {
              setIsSubmitting(false);
            }
          },
        });

        googleButtonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
        });
      } catch {
        if (!cancelled) {
          setErrorMessage('Google sign-in is currently unavailable.');
        }
      }
    };

    initializeGoogleButton();
    return () => {
      cancelled = true;
    };
  }, [isLogin]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-slate-900 font-serif">{pageTitle}</h1>
          <p className="text-sm text-slate-500 mt-2">OTP verification is required for secure access.</p>
        </div>

        {errorMessage ? (
          <div className="mb-4 text-sm font-medium text-rose-700 bg-rose-50 rounded-xl px-4 py-3">{errorMessage}</div>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {!isLogin ? (
            <input
              type="text"
              placeholder="Full name"
              value={formData.fullName}
              onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
              required
            />
          ) : null}

          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
            required
          />

          {!isLogin ? (
            <input
              type="text"
              placeholder="Phone (optional)"
              value={formData.phone}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
            />
          ) : null}

          <input
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
            required
          />

          {!isLogin ? (
            <select
              value={formData.role}
              onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
            >
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
              <option value="pharmacy">Pharmacy</option>
            </select>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-blue-600 text-white font-bold py-3 hover:bg-blue-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Please wait...' : isLogin ? 'Continue to OTP' : 'Create Account'}
          </button>
        </form>

        {isLogin ? (
          <>
            <div className="my-5 flex items-center gap-3 text-slate-400 text-xs">
              <div className="h-px bg-slate-200 flex-1" />
              <span>OR</span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>
            <div className="flex justify-center">
              <div ref={googleButtonRef} />
            </div>
            <div className="text-right mt-4">
              <Link to="/forgot-password" className="text-sm text-blue-600 font-semibold hover:underline">
                Forgot password?
              </Link>
            </div>
          </>
        ) : null}

        <div className="mt-6 text-center text-sm text-slate-600">
          {isLogin ? 'New user?' : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(isLogin ? 'signup' : 'login');
              setErrorMessage('');
            }}
            className="text-blue-600 font-bold hover:underline"
          >
            {isLogin ? 'Create account' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
