import { NavLink } from 'react-router-dom';

interface SidebarProps {
  profile: any;
  onLogout: () => void;
}

export function Sidebar({ profile, onLogout }: SidebarProps) {
  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen fixed left-0 top-0">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-8">JhelumVerse</h1>
        <div className="mb-6">
          <div className="text-sm text-gray-400">Logged in as</div>
          <div className="font-semibold">{profile?.full_name || 'Teacher'}</div>
          <div className="text-sm text-gray-400">{profile?.email}</div>
        </div>
        <nav className="space-y-2">
          <NavLink
            to="/teacher/classes"
            className={({ isActive }) =>
              `w-full text-left px-4 py-2 rounded-lg transition block ${
                isActive ? 'bg-blue-600' : 'hover:bg-gray-800'
              }`
            }
          >
            📚 My Classes
          </NavLink>
          <NavLink
            to="/teacher/attendance"
            className={({ isActive }) =>
              `w-full text-left px-4 py-2 rounded-lg transition block ${
                isActive ? 'bg-blue-600' : 'hover:bg-gray-800'
              }`
            }
          >
            📅 Attendance
          </NavLink>
          <NavLink
            to="/teacher/marks"
            className={({ isActive }) =>
              `w-full text-left px-4 py-2 rounded-lg transition block ${
                isActive ? 'bg-blue-600' : 'hover:bg-gray-800'
              }`
            }
          >
            📊 Marks Entry
          </NavLink>
          <NavLink
            to="/teacher/salary"
            className={({ isActive }) =>
              `w-full text-left px-4 py-2 rounded-lg transition block ${
                isActive ? 'bg-blue-600' : 'hover:bg-gray-800'
              }`
            }
          >
            💰 My Salary
          </NavLink>
          {false && (
            <NavLink
              to="/teacher/fees"
              className={({ isActive }) =>
                `w-full text-left px-4 py-2 rounded-lg transition block ${
                  isActive ? 'bg-blue-600' : 'hover:bg-gray-800'
                }`
              }
            >
              💵 Student Fees (View Only)
            </NavLink>
          )}
        </nav>
        <button
          onClick={onLogout}
          className="mt-8 w-full text-left px-4 py-2 rounded-lg hover:bg-gray-800 transition"
        >
          🚪 Logout
        </button>
      </div>
    </div>
  );
}
