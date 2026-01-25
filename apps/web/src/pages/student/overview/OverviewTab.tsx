import { StudentProfile, AttendanceSummary, FeeSummary } from '../types';

interface OverviewTabProps {
  profile: StudentProfile;
  attendanceSummary: AttendanceSummary | null;
  feeSummary: FeeSummary | null;
}

export default function OverviewTab({ profile, attendanceSummary, feeSummary }: OverviewTabProps) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">Profile</h3>
          <p className="text-gray-600">{profile.profiles?.full_name || 'N/A'}</p>
          <p className="text-gray-600 text-sm">{profile.profiles?.email || 'N/A'}</p>
          {profile.roll_number && (
            <p className="text-gray-600 text-sm">Roll No: {profile.roll_number}</p>
          )}
          {profile.class_groups && (
            <p className="text-gray-600 text-sm">Class: {profile.class_groups.name}</p>
          )}
          {profile.sections && (
            <p className="text-gray-600 text-sm">Section: {profile.sections.name}</p>
          )}
        </div>

        {/* Quick Stats */}
        {attendanceSummary && (
          <div className="bg-green-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Attendance</h3>
            <p className="text-3xl font-bold text-green-600">
              {attendanceSummary.attendancePercentage.toFixed(1)}%
            </p>
            <p className="text-gray-600 text-sm mt-2">
              {attendanceSummary.presentDays} present / {attendanceSummary.totalDays} total
            </p>
          </div>
        )}

        {feeSummary && (
          <div className="bg-purple-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Fees</h3>
            <p className="text-3xl font-bold text-purple-600">
              ₹{feeSummary.totalPending.toLocaleString()}
            </p>
            <p className="text-gray-600 text-sm mt-2">
              {feeSummary.totalPaid.toLocaleString()} / {feeSummary.totalAssigned.toLocaleString()} paid
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
