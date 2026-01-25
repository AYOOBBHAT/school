import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity, FlatList, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStaff, useCreateStaff } from '../hooks/useStaff';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Card } from '../../../shared/components/Card';
import { EmptyState } from '../../../shared/components/EmptyState';
import { Staff, NavigationProp } from '../../../shared/types';

interface StaffScreenProps {
  navigation: NavigationProp;
}

export function StaffScreen({ navigation }: StaffScreenProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'teacher' as 'teacher' | 'clerk',
  });

  const { data: staffData, isLoading, refetch, isRefetching } = useStaff();
  const createStaffMutation = useCreateStaff();

  const staff = staffData?.staff || [];

  const handleAddStaff = () => {
    if (!formData.email || !formData.password || !formData.full_name) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    createStaffMutation.mutate(formData, {
      onSuccess: () => {
        Alert.alert('Success', 'Staff member created successfully');
        setShowAddModal(false);
        setFormData({ email: '', password: '', full_name: '', role: 'teacher' });
      },
      onError: (error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to create staff member';
        Alert.alert('Error', message);
      },
    });
  };

  if (isLoading) {
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
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
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
