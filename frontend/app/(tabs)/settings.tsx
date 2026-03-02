import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function SettingsScreen() {
  const { user, token, logout } = useAuth();
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  const handleExport = async (format: 'pdf' | 'excel') => {
    setExporting(format);
    try {
      const endpoint = format === 'pdf' ? '/api/export/pdf' : '/api/export/excel';
      const filename = format === 'pdf' ? 'vertraege.pdf' : 'vertraege.xlsx';
      
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Export fehlgeschlagen');
      }

      const blob = await response.blob();
      
      // Convert blob to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const base64 = base64data.split(',')[1];
        
        const fileUri = FileSystem.documentDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert('Erfolg', 'Datei wurde exportiert');
        }
      };
      reader.readAsDataURL(blob);
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Export fehlgeschlagen');
    } finally {
      setExporting(null);
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
                disabled={exporting !== null}
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
                  <Ionicons name="chevron-forward" size={20} color="#64748b" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, isDesktop && styles.menuItemDesktop]}
                onPress={() => handleExport('excel')}
                disabled={exporting !== null}
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
                  <Ionicons name="chevron-forward" size={20} color="#64748b" />
                )}
              </TouchableOpacity>
            </View>
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
});
