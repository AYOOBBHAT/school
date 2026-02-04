
interface TabsProps {
  activeTab: 'overview' | 'attendance' | 'marks' | 'fees';
  setActiveTab: (tab: 'overview' | 'attendance' | 'marks' | 'fees') => void;
}

export function Tabs({ activeTab, setActiveTab }: TabsProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm mb-6">
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'overview'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'attendance'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Attendance
        </button>
        <button
          onClick={() => setActiveTab('marks')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'marks'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Marks
        </button>
        <button
          onClick={() => setActiveTab('fees')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'fees'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Fees
        </button>
      </div>
    </div>
  );
}
