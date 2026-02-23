import React, { useState, useEffect, useCallback } from 'react';
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
  useStudents,
  useCreateStudent,
  useUpdateStudent,
  usePromoteStudent,
  usePromoteClass,
} from '../hooks/useStudents';
import { useClasses } from '../hooks/useClasses';
import {
  loadClassSections,
  loadStudentFeeConfig,
  loadDefaultFees,
  checkUsername,
  type StudentInClass,
  type ClassWithStudents,
  type CreateStudentPayload,
} from '../../../shared/services/principal.service';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { EmptyState } from '../../../shared/components/EmptyState';
import type { PrincipalStackScreenProps } from '../../../navigation/types';

type Props = PrincipalStackScreenProps<'Students'>;

type ModalType = 'add' | 'edit' | 'promote' | 'promoteClass' | null;

export function StudentsScreen({ navigation }: Props) {
  const [expandedClassIds, setExpandedClassIds] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentInClass | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [sections, setSections] = useState<Record<string, Array<{ id: string; name: string }>>>({});

  const { data: studentsData, isLoading, refetch, isRefetching } = useStudents();
  const { data: classesData } = useClasses();
  const createMutation = useCreateStudent();
  const updateMutation = useUpdateStudent();
  const promoteMutation = usePromoteStudent();
  const promoteClassMutation = usePromoteClass();

  const classesWithStudents = studentsData?.classes ?? [];
  const unassigned = studentsData?.unassigned ?? [];
  const totalStudents = studentsData?.total_students ?? 0;
  const allClasses = classesData?.classes ?? [];

  const toggleClass = (classId: string) => {
    setExpandedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  };

  const fetchSections = useCallback(async (classId: string) => {
    if (!classId || sections[classId]) return;
    try {
      const data = await loadClassSections(classId);
      setSections((s) => ({ ...s, [classId]: data.sections ?? [] }));
    } catch {
      setSections((s) => ({ ...s, [classId]: [] }));
    }
  }, [sections]);

  // Add Student form state
  const [addForm, setAddForm] = useState<CreateStudentPayload>({
    email: '',
    password: '',
    full_name: '',
    username: '',
    phone: '',
    roll_number: '',
    class_group_id: null,
    section_id: null,
    admission_date: '',
    gender: '',
    date_of_birth: '',
    home_address: '',
    guardian_name: '',
    guardian_phone: '',
    guardian_email: '',
    guardian_relationship: 'parent',
  });
  const [usernameStatus, setUsernameStatus] = useState<{ checking: boolean; available: boolean | null; message: string }>({
    checking: false,
    available: null,
    message: '',
  });

  useEffect(() => {
    if (!addForm.username.trim()) {
      setUsernameStatus({ checking: false, available: null, message: '' });
      return;
    }
    if (addForm.username.trim().length < 3) {
      setUsernameStatus({ checking: false, available: null, message: 'At least 3 characters' });
      return;
    }
    setUsernameStatus((s) => ({ ...s, checking: true, available: null, message: 'Checking...' }));
    const t = setTimeout(async () => {
      try {
        const res = await checkUsername(addForm.username.trim());
        setUsernameStatus({
          checking: false,
          available: res.available,
          message: res.message || (res.available ? 'Available' : 'Username taken'),
        });
      } catch {
        setUsernameStatus({ checking: false, available: false, message: 'Check failed' });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [addForm.username]);

  const openAdd = () => {
    setAddForm({
      email: '',
      password: '',
      full_name: '',
      username: '',
      phone: '',
      roll_number: '',
      class_group_id: null,
      section_id: null,
      admission_date: '',
      gender: '',
      date_of_birth: '',
      home_address: '',
      guardian_name: '',
      guardian_phone: '',
      guardian_email: '',
      guardian_relationship: 'parent',
    });
    setUsernameStatus({ checking: false, available: null, message: '' });
    setModal('add');
  };

  const loadEditDefaultFees = useCallback(async (classId: string): Promise<void> => {
    if (!classId) {
      setEditDefaultFees(null);
      return;
    }
    setLoadingEditFees(true);
    try {
      const data = await loadDefaultFees(classId);
      setEditDefaultFees({
        class_fees: data.class_fees ?? [],
        transport_routes: data.transport_routes ?? [],
        custom_fees: data.custom_fees ?? [],
      });
      const firstClassFeeId = data.class_fees?.[0]?.id ?? '';
      setEditFeeConfig((prev) => ({
        ...prev,
        class_fee_id: prev.class_fee_id || firstClassFeeId,
        class_fee_discount: prev.class_fee_discount ?? 0,
        transport_enabled: prev.transport_enabled ?? false,
        transport_route_id: prev.transport_route_id ?? '',
        transport_fee_discount: prev.transport_fee_discount ?? 0,
        custom_fees: (data.custom_fees ?? []).map((cf: { id: string }) => ({
          custom_fee_id: cf.id,
          discount: 0,
          is_exempt: false,
        })),
      }));
    } catch {
      setEditDefaultFees(null);
    } finally {
      setLoadingEditFees(false);
    }
  }, []);

  const openEdit = (student: StudentInClass & { class_group_id?: string }) => {
    setSelectedStudent(student);
    setEditForm({
      class_group_id: student.class_group_id ?? '',
      section_id: student.section_id ?? '',
      roll_number: student.roll_number ?? '',
    });
    setEditFeeConfig({
      class_fee_id: '',
      class_fee_discount: 0,
      transport_enabled: false,
      transport_route_id: '',
      transport_fee_discount: 0,
      custom_fees: [],
      effective_from_date: new Date().toISOString().split('T')[0],
    });
    setEditDefaultFees(null);
    setModal('edit');
    if (student.class_group_id) {
      fetchSections(student.class_group_id);
      loadEditDefaultFees(student.class_group_id).then(() => {
        if (student.id) {
          loadStudentFeeConfig(student.id)
            .then((res) => {
              if (res.fee_config) {
                const fc = res.fee_config;
                setEditFeeConfig((prev) => ({
                  ...prev,
                  class_fee_id: fc.class_fee_id ?? '',
                  class_fee_discount: fc.class_fee_discount ?? 0,
                  transport_enabled: fc.transport_enabled ?? false,
                  transport_route_id: fc.transport_route_id ?? '',
                  transport_fee_discount: fc.transport_fee_discount ?? 0,
                  custom_fees: fc.custom_fees ?? [],
                  effective_from_date: fc.effective_from_date ?? new Date().toISOString().split('T')[0],
                }));
              }
            })
            .catch(() => {});
        }
      });
    } else if (student.id) {
      loadStudentFeeConfig(student.id)
        .then((res) => {
          if (res.fee_config) {
            const fc = res.fee_config;
            setEditFeeConfig((prev) => ({
              ...prev,
              class_fee_id: fc.class_fee_id ?? '',
              class_fee_discount: fc.class_fee_discount ?? 0,
              transport_enabled: fc.transport_enabled ?? false,
              transport_route_id: fc.transport_route_id ?? '',
              transport_fee_discount: fc.transport_fee_discount ?? 0,
              custom_fees: fc.custom_fees ?? [],
              effective_from_date: fc.effective_from_date ?? new Date().toISOString().split('T')[0],
            }));
          }
        })
        .catch(() => {});
    }
  };

  const [editForm, setEditForm] = useState({ class_group_id: '', section_id: '', roll_number: '' });
  const [editFeeConfig, setEditFeeConfig] = useState({
    class_fee_id: '',
    class_fee_discount: 0,
    transport_enabled: false,
    transport_route_id: '',
    transport_fee_discount: 0,
    custom_fees: [] as Array<{ custom_fee_id: string; discount: number; is_exempt: boolean }>,
    effective_from_date: '',
  });
  const [editDefaultFees, setEditDefaultFees] = useState<{
    class_fees: Array<{ id: string; amount?: number; fee_cycle?: string; fee_categories?: { name?: string } }>;
    transport_routes: Array<{ id: string; route_name?: string; bus_number?: string; fee?: { total?: number } }>;
    custom_fees: Array<{ id: string; amount?: number; name?: string }>;
  } | null>(null);
  const [loadingEditFees, setLoadingEditFees] = useState(false);
  const [promoteForm, setPromoteForm] = useState({ target_class_id: '' });
  const [promoteClassForm, setPromoteClassForm] = useState({ target_class_id: '', clear_sections: false });

  const openPromote = (student: StudentInClass) => {
    setSelectedStudent(student);
    setPromoteForm({ target_class_id: '' });
    setModal('promote');
  };

  const openPromoteClass = (classId: string) => {
    setSelectedClassId(classId);
    setPromoteClassForm({ target_class_id: '', clear_sections: false });
    setModal('promoteClass');
  };

  const handleCreateStudent = async () => {
    if (
      !addForm.email ||
      !addForm.password ||
      !addForm.full_name ||
      !addForm.username ||
      !addForm.guardian_name ||
      !addForm.guardian_phone
    ) {
      Alert.alert('Validation', 'Fill required fields: name, email, username, password, guardian name & phone');
      return;
    }
    if (usernameStatus.checking || usernameStatus.available === false) {
      Alert.alert('Validation', 'Choose an available username (min 3 characters)');
      return;
    }
    createMutation.mutate(
      {
        ...addForm,
        class_group_id: addForm.class_group_id || null,
        section_id: addForm.section_id || null,
        admission_date: addForm.admission_date || null,
        gender: addForm.gender || null,
        date_of_birth: addForm.date_of_birth || null,
        home_address: addForm.home_address || null,
        guardian_email: addForm.guardian_email || null,
        guardian_relationship: addForm.guardian_relationship || 'parent',
      },
      {
        onSuccess: () => {
          Alert.alert('Success', 'Student added');
          setModal(null);
        },
        onError: (e: unknown) => {
          Alert.alert('Error', e instanceof Error ? e.message : 'Failed to add student');
        },
      }
    );
  };

  const handleUpdateStudent = () => {
    if (!selectedStudent) return;
    const updateData: {
      class_group_id: string | null;
      section_id: string | null;
      roll_number: string | null;
      fee_config?: typeof editFeeConfig & { effective_from_date?: string };
    } = {
      class_group_id: editForm.class_group_id || null,
      section_id: editForm.section_id || null,
      roll_number: editForm.roll_number || null,
    };
    if (editForm.class_group_id && editDefaultFees) {
      updateData.fee_config = {
        ...editFeeConfig,
        effective_from_date: editFeeConfig.effective_from_date || '',
      };
    }
    updateMutation.mutate(
      {
        studentId: selectedStudent.id,
        data: updateData,
      },
      {
        onSuccess: () => {
          Alert.alert('Success', 'Student updated');
          setModal(null);
        },
        onError: (e: unknown) => {
          Alert.alert('Error', e instanceof Error ? e.message : 'Update failed');
        },
      }
    );
  };

  const handlePromoteStudent = () => {
    if (!selectedStudent || !promoteForm.target_class_id) {
      Alert.alert('Validation', 'Select target class');
      return;
    }
    promoteMutation.mutate(
      { studentId: selectedStudent.id, target_class_id: promoteForm.target_class_id },
      {
        onSuccess: () => {
          Alert.alert('Success', 'Student promoted');
          setModal(null);
        },
        onError: (e: unknown) => {
          Alert.alert('Error', e instanceof Error ? e.message : 'Promote failed');
        },
      }
    );
  };

  const handlePromoteClass = () => {
    if (!selectedClassId || !promoteClassForm.target_class_id) {
      Alert.alert('Validation', 'Select target class');
      return;
    }
    Alert.alert(
      'Confirm',
      'Move all students from this class to the target class? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote',
          onPress: () =>
            promoteClassMutation.mutate(
              { classId: selectedClassId, data: promoteClassForm },
              {
                onSuccess: () => {
                  Alert.alert('Success', 'Class promoted');
                  setModal(null);
                },
                onError: (e: unknown) => {
                  Alert.alert('Error', e instanceof Error ? e.message : 'Promote failed');
                },
              }
            ),
        },
      ]
    );
  };

  const pickerClassId = modal === 'add' ? addForm.class_group_id : modal === 'edit' ? editForm.class_group_id : null;
  useEffect(() => {
    if (pickerClassId) fetchSections(pickerClassId);
  }, [pickerClassId, fetchSections]);

  if (isLoading) {
    return <LoadingSpinner message="Loading students..." fullScreen />;
  }

  const listEmpty = classesWithStudents.length === 0 && unassigned.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Students</Text>
        <View style={styles.headerRight}>
          <Text style={styles.total}>Total: {totalStudents}</Text>
          <TouchableOpacity style={styles.addButton} onPress={openAdd}>
            <Text style={styles.addButtonText}>+ Add Student</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={listEmpty ? styles.emptyContainer : styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      >
        {listEmpty ? (
          <EmptyState icon="👥" title="No students" message="Add a student or they will appear once assigned." />
        ) : (
          <>
            {classesWithStudents.map((cls: ClassWithStudents) => {
              const isExpanded = expandedClassIds.has(cls.id);
              const classificationText =
                cls.classifications && cls.classifications.length
                  ? ` (${cls.classifications.map((c) => `${c.type}: ${c.value}`).join(', ')})`
                  : '';
              return (
                <View key={cls.id} style={styles.classCard}>
                  <TouchableOpacity
                    style={styles.classHeader}
                    onPress={() => toggleClass(cls.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.classExpand}>{isExpanded ? '▼' : '▶'}</Text>
                    <View style={styles.classHeaderContent}>
                      <Text style={styles.className}>
                        {cls.name}
                        {classificationText}
                      </Text>
                      {cls.description ? <Text style={styles.classDesc}>{cls.description}</Text> : null}
                    </View>
                    <TouchableOpacity
                      style={styles.promoteClassBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        openPromoteClass(cls.id);
                      }}
                    >
                      <Text style={styles.promoteClassBtnText}>Promote Class</Text>
                    </TouchableOpacity>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{cls.student_count}</Text>
                    </View>
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={styles.studentsList}>
                      {cls.students.map((s) => (
                        <View key={s.id} style={styles.studentRow}>
                          <View style={styles.studentInfo}>
                            <Text style={styles.studentName}>{s.profile?.full_name ?? '—'}</Text>
                            <Text style={styles.studentMeta}>
                              Roll: {s.roll_number ?? '—'} · Section: {s.section_name ?? '—'} · {s.profile?.email ?? ''}
                            </Text>
                          </View>
                          <View style={styles.studentActions}>
                            <TouchableOpacity onPress={() => openEdit({ ...s, class_group_id: cls.id })}>
                              <Text style={styles.actionLink}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => openPromote(s)}>
                              <Text style={[styles.actionLink, styles.actionPromote]}>Promote</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            {unassigned.length > 0 && (
              <View style={styles.unassignedCard}>
                <View style={styles.unassignedHeader}>
                  <Text style={styles.unassignedTitle}>Unassigned ({unassigned.length})</Text>
                </View>
                {unassigned.map((s) => (
                  <View key={s.id} style={styles.studentRow}>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName}>{s.profile?.full_name ?? '—'}</Text>
                      <Text style={styles.studentMeta}>Roll: {s.roll_number ?? '—'} · {s.profile?.email ?? ''}</Text>
                    </View>
                    <TouchableOpacity onPress={() => openEdit({ ...s, class_group_id: '' })}>
                      <Text style={styles.actionLink}>Assign Class</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Add Student Modal */}
      <Modal visible={modal === 'add'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Student</Text>
            <TextInput style={styles.input} placeholder="Full Name *" value={addForm.full_name} onChangeText={(t) => setAddForm({ ...addForm, full_name: t })} />
            <TextInput style={styles.input} placeholder="Email *" keyboardType="email-address" autoCapitalize="none" value={addForm.email} onChangeText={(t) => setAddForm({ ...addForm, email: t })} />
            <TextInput style={styles.input} placeholder="Username * (min 3)" value={addForm.username} onChangeText={(t) => setAddForm({ ...addForm, username: t })} />
            {addForm.username.length > 0 && <Text style={usernameStatus.available === true ? styles.helpOk : styles.helpErr}>{usernameStatus.checking ? 'Checking...' : usernameStatus.message}</Text>}
            <TextInput style={styles.input} placeholder="Password * (min 8)" secureTextEntry value={addForm.password} onChangeText={(t) => setAddForm({ ...addForm, password: t })} />
            <TextInput style={styles.input} placeholder="Phone" keyboardType="phone-pad" value={addForm.phone ?? ''} onChangeText={(t) => setAddForm({ ...addForm, phone: t || null })} />
            <TextInput style={styles.input} placeholder="Roll Number" value={addForm.roll_number ?? ''} onChangeText={(t) => setAddForm({ ...addForm, roll_number: t || null })} />
            <Text style={styles.label}>Class</Text>
            <View style={styles.pickerRow}>
              {allClasses.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, addForm.class_group_id === c.id && styles.chipSelected]}
                  onPress={() => setAddForm({ ...addForm, class_group_id: addForm.class_group_id === c.id ? null : c.id, section_id: null })}
                >
                  <Text style={addForm.class_group_id === c.id ? styles.chipTextSelected : styles.chipText}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {addForm.class_group_id && sections[addForm.class_group_id]?.length ? (
              <>
                <Text style={styles.label}>Section</Text>
                <View style={styles.pickerRow}>
                  {sections[addForm.class_group_id].map((sec) => (
                    <TouchableOpacity
                      key={sec.id}
                      style={[styles.chip, addForm.section_id === sec.id && styles.chipSelected]}
                      onPress={() => setAddForm({ ...addForm, section_id: addForm.section_id === sec.id ? null : sec.id })}
                    >
                      <Text style={addForm.section_id === sec.id ? styles.chipTextSelected : styles.chipText}>{sec.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}
            <Text style={styles.label}>Guardian *</Text>
            <TextInput style={styles.input} placeholder="Guardian Name *" value={addForm.guardian_name} onChangeText={(t) => setAddForm({ ...addForm, guardian_name: t })} />
            <TextInput style={styles.input} placeholder="Guardian Phone *" keyboardType="phone-pad" value={addForm.guardian_phone} onChangeText={(t) => setAddForm({ ...addForm, guardian_phone: t })} />
            <TextInput style={styles.input} placeholder="Guardian Email" keyboardType="email-address" value={addForm.guardian_email ?? ''} onChangeText={(t) => setAddForm({ ...addForm, guardian_email: t || null })} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModal(null)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, (createMutation.isPending || usernameStatus.checking || usernameStatus.available === false) && styles.submitDisabled]}
                onPress={handleCreateStudent}
                disabled={createMutation.isPending || usernameStatus.checking || usernameStatus.available === false}
              >
                {createMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Add Student</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Edit Student Modal */}
      <Modal visible={modal === 'edit'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit: {selectedStudent?.profile?.full_name ?? 'Student'}</Text>
            <Text style={styles.label}>Class</Text>
            <View style={styles.pickerRow}>
              <TouchableOpacity
                style={[styles.chip, !editForm.class_group_id && styles.chipSelected]}
                onPress={() => {
                  setEditForm({ ...editForm, class_group_id: '', section_id: '' });
                  setEditDefaultFees(null);
                }}
              >
                <Text style={!editForm.class_group_id ? styles.chipTextSelected : styles.chipText}>No Class</Text>
              </TouchableOpacity>
              {allClasses.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, editForm.class_group_id === c.id && styles.chipSelected]}
                  onPress={() => {
                    setEditForm({ ...editForm, class_group_id: c.id, section_id: '' });
                    fetchSections(c.id);
                    loadEditDefaultFees(c.id);
                  }}
                >
                  <Text style={editForm.class_group_id === c.id ? styles.chipTextSelected : styles.chipText}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {editForm.class_group_id && sections[editForm.class_group_id]?.length ? (
              <>
                <Text style={styles.label}>Section</Text>
                <View style={styles.pickerRow}>
                  {sections[editForm.class_group_id].map((sec) => (
                    <TouchableOpacity
                      key={sec.id}
                      style={[styles.chip, editForm.section_id === sec.id && styles.chipSelected]}
                      onPress={() => setEditForm({ ...editForm, section_id: sec.id })}
                    >
                      <Text style={editForm.section_id === sec.id ? styles.chipTextSelected : styles.chipText}>{sec.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}
            <Text style={styles.label}>Roll Number</Text>
            <TextInput style={styles.input} placeholder="Roll Number" value={editForm.roll_number} onChangeText={(t) => setEditForm({ ...editForm, roll_number: t })} />

            {/* Fee Configuration (same as web when class is selected) */}
            {editForm.class_group_id && (
              <View style={styles.feeSection}>
                <Text style={styles.feeSectionTitle}>Fee Configuration</Text>
                <Text style={styles.label}>Apply from date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={editFeeConfig.effective_from_date}
                  onChangeText={(t) => setEditFeeConfig((prev) => ({ ...prev, effective_from_date: t }))}
                />
                {loadingEditFees ? (
                  <View style={styles.loadingFeesRow}>
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text style={styles.loadingFeesText}>Loading fee options...</Text>
                  </View>
                ) : editDefaultFees && editDefaultFees.class_fees?.length > 0 ? (
                  <>
                    <Text style={styles.label}>Class fee discount (₹)</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      value={editFeeConfig.class_fee_discount ? String(editFeeConfig.class_fee_discount) : ''}
                      onChangeText={(t) => setEditFeeConfig((prev) => ({ ...prev, class_fee_discount: parseFloat(t) || 0 }))}
                    />
                    <View style={styles.transportRow}>
                      <Text style={styles.label}>Transport</Text>
                      <Switch
                        value={editFeeConfig.transport_enabled}
                        onValueChange={(v) => setEditFeeConfig((prev) => ({ ...prev, transport_enabled: v, transport_route_id: v ? prev.transport_route_id : '' }))}
                      />
                    </View>
                    {editFeeConfig.transport_enabled && editDefaultFees.transport_routes?.length > 0 && (
                      <>
                        <Text style={styles.label}>Route</Text>
                        <View style={styles.pickerRow}>
                          {editDefaultFees.transport_routes.map((r) => (
                            <TouchableOpacity
                              key={r.id}
                              style={[styles.chip, editFeeConfig.transport_route_id === r.id && styles.chipSelected]}
                              onPress={() => setEditFeeConfig((prev) => ({ ...prev, transport_route_id: r.id }))}
                            >
                              <Text style={editFeeConfig.transport_route_id === r.id ? styles.chipTextSelected : styles.chipText}>{r.route_name ?? r.bus_number ?? r.id}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <Text style={styles.label}>Transport discount (₹)</Text>
                        <TextInput
                          style={styles.input}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          value={editFeeConfig.transport_fee_discount ? String(editFeeConfig.transport_fee_discount) : ''}
                          onChangeText={(t) => setEditFeeConfig((prev) => ({ ...prev, transport_fee_discount: parseFloat(t) || 0 }))}
                        />
                      </>
                    )}
                  </>
                ) : null}
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModal(null)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleUpdateStudent} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Update</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Promote Student Modal */}
      <Modal visible={modal === 'promote'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Promote: {selectedStudent?.profile?.full_name ?? 'Student'}</Text>
            <Text style={styles.label}>Target Class</Text>
            <ScrollView style={styles.pickerScroll}>
              {allClasses.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, promoteForm.target_class_id === c.id && styles.chipSelected]}
                  onPress={() => setPromoteForm({ target_class_id: c.id })}
                >
                  <Text style={promoteForm.target_class_id === c.id ? styles.chipTextSelected : styles.chipText}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModal(null)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handlePromoteStudent} disabled={promoteMutation.isPending || !promoteForm.target_class_id}>
                {promoteMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Promote</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Promote Class Modal */}
      <Modal visible={modal === 'promoteClass'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Promote Entire Class</Text>
            <Text style={styles.label}>Target Class</Text>
            <ScrollView style={styles.pickerScroll}>
              {allClasses.filter((c) => c.id !== selectedClassId).map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, promoteClassForm.target_class_id === c.id && styles.chipSelected]}
                  onPress={() => setPromoteClassForm({ ...promoteClassForm, target_class_id: c.id })}
                >
                  <Text style={promoteClassForm.target_class_id === c.id ? styles.chipTextSelected : styles.chipText}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setPromoteClassForm((f) => ({ ...f, clear_sections: !f.clear_sections }))}
            >
              <Text style={styles.checkLabel}>Clear section assignments</Text>
              <Text style={styles.checkValue}>{promoteClassForm.clear_sections ? 'Yes' : 'No'}</Text>
            </TouchableOpacity>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModal(null)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handlePromoteClass}
                disabled={promoteClassMutation.isPending || !promoteClassForm.target_class_id}
              >
                {promoteClassMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Promote Class</Text>}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1e293b' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  total: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  addButton: { backgroundColor: '#16a34a', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  scroll: { flex: 1 },
  list: { padding: 16, paddingBottom: 32 },
  emptyContainer: { flexGrow: 1 },
  classCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  classHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  classExpand: { fontSize: 16, marginRight: 8, color: '#64748b' },
  classHeaderContent: { flex: 1 },
  className: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  classDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  promoteClassBtn: { backgroundColor: '#16a34a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, marginRight: 8 },
  promoteClassBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  badge: { backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#1d4ed8' },
  studentsList: { borderTopWidth: 1, borderTopColor: '#e2e8f0', padding: 12 },
  studentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  studentMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  studentActions: { flexDirection: 'row', gap: 12 },
  actionLink: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  actionPromote: { color: '#16a34a' },
  unassignedCard: { backgroundColor: '#fffbeb', borderRadius: 12, marginTop: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#fde68a' },
  unassignedHeader: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#fde68a' },
  unassignedTitle: { fontSize: 16, fontWeight: '700', color: '#92400e' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalScroll: { maxHeight: '90%', width: '100%' },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '100%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, backgroundColor: '#fff' },
  label: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8, marginTop: 8 },
  helpOk: { fontSize: 12, color: '#16a34a', marginBottom: 8 },
  helpErr: { fontSize: 12, color: '#dc2626', marginBottom: 8 },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  pickerScroll: { maxHeight: 160, marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9' },
  chipSelected: { backgroundColor: '#2563eb' },
  chipText: { fontSize: 14, color: '#475569' },
  chipTextSelected: { fontSize: 14, color: '#fff', fontWeight: '600' },
  checkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, marginBottom: 12 },
  checkLabel: { fontSize: 14, color: '#334155' },
  checkValue: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, gap: 12 },
  cancelButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f1f5f9' },
  cancelButtonText: { color: '#64748b', fontSize: 16, fontWeight: '600' },
  submitButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2563eb', minWidth: 120, alignItems: 'center' },
  submitDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  feeSection: { borderTopWidth: 1, borderTopColor: '#e2e8f0', marginTop: 16, paddingTop: 16 },
  feeSectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  loadingFeesRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  loadingFeesText: { fontSize: 14, color: '#64748b' },
  transportRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 8 },
});
