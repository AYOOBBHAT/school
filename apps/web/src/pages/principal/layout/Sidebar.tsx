import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../../utils/supabase';

export function Sidebar({ currentPath }: { currentPath: string }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { path: '/principal/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/principal/staff', label: 'Staff Management', icon: '👥' },
    { path: '/principal/classifications', label: 'Classifications', icon: '🏷️' },
    { path: '/principal/classes', label: 'Classes', icon: '🏫' },
    { path: '/principal/subjects', label: 'Subjects', icon: '📚' },
    { path: '/principal/students', label: 'Students', icon: '🎓' },
    { path: '/principal/exams', label: 'Exams', icon: '📝' },
    { path: '/principal/salary', label: 'Salary Management', icon: '💰' },
    { path: '/principal/fees', label: 'Fee Management', icon: '💵' },
  ];

  const filteredNav = navItems;

  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen fixed left-0 top-0">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-8">JhelumVerse</h1>
        <nav className="space-y-2">
          {filteredNav.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                currentPath === item.path
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
      <div className="absolute bottom-0 w-full p-6">
        <button
          onClick={handleLogout}
          className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
