import { lazy } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { LazyLoader } from '../../components/LazyLoader';
import { useTeacherAuth } from './hooks/useTeacherAuth';
import { Sidebar } from './layout/Sidebar';
import { ClassesOverview } from './overview/ClassesOverview';

// Lazy load heavy dashboard sections with retry logic
const lazyWithRetry = (componentImport: () => Promise<any>, retries = 3) => {
  return lazy(async () => {
    for (let i = 0; i < retries; i++) {
      try {
        return await componentImport();
      } catch (error) {
        if (i === retries - 1) {
          console.error('Failed to load component after retries:', error);
          throw error;
        }
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    throw new Error('Failed to load component');
  });
};

const AttendanceView = lazyWithRetry(() => import('./attendance/AttendanceView'));
const MarksEntryView = lazyWithRetry(() => import('./marks/MarksEntryView'));
const SalaryView = lazyWithRetry(() => import('./salary/SalaryView'));
const StudentFeeStatusView = lazyWithRetry(() => import('./fees/StudentFeeStatusView'));

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { profile, loading } = useTeacherAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        profile={profile}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="ml-64">
        <div className="p-6">
          <Routes>
            <Route path="classes" element={<ClassesOverview />} />
            <Route
              path="attendance"
              element={
                <LazyLoader>
                  <AttendanceView profile={profile} />
                </LazyLoader>
              }
            />
            <Route
              path="marks"
              element={
                <LazyLoader>
                  <MarksEntryView profile={profile} />
                </LazyLoader>
              }
            />
            <Route
              path="salary"
              element={
                <LazyLoader>
                  <SalaryView profile={profile} />
                </LazyLoader>
              }
            />
            <Route
              path="fees"
              element={
                <LazyLoader>
                  <StudentFeeStatusView
                    students={[]}
                    studentFeeStatus={{}}
                    loadingFees={false}
                  />
                </LazyLoader>
              }
            />
            <Route path="*" element={<Navigate to="classes" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
