import  { useEffect, useState, lazy } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { LazyLoader } from '../../components/LazyLoader';
import { loadDashboardStats } from '../../services/clerk.service';
import { useClerkAuth } from './hooks/useClerkAuth';
import { Sidebar } from './layout/Sidebar';
import { DashboardOverview } from './overview/DashboardOverview';

// Lazy load heavy dashboard sections
const FeeCollection = lazy(() => import('../../components/FeeCollection'));
const SalaryPaymentSection = lazy(() => import('./salary/SalaryPaymentSection'));

export default function ClerkDashboard() {
  const location = useLocation();
  const { loading, profile } = useClerkAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'fee-collection' | 'salary-payment'>('dashboard');
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Sync activeTab with URL path
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/clerk/fees') || path.includes('/clerk/payments')) {
      setActiveTab('fee-collection');
    } else if (path.includes('/clerk/salary')) {
      setActiveTab('salary-payment');
    } else if (path === '/clerk' || path === '/clerk/') {
      setActiveTab('dashboard');
    }
  }, [location.pathname]);

  // Load dashboard statistics
  useEffect(() => {
    if (activeTab === 'dashboard' && profile) {
      loadDashboardStatsData();
    }
  }, [activeTab, profile]);

  const loadDashboardStatsData = async () => {
    setLoadingStats(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return;

      const stats = await loadDashboardStats(token);
      setDashboardStats(stats);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      // Set default stats on error
      setDashboardStats({
        totalStudents: 0,
        todayCollection: 0,
        totalPending: 0,
        recentPayments: []
      });
    } finally {
      setLoadingStats(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar profile={profile} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main content */}
      <div className="ml-64 flex-1">
        <div className="p-6">
          {activeTab === 'dashboard' && (
            <DashboardOverview 
              dashboardStats={dashboardStats} 
              loadingStats={loadingStats}
              setActiveTab={setActiveTab}
            />
          )}
          {activeTab === 'fee-collection' && (
            <LazyLoader>
              <FeeCollection />
            </LazyLoader>
          )}
          {activeTab === 'salary-payment' && (
            <LazyLoader>
              <SalaryPaymentSection />
            </LazyLoader>
          )}
        </div>
      </div>
    </div>
  );
}
