import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, FlatList, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStudents, useCreateStudent } from '../hooks/useStudents';
import { useClasses } from '../hooks/useClasses';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Card } from '../../../shared/components/Card';
import { EmptyState } from '../../../shared/components/EmptyState';
import { Button } from '../../../shared/components/Button';
import { Student, ClassGroup } from '../../../shared/types';

import { NavigationProp } from '../../../shared/types';

interface StudentsScreenProps {
  navigation: NavigationProp;
}

export function StudentsScreen({ navigation }: StudentsScreenProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    roll_number: '',
    class_group_id: '',
  });

  const { data: studentsData, isLoading, refetch, isRefetching } = useStudents();
  const { data: classesData } = useClasses();
  const createStudentMutation = useCreateStudent();

  const students = studentsData?.students || [];
  const classes = classesData?.classes || [];

  const handleAddStudent = () => {
    if (!formData.email || !formData.password || !formData.full_name || !formData.roll_number || !formData.class_group_id) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    createStudentMutation.mutate(
      {
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        roll_number: formData.roll_number,
        class_group_id: formData.class_group_id,
      },
      {
        onSuccess: () => {
          Alert.alert('Success', 'Student created successfully');
          setShowAddModal(false);
          setFormData({ email: '', password: '', full_name: '', roll_number: '', class_group_id: '' });
        },
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Failed to create student';
          Alert.alert('Error', message);
        },
      }
    );
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading students..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Students</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={students}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        contentContainerStyle={students.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="👥"
            title="No students found"
            message="Add your first student to get started"
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.studentCard}>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{item.profiles?.full_name || 'Unknown'}</Text>
              <Text style={styles.studentEmail}>{item.profiles?.email || 'No email'}</Text>
              <Text style={styles.rollNumber}>Roll No: {item.roll_number}</Text>
              {item.class_groups && (
                <Text style={styles.className}>Class: {item.class_groups.name}</Text>
              )}
            </View>
            <View style={styles.statusBadge}>
              <Text style={[styles.statusText, item.status === 'active' && styles.activeStatus]}>
                {item.status}
              </Text>
            </View>
          </Card>
        )}
      />

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Student</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={formData.full_name}
              onChangeText={(text) => setFormData({ ...formData, full_name: text })}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Roll Number"
              value={formData.roll_number}
              onChangeText={(text) => setFormData({ ...formData, roll_number: text })}
            />
            
            <View style={styles.pickerContainer}>
              <Text style={styles.label}>Class</Text>
              <ScrollView style={styles.picker}>
                {classes.map(cls => (
                  <TouchableOpacity
                    key={cls.id}
                    style={[
                      styles.pickerItem,
                      formData.class_group_id === cls.id && styles.pickerItemSelected
                    ]}
                    onPress={() => setFormData({ ...formData, class_group_id: cls.id })}
                  >
                    <Text style={formData.class_group_id === cls.id ? styles.pickerItemTextSelected : styles.pickerItemText}>
                      {cls.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleAddStudent}>
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
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
  },
  addButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
  },
  studentCard: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  studentEmail: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 2,
  },
  rollNumber: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  className: {
    fontSize: 12,
    color: '#94a3b8',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'capitalize',
  },
  activeStatus: {
    color: '#10b981',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  pickerContainer: {
    marginBottom: 12,
  },
  picker: {
    maxHeight: 150,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
  },
  pickerItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  pickerItemSelected: {
    backgroundColor: '#eff6ff',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#1e293b',
  },
  pickerItemTextSelected: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  cancelButtonText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
