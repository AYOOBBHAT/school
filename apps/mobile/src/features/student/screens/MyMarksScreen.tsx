import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ScrollView } from 'react-native';
import { StudentScreenWrapper } from '../../../shared/components/StudentScreenWrapper';
import { useStudentMarks } from '../hooks/useMarks';
import { Mark } from '../../../shared/services/student.service';

// Grade calculation utilities (matching web app)
function calculateTotal(marks: Mark): number {
  return marks.subjects.reduce((sum, s) => sum + s.marks_obtained, 0);
}

function calculateTotalMax(marks: Mark): number {
  return marks.subjects.reduce((sum, s) => sum + s.max_marks, 0);
}
function calculateAverage(marks: Mark): number {
  return marks.subjects.length > 0 ? calculateTotal(marks) / marks.subjects.length : 0;
}

function calculatePercentage(marks: Mark): number {
  const total = calculateTotal(marks);
  const totalMax = calculateTotalMax(marks);
  return parseFloat(marks.overallPercentage) || (totalMax > 0 ? (total / totalMax) * 100 : 0);
}

function calculateGrade(marks: Mark): string {
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

export function MyMarksScreen() {
  const { data, isLoading, refetch, isRefetching } = useStudentMarks();
  const marks = data?.marks || [];

  if (marks.length === 0) {
    return (
      <StudentScreenWrapper currentRoute="MyMarks">
        <Text style={styles.title}>Marks & Grades</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.empty}>
            {isLoading ? 'Loading marks...' : 'No verified marks available yet.'}
          </Text>
          {!isLoading && (
            <Text style={styles.emptySubtext}>
              Marks will appear here once they are verified by the principal or clerk.
            </Text>
          )}
        </View>
      </StudentScreenWrapper>
    );
  }

  return (
    <StudentScreenWrapper currentRoute="MyMarks">
      <Text style={styles.title}>Marks & Grades</Text>
      <FlatList
        data={marks}
        keyExtractor={(item, index) => item.exam.id || `exam-${index}`}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        renderItem={({ item: examMark }) => {
          const total = calculateTotal(examMark);
          const totalMax = calculateTotalMax(examMark);
          const average = calculateAverage(examMark);
          const percentage = calculatePercentage(examMark);
          const grade = calculateGrade(examMark);

          return (
            <View style={styles.examCard}>
              {/* Exam Header */}
              <View style={styles.examHeader}>
                <View style={styles.examInfo}>
                  <Text style={styles.examName}>{examMark.exam.name}</Text>
                  <Text style={styles.examTerm}>{examMark.exam.term}</Text>
                  <Text style={styles.examDate}>
                    {new Date(examMark.exam.start_date).toLocaleDateString()} -{' '}
                    {new Date(examMark.exam.end_date).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Total</Text>
                    <Text style={styles.statValue}>
                      {total.toFixed(0)} / {totalMax.toFixed(0)}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Average</Text>
                    <Text style={styles.statValue}>{average.toFixed(2)}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Percentage</Text>
                    <Text style={[styles.statValue, styles.percentageValue]}>
                      {percentage.toFixed(2)}%
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Grade</Text>
                    <Text style={[styles.statValue, styles.gradeValue]}>{grade}</Text>
                  </View>
                </View>
              </View>

              {/* Subjects List */}
              <View style={styles.subjectsContainer}>
                {examMark.subjects.map((subjectMark, idx) => (
                  <View key={idx} style={styles.subjectRow}>
                    <View style={styles.subjectInfo}>
                      <Text style={styles.subjectName}>{subjectMark.subject.name}</Text>
                      {subjectMark.subject.code && (
                        <Text style={styles.subjectCode}>({subjectMark.subject.code})</Text>
                      )}
                    </View>
                    <View style={styles.subjectMarks}>
                      <Text style={styles.marksText}>
                        {subjectMark.marks_obtained} / {subjectMark.max_marks}
                      </Text>
                      <Text style={styles.percentageText}>{subjectMark.percentage}%</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          );
        }}
        contentContainerStyle={styles.listContent}
      />
    </StudentScreenWrapper>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 64,
  },
  empty: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 16,
  },
  examCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  examHeader: {
    marginBottom: 16,
  },
  examInfo: {
    marginBottom: 12,
  },
  examName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  examTerm: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 4,
  },
  examDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  percentageValue: {
    color: '#2563eb',
  },
  gradeValue: {
    color: '#10b981',
  },
  subjectsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 12,
  },
  subjectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  subjectCode: {
    fontSize: 14,
    color: '#64748b',
  },
  subjectMarks: {
    alignItems: 'flex-end',
  },
  marksText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  percentageText: {
    fontSize: 14,
    color: '#64748b',
  },
});
