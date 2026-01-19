import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, FlatList, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Staff, Subject, Exam, Classification } from '../types';

// Staff Management Screen
export function StaffScreen({ navigation }: any) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'teacher' as 'teacher' | 'clerk',
  });

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      setLoading(true);
      const data = await api.getStaff();
      setStaff(data.staff || []);
    } catch (error: any) {
      console.error('Error loading staff:', error);
      Alert.alert('Error', error.message || 'Failed to load staff');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStaff();
  };

  const handleAddStaff = async () => {
    if (!formData.email || !formData.password || !formData.full_name) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    try {
      await api.createStaff(formData);
      Alert.alert('Success', 'Staff member created successfully');
      setShowAddModal(false);
      setFormData({ email: '', password: '', full_name: '', role: 'teacher' });
      loadStaff();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create staff member');
    }
  };

  if (loading && !refreshing) {
    return <LoadingSpinner message="Loading staff..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Staff Management</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={staff}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={staff.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <EmptyState icon="👥" title="No staff found" message="Add your first staff member" />
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{item.profiles?.full_name || 'Unknown'}</Text>
              <Text style={styles.cardEmail}>{item.profiles?.email || 'No email'}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{item.role}</Text>
              </View>
            </View>
          </Card>
        )}
      />

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Staff Member</Text>
            <TextInput style={styles.input} placeholder="Full Name *" value={formData.full_name} onChangeText={(text) => setFormData({ ...formData, full_name: text })} />
            <TextInput style={styles.input} placeholder="Email *" keyboardType="email-address" autoCapitalize="none" value={formData.email} onChangeText={(text) => setFormData({ ...formData, email: text })} />
            <TextInput style={styles.input} placeholder="Password *" secureTextEntry value={formData.password} onChangeText={(text) => setFormData({ ...formData, password: text })} />
            <View style={styles.roleSelector}>
              <TouchableOpacity style={[styles.roleOption, formData.role === 'teacher' && styles.roleOptionSelected]} onPress={() => setFormData({ ...formData, role: 'teacher' })}>
                <Text style={formData.role === 'teacher' ? styles.roleOptionTextSelected : styles.roleOptionText}>Teacher</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.roleOption, formData.role === 'clerk' && styles.roleOptionSelected]} onPress={() => setFormData({ ...formData, role: 'clerk' })}>
                <Text style={formData.role === 'clerk' ? styles.roleOptionTextSelected : styles.roleOptionText}>Clerk</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleAddStaff}>
                <Text style={styles.submitButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Subjects Management Screen
export function SubjectsScreen({ navigation }: any) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', code: '' });

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    try {
      setLoading(true);
      const data = await api.getSubjects();
      setSubjects(data.subjects || []);
    } catch (error: any) {
      console.error('Error loading subjects:', error);
      Alert.alert('Error', error.message || 'Failed to load subjects');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSubjects();
  };

  const handleAddSubject = async () => {
    if (!formData.name) {
      Alert.alert('Validation Error', 'Please enter a subject name');
      return;
    }

    try {
      await api.createSubject({ name: formData.name, code: formData.code || undefined });
      Alert.alert('Success', 'Subject created successfully');
      setShowAddModal(false);
      setFormData({ name: '', code: '' });
      loadSubjects();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create subject');
    }
  };

  if (loading && !refreshing) {
    return <LoadingSpinner message="Loading subjects..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Subjects</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={subjects}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={subjects.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={<EmptyState icon="📚" title="No subjects found" message="Add your first subject" />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.cardName}>{item.name}</Text>
            {item.code && <Text style={styles.cardEmail}>Code: {item.code}</Text>}
          </Card>
        )}
      />

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Subject</Text>
            <TextInput style={styles.input} placeholder="Subject Name *" value={formData.name} onChangeText={(text) => setFormData({ ...formData, name: text })} />
            <TextInput style={styles.input} placeholder="Code (Optional)" value={formData.code} onChangeText={(text) => setFormData({ ...formData, code: text })} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleAddSubject}>
                <Text style={styles.submitButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Exams Management Screen
export function ExamsScreen({ navigation }: any) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = async () => {
    try {
      setLoading(true);
      const data = await api.getExams();
      setExams(data.exams || []);
    } catch (error: any) {
      console.error('Error loading exams:', error);
      Alert.alert('Error', error.message || 'Failed to load exams');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadExams();
  };

  if (loading && !refreshing) {
    return <LoadingSpinner message="Loading exams..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Exams</Text>
      </View>

      <FlatList
        data={exams}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={exams.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={<EmptyState icon="📝" title="No exams found" message="Create your first exam" />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.cardName}>{item.name}</Text>
            <Text style={styles.cardEmail}>Term: {item.term}</Text>
            <Text style={styles.cardEmail}>
              {new Date(item.start_date).toLocaleDateString()} - {new Date(item.end_date).toLocaleDateString()}
            </Text>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

// Classifications Management Screen
export function ClassificationsScreen({ navigation }: any) {
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadClassifications();
  }, []);

  const loadClassifications = async () => {
    try {
      setLoading(true);
      const data = await api.getClassificationTypes();
      setTypes(data.types || []);
    } catch (error: any) {
      console.error('Error loading classifications:', error);
      Alert.alert('Error', error.message || 'Failed to load classifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadClassifications();
  };

  if (loading && !refreshing) {
    return <LoadingSpinner message="Loading classifications..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Classifications</Text>
      </View>

      <FlatList
        data={types}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={types.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={<EmptyState icon="🏷️" title="No classifications found" />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.cardName}>{item.name}</Text>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

// Salary Management Screen
export function SalaryScreen({ navigation }: any) {
  const [summaries, setSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSalary();
  }, []);

  const loadSalary = async () => {
    try {
      setLoading(true);
      const data = await api.getSalarySummary();
      setSummaries(data.summaries || []);
    } catch (error: any) {
      console.error('Error loading salary:', error);
      Alert.alert('Error', error.message || 'Failed to load salary data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSalary();
  };

  if (loading && !refreshing) {
    return <LoadingSpinner message="Loading salary data..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Salary Management</Text>
      </View>

      <FlatList
        data={summaries}
        keyExtractor={(item, index) => item.id || `salary-${index}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={summaries.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={<EmptyState icon="💰" title="No salary data found" />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.cardName}>{item.teacher?.full_name || 'Unknown'}</Text>
            <Text style={styles.cardEmail}>Total Due: ₹{item.total_salary_due || 0}</Text>
            <Text style={styles.cardEmail}>Total Paid: ₹{item.total_salary_paid || 0}</Text>
            <Text style={styles.cardEmail}>Pending: ₹{item.pending_salary || 0}</Text>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

// Fees Management Screen  
export function FeesScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fee Management</Text>
      </View>
      <View style={styles.emptyContainer}>
        <EmptyState icon="💵" title="Fee Management" message="Fee management features coming soon" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 24, fontWeight: '700', color: '#1e293b' },
  addButton: { backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  addButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  list: { padding: 16 },
  emptyContainer: { flex: 1 },
  card: { marginBottom: 12, padding: 16 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  cardEmail: { fontSize: 14, color: '#64748b', marginBottom: 2 },
  roleBadge: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: '#eff6ff', alignSelf: 'flex-start' },
  roleText: { fontSize: 12, fontWeight: '600', color: '#2563eb', textTransform: 'capitalize' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '90%', maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, backgroundColor: '#fff' },
  roleSelector: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  roleOption: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  roleOptionSelected: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  roleOptionText: { fontSize: 16, color: '#64748b' },
  roleOptionTextSelected: { fontSize: 16, color: '#2563eb', fontWeight: '600' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, gap: 12 },
  cancelButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f1f5f9' },
  cancelButtonText: { color: '#64748b', fontSize: 16, fontWeight: '600' },
  submitButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2563eb' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});