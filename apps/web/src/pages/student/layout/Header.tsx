import { StudentProfile } from '../types';

interface HeaderProps {
  profile: StudentProfile;
  onLogout: () => void;
}

export function Header({ profile, onLogout }: HeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Student Dashboard</h1>
            <p className="text-gray-600">
              {profile.profiles?.full_name || 'Student'}
              {profile.roll_number && ` • Roll No: ${profile.roll_number}`}
              {profile.class_groups && ` • ${profile.class_groups.name}`}
              {profile.sections && ` - ${profile.sections.name}`}
            </p>
          </div>
          <button
            onClick={onLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
