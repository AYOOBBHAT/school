import { useState, useEffect, lazy } from 'react';
import { useLocation } from 'react-router-dom';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { LazyLoader } from '../../components/LazyLoader';
import { usePrincipalAuth } from './hooks/usePrincipalAuth';
import { Sidebar } from './layout/Sidebar';
import { DashboardOverview } from './overview/DashboardOverview';

// Lazy load heavy dashboard sections
const StaffManagement = lazy(() => import('./staff/StaffManagement'));
const ClassesManagement = lazy(() => import('./classes/ClassesManagement'));
const SubjectsManagement = lazy(() => import('./subjects/SubjectsManagement'));
const StudentsManagement = lazy(() => import('./students/StudentsManagement'));
const ClassificationsManagement = lazy(() => import('./classifications/ClassificationsManagement'));
const ExamsManagement = lazy(() => import('./exams/ExamsManagement'));
const SalaryManagement = lazy(() => import('./salary/SalaryManagement'));
const FeeManagement = lazy(() => import('./fees/FeeManagement'));

export default function PrincipalDashboard() {
  const location = useLocation();
  const { loading } = usePrincipalAuth();
  const [currentView, setCurrentView] = useState('dashboard');

  useEffect(() => {
    const path = location.pathname;
    if (path === '/principal/dashboard') setCurrentView('dashboard');
    else if (path === '/principal/staff') setCurrentView('staff');
    else if (path === '/principal/classifications') setCurrentView('classifications');
    else if (path === '/principal/classes') setCurrentView('classes');
    else if (path === '/principal/subjects') setCurrentView('subjects');
    else if (path === '/principal/students') setCurrentView('students');
    else if (path === '/principal/exams') setCurrentView('exams');
    else if (path === '/principal/salary') setCurrentView('salary');
    else if (path === '/principal/fees') setCurrentView('fees');
    // Always return cleanup function (even if empty) to avoid React error #310
    return () => {
      // No cleanup needed
    };
  }, [location]);

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
      <Sidebar currentPath={location.pathname} />
      <div className="ml-64 flex-1">
        {currentView === 'dashboard' && <DashboardOverview />}
        {currentView === 'staff' && (
          <ErrorBoundary fallback={
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-red-800 font-semibold mb-2">Error Loading Staff Page</h3>
                <p className="text-red-600 text-sm">Please refresh the page or try again later.</p>
              </div>
            </div>
          }>
            <LazyLoader>
              <StaffManagement key="staff-management" />
            </LazyLoader>
          </ErrorBoundary>
        )}
        {currentView === 'classifications' && (
          <LazyLoader>
            <ClassificationsManagement />
          </LazyLoader>
        )}
        {currentView === 'classes' && (
          <LazyLoader>
            <ClassesManagement />
          </LazyLoader>
        )}
        {currentView === 'subjects' && (
          <LazyLoader>
            <SubjectsManagement />
          </LazyLoader>
        )}
        {currentView === 'students' && (
          <LazyLoader>
            <StudentsManagement />
          </LazyLoader>
        )}
        {currentView === 'exams' && (
          <LazyLoader>
            <ExamsManagement />
          </LazyLoader>
        )}
        {currentView === 'salary' && (
          <LazyLoader>
            <SalaryManagement />
          </LazyLoader>
        )}
        {currentView === 'fees' && (
          <LazyLoader>
            <FeeManagement userRole="principal" />
          </LazyLoader>
        )}
      </div>
    </div>
  );
}
