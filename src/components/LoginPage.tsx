import React, { useState } from 'react';
import { User } from '../types';
import { Building2, Lock, Mail, ShieldCheck, AlertCircle, KeyRound, Eye, EyeOff } from 'lucide-react';

interface LoginPageProps {
  users: User[];
  onLogin: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ users, onLogin }) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setErrorMessage('Please enter both corporate email and password.');
      return;
    }

    setIsSubmitting(true);

    // Validate active account against database
    const matchedUser = users.find(
      (u) => u.Email.toLowerCase() === trimmedEmail && u.Status === 'Active'
    );

    if (!matchedUser) {
      setErrorMessage('Invalid credentials. No active employee account found with this email.');
      setIsSubmitting(false);
      return;
    }

    const expectedPassword =
      matchedUser.Password || (matchedUser.Role === 'Admin' ? 'admin' : 'user123');
    if (trimmedPassword !== expectedPassword) {
      setErrorMessage('Invalid credentials. Incorrect password.');
      setIsSubmitting(false);
      return;
    }

    // Success
    setIsSubmitting(false);
    onLogin(matchedUser);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-indigo-50/20 to-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 selection:bg-[#6C70FF] selection:text-white">
      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#6C70FF] to-[#8C8EFF] shadow-[0_8px_24px_rgba(108,112,255,0.35)] text-white mb-2 ring-4 ring-white">
            <Building2 className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Malwa Concrete
          </h1>
          <p className="text-xs text-slate-500 font-medium max-w-xs mx-auto">
            Factory Operations & Task Delegation Portal (FMS)
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)] space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2 text-slate-800">
              <ShieldCheck className="w-4 h-4 text-[#6C70FF]" />
              <span className="text-xs font-bold uppercase tracking-wider">Secure Employee Login</span>
            </div>
            <span className="text-[10px] font-mono text-[#6C70FF] bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full font-bold">
              Protected
            </span>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-start space-x-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4" autoComplete="off">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Corporate Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your corporate email"
                  required
                  autoComplete="off"
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#6C70FF] rounded-2xl py-3 pl-10 pr-3 text-xs text-slate-900 placeholder-slate-400 transition outline-none min-h-[46px]"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="new-password"
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#6C70FF] rounded-2xl py-3 pl-10 pr-10 text-xs text-slate-900 placeholder-slate-400 transition outline-none min-h-[46px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 bg-[#6C70FF] hover:bg-[#5B5FF5] active:scale-[0.99] text-white font-bold text-xs py-3.5 rounded-2xl shadow-[0_4px_16px_rgba(108,112,255,0.35)] transition flex items-center justify-center space-x-2 cursor-pointer min-h-[46px] disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4" />
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In Securely'}</span>
            </button>
          </form>
        </div>

        {/* Security Notice */}
        <div className="text-center text-[11px] text-slate-400 space-y-1">
          <p>© 2026 Malwa Concrete Udyog Pvt. Ltd. All rights reserved.</p>
          <p className="text-[10px]">
            Confidential operations database. Unauthorized access is prohibited.
          </p>
        </div>
      </div>
    </div>
  );
};
