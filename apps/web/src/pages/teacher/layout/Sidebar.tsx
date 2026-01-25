
interface SidebarProps {
  currentView: 'classes' | 'attendance' | 'marks' | 'salary' | 'fees';
  setCurrentView: (view: 'classes' | 'attendance' | 'marks' | 'salary' | 'fees') => void;
  profile: any;
  onLogout: () => void;
}

export function Sidebar({ currentView, setCurrentView, profile, onLogout }: SidebarProps) {
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
          <button
            onClick={() => setCurrentView('classes')}
            className={`w-full text-left px-4 py-2 rounded-lg transition ${
              currentView === 'classes' ? 'bg-blue-600' : 'hover:bg-gray-800'
            }`}
          >
            📚 My Classes
          </button>
          <button
            onClick={() => setCurrentView('attendance')}
            className={`w-full text-left px-4 py-2 rounded-lg transition ${
              currentView === 'attendance' ? 'bg-blue-600' : 'hover:bg-gray-800'
            }`}
          >
            📅 Attendance
          </button>
          <button
            onClick={() => setCurrentView('marks')}
            className={`w-full text-left px-4 py-2 rounded-lg transition ${
              currentView === 'marks' ? 'bg-blue-600' : 'hover:bg-gray-800'
            }`}
          >
            📊 Marks Entry
          </button>
          <button
            onClick={() => setCurrentView('salary')}
            className={`w-full text-left px-4 py-2 rounded-lg transition ${
              currentView === 'salary' ? 'bg-blue-600' : 'hover:bg-gray-800'
            }`}
          >
            💰 My Salary
          </button>
          {false && (
            <button
              onClick={() => setCurrentView('fees')}
              className={`w-full text-left px-4 py-2 rounded-lg transition ${
                currentView === 'fees' ? 'bg-blue-600' : 'hover:bg-gray-800'
              }`}
            >
              💵 Student Fees (View Only)
            </button>
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
