import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function OtpVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const { completeLogin, pendingAuth, hydratePendingAuth, clearPendingAuth } = useAuth();

  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [flow, setFlow] = useState(pendingAuth || null);
  const [countdown, setCountdown] = useState(0);

  const redirectPath = location.state?.from || '';

  const getRouteByRole = (role) => {
    if (role === 'doctor') return '/doctor-dashboard';
    if (role === 'admin') return '/admin-dashboard';
    return '/dashboard';
  };

  useEffect(() => {
    const restored = pendingAuth || hydratePendingAuth();
    if (!restored?.otpFlowToken) {
      navigate('/login', { replace: true });
      return;
    }
    setFlow(restored);
    setCountdown(Number(restored.resendAfterSeconds || 0));
  }, [hydratePendingAuth, navigate, pendingAuth]);

  useEffect(() => {
    if (!countdown) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const purposeLabel = useMemo(() => {
    const purpose = flow?.purpose || '';
    if (purpose === 'google_login') return 'Google login verification';
    if (purpose === 'signup') return 'Account verification';
    return 'Login verification';
  }, [flow?.purpose]);

  const handleVerify = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const { data } = await authAPI.verifyOtp({
        otpFlowToken: flow.otpFlowToken,
        otp: String(otp).trim(),
      });
      completeLogin({
        accessToken: data?.accessToken,
        refreshToken: data?.refreshToken,
        user: data?.user,
      });
      clearPendingAuth();
      navigate(redirectPath || getRouteByRole(data?.user?.role), { replace: true });
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'OTP verification failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!flow?.otpFlowToken || countdown > 0) return;
    setErrorMessage('');
    try {
      const { data } = await authAPI.resendOtp({ otpFlowToken: flow.otpFlowToken });
      const nextFlow = {
        ...(flow || {}),
        otpFlowToken: data?.otpFlowToken || flow.otpFlowToken,
        expiresAt: data?.expiresAt || flow.expiresAt,
        resendAfterSeconds: data?.resendAfterSeconds ?? 60,
      };
      setFlow(nextFlow);
      setCountdown(Number(nextFlow.resendAfterSeconds || 60));
    } catch (error) {
      const wait = Number(error?.response?.data?.resendAfterSeconds || 0);
      setCountdown(wait);
      setErrorMessage(error?.response?.data?.message || 'Could not resend OTP right now.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-8">
        <h1 className="text-3xl font-bold font-serif text-slate-900 text-center mb-2">Verify OTP</h1>
        <p className="text-center text-sm text-slate-500 mb-6">
          {purposeLabel} for <span className="font-semibold text-slate-700">{flow?.email || 'your account'}</span>
        </p>

        {errorMessage ? (
          <div className="mb-4 text-sm font-medium text-rose-700 bg-rose-50 rounded-xl px-4 py-3">{errorMessage}</div>
        ) : null}

        <form onSubmit={handleVerify} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Enter 6-digit OTP"
            className="w-full text-center tracking-[0.5em] rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
            required
          />

          <button
            type="submit"
            disabled={isSubmitting || otp.length !== 6}
            className="w-full rounded-xl bg-blue-600 text-white font-bold py-3 hover:bg-blue-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Verifying...' : 'Verify and Continue'}
          </button>
        </form>

        <div className="mt-5 text-center text-sm">
          <button
            type="button"
            onClick={handleResend}
            disabled={countdown > 0}
            className="text-blue-600 font-semibold disabled:text-slate-400"
          >
            {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
          </button>
        </div>
      </div>
    </div>
  );
}
