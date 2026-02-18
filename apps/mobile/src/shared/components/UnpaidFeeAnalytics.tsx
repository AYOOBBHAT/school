import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import * as clerkService from '../services/clerk.service';
import * as principalService from '../services/principal.service';
import { ClassGroup } from '../types';

interface UnpaidFeeAnalyticsProps {
  userRole: 'clerk' | 'principal';
  /** Set false to hide payment status distribution (e.g. principal quick action screen) */
  showChart?: boolean;
}

interface FeeComponentBreakdown {
  fee_type: string;
  fee_name: string;
  total_months_due: number;
  paid_months: number;
  pending_months: number;
  total_fee_amount: number;
  total_paid_amount: number;
  total_pending_amount: number;
}

interface Student {
  student_id: string;
  student_name: string;
  roll_number: string;
  class_name: string;
  parent_name: string;
  parent_phone: string;
  parent_address: string;
  pending_months: number | string;
  total_pending: number;
  total_fee: number;
  total_paid: number;
  payment_status: 'paid' | 'unpaid' | 'partially-paid';
  fee_component_breakdown?: FeeComponentBreakdown[];
}

interface AnalyticsData {
  summary: {
    total_students: number;
    unpaid_count: number;
    partially_paid_count: number;
    paid_count: number;
    total_unpaid_amount: number;
  };
  chart_data: {
    paid: number;
    unpaid: number;
    partially_paid: number;
  };
  students: Student[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export function UnpaidFeeAnalytics({ userRole, showChart = true }: UnpaidFeeAnalyticsProps) {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [timeScope, setTimeScope] = useState<string>('last_month');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (timeScope) {
      loadAnalytics();
    }
  }, [selectedClass, timeScope, currentPage]);

