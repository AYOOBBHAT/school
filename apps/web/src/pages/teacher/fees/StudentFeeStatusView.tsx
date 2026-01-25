import { Student } from '../types';

interface StudentFeeStatusViewProps {
  students: Student[];
  studentFeeStatus: Record<string, { hasPending: boolean; totalPending: number; studentName?: string; rollNumber?: string }>;
  loadingFees: boolean;
}

export default function StudentFeeStatusView({ students, studentFeeStatus, loadingFees }: StudentFeeStatusViewProps) {
  if (loadingFees) {
    return <div className="text-center py-8">Loading fee status...</div>;
  }

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Student Fee Status (Read-Only)</h2>
      <p className="text-gray-600 mb-4">View fee status for students in your assigned classes. You cannot modify fees.</p>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        {students.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No students found in your assigned classes.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pending Fees</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Fee Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students.map((student) => {
                  const status = studentFeeStatus[student.id] || { hasPending: false, totalPending: 0, studentName: student.profile.full_name, rollNumber: student.roll_number || '-' };
                  return (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">{status.rollNumber}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">{status.studentName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {status.totalPending > 0 ? (
                          <span className="text-red-600 font-semibold">₹{status.totalPending.toLocaleString()}</span>
                        ) : (
                          <span className="text-green-600">₹0</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {status.hasPending ? (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                            Pending
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            Cleared
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
