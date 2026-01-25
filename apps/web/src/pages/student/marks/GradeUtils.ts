import { Mark } from '../types';

export function calculateTotal(marks: Mark): number {
  return marks.total ?? marks.subjects.reduce((sum, s) => sum + s.marks_obtained, 0);
}

export function calculateTotalMax(marks: Mark): number {
  return marks.totalMax ?? marks.subjects.reduce((sum, s) => sum + s.max_marks, 0);
}

export function calculateAverage(marks: Mark): number {
  return marks.average ?? (marks.subjects.length > 0 ? calculateTotal(marks) / marks.subjects.length : 0);
}

export function calculatePercentage(marks: Mark): number {
  const total = calculateTotal(marks);
  const totalMax = calculateTotalMax(marks);
  return parseFloat(marks.overallPercentage) || (totalMax > 0 ? (total / totalMax) * 100 : 0);
}

export function calculateGrade(marks: Mark): string {
  if (marks.grade) return marks.grade;
  
  const percentage = calculatePercentage(marks);
  return (
    percentage >= 90 ? 'A+' :
    percentage >= 80 ? 'A' :
    percentage >= 70 ? 'B+' :
    percentage >= 60 ? 'B' :
    percentage >= 50 ? 'C+' :
    percentage >= 40 ? 'C' :
    'F'
  );
}
