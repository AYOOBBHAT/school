import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../utils/supabase';

interface SidebarProps {
  profile: any;
  activeTab: 'dashboard' | 'fee-collection' | 'salary-payment';
  setActiveTab: (tab: 'dashboard' | 'fee-collection' | 'salary-payment') => void;
}

export function Sidebar({ profile, activeTab, setActiveTab }: SidebarProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen fixed left-0 top-0">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-8">JhelumVerse</h1>
        <div className="mb-6">
          <div className="text-sm text-gray-400">Logged in as</div>
          <div className="font-semibold">{profile?.full_name || 'Clerk'}</div>
          <div className="text-sm text-gray-400">{profile?.email}</div>
        </div>
        <nav className="space-y-2">
          <button
            onClick={() => {
              setActiveTab('dashboard');
              navigate('/clerk');
            }}
            className={`w-full text-left px-4 py-2 rounded-lg transition ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-800 text-gray-300'
            }`}
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => {
              setActiveTab('fee-collection');
              navigate('/clerk/fees');
            }}
            className={`w-full text-left px-4 py-2 rounded-lg transition ${
              activeTab === 'fee-collection'
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-800 text-gray-300'
            }`}
          >
            💰 Fee Collection
          </button>
          <button
            onClick={() => {
              setActiveTab('salary-payment');
              navigate('/clerk/salary');
            }}
            className={`w-full text-left px-4 py-2 rounded-lg transition ${
              activeTab === 'salary-payment'
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-800 text-gray-300'
            }`}
          >
            💵 Pay Salary
          </button>
        </nav>
        <button
          onClick={handleLogout}
          className="mt-8 w-full text-left px-4 py-2 rounded-lg hover:bg-gray-800 transition"
        >
          🚪 Logout
        </button>
      </div>
    </div>
  );
}
