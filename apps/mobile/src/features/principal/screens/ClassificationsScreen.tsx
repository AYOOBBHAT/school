import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useClassifications,
  useClassificationValues,
  useCreateClassificationType,
  useCreateClassificationValue,
  useDeleteClassificationType,
  useDeleteClassificationValue,
} from '../hooks/useClassifications';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Card } from '../../../shared/components/Card';
import { EmptyState } from '../../../shared/components/EmptyState';
import { NavigationProp } from '../../../shared/types';
import type { ClassificationType } from '../../../shared/types';

// Example hints (same logic as web)
function getExamplePlaceholder(typeName: string): string {
  const lower = typeName.toLowerCase();
  if (lower.includes('grade')) return 'Grade 9, Grade 10, Grade 11';
  if (lower.includes('section')) return 'A, B, C, D';
  if (lower.includes('house')) return 'Blue House, Red House, Green House';
  if (lower.includes('gender')) return 'Boys, Girls, Mixed';
  if (lower.includes('stream')) return 'Science, Arts, Commerce';
  if (lower.includes('level')) return 'Junior, Senior, Advanced';
  return 'Enter value';
}

function getExampleHint(typeName: string): string {
  const lower = typeName.toLowerCase();
  if (lower.includes('grade')) return 'Examples: Grade 9, Grade 10, Grade 11, Grade 12';
  if (lower.includes('section')) return 'Examples: A, B, C, D, E';
  if (lower.includes('house')) return 'Examples: Blue House, Red House, Green House';
  if (lower.includes('gender')) return 'Examples: Boys, Girls, Mixed';
  if (lower.includes('stream')) return 'Examples: Science, Arts, Commerce, Vocational';
  if (lower.includes('level')) return 'Examples: Junior Group, Senior Group, Advanced';
  return 'Enter a value for this classification type';
}

interface ClassificationsScreenProps {
  navigation: NavigationProp;
}

