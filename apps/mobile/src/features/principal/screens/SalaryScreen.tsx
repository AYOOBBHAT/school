import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useSalarySummary,
  useSalaryStructures,
  useSalaryRecords,
  useCreateSalaryStructure,
} from '../hooks/useSalary';
import { useStaff } from '../hooks/useStaff';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Card } from '../../../shared/components/Card';
import { EmptyState } from '../../../shared/components/EmptyState';
import { UnpaidSalaries } from '../../../shared/components/UnpaidSalaries';
import type { PrincipalStackScreenProps } from '../../../navigation/types';
import type { SalaryStructureItem } from '../../../shared/services/principal.service';

type TabId = 'structure' | 'unpaid' | 'records' | 'reports';

type Props = PrincipalStackScreenProps<'Salary'>;

export function SalaryScreen({}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('structure');
  const [structureModalOpen, setStructureModalOpen] = useState(false);
  const [editingStructure, setEditingStructure] = useState<SalaryStructureItem | null>(null);
  const [structureForm, setStructureForm] = useState({
    teacher_id: '',
    base_salary: '',
    hra: '',
    other_allowances: '',
    fixed_deductions: '',
    salary_cycle: 'monthly' as 'monthly' | 'weekly' | 'biweekly',
    attendance_based_deduction: false,
    effective_from_date: '',
  });

  const { data: staffData } = useStaff();
  const teachers = (staffData?.staff ?? []).filter((s: any) => s.role === 'teacher');

  const { data: summaryData, isLoading: loadingSummary, refetch: refetchSummary, isRefetching: refetchingSummary } = useSalarySummary();
  const { data: structuresData, isLoading: loadingStructures, refetch: refetchStructures, isRefetching: refetchingStructures } = useSalaryStructures();
  const { data: recordsData, isLoading: loadingRecords, refetch: refetchRecords, isRefetching: refetchingRecords } = useSalaryRecords();
  const createStructureMutation = useCreateSalaryStructure();

  const structures = structuresData?.structures ?? [];
  const records = recordsData?.records ?? [];
  const summary = summaryData?.summary;

  const refetch = () => {
    refetchSummary();
    refetchStructures();
    refetchRecords();
  };
  const isRefetching = refetchingSummary || refetchingStructures || refetchingRecords;

  const openSetStructure = () => {
    setEditingStructure(null);
    setStructureForm({
      teacher_id: '',
      base_salary: '',
      hra: '',
      other_allowances: '',
      fixed_deductions: '',
      salary_cycle: 'monthly',
      attendance_based_deduction: false,
      effective_from_date: new Date().toISOString().split('T')[0],
    });
    setStructureModalOpen(true);
  };

  const openEditStructure = (s: SalaryStructureItem) => {
    setEditingStructure(s);
    setStructureForm({
      teacher_id: s.teacher_id,
      base_salary: String(s.base_salary),
      hra: String(s.hra ?? 0),
      other_allowances: String(s.other_allowances ?? 0),
      fixed_deductions: String(s.fixed_deductions ?? 0),
      salary_cycle: (s.salary_cycle as 'monthly' | 'weekly' | 'biweekly') || 'monthly',
      attendance_based_deduction: s.attendance_based_deduction ?? false,
      effective_from_date: s.effective_from?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    });
    setStructureModalOpen(true);
  };

  const handleSaveStructure = () => {
    if (!structureForm.teacher_id || !structureForm.base_salary?.trim()) {
      Alert.alert('Validation', 'Select teacher and enter base salary');
      return;
    }
    if (!structureForm.effective_from_date?.trim()) {
      Alert.alert('Validation', 'Effective from date is required');
      return;
    }
    if (!editingStructure) {
      const d = new Date(structureForm.effective_from_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (d < today) {
        Alert.alert('Validation', 'Effective from date cannot be in the past for new structures');
        return;
      }
    }
    createStructureMutation.mutate(
      {
        teacher_id: structureForm.teacher_id,
        base_salary: parseFloat(structureForm.base_salary) || 0,
        hra: parseFloat(structureForm.hra) || 0,
        other_allowances: parseFloat(structureForm.other_allowances) || 0,
        fixed_deductions: parseFloat(structureForm.fixed_deductions) || 0,
        salary_cycle: structureForm.salary_cycle,
        attendance_based_deduction: structureForm.attendance_based_deduction,
        effective_from_date: structureForm.effective_from_date,
      },
      {
        onSuccess: () => {
          Alert.alert('Success', 'Salary structure saved');
          setStructureModalOpen(false);
        },
        onError: (e: unknown) => {
          Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save');
        },
      }
    );
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'structure', label: 'Structure' },
    { id: 'unpaid', label: 'Unpaid' },
    { id: 'records', label: 'Records' },
    { id: 'reports', label: 'Reports' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Salary Management</Text>
      </View>

      <View style={styles.tabRow}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {activeTab === 'structure' && (
          <View style={styles.tabContent}>
            <View style={styles.row}>
              <Text style={styles.sectionTitle}>Teacher Salary Structures</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={openSetStructure}>
                <Text style={styles.primaryButtonText}>+ Set Structure</Text>
              </TouchableOpacity>
            </View>
            {loadingStructures ? (
              <LoadingSpinner message="Loading structures..." />
            ) : structures.length === 0 ? (
              <EmptyState icon="💰" title="No structures" message="Set a salary structure to get started." />
            ) : (
              <View style={styles.list}>
                {structures.map((s) => (
                  <Card key={s.id} style={styles.card}>
                    <View style={styles.cardRow}>
                      <View style={styles.cardBody}>
                        <Text style={styles.cardName}>{s.teacher?.full_name ?? 'Unknown'}</Text>
                        <Text style={styles.cardMeta}>
                          Base ₹{Number(s.base_salary).toLocaleString()} · HRA ₹{Number(s.hra || 0).toLocaleString()} · Ded ₹{Number(s.fixed_deductions || 0).toLocaleString()}
                        </Text>
                        <Text style={styles.cardMeta}>
                          {s.attendance_based_deduction ? '✅ Attendance deduction' : '❌ No attendance deduction'}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => openEditStructure(s)}>
                        <Text style={styles.actionLink}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === 'unpaid' && (
          <View style={styles.tabContent}>
            <UnpaidSalaries userRole="principal" />
          </View>
        )}

        {activeTab === 'records' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>All Salary Records</Text>
            {loadingRecords ? (
              <LoadingSpinner message="Loading records..." />
            ) : records.length === 0 ? (
              <EmptyState icon="📋" title="No records" message="No salary records found." />
            ) : (
              <View style={styles.list}>
                {records.map((r: any) => (
                  <Card key={r.id} style={styles.card}>
                    <Text style={styles.cardName}>{r.teacher?.full_name ?? 'Unknown'}</Text>
                    <Text style={styles.cardMeta}>
                      {new Date(2000, (r.month || 1) - 1).toLocaleString('default', { month: 'long' })} {r.year}
                    </Text>
                    <Text style={styles.cardMeta}>
                      Gross ₹{Number(r.gross_salary || 0).toLocaleString()} · Ded ₹{Number(r.total_deductions || 0).toLocaleString()} · Net ₹{Number(r.net_salary || 0).toLocaleString()}
                    </Text>
                    <View style={styles.badgeRow}>
                      <View style={[styles.badge, r.status === 'paid' ? styles.badgePaid : r.status === 'approved' ? styles.badgeApproved : styles.badgePending]}>
                        <Text style={styles.badgeText}>{r.status ?? 'pending'}</Text>
                      </View>
                      {r.payment_date && (
                        <Text style={styles.cardMeta}>Paid: {new Date(r.payment_date).toLocaleDateString()}</Text>
                      )}
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === 'reports' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Salary Reports</Text>
            {loadingSummary ? (
              <LoadingSpinner message="Loading summary..." />
            ) : (
              <View style={styles.reportGrid}>
                <Card style={styles.reportCard}>
                  <Text style={styles.reportLabel}>Total Paid</Text>
                  <Text style={[styles.reportValue, styles.green]}>
                    ₹{(summary?.summaries?.reduce((acc: number, s: any) => acc + (s.paid ?? 0), 0) ?? 0).toLocaleString()}
                  </Text>
                </Card>
                <Card style={styles.reportCard}>
                  <Text style={styles.reportLabel}>Total Pending</Text>
                  <Text style={[styles.reportValue, styles.orange]}>
                    ₹{(summary?.summaries?.reduce((acc: number, s: any) => acc + (s.pending ?? 0), 0) ?? 0).toLocaleString()}
                  </Text>
                </Card>
                <Card style={styles.reportCard}>
                  <Text style={styles.reportLabel}>Records (paid)</Text>
                  <Text style={styles.reportValue}>{records.filter((r: any) => r.status === 'paid').length}</Text>
                </Card>
                <Card style={styles.reportCard}>
                  <Text style={styles.reportLabel}>Records (pending)</Text>
                  <Text style={styles.reportValue}>{records.filter((r: any) => r.status === 'pending').length}</Text>
                </Card>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Set / Edit Salary Structure Modal */}
      <Modal visible={structureModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingStructure ? 'Edit Salary Structure' : 'Set Salary Structure'}</Text>

            <Text style={styles.label}>Effective from date *</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={structureForm.effective_from_date}
              onChangeText={(t) => setStructureForm({ ...structureForm, effective_from_date: t })}
            />

            <Text style={styles.label}>Teacher *</Text>
            <ScrollView horizontal style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
              {teachers.map((t: any) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.chip, structureForm.teacher_id === t.id && styles.chipSelected]}
                  onPress={() => setStructureForm({ ...structureForm, teacher_id: t.id })}
                >
                  <Text style={structureForm.teacher_id === t.id ? styles.chipTextSelected : styles.chipText}>{t.full_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Base salary (₹) *</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="0"
              value={structureForm.base_salary}
              onChangeText={(t) => setStructureForm({ ...structureForm, base_salary: t })}
            />
            <Text style={styles.label}>HRA (₹)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="0"
              value={structureForm.hra}
              onChangeText={(t) => setStructureForm({ ...structureForm, hra: t })}
            />
            <Text style={styles.label}>Other allowances (₹)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="0"
              value={structureForm.other_allowances}
              onChangeText={(t) => setStructureForm({ ...structureForm, other_allowances: t })}
            />
            <Text style={styles.label}>Fixed deductions (₹)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="0"
              value={structureForm.fixed_deductions}
              onChangeText={(t) => setStructureForm({ ...structureForm, fixed_deductions: t })}
            />
            <Text style={styles.label}>Salary cycle</Text>
            <View style={styles.chipRow}>
              {(['monthly', 'weekly', 'biweekly'] as const).map((cycle) => (
                <TouchableOpacity
                  key={cycle}
                  style={[styles.chip, structureForm.salary_cycle === cycle && styles.chipSelected]}
                  onPress={() => setStructureForm({ ...structureForm, salary_cycle: cycle })}
                >
                  <Text style={structureForm.salary_cycle === cycle ? styles.chipTextSelected : styles.chipText}>{cycle}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Attendance-based deduction</Text>
              <Switch
                value={structureForm.attendance_based_deduction}
                onValueChange={(v) => setStructureForm({ ...structureForm, attendance_based_deduction: v })}
              />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setStructureModalOpen(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSaveStructure}
                disabled={createStructureMutation.isPending}
              >
                {createStructureMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1e293b' },
  tabRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  tabText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  tabTextActive: { color: '#2563eb' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  tabContent: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  primaryButton: { backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  list: { gap: 12 },
  card: { padding: 14 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBody: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  cardMeta: { fontSize: 13, color: '#64748b', marginBottom: 2 },
  actionLink: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgePaid: { backgroundColor: '#dcfce7' },
  badgeApproved: { backgroundColor: '#dbeafe' },
  badgePending: { backgroundColor: '#fef3c7' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#1e293b' },
  reportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  reportCard: { minWidth: '45%', flex: 1, padding: 16 },
  reportLabel: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  reportValue: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  green: { color: '#16a34a' },
  orange: { color: '#ea580c' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalScroll: { maxHeight: '90%', width: '100%' },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '100%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 8, backgroundColor: '#fff' },
  chipScroll: { marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9' },
  chipSelected: { backgroundColor: '#2563eb' },
  chipText: { fontSize: 14, color: '#475569' },
  chipTextSelected: { fontSize: 14, color: '#fff', fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, gap: 12 },
  cancelButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f1f5f9' },
  cancelButtonText: { color: '#64748b', fontSize: 16, fontWeight: '600' },
  submitButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2563eb', minWidth: 100, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
