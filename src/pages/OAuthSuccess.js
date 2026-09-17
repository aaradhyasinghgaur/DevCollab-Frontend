import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const OAuthSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithToken } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleAuth = async () => {
      const params = new URLSearchParams(location.search);
      const token = params.get('token');

      if (!token) {
        setError('No authentication token received from OAuth provider.');
        setTimeout(() => navigate('/login'), 2500);
        return;
      }

      try {
        await loginWithToken(token);
        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('OAuth token authentication failed:', err);
        setError('Failed to authenticate session. Redirecting to login...');
        setTimeout(() => navigate('/login'), 2500);
      }
    };

    handleAuth();
  }, [location.search, loginWithToken, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900/80 p-8 text-center shadow-2xl backdrop-blur-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-900/40 text-2xl font-bold text-purple-400">
          {'</>'}
        </div>
        {error ? (
          <div>
            <h2 className="text-xl font-semibold text-rose-400">Authentication Error</h2>
            <p className="mt-2 text-sm text-gray-400">{error}</p>
          </div>
        ) : (
          <div>
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"></div>
            <h2 className="text-xl font-semibold text-gray-200">Signing you into DevCollab...</h2>
            <p className="mt-2 text-sm text-gray-400">Please wait while we set up your workspace session.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OAuthSuccess;
