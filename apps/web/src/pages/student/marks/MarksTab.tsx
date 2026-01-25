import { Mark } from '../types';
import { calculateTotal, calculateTotalMax, calculateAverage, calculatePercentage, calculateGrade } from './GradeUtils';

interface MarksTabProps {
  marks: Mark[];
}

export default function MarksTab({ marks }: MarksTabProps) {
  if (marks.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">Marks & Grades</h2>
        <div className="text-center py-12 text-gray-500">
          <p className="mb-2">No verified marks available yet.</p>
          <p className="text-sm text-gray-400">Marks will appear here once they are verified by the principal or clerk.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Marks & Grades</h2>
      <div className="space-y-6">
        {marks.map((examMark, index) => {
          const total = calculateTotal(examMark);
          const totalMax = calculateTotalMax(examMark);
          const average = calculateAverage(examMark);
          const percentage = calculatePercentage(examMark);
          const grade = calculateGrade(examMark);

          return (
            <div key={index} className="border border-gray-200 rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold">{examMark.exam.name}</h3>
                  <p className="text-gray-600">{examMark.exam.term}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(examMark.exam.start_date).toLocaleDateString()} - {new Date(examMark.exam.end_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-xs text-gray-600">Total</p>
                      <p className="text-lg font-bold text-gray-900">
                        {total.toFixed(0)} / {totalMax.toFixed(0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Average</p>
                      <p className="text-lg font-bold text-gray-900">{average.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Percentage</p>
                      <p className="text-lg font-bold text-blue-600">{percentage.toFixed(2)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Grade</p>
                      <p className="text-lg font-bold text-green-600">{grade}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Subject
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Marks Obtained
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Max Marks
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Percentage
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {examMark.subjects.map((subjectMark, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {subjectMark.subject.name}
                          {subjectMark.subject.code && (
                            <span className="text-gray-500"> ({subjectMark.subject.code})</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{subjectMark.marks_obtained}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{subjectMark.max_marks}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{subjectMark.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
