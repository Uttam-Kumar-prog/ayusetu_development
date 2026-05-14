import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../utils/api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otpFlowToken, setOtpFlowToken] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!countdown) return;
    const timer = setInterval(() => setCountdown((prev) => (prev <= 1 ? 0 : prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setMessage('');
    setLoading(true);
    try {
      const { data } = await authAPI.forgotPassword({ email: String(email).trim().toLowerCase() });
      setMessage(data?.message || 'If the email exists, OTP has been sent.');
      if (data?.otpFlowToken) {
        setOtpFlowToken(data.otpFlowToken);
        setStep(2);
        setCountdown(Number(data.resendAfterSeconds || 0));
      }
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Unable to process request.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setLoading(true);
    try {
      const { data } = await authAPI.verifyForgotPasswordOtp({ otpFlowToken, otp });
      setResetToken(data?.resetToken || '');
      setStep(3);
      setMessage(data?.message || 'OTP verified successfully.');
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setLoading(true);
    try {
      const { data } = await authAPI.resetPassword({ resetToken, newPassword, confirmPassword });
      setMessage(data?.message || 'Password reset successful.');
      setTimeout(() => navigate('/login'), 1200);
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || !otpFlowToken) return;
    setErrorMessage('');
    try {
      const { data } = await authAPI.resendOtp({ otpFlowToken });
      if (data?.otpFlowToken) setOtpFlowToken(data.otpFlowToken);
      setCountdown(Number(data?.resendAfterSeconds || 60));
      setMessage(data?.message || 'OTP resent successfully.');
    } catch (error) {
      const wait = Number(error?.response?.data?.resendAfterSeconds || 0);
      if (wait > 0) setCountdown(wait);
      setErrorMessage(error?.response?.data?.message || 'Unable to resend OTP.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-8">
        <h1 className="text-3xl font-bold font-serif text-slate-900 text-center mb-3">Forgot Password</h1>
        <p className="text-sm text-slate-500 text-center mb-6">Recover access securely with email OTP verification.</p>

        {message ? <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3">{message}</div> : null}
        {errorMessage ? <div className="mb-4 text-sm text-rose-700 bg-rose-50 rounded-xl px-4 py-3">{errorMessage}</div> : null}

        {step === 1 ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <input
              type="email"
              placeholder="Registered email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
              required
            />
            <button disabled={loading} className="w-full rounded-xl bg-blue-600 text-white font-bold py-3 hover:bg-blue-700 disabled:opacity-60">
              {loading ? 'Please wait...' : 'Send OTP'}
            </button>
          </form>
        ) : null}

        {step === 2 ? (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
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
            <button disabled={loading || otp.length !== 6} className="w-full rounded-xl bg-blue-600 text-white font-bold py-3 hover:bg-blue-700 disabled:opacity-60">
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={countdown > 0}
              className="w-full rounded-xl border border-slate-300 text-slate-700 font-semibold py-3 disabled:opacity-60"
            >
              {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
            </button>
          </form>
        ) : null}

        {step === 3 ? (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
              required
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
              required
            />
            <button disabled={loading} className="w-full rounded-xl bg-blue-600 text-white font-bold py-3 hover:bg-blue-700 disabled:opacity-60">
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
