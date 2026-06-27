'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { mobileApi } from '../lib/mobileApi';
import PwaInstallPrompt from '../components/PwaInstallPrompt';

function ShieldIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"
        stroke="#38BDF8"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="#38BDF8"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="#38BDF8" strokeWidth="1.5" />
      <path d="M5 20c0-4 3.5-6 7-6s7 2 7 6" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="7" y="3" width="10" height="18" rx="2" stroke="#38BDF8" strokeWidth="1.5" />
      <path d="M11 18h2" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="#FCA5A5" strokeWidth="1.5" />
      <path d="M12 8v5M12 16h.01" stroke="#FCA5A5" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function LoginPage() {
  const [formData, setFormData] = useState({ firstName: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apkDownloading, setApkDownloading] = useState(false);
  const [apkProgress, setApkProgress] = useState(0);
  const [apkStatus, setApkStatus] = useState('');
  const router = useRouter();
  const apkUrls = ['/downloads/votabase.apk', '/ui/downloads/votabase.apk'];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const msg = params.get('error');
      if (msg) setError(msg);
    }
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.firstName.trim() || !formData.phone.trim()) {
      setError('Please enter first name and mobile number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await mobileApi.loginApi({
        firstName: formData.firstName.trim(),
        phone: formData.phone.trim(),
      });
      const result = data?.data?.result;

      if (!data?.success || !result?.token) {
        const message =
          data?.detail ||
          data?.message ||
          data?.error ||
          'Invalid first name or mobile number';
        throw new Error(message);
      }

      localStorage.setItem('token', result.token);
      localStorage.setItem('X_INIT_TOKEN', result.token);
      localStorage.setItem('role', result.role || '');
      localStorage.setItem(
        'userName',
        result.userName || result.firstName || formData.firstName.trim()
      );
      localStorage.setItem('tenantId', result.tenantId || '');
      localStorage.setItem('userInfo', JSON.stringify(result));
      document.cookie = `token=${result.token}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;

      router.push('/mobile/search-voter');
    } catch (err) {
      setError(err?.detail || err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApkDownload = () => {
    if (apkDownloading) return;
    setApkDownloading(true);
    setApkProgress(0);
    setApkStatus('Checking APK file...');

    const tryDownload = (urlIndex = 0) => {
      const apkUrl = apkUrls[urlIndex];
      if (!apkUrl) {
        setApkStatus('APK file is not uploaded yet. Add it as public/downloads/votabase.apk and redeploy.');
        setApkDownloading(false);
        return;
      }

      const xhr = new XMLHttpRequest();
      xhr.open('GET', apkUrl, true);
      xhr.responseType = 'blob';
      xhr.onprogress = (event) => {
        if (!event.lengthComputable) {
          setApkStatus('Downloading APK...');
          return;
        }
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        setApkProgress(percent);
        setApkStatus(`Downloading APK: ${percent}%`);
      };
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          tryDownload(urlIndex + 1);
          return;
        }
        const blobUrl = URL.createObjectURL(xhr.response);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = 'votabase.apk';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(blobUrl);
        setApkProgress(100);
        setApkStatus('Download complete. Open the APK on Android to install.');
        setApkDownloading(false);
      };
      xhr.onerror = () => {
        tryDownload(urlIndex + 1);
      };
      xhr.send();
    };

    tryDownload();
  };

  return (
    <div className="login-screen">
      <div className="login-screen__glow login-screen__glow--left" aria-hidden="true" />
      <div className="login-screen__glow login-screen__glow--right" aria-hidden="true" />

      <div className="login-screen__inner">
        <header className="login-brand">
          <div className="login-brand__icon">
            <ShieldIcon />
          </div>
          <h1 className="login-brand__title">Votabase</h1>
          <p className="login-brand__tagline">Secure Voter Management Portal</p>
        </header>

        <form onSubmit={handleSubmit} className="login-card">
          <div className="login-card__head">
            <h2 className="login-card__title">Welcome !</h2>
            <p className="login-card__sub">Please enter your credentials to sign in</p>
          </div>

          <div className="login-field">
            <label className="login-field__label" htmlFor="firstName">
              First name
            </label>
            <div className="login-field__wrap">
              <span className="login-field__icon">
                <PersonIcon />
              </span>
              <input
                id="firstName"
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Enter your first name"
                className="login-field__input"
                autoComplete="username"
              />
            </div>
          </div>

          <div className="login-field">
            <label className="login-field__label" htmlFor="phone">
              Mobile number
            </label>
            <div className="login-field__wrap">
              <span className="login-field__icon">
                <PhoneIcon />
              </span>
              <input
                id="phone"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="10 digit mobile number"
                maxLength={10}
                className="login-field__input"
                autoComplete="tel-national"
              />
            </div>
          </div>

          {error ? (
            <div className="login-error" role="alert">
              <AlertIcon />
              <span>{error}</span>
            </div>
          ) : null}

          <button type="submit" disabled={loading} className="login-btn">
            {loading ? (
              <span className="login-btn__spinner" aria-hidden="true" />
            ) : (
              <>
                <span>Login</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 12h14M13 6l6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </>
            )}
          </button>

          <p className="login-legal">
            By continuing you agree to our{' '}
            <a href="#" className="login-legal__link">
              Terms of Service
            </a>{' '}
            &{' '}
            <a href="/ui/privacy" className="login-legal__link">
              Privacy Policy
            </a>
          </p>
        </form>

        <PwaInstallPrompt />

        <div className="login-apk">
          <p className="login-apk__text">Prefer the mobile app? Download the Votabase Android app and sign in on the go.</p>
          <button type="button" className="login-apk__btn" onClick={handleApkDownload} disabled={apkDownloading}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{apkDownloading ? `Downloading ${apkProgress}%` : 'Download Android App (APK)'}</span>
          </button>
          {(apkDownloading || apkStatus) ? (
            <div className="login-apk__progress" aria-live="polite">
              <div className="login-apk__progress-track">
                <span style={{ width: `${apkProgress}%` }} />
              </div>
              <p>{apkStatus}</p>
            </div>
          ) : null}
        </div>

        <footer className="login-footer">© {new Date().getFullYear()} Votabase. All rights reserved.</footer>
      </div>
    </div>
  );
}
