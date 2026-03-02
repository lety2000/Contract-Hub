import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface FamilyMember {
  id: string;
  name: string;
}

interface Document {
  id?: string;
  name: string;
  content_base64: string;
  mime_type: string;
}

interface Reminder {
  id?: string;
  title: string;
  date: string;
  description?: string;
}

const CATEGORIES = [
  'Versicherungen',
  'Abonnements',
  'Telekommunikation',
  'Energie',
  'Sonstige',
];

const INTERVALS = [
  { value: 'monatlich', label: 'Monatlich' },
  { value: 'quartalsweise', label: 'Quartalweise' },
  { value: 'jährlich', label: 'Jährlich' },
];

export default function ContractFormScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const contractId = params.id as string;
  const isEditing = contractId && contractId !== 'new';

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');
  const [category, setCategory] = useState('Versicherungen');
  const [familyMemberId, setFamilyMemberId] = useState<string | null>(null);
  const [cost, setCost] = useState('');
  const [costInterval, setCostInterval] = useState('monatlich');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [cancellationPeriod, setCancellationPeriod] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    fetchFamilyMembers();
    if (isEditing) {
      fetchContract();
    }
  }, []);

  const fetchFamilyMembers = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/family-members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setFamilyMembers(data);
      }
    } catch (error) {
      console.error('Failed to fetch family members:', error);
    }
  };

  const fetchContract = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/contracts/${contractId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setName(data.name || '');
        setProvider(data.provider || '');
        setCategory(data.category || 'Versicherungen');
        setFamilyMemberId(data.family_member_id || null);
        setCost(data.cost?.toString() || '');
        setCostInterval(data.cost_interval || 'monatlich');
        setStartDate(data.start_date || '');
        setEndDate(data.end_date || '');
        setCancellationPeriod(data.cancellation_period || '');
        setContractNumber(data.contract_number || '');
        setContactPerson(data.contact_person || '');
        setContactPhone(data.contact_phone || '');
        setContactEmail(data.contact_email || '');
        setNotes(data.notes || '');
        setTags(data.tags?.join(', ') || '');
        setDocuments(data.documents || []);
        setReminders(data.reminders || []);
      }
    } catch (error) {
      console.error('Failed to fetch contract:', error);
      Alert.alert('Fehler', 'Vertrag konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        const content = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        setDocuments([...documents, {
          name: file.name,
          content_base64: content,
          mime_type: 'application/pdf',
        }]);
      }
    } catch (error) {
      Alert.alert('Fehler', 'Dokument konnte nicht geladen werden');
    }
  };

  const handleRemoveDocument = (index: number) => {
    const newDocs = [...documents];
    newDocs.splice(index, 1);
    setDocuments(newDocs);
  };

  const handleAddReminder = () => {
    const today = new Date().toISOString().split('T')[0];
    setReminders([...reminders, {
      title: 'Erinnerung',
      date: today,
      description: '',
    }]);
  };

  const handleRemoveReminder = (index: number) => {
    const newReminders = [...reminders];
    newReminders.splice(index, 1);
    setReminders(newReminders);
  };

  const updateReminder = (index: number, field: string, value: string) => {
    const newReminders = [...reminders];
    newReminders[index] = { ...newReminders[index], [field]: value };
    setReminders(newReminders);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Fehler', 'Bitte einen Namen eingeben');
      return;
    }
    if (!provider.trim()) {
      Alert.alert('Fehler', 'Bitte einen Anbieter eingeben');
      return;
    }
    if (!cost || isNaN(parseFloat(cost))) {
      Alert.alert('Fehler', 'Bitte gültige Kosten eingeben');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        provider: provider.trim(),
        category,
        family_member_id: familyMemberId,
        cost: parseFloat(cost),
        cost_interval: costInterval,
        start_date: startDate || null,
        end_date: endDate || null,
        cancellation_period: cancellationPeriod || null,
        contract_number: contractNumber || null,
        contact_person: contactPerson || null,
        contact_phone: contactPhone || null,
        contact_email: contactEmail || null,
        notes: notes || null,
        tags: tags.split(',').map((t) => t.trim()).filter((t) => t),
        documents: documents.map((d) => ({
          name: d.name,
          content_base64: d.content_base64,
          mime_type: d.mime_type,
        })),
        reminders: reminders.map((r) => ({
          title: r.title,
          date: r.date,
          description: r.description || null,
        })),
      };

      const url = isEditing
        ? `${BACKEND_URL}/api/contracts/${contractId}`
        : `${BACKEND_URL}/api/contracts`;

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Fehler beim Speichern');
      }

      router.back();
    } catch (error: any) {
      Alert.alert('Fehler', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Vertrag löschen',
      'Möchtest du diesen Vertrag wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(
                `${BACKEND_URL}/api/contracts/${contractId}`,
                {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${token}` },
                }
              );
              if (response.ok) {
                router.back();
              }
            } catch (error) {
              Alert.alert('Fehler', 'Konnte nicht gelöscht werden');
            }
          },
        },
      ]
    );
  };

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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditing ? 'Vertrag bearbeiten' : 'Neuer Vertrag'}
          </Text>
          {isEditing && (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={24} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Basic Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Grunddaten</Text>
            
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="z.B. KFZ-Versicherung"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.label}>Anbieter *</Text>
            <TextInput
              style={styles.input}
              value={provider}
              onChangeText={setProvider}
              placeholder="z.B. Allianz"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.label}>Kategorie</Text>
            <View style={styles.chipContainer}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.chip,
                    category === cat && styles.chipActive,
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      category === cat && styles.chipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Familienmitglied</Text>
            <View style={styles.chipContainer}>
              <TouchableOpacity
                style={[
                  styles.chip,
                  familyMemberId === null && styles.chipActive,
                ]}
                onPress={() => setFamilyMemberId(null)}
              >
                <Text
                  style={[
                    styles.chipText,
                    familyMemberId === null && styles.chipTextActive,
                  ]}
                >
                  Ich
                </Text>
              </TouchableOpacity>
              {familyMembers.map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={[
                    styles.chip,
                    familyMemberId === member.id && styles.chipActive,
                  ]}
                  onPress={() => setFamilyMemberId(member.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      familyMemberId === member.id && styles.chipTextActive,
                    ]}
                  >
                    {member.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Costs */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kosten</Text>
            
            <Text style={styles.label}>Betrag *</Text>
            <TextInput
              style={styles.input}
              value={cost}
              onChangeText={setCost}
              placeholder="0.00"
              placeholderTextColor="#64748b"
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Intervall</Text>
            <View style={styles.chipContainer}>
              {INTERVALS.map((int) => (
                <TouchableOpacity
                  key={int.value}
                  style={[
                    styles.chip,
                    costInterval === int.value && styles.chipActive,
                  ]}
                  onPress={() => setCostInterval(int.value)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      costInterval === int.value && styles.chipTextActive,
                    ]}
                  >
                    {int.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Contract Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vertragsdetails</Text>
            
            <Text style={styles.label}>Vertragsnummer</Text>
            <TextInput
              style={styles.input}
              value={contractNumber}
              onChangeText={setContractNumber}
              placeholder="z.B. VN-123456"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.label}>Startdatum (JJJJ-MM-TT)</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="2024-01-01"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.label}>Enddatum (JJJJ-MM-TT)</Text>
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="2025-01-01"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.label}>Kündigungsfrist</Text>
            <TextInput
              style={styles.input}
              value={cancellationPeriod}
              onChangeText={setCancellationPeriod}
              placeholder="z.B. 3 Monate zum Quartalsende"
              placeholderTextColor="#64748b"
            />
          </View>

          {/* Contact */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kontakt</Text>
            
            <Text style={styles.label}>Ansprechpartner</Text>
            <TextInput
              style={styles.input}
              value={contactPerson}
              onChangeText={setContactPerson}
              placeholder="Name"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.label}>Telefon</Text>
            <TextInput
              style={styles.input}
              value={contactPhone}
              onChangeText={setContactPhone}
              placeholder="+49 123 456789"
              placeholderTextColor="#64748b"
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>E-Mail</Text>
            <TextInput
              style={styles.input}
              value={contactEmail}
              onChangeText={setContactEmail}
              placeholder="kontakt@firma.de"
              placeholderTextColor="#64748b"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Notes & Tags */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notizen & Tags</Text>
            
            <Text style={styles.label}>Notizen</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Zusätzliche Informationen..."
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>Tags (kommagetrennt)</Text>
            <TextInput
              style={styles.input}
              value={tags}
              onChangeText={setTags}
              placeholder="wichtig, auto, familie"
              placeholderTextColor="#64748b"
            />
          </View>

          {/* Documents */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Dokumente</Text>
              <TouchableOpacity
                style={styles.addSmallBtn}
                onPress={handlePickDocument}
              >
                <Ionicons name="add" size={20} color="#3b82f6" />
                <Text style={styles.addSmallBtnText}>PDF hinzufügen</Text>
              </TouchableOpacity>
            </View>
            
            {documents.map((doc, index) => (
              <View key={index} style={styles.documentItem}>
                <Ionicons name="document" size={24} color="#ef4444" />
                <Text style={styles.documentName} numberOfLines={1}>
                  {doc.name}
                </Text>
                <TouchableOpacity onPress={() => handleRemoveDocument(index)}>
                  <Ionicons name="close-circle" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
            ))}
            
            {documents.length === 0 && (
              <Text style={styles.emptyText}>Keine Dokumente</Text>
            )}
          </View>

          {/* Reminders */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Erinnerungen</Text>
              <TouchableOpacity
                style={styles.addSmallBtn}
                onPress={handleAddReminder}
              >
                <Ionicons name="add" size={20} color="#3b82f6" />
                <Text style={styles.addSmallBtnText}>Hinzufügen</Text>
              </TouchableOpacity>
            </View>
            
            {reminders.map((reminder, index) => (
              <View key={index} style={styles.reminderItem}>
                <View style={styles.reminderHeader}>
                  <Ionicons name="alarm" size={20} color="#f59e0b" />
                  <TouchableOpacity onPress={() => handleRemoveReminder(index)}>
                    <Ionicons name="close-circle" size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.reminderInput}
                  value={reminder.title}
                  onChangeText={(v) => updateReminder(index, 'title', v)}
                  placeholder="Titel"
                  placeholderTextColor="#64748b"
                />
                <TextInput
                  style={styles.reminderInput}
                  value={reminder.date}
                  onChangeText={(v) => updateReminder(index, 'date', v)}
                  placeholder="Datum (JJJJ-MM-TT)"
                  placeholderTextColor="#64748b"
                />
                <TextInput
                  style={styles.reminderInput}
                  value={reminder.description || ''}
                  onChangeText={(v) => updateReminder(index, 'description', v)}
                  placeholder="Beschreibung (optional)"
                  placeholderTextColor="#64748b"
                />
              </View>
            ))}
            
            {reminders.length === 0 && (
              <Text style={styles.emptyText}>Keine Erinnerungen</Text>
            )}
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Speichern</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  deleteBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e293b',
  },
  chipActive: {
    backgroundColor: '#3b82f6',
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  addSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addSmallBtnText: {
    color: '#3b82f6',
    fontSize: 14,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  documentName: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  reminderItem: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reminderInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  bottomPadding: {
    height: 100,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
