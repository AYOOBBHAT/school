import  { useState, useEffect, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { LazyLoader } from '../../components/LazyLoader';
import { useStudentAuth } from './hooks/useStudentAuth';
import { useStudentProfile } from './hooks/useStudentProfile';
import { useStudentAttendance } from './hooks/useStudentAttendance';
import { useStudentMarks } from './hooks/useStudentMarks';
import { Header } from './layout/Header';
import { Tabs } from './layout/Tabs';

// Lazy load tab content components
const OverviewTab = lazy(() => import('./overview/OverviewTab'));
const AttendanceTab = lazy(() => import('./attendance/AttendanceTab'));
const MarksTab = lazy(() => import('./marks/MarksTab'));

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { loading: authLoading } = useStudentAuth();
  const { profile, loading: profileLoading } = useStudentProfile();
  const { attendance, attendanceSummary, loadAttendance } = useStudentAttendance();
  const { marks, loadMarks } = useStudentMarks();
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'marks' | 'fees'>('overview');

  useEffect(() => {
    if (activeTab === 'attendance') {
      loadAttendance();
    } else if (activeTab === 'marks') {
      loadMarks();
    } else if (activeTab === 'fees') {
      // Fees tab removed - billing feature disabled
    }
  }, [activeTab, loadAttendance, loadMarks]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-600">Profile not found</div>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header profile={profile} onLogout={handleLogout} />

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {activeTab === 'overview' && (
            <LazyLoader>
              <OverviewTab
                profile={profile}
                attendanceSummary={attendanceSummary}
                feeSummary={null}
              />
            </LazyLoader>
          )}

          {activeTab === 'attendance' && (
            <LazyLoader>
              <AttendanceTab
                attendance={attendance}
                attendanceSummary={attendanceSummary}
              />
            </LazyLoader>
          )}

          {activeTab === 'marks' && (
            <LazyLoader>
              <MarksTab marks={marks} />
            </LazyLoader>
          )}

          {activeTab === 'fees' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Fees & Payments</h2>
              <div className="text-center py-12 text-gray-600">
                Billing has been removed from this deployment.
              </div>
              {false && (
                <>
                  {/* Fee summary and bills removed */}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
