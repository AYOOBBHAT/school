import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, ScrollView } from 'react-native';
import * as clerkService from '../services/clerk.service';

interface UnpaidSalariesProps {
  userRole: 'principal' | 'clerk';
}

interface UnpaidMonth {
  month: number;
  year: number;
  period_start: string;
  period_label: string;
  payment_status: string;
  net_salary: number;
  paid_amount: number;
  credit_applied: number;
  effective_paid_amount: number;
  pending_amount: number;
  days_since_period_start: number;
  payment_date: string | null;
}

interface Teacher {
  teacher_id: string;
  teacher_name: string;
  teacher_email: string;
  unpaid_months_count: number;
  total_unpaid_amount: number;
  max_days_unpaid: number;
  oldest_unpaid_month: {
    month: number;
    year: number;
    period_label: string;
    period_start: string;
    days_since_period_start: number;
  } | null;
  latest_unpaid_month: {
    month: number;
    year: number;
    period_label: string;
    period_start: string;
    days_since_period_start: number;
  } | null;
  unpaid_months: UnpaidMonth[];
}

interface SalariesData {
  summary: {
    total_teachers: number;
    total_unpaid_amount: number;
    total_unpaid_months: number;
    time_scope: string;
    start_date: string;
    end_date: string;
  };
  teachers: Teacher[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export function UnpaidSalaries({ userRole }: UnpaidSalariesProps) {
  const [data, setData] = useState<SalariesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeScope, setTimeScope] = useState<string>('last_12_months');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadUnpaidSalaries();
  }, [timeScope, currentPage]);

  const loadUnpaidSalaries = async () => {
    setLoading(true);
    try {
      const result = await clerkService.loadUnpaidSalaries(timeScope, currentPage, pageSize);
      setData(result);
    } catch (error: unknown) {
      console.error('Error loading unpaid salaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTeacherExpansion = (teacherId: string) => {
    setExpandedTeachers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teacherId)) {
        newSet.delete(teacherId);
      } else {
        newSet.add(teacherId);
      }
      return newSet;
    });
  };

  const timeScopeOptions = [
    { value: 'last_month', label: 'Last Month' },
    { value: 'last_2_months', label: 'Last 2 Months' },
    { value: 'last_3_months', label: 'Last 3 Months' },
    { value: 'last_6_months', label: 'Last 6 Months' },
    { value: 'last_12_months', label: 'Last 12 Months' },
    { value: 'current_academic_year', label: 'Current Academic Year' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return { bg: '#dbeafe', text: '#1e40af' };
      case 'partially-paid':
        return { bg: '#fef3c7', text: '#92400e' };
      default:
        return { bg: '#fee2e2', text: '#991b1b' };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Paid';
      case 'partially-paid':
        return 'Partially Paid';
      default:
        return 'Unpaid';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Unpaid Teacher Salaries</Text>
        <TouchableOpacity
          onPress={() => setShowFilters(!showFilters)}
          style={styles.filterButton}
        >
          <Text style={styles.filterButtonText}>Filters</Text>
        </TouchableOpacity>
      </View>

      {/* Filters Modal */}
      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Time Scope</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterOptions}>
              {timeScopeOptions.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.filterOption, timeScope === option.value && styles.filterOptionActive]}
                  onPress={() => {
                    setTimeScope(option.value);
                    setCurrentPage(1);
                    setShowFilters(false);
                  }}
                >
                  <Text style={[styles.filterOptionText, timeScope === option.value && styles.filterOptionTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading unpaid salaries...</Text>
        </View>
      ) : data ? (
        <View style={styles.content}>
          {/* Summary Cards */}
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, styles.summaryCardBlue]}>
              <Text style={styles.summaryLabel}>Total Teachers</Text>
              <Text style={styles.summaryValue}>{data.summary.total_teachers}</Text>
            </View>
            <View style={[styles.summaryCard, styles.summaryCardOrange]}>
              <Text style={styles.summaryLabel}>Unpaid Months</Text>
              <Text style={styles.summaryValue}>{data.summary.total_unpaid_months}</Text>
            </View>
            <View style={[styles.summaryCard, styles.summaryCardRed]}>
              <Text style={styles.summaryLabel}>Total Unpaid</Text>
              <Text style={styles.summaryValue}>₹{data.summary.total_unpaid_amount.toFixed(2)}</Text>
            </View>
          </View>

          {/* Teachers List */}
          <View style={styles.teachersSection}>
            <Text style={styles.sectionTitle}>Teachers with Unpaid Salaries</Text>
            {data.teachers.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No teachers with unpaid salaries. All teachers are up to date with their payments.
                </Text>
              </View>
            ) : (
              <>
                {data.teachers.map((teacher) => {
                  const isExpanded = expandedTeachers.has(teacher.teacher_id);
                  const hasMonths = teacher.unpaid_months && teacher.unpaid_months.length > 0;

                  return (
                    <View key={teacher.teacher_id} style={styles.teacherCard}>
                      <TouchableOpacity
                        onPress={() => hasMonths && toggleTeacherExpansion(teacher.teacher_id)}
                        activeOpacity={hasMonths ? 0.7 : 1}
                      >
                        <View style={styles.teacherHeader}>
                          <View style={styles.teacherInfo}>
                            {hasMonths && (
                              <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
                            )}
                            <View style={styles.teacherNameRow}>
                              <Text style={styles.teacherName}>{teacher.teacher_name || 'Unknown'}</Text>
                              <View style={styles.monthsBadge}>
                                <Text style={styles.monthsBadgeText}>
                                  {teacher.unpaid_months_count} {teacher.unpaid_months_count === 1 ? 'month' : 'months'}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.teacherDetail}>Email: {teacher.teacher_email || '-'}</Text>
                            <Text style={styles.unpaidAmount}>Total Unpaid: ₹{teacher.total_unpaid_amount.toFixed(2)}</Text>
                            {teacher.oldest_unpaid_month && (
                              <Text style={styles.teacherDetail}>
                                Oldest Unpaid: {teacher.oldest_unpaid_month.period_label} ({teacher.oldest_unpaid_month.days_since_period_start} days overdue)
                              </Text>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>

                      {isExpanded && hasMonths && (
                        <View style={styles.monthsContainer}>
                          <Text style={styles.monthsTitle}>Monthly Breakdown</Text>
                          {teacher.unpaid_months.map((month, idx) => {
                            const statusColors = getStatusColor(month.payment_status);
                            return (
                              <View key={`${month.year}-${month.month}-${idx}`} style={styles.monthCard}>
                                <View style={styles.monthHeader}>
                                  <Text style={styles.monthLabel}>{month.period_label}</Text>
                                  <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                                    <Text style={[styles.statusText, { color: statusColors.text }]}>
                                      {getStatusLabel(month.payment_status)}
                                    </Text>
                                  </View>
                                </View>
                                <View style={styles.monthDetails}>
                                  <View style={styles.monthRow}>
                                    <Text style={styles.monthDetailLabel}>Net Salary:</Text>
                                    <Text style={styles.monthDetailValue}>₹{month.net_salary.toFixed(2)}</Text>
                                  </View>
                                  {month.paid_amount > 0 && (
                                    <View style={styles.monthRow}>
                                      <Text style={styles.monthDetailLabel}>Cash Paid:</Text>
                                      <Text style={[styles.monthDetailValue, styles.monthDetailValueGreen]}>
                                        ₹{month.paid_amount.toFixed(2)}
                                      </Text>
                                    </View>
                                  )}
                                  {month.credit_applied > 0 && (
                                    <View style={styles.monthRow}>
                                      <Text style={styles.monthDetailLabel}>Credit Applied:</Text>
                                      <Text style={[styles.monthDetailValue, styles.monthDetailValueBlue]}>
                                        ₹{month.credit_applied.toFixed(2)}
                                      </Text>
                                    </View>
                                  )}
                                  {month.effective_paid_amount > 0 && month.effective_paid_amount !== month.paid_amount && (
                                    <View style={styles.monthRow}>
                                      <Text style={styles.monthDetailLabel}>Total Paid:</Text>
                                      <Text style={styles.monthDetailValue}>₹{month.effective_paid_amount.toFixed(2)}</Text>
                                    </View>
                                  )}
                                  {month.pending_amount > 0 && (
                                    <View style={styles.monthRow}>
                                      <Text style={styles.monthDetailLabel}>Pending:</Text>
                                      <Text style={[styles.monthDetailValue, styles.monthDetailValueRed]}>
                                        ₹{month.pending_amount.toFixed(2)}
                                      </Text>
                                    </View>
                                  )}
                                  {month.days_since_period_start > 0 && (
                                    <View style={styles.monthRow}>
                                      <Text style={styles.monthDetailLabel}>Days Overdue:</Text>
                                      <Text style={[styles.monthDetailValue, styles.monthDetailValueRed]}>
                                        {month.days_since_period_start} days
                                      </Text>
                                    </View>
                                  )}
                                  {month.payment_date && (
                                    <View style={styles.monthRow}>
                                      <Text style={styles.monthDetailLabel}>Last Payment:</Text>
                                      <Text style={styles.monthDetailValue}>
                                        {new Date(month.payment_date).toLocaleDateString()}
                                      </Text>
                                    </View>
                                  )}
                                  {!month.payment_date && month.payment_status === 'unpaid' && (
                                    <Text style={styles.noPaymentText}>No payment recorded</Text>
                                  )}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}

                {/* Pagination */}
                {data.pagination.total_pages > 1 && (
                  <View style={styles.pagination}>
                    <Text style={styles.paginationText}>
                      Page {data.pagination.page} of {data.pagination.total_pages}
                    </Text>
                    <View style={styles.paginationButtons}>
                      <TouchableOpacity
                        style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
                        onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <Text style={[styles.paginationButtonText, currentPage === 1 && styles.paginationButtonTextDisabled]}>
                          Previous
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.paginationButton, currentPage === data.pagination.total_pages && styles.paginationButtonDisabled]}
                        onPress={() => setCurrentPage(prev => Math.min(data.pagination.total_pages, prev + 1))}
                        disabled={currentPage === data.pagination.total_pages}
                      >
                        <Text style={[styles.paginationButtonText, currentPage === data.pagination.total_pages && styles.paginationButtonTextDisabled]}>
                          Next
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Select time scope to view unpaid salaries</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2563eb',
    borderRadius: 6,
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  modalClose: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '600',
  },
  filterOptions: {
    maxHeight: 300,
  },
  filterOption: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f1f5f9',
  },
  filterOptionActive: {
    backgroundColor: '#2563eb',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#1e293b',
  },
  filterOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
  },
  content: {
    flex: 1,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryCardBlue: {
    backgroundColor: '#dbeafe',
    borderColor: '#93c5fd',
  },
  summaryCardOrange: {
    backgroundColor: '#fed7aa',
    borderColor: '#fdba74',
  },
  summaryCardRed: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
  },
  teachersSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
  },
  teacherCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  teacherHeader: {
    flexDirection: 'row',
  },
  teacherInfo: {
    flex: 1,
  },
  expandIcon: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  teacherNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  teacherName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  monthsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#fed7aa',
  },
  monthsBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400e',
  },
  teacherDetail: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  unpaidAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f97316',
    marginTop: 8,
  },
  monthsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  monthsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  monthCard: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  monthDetails: {
    gap: 4,
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  monthDetailLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  monthDetailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  monthDetailValueGreen: {
    color: '#10b981',
  },
  monthDetailValueBlue: {
    color: '#3b82f6',
  },
  monthDetailValueRed: {
    color: '#ef4444',
  },
  noPaymentText: {
    fontSize: 12,
    color: '#f97316',
    fontStyle: 'italic',
    marginTop: 4,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  paginationText: {
    fontSize: 14,
    color: '#64748b',
  },
  paginationButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  paginationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationButtonText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
  paginationButtonTextDisabled: {
    color: '#94a3b8',
  },
});
