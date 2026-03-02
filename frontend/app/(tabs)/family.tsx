import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
}

const RELATIONSHIPS = [
  'Ehepartner',
  'Kind',
  'Elternteil',
  'Geschwister',
  'Sonstige',
];

export default function FamilyScreen() {
  const { token } = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRelationship, setNewRelationship] = useState('Ehepartner');
  const [saving, setSaving] = useState(false);

  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  const fetchMembers = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/family-members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (token) {
        fetchMembers();
      }
    }, [token])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchMembers();
  };

  const handleAddMember = async () => {
    if (!newName.trim()) {
      Alert.alert('Fehler', 'Bitte einen Namen eingeben');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/family-members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newName.trim(),
          relationship: newRelationship,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Fehler beim Speichern');
      }

      setModalVisible(false);
      setNewName('');
      setNewRelationship('Ehepartner');
      fetchMembers();
    } catch (error: any) {
      Alert.alert('Fehler', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMember = (member: FamilyMember) => {
    Alert.alert(
      'Familienmitglied löschen',
      `Möchtest du ${member.name} wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(
                `${BACKEND_URL}/api/family-members/${member.id}`,
                {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${token}` },
                }
              );
              if (response.ok) {
                fetchMembers();
              }
            } catch (error) {
              Alert.alert('Fehler', 'Konnte nicht gelöscht werden');
            }
          },
        },
      ]
    );
  };

  const getRelationshipIcon = (relationship: string): keyof typeof Ionicons.glyphMap => {
    switch (relationship) {
      case 'Ehepartner':
        return 'heart';
      case 'Kind':
        return 'happy';
      case 'Elternteil':
        return 'people';
      case 'Geschwister':
        return 'person';
      default:
        return 'person-outline';
    }
  };

  const renderMember = ({ item }: { item: FamilyMember }) => (
    <View style={[styles.memberCard, isDesktop && styles.memberCardDesktop]}>
      <View style={[styles.memberIcon, isDesktop && styles.memberIconDesktop]}>
        <Ionicons
          name={getRelationshipIcon(item.relationship)}
          size={isDesktop ? 28 : 24}
          color="#3b82f6"
        />
      </View>
      <View style={styles.memberInfo}>
        <Text style={[styles.memberName, isDesktop && styles.memberNameDesktop]}>
          {item.name}
        </Text>
        <Text style={[styles.memberRelationship, isDesktop && styles.memberRelationshipDesktop]}>
          {item.relationship}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteMember(item)}
      >
        <Ionicons name="trash-outline" size={isDesktop ? 24 : 20} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.contentWrapper, { maxWidth: isDesktop ? 800 : isTablet ? 600 : '100%' }]}>
        <View style={[styles.header, isDesktop && styles.headerDesktop]}>
          <Text style={[styles.title, isDesktop && styles.titleDesktop]}>Familie</Text>
          <TouchableOpacity
            style={[
              styles.addButton,
              isDesktop && styles.addButtonDesktop,
              members.length >= 6 && styles.addButtonDisabled,
            ]}
            onPress={() => setModalVisible(true)}
            disabled={members.length >= 6}
          >
            <Ionicons name="add" size={isDesktop ? 28 : 24} color="#fff" />
            {isDesktop && <Text style={styles.addButtonText}>Hinzufügen</Text>}
          </TouchableOpacity>
        </View>

        <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>
          {members.length}/6 Familienmitglieder
        </Text>

        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={renderMember}
          contentContainerStyle={[styles.listContent, isDesktop && styles.listContentDesktop]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3b82f6"
            />
          }
          ListEmptyComponent={
            <View style={[styles.emptyState, isDesktop && styles.emptyStateDesktop]}>
              <Ionicons name="people-outline" size={isDesktop ? 64 : 48} color="#64748b" />
              <Text style={[styles.emptyText, isDesktop && styles.emptyTextDesktop]}>
                Noch keine Familienmitglieder
              </Text>
              <Text style={[styles.emptySubtext, isDesktop && styles.emptySubtextDesktop]}>
                Füge Familienmitglieder hinzu, um deren Verträge zu verwalten
              </Text>
            </View>
          }
        />
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDesktop && styles.modalTitleDesktop]}>
                Neues Familienmitglied
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, isDesktop && styles.inputLabelDesktop]}>Name</Text>
            <TextInput
              style={[styles.input, isDesktop && styles.inputDesktop]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Name eingeben"
              placeholderTextColor="#64748b"
            />

            <Text style={[styles.inputLabel, isDesktop && styles.inputLabelDesktop]}>Beziehung</Text>
            <View style={[styles.relationshipOptions, isDesktop && styles.relationshipOptionsDesktop]}>
              {RELATIONSHIPS.map((rel) => (
                <TouchableOpacity
                  key={rel}
                  style={[
                    styles.relationshipChip,
                    isDesktop && styles.relationshipChipDesktop,
                    newRelationship === rel && styles.relationshipChipActive,
                  ]}
                  onPress={() => setNewRelationship(rel)}
                >
                  <Text
                    style={[
                      styles.relationshipChipText,
                      isDesktop && styles.relationshipChipTextDesktop,
                      newRelationship === rel && styles.relationshipChipTextActive,
                    ]}
                  >
                    {rel}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.saveButton,
                isDesktop && styles.saveButtonDesktop,
                saving && styles.saveButtonDisabled,
              ]}
              onPress={handleAddMember}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.saveButtonText, isDesktop && styles.saveButtonTextDesktop]}>
                  Hinzufügen
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerDesktop: {
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  titleDesktop: {
    fontSize: 32,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  subtitleDesktop: {
    fontSize: 16,
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: '#3b82f6',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  addButtonDesktop: {
    width: 'auto',
    paddingHorizontal: 24,
    height: 48,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  addButtonDisabled: {
    backgroundColor: '#475569',
  },
  listContent: {
    padding: 16,
  },
  listContentDesktop: {
    padding: 32,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  memberCardDesktop: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  memberIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1e3a5f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberIconDesktop: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  memberNameDesktop: {
    fontSize: 18,
  },
  memberRelationship: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
  },
  memberRelationshipDesktop: {
    fontSize: 16,
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateDesktop: {
    paddingVertical: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
  },
  emptyTextDesktop: {
    fontSize: 20,
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  emptySubtextDesktop: {
    fontSize: 16,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 440,
  },
  modalContentDesktop: {
    padding: 32,
    maxWidth: 500,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalTitleDesktop: {
    fontSize: 24,
  },
  inputLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  inputLabelDesktop: {
    fontSize: 16,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  inputDesktop: {
    padding: 18,
    fontSize: 17,
    marginBottom: 20,
  },
  relationshipOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  relationshipOptionsDesktop: {
    gap: 12,
    marginBottom: 32,
  },
  relationshipChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0f172a',
  },
  relationshipChipDesktop: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  relationshipChipActive: {
    backgroundColor: '#3b82f6',
  },
  relationshipChipText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  relationshipChipTextDesktop: {
    fontSize: 16,
  },
  relationshipChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonDesktop: {
    padding: 18,
    borderRadius: 14,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonTextDesktop: {
    fontSize: 18,
  },
});
