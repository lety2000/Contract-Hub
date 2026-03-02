import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function SettingsScreen() {
  const { user, token, logout } = useAuth();
  const router = useRouter();
  const [exporting, setExporting] = useState<'pdf' | 'excel' | 'backup' | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  const isWeb = Platform.OS === 'web';

  // Web-specific download function
  const downloadFileWeb = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
    setExporting(format);
    try {
      const endpoint = format === 'pdf' ? '/api/export/pdf' : '/api/export/excel';
      const filename = format === 'pdf' ? 'vertraege.pdf' : 'vertraege.xlsx';
      const mimeType = format === 'pdf' 
        ? 'application/pdf' 
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Export fehlgeschlagen');
      }

      const blob = await response.blob();
      
      if (isWeb) {
        // Web: Direct download
        downloadFileWeb(blob, filename);
        Alert.alert('Erfolg', `${filename} wurde heruntergeladen`);
      } else {
        // Native: Use FileSystem and Sharing
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64data = reader.result as string;
            const base64 = base64data.split(',')[1];
            
            const fileUri = FileSystem.documentDirectory + filename;
            await FileSystem.writeAsStringAsync(fileUri, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(fileUri, { mimeType });
            } else {
              Alert.alert('Erfolg', 'Datei wurde exportiert');
            }
          } catch (e) {
            Alert.alert('Fehler', 'Datei konnte nicht gespeichert werden');
          }
        };
        reader.readAsDataURL(blob);
      }
    } catch (error: any) {
      console.error('Export error:', error);
      Alert.alert('Fehler', error.message || 'Export fehlgeschlagen');
    } finally {
      setExporting(null);
    }
  };

  const handleBackupExport = async () => {
    setExporting('backup');
    try {
      const response = await fetch(`${BACKEND_URL}/api/backup/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Backup-Export fehlgeschlagen');
      }

      const blob = await response.blob();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `vertragsmanager_backup_${timestamp}.json`;
      
      if (isWeb) {
        downloadFileWeb(blob, filename);
        Alert.alert('Erfolg', 'Backup wurde heruntergeladen');
      } else {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64data = reader.result as string;
            const base64 = base64data.split(',')[1];
            
            const fileUri = FileSystem.documentDirectory + filename;
            await FileSystem.writeAsStringAsync(fileUri, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(fileUri, { mimeType: 'application/json' });
            } else {
              Alert.alert('Erfolg', 'Backup wurde erstellt');
            }
          } catch (e) {
            Alert.alert('Fehler', 'Backup konnte nicht gespeichert werden');
          }
        };
        reader.readAsDataURL(blob);
      }
    } catch (error: any) {
      console.error('Backup export error:', error);
      Alert.alert('Fehler', error.message || 'Backup-Export fehlgeschlagen');
    } finally {
      setExporting(null);
    }
  };

  const handleBackupRestore = async () => {
    setRestoreModalVisible(false);
    
    try {
      if (isWeb) {
        // Web: Use file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        
        input.onchange = async (e: any) => {
          const file = e.target.files[0];
          if (!file) return;
          
          setRestoring(true);
          try {
            const text = await file.text();
            const backupData = JSON.parse(text);
            
            const response = await fetch(`${BACKEND_URL}/api/backup/restore`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(backupData),
            });

            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.detail || 'Wiederherstellung fehlgeschlagen');
            }

            const result = await response.json();
            Alert.alert(
              'Erfolg',
              `Backup wiederhergestellt:\n${result.restored_family_members} Familienmitglieder\n${result.restored_contracts} Verträge`
            );
          } catch (error: any) {
            Alert.alert('Fehler', error.message || 'Wiederherstellung fehlgeschlagen');
          } finally {
            setRestoring(false);
          }
        };
        
        input.click();
      } else {
        // Native: Use DocumentPicker
        setRestoring(true);
        const result = await DocumentPicker.getDocumentAsync({
          type: 'application/json',
          copyToCacheDirectory: true,
        });

        if (!result.canceled && result.assets[0]) {
          const file = result.assets[0];
          const content = await FileSystem.readAsStringAsync(file.uri);
          const backupData = JSON.parse(content);
          
          const response = await fetch(`${BACKEND_URL}/api/backup/restore`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(backupData),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Wiederherstellung fehlgeschlagen');
          }

          const restoreResult = await response.json();
          Alert.alert(
            'Erfolg',
            `Backup wiederhergestellt:\n${restoreResult.restored_family_members} Familienmitglieder\n${restoreResult.restored_contracts} Verträge`
          );
        }
      }
    } catch (error: any) {
      console.error('Restore error:', error);
      Alert.alert('Fehler', error.message || 'Wiederherstellung fehlgeschlagen');
    } finally {
      setRestoring(false);
    }
  };

  const confirmRestore = () => {
    setRestoreModalVisible(true);
  };

  const handleSendReminderEmail = async () => {
    setSendingEmail(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/reminders/send-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (response.ok) {
        if (data.sent) {
          Alert.alert('Erfolg', data.message);
        } else {
          Alert.alert('Info', data.message);
        }
      } else {
        throw new Error(data.detail || 'Fehler beim Senden');
      }
    } catch (error: any) {
      Alert.alert('Fehler', error.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleTestEmail = async () => {
    setSendingEmail(true);
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
      setSendingEmail(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Abmelden',
      'Möchtest du dich wirklich abmelden?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Abmelden',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={[
          styles.content,
          isDesktop && styles.contentDesktop,
        ]}
      >
        <View style={[styles.contentWrapper, { maxWidth: isDesktop ? 800 : isTablet ? 600 : '100%' }]}>
          <Text style={[styles.title, isDesktop && styles.titleDesktop]}>Einstellungen</Text>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>Profil</Text>
            <View style={[styles.profileCard, isDesktop && styles.profileCardDesktop]}>
              <View style={[styles.profileAvatar, isDesktop && styles.profileAvatarDesktop]}>
                <Ionicons name="person" size={isDesktop ? 40 : 32} color="#3b82f6" />
              </View>
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, isDesktop && styles.profileNameDesktop]}>
                  {user?.username}
                </Text>
                {user?.email && (
                  <Text style={[styles.profileEmail, isDesktop && styles.profileEmailDesktop]}>
                    {user.email}
                  </Text>
                )}
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>Export</Text>
            
            <View style={[styles.exportGrid, isDesktop && styles.exportGridDesktop]}>
              <TouchableOpacity
                style={[styles.menuItem, isDesktop && styles.menuItemDesktop]}
                onPress={() => handleExport('pdf')}
                disabled={exporting !== null || restoring}
              >
                <View style={[styles.menuIcon, styles.pdfIcon, isDesktop && styles.menuIconDesktop]}>
                  <Ionicons name="document" size={isDesktop ? 24 : 20} color="#fff" />
                </View>
                <View style={styles.menuContent}>
                  <Text style={[styles.menuTitle, isDesktop && styles.menuTitleDesktop]}>
                    Als PDF exportieren
                  </Text>
                  <Text style={[styles.menuSubtitle, isDesktop && styles.menuSubtitleDesktop]}>
                    Übersicht aller Verträge
                  </Text>
                </View>
                {exporting === 'pdf' ? (
                  <ActivityIndicator size="small" color="#3b82f6" />
                ) : (
                  <Ionicons name="download-outline" size={20} color="#64748b" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, isDesktop && styles.menuItemDesktop]}
                onPress={() => handleExport('excel')}
                disabled={exporting !== null || restoring}
              >
                <View style={[styles.menuIcon, styles.excelIcon, isDesktop && styles.menuIconDesktop]}>
                  <Ionicons name="grid" size={isDesktop ? 24 : 20} color="#fff" />
                </View>
                <View style={styles.menuContent}>
                  <Text style={[styles.menuTitle, isDesktop && styles.menuTitleDesktop]}>
                    Als Excel exportieren
                  </Text>
                  <Text style={[styles.menuSubtitle, isDesktop && styles.menuSubtitleDesktop]}>
                    Detaillierte Tabelle
                  </Text>
                </View>
                {exporting === 'excel' ? (
                  <ActivityIndicator size="small" color="#3b82f6" />
                ) : (
                  <Ionicons name="download-outline" size={20} color="#64748b" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>
              Datensicherung
            </Text>
            
            <TouchableOpacity
              style={[styles.menuItem, isDesktop && styles.menuItemDesktop]}
              onPress={handleBackupExport}
              disabled={exporting !== null || restoring}
            >
              <View style={[styles.menuIcon, styles.backupIcon, isDesktop && styles.menuIconDesktop]}>
                <Ionicons name="cloud-download" size={isDesktop ? 24 : 20} color="#fff" />
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuTitle, isDesktop && styles.menuTitleDesktop]}>
                  Backup erstellen
                </Text>
                <Text style={[styles.menuSubtitle, isDesktop && styles.menuSubtitleDesktop]}>
                  Alle Daten als JSON exportieren
                </Text>
              </View>
              {exporting === 'backup' ? (
                <ActivityIndicator size="small" color="#3b82f6" />
              ) : (
                <Ionicons name="download-outline" size={20} color="#64748b" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, isDesktop && styles.menuItemDesktop]}
              onPress={confirmRestore}
              disabled={exporting !== null || restoring}
            >
              <View style={[styles.menuIcon, styles.restoreIcon, isDesktop && styles.menuIconDesktop]}>
                <Ionicons name="cloud-upload" size={isDesktop ? 24 : 20} color="#fff" />
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuTitle, isDesktop && styles.menuTitleDesktop]}>
                  Backup wiederherstellen
                </Text>
                <Text style={[styles.menuSubtitle, isDesktop && styles.menuSubtitleDesktop]}>
                  Daten aus JSON-Backup laden
                </Text>
              </View>
              {restoring ? (
                <ActivityIndicator size="small" color="#3b82f6" />
              ) : (
                <Ionicons name="push-outline" size={20} color="#64748b" />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>
              E-Mail Erinnerungen
            </Text>
            
            <TouchableOpacity
              style={[styles.menuItem, isDesktop && styles.menuItemDesktop]}
              onPress={handleSendReminderEmail}
              disabled={sendingEmail}
            >
              <View style={[styles.menuIcon, styles.emailIcon, isDesktop && styles.menuIconDesktop]}>
                <Ionicons name="mail" size={isDesktop ? 24 : 20} color="#fff" />
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuTitle, isDesktop && styles.menuTitleDesktop]}>
                  Erinnerungen jetzt senden
                </Text>
                <Text style={[styles.menuSubtitle, isDesktop && styles.menuSubtitleDesktop]}>
                  Sende E-Mail mit anstehenden Erinnerungen
                </Text>
              </View>
              {sendingEmail ? (
                <ActivityIndicator size="small" color="#3b82f6" />
              ) : (
                <Ionicons name="send-outline" size={20} color="#64748b" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, isDesktop && styles.menuItemDesktop]}
              onPress={handleTestEmail}
              disabled={sendingEmail}
            >
              <View style={[styles.menuIcon, styles.testEmailIcon, isDesktop && styles.menuIconDesktop]}>
                <Ionicons name="checkmark-circle" size={isDesktop ? 24 : 20} color="#fff" />
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuTitle, isDesktop && styles.menuTitleDesktop]}>
                  Test-E-Mail senden
                </Text>
                <Text style={[styles.menuSubtitle, isDesktop && styles.menuSubtitleDesktop]}>
                  Prüfe ob E-Mails ankommen
                </Text>
              </View>
              {sendingEmail ? (
                <ActivityIndicator size="small" color="#3b82f6" />
              ) : (
                <Ionicons name="flask-outline" size={20} color="#64748b" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, isDesktop && styles.menuItemDesktop]}
              onPress={() => router.push('/email-settings')}
              disabled={sendingEmail}
            >
              <View style={[styles.menuIcon, styles.settingsIcon, isDesktop && styles.menuIconDesktop]}>
                <Ionicons name="settings" size={isDesktop ? 24 : 20} color="#fff" />
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuTitle, isDesktop && styles.menuTitleDesktop]}>
                  SMTP-Einstellungen
                </Text>
                <Text style={[styles.menuSubtitle, isDesktop && styles.menuSubtitleDesktop]}>
                  E-Mail-Server konfigurieren
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>Konto</Text>
            
            <TouchableOpacity 
              style={[styles.menuItem, isDesktop && styles.menuItemDesktop]} 
              onPress={handleLogout}
            >
              <View style={[styles.menuIcon, styles.logoutIcon, isDesktop && styles.menuIconDesktop]}>
                <Ionicons name="log-out" size={isDesktop ? 24 : 20} color="#fff" />
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuTitle, isDesktop && styles.menuTitleDesktop]}>Abmelden</Text>
                <Text style={[styles.menuSubtitle, isDesktop && styles.menuSubtitleDesktop]}>
                  Von diesem Gerät abmelden
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={[styles.footer, isDesktop && styles.footerDesktop]}>
            <Text style={[styles.footerText, isDesktop && styles.footerTextDesktop]}>
              Vertragsmanager v1.0.0
            </Text>
            <Text style={[styles.footerSubtext, isDesktop && styles.footerSubtextDesktop]}>
              Alle Verträge im Überblick
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Restore Confirmation Modal */}
      <Modal
        visible={restoreModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRestoreModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}>
            <View style={styles.modalIcon}>
              <Ionicons name="warning" size={48} color="#f59e0b" />
            </View>
            <Text style={[styles.modalTitle, isDesktop && styles.modalTitleDesktop]}>
              Backup wiederherstellen?
            </Text>
            <Text style={[styles.modalText, isDesktop && styles.modalTextDesktop]}>
              Achtung: Alle aktuellen Daten (Verträge und Familienmitglieder) werden durch die Daten aus dem Backup ersetzt!
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setRestoreModalVisible(false)}
              >
                <Text style={styles.modalButtonCancelText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleBackupRestore}
              >
                <Text style={styles.modalButtonConfirmText}>Wiederherstellen</Text>
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
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 16,
  },
  contentDesktop: {
    alignItems: 'center',
    padding: 32,
  },
  contentWrapper: {
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
  },
  titleDesktop: {
    fontSize: 32,
    marginBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionTitleDesktop: {
    fontSize: 16,
    marginBottom: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
  },
  profileCardDesktop: {
    padding: 24,
    borderRadius: 16,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1e3a5f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarDesktop: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  profileInfo: {
    marginLeft: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  profileNameDesktop: {
    fontSize: 22,
  },
  profileEmail: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
  },
  profileEmailDesktop: {
    fontSize: 16,
    marginTop: 4,
  },
  exportGrid: {
    gap: 8,
  },
  exportGridDesktop: {
    flexDirection: 'row',
    gap: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  menuItemDesktop: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    marginBottom: 0,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIconDesktop: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  pdfIcon: {
    backgroundColor: '#ef4444',
  },
  excelIcon: {
    backgroundColor: '#10b981',
  },
  backupIcon: {
    backgroundColor: '#3b82f6',
  },
  restoreIcon: {
    backgroundColor: '#8b5cf6',
  },
  emailIcon: {
    backgroundColor: '#f59e0b',
  },
  testEmailIcon: {
    backgroundColor: '#10b981',
  },
  settingsIcon: {
    backgroundColor: '#6366f1',
  },
  logoutIcon: {
    backgroundColor: '#64748b',
  },
  menuContent: {
    flex: 1,
    marginLeft: 12,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  menuTitleDesktop: {
    fontSize: 18,
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  menuSubtitleDesktop: {
    fontSize: 15,
    marginTop: 4,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerDesktop: {
    paddingVertical: 40,
  },
  footerText: {
    fontSize: 14,
    color: '#64748b',
  },
  footerTextDesktop: {
    fontSize: 16,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
  },
  footerSubtextDesktop: {
    fontSize: 14,
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
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalContentDesktop: {
    padding: 32,
    maxWidth: 480,
  },
  modalIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalTitleDesktop: {
    fontSize: 24,
  },
  modalText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalTextDesktop: {
    fontSize: 16,
    lineHeight: 26,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#334155',
  },
  modalButtonConfirm: {
    backgroundColor: '#3b82f6',
  },
  modalButtonCancelText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  modalButtonConfirmText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