export function ClassificationsScreen({ navigation }: ClassificationsScreenProps) {
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showValueModal, setShowValueModal] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [typeFormName, setTypeFormName] = useState('');
  const [valueFormValue, setValueFormValue] = useState('');

  const { data: typesData, isLoading, refetch, isRefetching, error } = useClassifications();
  const createTypeMutation = useCreateClassificationType();
  const createValueMutation = useCreateClassificationValue();
  const deleteTypeMutation = useDeleteClassificationType();
  const deleteValueMutation = useDeleteClassificationValue();

  const types = typesData?.types ?? [];
  const selectedType = types.find((t) => t.id === selectedTypeId);

  const handleCreateType = () => {
    const name = typeFormName.trim();
    if (!name) {
      Alert.alert('Validation', 'Please enter a type name');
      return;
    }
    createTypeMutation.mutate(
      { name },
      {
        onSuccess: () => {
          setShowTypeModal(false);
          setTypeFormName('');
        },
        onError: (e) => Alert.alert('Error', e.message),
      }
    );
  };

  const handleCreateValue = () => {
    const value = valueFormValue.trim();
    if (!selectedTypeId || !value) {
      Alert.alert('Validation', 'Please enter a value');
      return;
    }
    createValueMutation.mutate(
      { classification_type_id: selectedTypeId, value },
      {
        onSuccess: () => {
          setShowValueModal(false);
          setSelectedTypeId(null);
          setValueFormValue('');
        },
        onError: (e) => Alert.alert('Error', e.message),
      }
    );
  };

  const handleDeleteType = (type: ClassificationType) => {
    Alert.alert(
      'Delete type',
      `Are you sure you want to delete "${type.name}"? All values will be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteTypeMutation.mutate(type.id, {
              onError: (e) => Alert.alert('Error', e.message),
            }),
        },
      ]
    );
  };

  const handleDeleteValue = (valueId: string, typeId: string) => {
    Alert.alert('Delete value', 'Are you sure you want to delete this value?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteValueMutation.mutate(
            { valueId, typeId },
            { onError: (e) => Alert.alert('Error', e.message) }
          ),
      },
    ]);
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading classifications..." fullScreen />;
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Error Loading Classifications</Text>
          <Text style={styles.errorText}>{error.message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Dynamic Class Classifications</Text>
            <Text style={styles.subtitle}>
              Create custom classification types to organize your classes.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addTypeButton}
            onPress={() => setShowTypeModal(true)}
          >
            <Text style={styles.addTypeButtonText}>+ Add Type</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.examplesBox}>
          <Text style={styles.examplesTitle}>Examples</Text>
          <Text style={styles.examplesItem}>
            <Text style={styles.examplesBold}>Gender:</Text> Type "Gender" → values "Boys", "Girls"
          </Text>
          <Text style={styles.examplesItem}>
            <Text style={styles.examplesBold}>House:</Text> Type "House" → "Blue House", "Red House"
          </Text>
          <Text style={styles.examplesItem}>
            <Text style={styles.examplesBold}>Section:</Text> Type "Section" → "A", "B", "C"
          </Text>
        </View>

        {types.length === 0 ? (
          <View style={styles.emptyWrapper}>
            <EmptyState
              icon="🏷️"
              title="No Classification Types Yet"
              message="Create your first type (e.g. Grade, Section, House, Gender) to start organizing classes."
            />
            <TouchableOpacity
              style={styles.emptyCta}
              onPress={() => setShowTypeModal(true)}
            >
              <Text style={styles.emptyCtaText}>Create First Type</Text>
            </TouchableOpacity>
          </View>
        ) : (
          types.map((type) => (
            <TypeCard
              key={type.id}
              type={type}
              onAddValue={() => {
                setSelectedTypeId(type.id);
                setValueFormValue('');
                setShowValueModal(true);
              }}
              onDeleteType={() => handleDeleteType(type)}
              onDeleteValue={(valueId) => handleDeleteValue(valueId, type.id)}
            />
          ))
        )}
      </ScrollView>

      {/* Create Type Modal */}
      <Modal visible={showTypeModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Classification Type</Text>
            <Text style={styles.modalHint}>
              e.g. Grade, Section, House, Gender, Stream
            </Text>
            <Text style={styles.inputLabel}>Type Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Grade, Section, House"
              value={typeFormName}
              onChangeText={setTypeFormName}
              autoCapitalize="words"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowTypeModal(false);
                  setTypeFormName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleCreateType}
                disabled={createTypeMutation.isPending}
              >
                <Text style={styles.submitButtonText}>
                  {createTypeMutation.isPending ? 'Creating...' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Value Modal */}
      <Modal visible={showValueModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Add Value to {selectedType?.name ?? 'Type'}
            </Text>
            <Text style={styles.modalHint}>
              Add a specific value for this classification type.
            </Text>
            <Text style={styles.inputLabel}>Value *</Text>
            <TextInput
              style={styles.input}
              placeholder={selectedType ? getExamplePlaceholder(selectedType.name) : 'Enter value'}
              value={valueFormValue}
              onChangeText={setValueFormValue}
            />
            <Text style={styles.inputHint}>
              {selectedType ? getExampleHint(selectedType.name) : ''}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowValueModal(false);
                  setSelectedTypeId(null);
                  setValueFormValue('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleCreateValue}
                disabled={createValueMutation.isPending}
              >
                <Text style={styles.submitButtonText}>
                  {createValueMutation.isPending ? 'Adding...' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Card per type: shows values and actions (add value, delete type, delete value)
function TypeCard({
  type,
  onAddValue,
  onDeleteType,
  onDeleteValue,
}: {
  type: ClassificationType;
  onAddValue: () => void;
  onDeleteType: () => void;
  onDeleteValue: (valueId: string) => void;
}) {
  const { data: valuesData, isLoading: loadingValues } = useClassificationValues(type.id);
  const values = valuesData?.values ?? [];

  return (
    <Card style={styles.typeCard}>
      <View style={styles.typeCardHeader}>
        <View>
          <Text style={styles.typeName}>{type.name}</Text>
          <Text style={styles.typeMeta}>
            {loadingValues ? '...' : `${values.length} value${values.length !== 1 ? 's' : ''} defined`}
          </Text>
        </View>
        <View style={styles.typeActions}>
          <TouchableOpacity style={styles.addValueButton} onPress={onAddValue}>
            <Text style={styles.addValueButtonText}>+ Add Value</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteTypeButton} onPress={onDeleteType}>
            <Text style={styles.deleteTypeButtonText}>Delete Type</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.valuesRow}>
        {values.length === 0 && !loadingValues && (
          <Text style={styles.noValuesText}>No values yet. Tap "+ Add Value" to create one.</Text>
        )}
        {values.map((v) => (
          <View key={v.id} style={styles.valueChip}>
            <Text style={styles.valueChipText}>{v.value}</Text>
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => onDeleteValue(v.id)}
              style={styles.valueChipDelete}
            >
              <Text style={styles.valueChipDeleteText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  headerText: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b' },
  addTypeButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addTypeButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  examplesBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  examplesTitle: { fontSize: 14, fontWeight: '600', color: '#1e40af', marginBottom: 8 },
  examplesItem: { fontSize: 13, color: '#1e40af', marginBottom: 4 },
  examplesBold: { fontWeight: '600' },
  emptyWrapper: { alignItems: 'center', paddingVertical: 24 },
  emptyCta: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    alignSelf: 'center',
  },
  emptyCtaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorBox: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
  },
  errorTitle: { fontSize: 16, fontWeight: '600', color: '#b91c1c', marginBottom: 8 },
  errorText: { fontSize: 14, color: '#b91c1c', marginBottom: 12 },
  retryButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  retryButtonText: { color: '#fff', fontWeight: '600' },
  typeCard: { marginBottom: 16, padding: 16 },
  typeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  typeName: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  typeMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  typeActions: { flexDirection: 'row', gap: 8 },
  addValueButton: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addValueButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  deleteTypeButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteTypeButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  valuesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  valueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingLeft: 12,
    paddingVertical: 8,
    paddingRight: 6,
  },
  valueChipText: { fontSize: 14, fontWeight: '500', color: '#1e40af' },
  valueChipDelete: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  valueChipDeleteText: { color: '#dc2626', fontSize: 16, fontWeight: '700' },
  noValuesText: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', width: '100%' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  modalHint: { fontSize: 13, color: '#64748b', marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  inputHint: { fontSize: 12, color: '#64748b', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  cancelButtonText: { color: '#64748b', fontWeight: '600' },
  submitButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  submitButtonText: { color: '#fff', fontWeight: '600' },
});