  const loadClasses = async () => {
    try {
      const result = userRole === 'clerk' 
        ? await clerkService.loadClasses()
        : await principalService.loadClasses();
      setClasses(result.classes || []);
      if (result.classes && result.classes.length > 0 && !selectedClass) {
        setSelectedClass(result.classes[0].id);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const result = await clerkService.loadUnpaidFeeAnalytics({
        class_group_id: selectedClass || undefined,
        time_scope: timeScope,
        page: currentPage,
        limit: pageSize,
      });
      setData(result);
    } catch (error: unknown) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStudentExpansion = (studentId: string) => {
    setExpandedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const timeScopeOptions = [
    { value: 'last_month', label: 'Last Month' },
    { value: 'last_2_months', label: 'Last 2 Months' },
    { value: 'last_3_months', label: 'Last 3 Months' },
    { value: 'last_6_months', label: 'Last 6 Months' },
    { value: 'current_academic_year', label: 'Current Academic Year' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Unpaid Fee Analytics</Text>
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
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Select Class</Text>
              <ScrollView style={styles.filterOptions}>
                <TouchableOpacity
                  style={[styles.filterOption, !selectedClass && styles.filterOptionActive]}
                  onPress={() => {
                    setSelectedClass('');
                    setCurrentPage(1);
                    setShowFilters(false);
                  }}
                >
                  <Text style={[styles.filterOptionText, !selectedClass && styles.filterOptionTextActive]}>
                    All Classes
                  </Text>
                </TouchableOpacity>
                {classes.map(cls => (
                  <TouchableOpacity
                    key={cls.id}
                    style={[styles.filterOption, selectedClass === cls.id && styles.filterOptionActive]}
                    onPress={() => {
                      setSelectedClass(cls.id);
                      setCurrentPage(1);
                      setShowFilters(false);
                    }}
                  >
                    <Text style={[styles.filterOptionText, selectedClass === cls.id && styles.filterOptionTextActive]}>
                      {cls.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Time Scope</Text>
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
        </View>
      </Modal>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      ) : data ? (
        <View style={styles.content}>
          {/* Summary Cards */}
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, styles.summaryCardBlue]}>
              <Text style={styles.summaryLabel}>Total Students</Text>
              <Text style={styles.summaryValue}>{data.summary.total_students}</Text>
            </View>
            <View style={[styles.summaryCard, styles.summaryCardRed]}>
              <Text style={styles.summaryLabel}>Unpaid</Text>
              <Text style={styles.summaryValue}>{data.summary.unpaid_count}</Text>
            </View>
            <View style={[styles.summaryCard, styles.summaryCardYellow]}>
              <Text style={styles.summaryLabel}>Partially Paid</Text>
              <Text style={styles.summaryValue}>{data.summary.partially_paid_count}</Text>
            </View>
            <View style={[styles.summaryCard, styles.summaryCardGray]}>
              <Text style={styles.summaryLabel}>Total Unpaid</Text>
              <Text style={styles.summaryValue}>₹{data.summary.total_unpaid_amount.toFixed(2)}</Text>
            </View>
          </View>

          {/* Payment status distribution (optional; omit on principal quick-action screen) */}
          {showChart && data.chart_data && (
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Payment Status Distribution</Text>
              <View style={styles.chartLegend}>
                <View style={styles.chartLegendItem}>
                  <View style={[styles.chartLegendColor, { backgroundColor: '#3B82F6' }]} />
                  <Text style={styles.chartLegendText}>Paid: {data.chart_data.paid}</Text>
                </View>
                <View style={styles.chartLegendItem}>
                  <View style={[styles.chartLegendColor, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.chartLegendText}>Unpaid: {data.chart_data.unpaid}</Text>
                </View>
                <View style={styles.chartLegendItem}>
                  <View style={[styles.chartLegendColor, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.chartLegendText}>Partially Paid: {data.chart_data.partially_paid}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Students List */}
          <View style={styles.studentsSection}>
            <Text style={styles.sectionTitle}>Unpaid Students List</Text>
            {data.students.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No unpaid students found for the selected filters.</Text>
              </View>
            ) : (
              <>
                {data.students.map((student) => {
                  const isExpanded = expandedStudents.has(student.student_id);
                  const hasBreakdown = student.fee_component_breakdown && student.fee_component_breakdown.length > 0;

                  return (
                    <View key={student.student_id} style={styles.studentCard}>
                      <TouchableOpacity
                        onPress={() => hasBreakdown && toggleStudentExpansion(student.student_id)}
                        activeOpacity={hasBreakdown ? 0.7 : 1}
                      >
                        <View style={styles.studentHeader}>
                          <View style={styles.studentInfo}>
                            {hasBreakdown && (
                              <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
                            )}
                            <View style={styles.studentNameRow}>
                              <Text style={styles.studentName}>{student.student_name}</Text>
                              <View style={[
                                styles.statusBadge,
                                student.payment_status === 'unpaid' && styles.statusUnpaid,
                                student.payment_status === 'paid' && styles.statusPaid,
                                student.payment_status === 'partially-paid' && styles.statusPartiallyPaid,
                              ]}>
                                <Text style={styles.statusText}>{student.payment_status.replace('-', ' ')}</Text>
                              </View>
                            </View>
                            <Text style={styles.studentDetail}>Roll: {student.roll_number} | Class: {student.class_name}</Text>
                            <Text style={styles.studentDetail}>Parent: {student.parent_name}</Text>
                            <Text style={styles.studentDetail}>Phone: {student.parent_phone}</Text>
                            {student.parent_address && (
                              <Text style={styles.studentDetail}>Address: {student.parent_address}</Text>
                            )}
                            <Text style={styles.studentDetail}>Pending Months: {student.pending_months}</Text>
                            <Text style={styles.pendingAmount}>Total Pending: ₹{student.total_pending.toFixed(2)}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>

                      {isExpanded && hasBreakdown && (
                        <View style={styles.breakdownContainer}>
                          <Text style={styles.breakdownTitle}>Fee Component Breakdown</Text>
                          {student.fee_component_breakdown!.map((component, idx) => (
                            <View key={idx} style={styles.componentCard}>
                              <Text style={styles.componentName}>{component.fee_name}</Text>
                              <View style={styles.componentRow}>
                                <Text style={styles.componentLabel}>Total Months Due:</Text>
                                <Text style={styles.componentValue}>{component.total_months_due}</Text>
                              </View>
                              <View style={styles.componentRow}>
                                <Text style={styles.componentLabel}>Paid Months:</Text>
                                <Text style={[styles.componentValue, styles.componentValueGreen]}>
                                  {component.paid_months}
                                </Text>
                              </View>
                              <View style={styles.componentRow}>
                                <Text style={styles.componentLabel}>Pending Months:</Text>
                                <Text style={[styles.componentValue, styles.componentValueRed]}>
                                  {component.pending_months}
                                </Text>
                              </View>
                              <View style={styles.componentDivider} />
                              <View style={styles.componentRow}>
                                <Text style={styles.componentLabel}>Total Fee:</Text>
                                <Text style={styles.componentValue}>₹{component.total_fee_amount.toFixed(2)}</Text>
                              </View>
                              <View style={styles.componentRow}>
                                <Text style={styles.componentLabel}>Total Paid:</Text>
                                <Text style={[styles.componentValue, styles.componentValueGreen]}>
                                  ₹{component.total_paid_amount.toFixed(2)}
                                </Text>
                              </View>
                              <View style={styles.componentRow}>
                                <Text style={styles.componentLabel}>Total Pending:</Text>
                                <Text style={[styles.componentValue, styles.componentValueRed]}>
                                  ₹{component.total_pending_amount.toFixed(2)}
                                </Text>
                              </View>
                            </View>
                          ))}
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
          <Text style={styles.emptyText}>Select filters to view analytics</Text>
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
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  filterOptions: {
    maxHeight: 200,
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
  summaryCardRed: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  summaryCardYellow: {
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
  },
  summaryCardGray: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
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
  chartContainer: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  chartLegend: {
    gap: 12,
  },
  chartLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chartLegendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  chartLegendText: {
    fontSize: 14,
    color: '#1e293b',
  },
  studentsSection: {
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
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  studentHeader: {
    flexDirection: 'row',
  },
  studentInfo: {
    flex: 1,
  },
  expandIcon: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  studentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusUnpaid: {
    backgroundColor: '#fee2e2',
  },
  statusPaid: {
    backgroundColor: '#dbeafe',
  },
  statusPartiallyPaid: {
    backgroundColor: '#fef3c7',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
    color: '#1e293b',
  },
  studentDetail: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  pendingAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ef4444',
    marginTop: 8,
  },
  breakdownContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  componentCard: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  componentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  componentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  componentLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  componentValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  componentValueGreen: {
    color: '#10b981',
  },
  componentValueRed: {
    color: '#ef4444',
  },
  componentDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 8,
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
