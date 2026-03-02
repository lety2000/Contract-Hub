import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function EmailSettingsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFromEmail, setSmtpFromEmail] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('Vertragsmanager');
  const [passwordSet, setPasswordSet] = useState(false);

  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/settings/smtp`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSmtpHost(data.smtp_host || 'smtp.gmail.com');
        setSmtpPort(String(data.smtp_port || 587));
        setSmtpUser(data.smtp_user || '');
        setSmtpFromEmail(data.smtp_from_email || '');
        setSmtpFromName(data.smtp_from_name || 'Vertragsmanager');
        setPasswordSet(data.smtp_password_set || false);
      }
    } catch (error) {
      console.error('Failed to fetch SMTP settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!smtpUser) {
      Alert.alert('Fehler', 'Bitte eine E-Mail-Adresse eingeben');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        smtp_host: smtpHost,
        smtp_port: parseInt(smtpPort, 10) || 587,
        smtp_user: smtpUser,
        smtp_from_email: smtpFromEmail || smtpUser,
        smtp_from_name: smtpFromName,
      };

      // Only include password if changed
      if (smtpPassword) {
        payload.smtp_password = smtpPassword;
      }

      const response = await fetch(`${BACKEND_URL}/api/settings/smtp`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Speichern fehlgeschlagen');
      }

      Alert.alert('Erfolg', 'SMTP-Einstellungen gespeichert');
      setSmtpPassword('');
      setPasswordSet(true);
    } catch (error: any) {
      Alert.alert('Fehler', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setTesting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/reminders/test-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Erfolg', data.message);
      } else {
        throw new Error(data.detail || 'Test fehlgeschlagen');
      }
    } catch (error: any) {
      Alert.alert('Fehler', error.message);
    } finally {
      setTesting(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Einstellungen zurücksetzen',
      'Möchtest du die SMTP-Einstellungen auf die Standardwerte zurücksetzen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Zurücksetzen',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${BACKEND_URL}/api/settings/smtp`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              fetchSettings();
              Alert.alert('Erfolg', 'Einstellungen zurückgesetzt');
            } catch (error) {
              Alert.alert('Fehler', 'Zurücksetzen fehlgeschlagen');
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
          <Text style={styles.headerTitle}>E-Mail Einstellungen</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            isDesktop && styles.scrollContentDesktop,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.formWrapper, { maxWidth: isDesktop ? 600 : '100%' }]}>
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={24} color="#3b82f6" />
              <Text style={styles.infoText}>
                Hier kannst du deine SMTP-Einstellungen konfigurieren, um E-Mail-Erinnerungen zu erhalten.
                Für Gmail wird ein App-Passwort benötigt.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SMTP-Server</Text>

              <Text style={styles.label}>SMTP Host</Text>
              <TextInput
                style={styles.input}
                value={smtpHost}
                onChangeText={setSmtpHost}
                placeholder="smtp.gmail.com"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
              />

              <Text style={styles.label}>SMTP Port</Text>
              <TextInput
                style={styles.input}
                value={smtpPort}
                onChangeText={setSmtpPort}
                placeholder="587"
                placeholderTextColor="#64748b"
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Anmeldedaten</Text>

              <Text style={styles.label}>E-Mail-Adresse (Benutzer)</Text>
              <TextInput
                style={styles.input}
                value={smtpUser}
                onChangeText={setSmtpUser}
                placeholder="deine.email@gmail.com"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.label}>
                Passwort / App-Passwort
                {passwordSet && <Text style={styles.passwordSetBadge}> (gespeichert)</Text>}
              </Text>
              <TextInput
                style={styles.input}
                value={smtpPassword}
                onChangeText={setSmtpPassword}
                placeholder={passwordSet ? '••••••••••••••••' : 'App-Passwort eingeben'}
                placeholderTextColor="#64748b"
                secureTextEntry
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Absender</Text>

              <Text style={styles.label}>Absender-E-Mail (optional)</Text>
              <TextInput
                style={styles.input}
                value={smtpFromEmail}
                onChangeText={setSmtpFromEmail}
                placeholder="Falls anders als Benutzer"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.label}>Absender-Name</Text>
              <TextInput
                style={styles.input}
                value={smtpFromName}
                onChangeText={setSmtpFromName}
                placeholder="Vertragsmanager"
                placeholderTextColor="#64748b"
              />
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={saving || testing}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="save" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Speichern</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.testButton, testing && styles.buttonDisabled]}
                onPress={handleTestEmail}
                disabled={saving || testing}
              >
                {testing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="mail" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Test-E-Mail senden</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleReset}
                disabled={saving || testing}
              >
                <Ionicons name="refresh" size={20} color="#ef4444" />
                <Text style={styles.resetButtonText}>Zurücksetzen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  scrollContentDesktop: {
    alignItems: 'center',
    padding: 32,
  },
  formWrapper: {
    width: '100%',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#1e3a5f',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  passwordSetBadge: {
    color: '#10b981',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  buttonContainer: {
    gap: 12,
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 16,
  },
  testButton: {
    backgroundColor: '#8b5cf6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 16,
  },
  resetButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resetButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
});
