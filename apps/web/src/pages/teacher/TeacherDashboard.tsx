import  { useState, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [currentView, setCurrentView] = useState<'classes' | 'attendance' | 'marks' | 'salary' | 'fees'>('classes');

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
        currentView={currentView}
        setCurrentView={setCurrentView}
        profile={profile}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="ml-64">
        <div className="p-6">
          {currentView === 'classes' && <ClassesOverview currentView={currentView} />}
          {currentView === 'attendance' && (
            <LazyLoader>
              <AttendanceView profile={profile} />
            </LazyLoader>
          )}
          {currentView === 'marks' && (
            <LazyLoader>
              <MarksEntryView profile={profile} />
            </LazyLoader>
          )}
          {currentView === 'salary' && (
            <LazyLoader>
              <SalaryView profile={profile} />
            </LazyLoader>
          )}
          {currentView === 'fees' && (
            <LazyLoader>
              <StudentFeeStatusView
                students={[]}
                studentFeeStatus={{}}
                loadingFees={false}
              />
            </LazyLoader>
          )}
        </div>
      </div>
    </div>
  );
}
