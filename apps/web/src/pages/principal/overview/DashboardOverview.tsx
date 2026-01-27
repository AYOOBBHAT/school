import { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabase';
import { DashboardStats } from '../types';
import { createEmptyBreakdown, buildGenderBreakdown, hydrateBreakdown } from '../utils';
import { DoughnutChart } from './DoughnutChart';
import UnpaidFeeAnalytics from '../../../components/UnpaidFeeAnalytics';
import { loadSchoolInfo, loadDashboardStats } from '../../../services/principal.service';

export function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalStaff: 0,
    totalClasses: 0,
    studentsByGender: createEmptyBreakdown(),
    staffByGender: createEmptyBreakdown(),
  });
  const [loading, setLoading] = useState(true);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error('Error getting user:', userError);
          return;
        }
        if (!user) {
          console.log('No user found');
          return;
        }

        // Get user profile to get school_id
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('school_id')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('Error loading profile:', profileError);
          return;
        }

        if (!profile || !('school_id' in profile) || !(profile as any).school_id) {
          console.log('No profile or school_id found');
          return;
        }

        const schoolId = (profile as any).school_id;

        const token = (await supabase.auth.getSession()).data.session?.access_token;

        const loadSchoolInfoFromSupabase = async () => {
          try {
            const { data: school, error: schoolError } = await supabase
              .from('schools')
              .select('id, name, join_code, registration_number, address, contact_email, contact_phone, logo_url, created_at')
              .eq('id', schoolId)
              .maybeSingle(); // Use maybeSingle() instead of single() to handle no results gracefully

            if (!schoolError && school) {
              console.log('School data loaded from Supabase fallback:', school);
              setSchoolInfo(school);
            } else if (schoolError) {
              console.error('Error loading school from Supabase:', schoolError);
              // Don't throw, just log - school info is optional
            }
          } catch (supabaseError) {
            console.error('Error in Supabase query:', supabaseError);
            // Don't throw - school info is optional
          }
        };

        const loadSchoolInfoData = async () => {
          if (!token) {
            await loadSchoolInfoFromSupabase();
            return;
          }

          try {
            const schoolData = await loadSchoolInfo(token);
            console.log('School data loaded from API:', schoolData);
            setSchoolInfo(schoolData);
          } catch (apiError: any) {
            console.error('Error loading school from API:', apiError);
            await loadSchoolInfoFromSupabase();
          }
        };

        const loadStatsFallback = async () => {
          try {
            const [
              studentRows,
              staffRows,
              classesCount
            ] = await Promise.all([
              supabase
                .from('students')
                .select('id, status, profile:profiles!students_profile_id_fkey(gender)')
                .eq('school_id', schoolId)
                .eq('status', 'active'),
              supabase
                .from('profiles')
                .select('id, gender')
                .eq('school_id', schoolId)
                .in('role', ['principal', 'clerk', 'teacher'])
                .eq('approval_status', 'approved'),
              supabase
                .from('class_groups')
                .select('id', { count: 'exact', head: true })
                .eq('school_id', schoolId)
            ]);

            if (studentRows.error) throw studentRows.error;
            if (staffRows.error) throw staffRows.error;
            if (classesCount.error) throw classesCount.error;

            const studentGenders = buildGenderBreakdown(
              (studentRows.data || []).map((student: any) => {
                const profile = Array.isArray(student.profile) ? student.profile[0] : student.profile;
                return profile?.gender;
              })
            );
            const staffGenders = buildGenderBreakdown(
              (staffRows.data || []).map((member: any) => member.gender)
            );

            setStats({
              totalStudents: studentGenders.total,
              totalStaff: staffGenders.total,
              totalClasses: classesCount.count || 0,
              studentsByGender: studentGenders,
              staffByGender: staffGenders,
            });
          } catch (fallbackError) {
            console.error('Error loading fallback stats:', fallbackError);
          }
        };

        const loadStats = async () => {
          if (!token) {
            await loadStatsFallback();
            return;
          }

          try {
            const payload = await loadDashboardStats(token);
            setStats({
              totalStudents: payload?.totalStudents ?? 0,
              totalStaff: payload?.totalStaff ?? 0,
              totalClasses: payload?.totalClasses ?? 0,
              studentsByGender: hydrateBreakdown(payload?.studentsByGender),
              staffByGender: hydrateBreakdown(payload?.staffByGender),
            });
          } catch (statsError) {
            console.error('Error loading dashboard stats:', statsError);
            await loadStatsFallback();
          }
        };

        await loadSchoolInfoData();
        await loadStats();
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
    // Always return cleanup function (even if empty) to avoid React error #310
    return () => {
      // No cleanup needed
    };
  }, []);

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        {schoolInfo && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-8 mb-6 shadow-2xl">
            <div className="absolute inset-0 bg-black opacity-10"></div>
            <div className="relative z-10">
              <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-2 drop-shadow-lg">
                Welcome to{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 via-white to-yellow-200 animate-pulse">
                  {schoolInfo.name}
                </span>
              </h1>
              <div className="flex flex-wrap gap-4 mt-4 text-sm">
                {schoolInfo.join_code && (
                  <div className="flex items-center gap-2 bg-white bg-opacity-20 backdrop-blur-sm px-4 py-2 rounded-lg">
                    <span className="font-medium text-white">School Code:</span>
                    <span className="font-mono font-bold text-yellow-200">{schoolInfo.join_code}</span>
                  </div>
                )}
                {schoolInfo.registration_number && (
                  <div className="flex items-center gap-2 bg-white bg-opacity-20 backdrop-blur-sm px-4 py-2 rounded-lg">
                    <span className="font-medium text-white">Registration No:</span>
                    <span className="font-bold text-yellow-200">{schoolInfo.registration_number}</span>
                  </div>
                )}
              </div>
            </div>
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>
          </div>
        )}
        <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
      </div>

      {/* Debug Info - Remove in production */}
      {import.meta.env.DEV && schoolInfo && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-sm">
          <p className="font-semibold text-yellow-800 mb-2">Debug Info:</p>
          <pre className="text-xs text-yellow-700 overflow-auto">
            {JSON.stringify({ schoolInfo, hasJoinCode: !!schoolInfo?.join_code }, null, 2)}
          </pre>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 mt-6">
        <DoughnutChart
          title="Student Gender Breakdown"
          breakdown={stats.studentsByGender}
          colors={{
            male: '#3B82F6', // blue
            female: '#EC4899', // pink
            other: '#10B981', // green
            unknown: '#9CA3AF', // gray
          }}
        />
        <DoughnutChart
          title="Staff Gender Breakdown"
          breakdown={stats.staffByGender}
          colors={{
            male: '#3B82F6', // blue
            female: '#EC4899', // pink
            other: '#10B981', // green
            unknown: '#9CA3AF', // gray
          }}
        />
      </div>

      {/* Unpaid Fee Analytics */}
      <UnpaidFeeAnalytics userRole="principal" />
    </div>
  );
}
