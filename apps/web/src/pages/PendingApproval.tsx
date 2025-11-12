import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function PendingApproval() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);

  useEffect(() => {
    // Check approval status when component loads
    checkApprovalStatus();
  }, []);

  // Separate effect for polling (only if still pending)
  useEffect(() => {
    // Only poll if status is pending or null
    if (approvalStatus !== 'pending' && approvalStatus !== null) {
      return; // Stop polling if approved or rejected
    }

    const interval = setInterval(() => {
      checkApprovalStatus();
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvalStatus]);

  const checkApprovalStatus = async () => {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      if (!token) {
        setChecking(false);
        return;
      }

      // Try to get profile from backend (bypasses RLS)
      const response = await fetch(`${API_URL}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const status = data.profile?.approval_status;
        setApprovalStatus(status);

        console.log('[PendingApproval] Current approval status:', status);

        // If approved, redirect to appropriate dashboard
        if (status === 'approved') {
          const role = data.profile?.role;
          const redirectMap: Record<string, string> = {
            principal: '/principal/dashboard',
            clerk: '/clerk/fees',
            teacher: '/teacher/classes',
            student: '/student/home',
            parent: '/parent/home'
          };
          
          const redirectPath = redirectMap[role] || '/';
          console.log('[PendingApproval] User approved, redirecting to:', redirectPath);
          
          // Use replace instead of navigate to prevent back button issues
          navigate(redirectPath, { replace: true });
        } else if (status === 'rejected') {
          // If rejected, show a message
          console.log('[PendingApproval] User rejected');
          setApprovalStatus('rejected');
        }
      } else {
        console.error('[PendingApproval] Failed to check status:', await response.text());
      }
    } catch (error) {
      console.error('[PendingApproval] Error checking status:', error);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
        <div className="text-6xl mb-4">⏳</div>
        <h2 className="text-2xl font-bold mb-4">Waiting for Approval</h2>
        <p className="text-gray-600 mb-6">
          Your account has been created successfully. However, it requires approval from your school administrator before you can access the platform.
        </p>
        
        {checking && (
          <div className="mb-4">
            <p className="text-sm text-blue-600 animate-pulse">Checking approval status...</p>
          </div>
        )}

        {approvalStatus && !checking && (
          <div className="mb-4">
            <p className="text-sm text-gray-500">
              Current status: <span className="font-semibold capitalize">{approvalStatus}</span>
            </p>
            {approvalStatus === 'pending' && (
              <p className="text-xs text-gray-400 mt-2">
                This page will automatically refresh when you're approved.
              </p>
            )}
          </div>
        )}

        <p className="text-sm text-gray-500 mb-6">
          You will be automatically redirected once your account has been approved.
        </p>
        <div className="space-y-2">
          <button
            onClick={checkApprovalStatus}
            disabled={checking}
            className="block w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {checking ? 'Checking...' : 'Check Status Again'}
          </button>
          <Link
            to="/login"
            className="block w-full border px-4 py-2 rounded-md hover:bg-gray-50"
          >
            Back to Login
          </Link>
          <Link
            to="/"
            className="block w-full border px-4 py-2 rounded-md hover:bg-gray-50"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}



