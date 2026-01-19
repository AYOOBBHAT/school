import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, FlatList, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/Button';
import { Student, ClassGroup } from '../types';

// Students Screen - Complete implementation
export function StudentsScreen({ navigation }: any) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    roll_number: '',
    class_group_id: '',
  });

  useEffect(() => {
    loadStudents();
    loadClasses();
  }, []);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const data = await api.getStudents();
      setStudents(data.students || []);
    } catch (error: any) {
      console.error('Error loading students:', error);
      Alert.alert('Error', error.message || 'Failed to load students');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadClasses = async () => {
    try {
      const data = await api.getClasses();
      setClasses(data.classes || []);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStudents();
  };

  const handleAddStudent = async () => {
    if (!formData.email || !formData.password || !formData.full_name || !formData.roll_number || !formData.class_group_id) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    try {
      await api.createStudent({
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        roll_number: formData.roll_number,
        class_group_id: formData.class_group_id,
      });
      Alert.alert('Success', 'Student created successfully');
      setShowAddModal(false);
      setFormData({ email: '', password: '', full_name: '', roll_number: '', class_group_id: '' });
      loadStudents();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create student');
    }
  };

  if (loading && !refreshing) {
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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

// Classes Screen - Complete implementation
export function ClassesScreen({ navigation }: any) {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      setLoading(true);
      const data = await api.getClasses();
      setClasses(data.classes || []);
    } catch (error: any) {
      console.error('Error loading classes:', error);
      Alert.alert('Error', error.message || 'Failed to load classes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadClasses();
  };

  const handleAddClass = async () => {
    if (!formData.name) {
      Alert.alert('Validation Error', 'Please enter a class name');
      return;
    }

    try {
      await api.createClass({
        name: formData.name,
        description: formData.description || undefined,
      });
      Alert.alert('Success', 'Class created successfully');
      setShowAddModal(false);
      setFormData({ name: '', description: '' });
      loadClasses();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create class');
    }
  };

  if (loading && !refreshing) {
    return <LoadingSpinner message="Loading classes..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Classes</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={classes}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={classes.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="🏫"
            title="No classes found"
            message="Create your first class to get started"
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.classCard}>
            <View style={styles.classInfo}>
              <Text style={styles.className}>{item.name}</Text>
              {item.description && (
                <Text style={styles.description}>{item.description}</Text>
              )}
            </View>
            <TouchableOpacity style={styles.viewButton}>
              <Text style={styles.viewButtonText}>View</Text>
            </TouchableOpacity>
          </Card>
        )}
      />

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Class</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Class Name *"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (Optional)"
              multiline
              numberOfLines={3}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleAddClass}>
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
  classCard: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  classInfo: {
    flex: 1,
  },
  grade: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  studentCount: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  description: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  viewButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  viewButtonText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
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