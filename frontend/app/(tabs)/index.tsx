import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Statistics {
  total_contracts: number;
  total_monthly_cost: number;
  total_yearly_cost: number;
  by_category: {
    [key: string]: {
      count: number;
      monthly_cost: number;
    };
  };
}

interface Reminder {
  id: string;
  title: string;
  date: string;
  description?: string;
  contractName: string;
  contractId: string;
}

interface Contract {
  id: string;
  name: string;
  reminders: {
    id: string;
    title: string;
    date: string;
    description?: string;
  }[];
}

const CATEGORY_ICONS: { [key: string]: keyof typeof Ionicons.glyphMap } = {
  'Versicherungen': 'shield-checkmark',
  'Abonnements': 'tv',
  'Telekommunikation': 'phone-portrait',
  'Energie': 'flash',
  'Sonstige': 'ellipsis-horizontal-circle',
};

const CATEGORY_COLORS: { [key: string]: string } = {
  'Versicherungen': '#10b981',
  'Abonnements': '#f59e0b',
  'Telekommunikation': '#8b5cf6',
  'Energie': '#ef4444',
  'Sonstige': '#6b7280',
};

export default function DashboardScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dueReminders, setDueReminders] = useState<Reminder[]>([]);
  const [showRemindersModal, setShowRemindersModal] = useState(false);
  
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  // Parse German date format (DD.MM.YYYY) to Date
  const parseGermanDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    // Handle ISO format
    if (dateStr.includes('-')) {
      return new Date(dateStr);
    }
    // Handle German format
    const parts = dateStr.split('.');
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return null;
  };

  // Format date to German
  const formatDateGerman = (dateStr: string): string => {
    const date = parseGermanDate(dateStr);
    if (!date) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/statistics`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchReminders = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/contracts`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const contracts: Contract[] = await response.json();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get reminders due today or earlier, or in the next 7 days
        const upcoming: Reminder[] = [];
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        contracts.forEach((contract) => {
          if (contract.reminders && contract.reminders.length > 0) {
            contract.reminders.forEach((reminder) => {
              const reminderDate = parseGermanDate(reminder.date);
              if (reminderDate) {
                reminderDate.setHours(0, 0, 0, 0);
                if (reminderDate <= nextWeek) {
                  upcoming.push({
                    ...reminder,
                    contractName: contract.name,
                    contractId: contract.id,
                  });
                }
              }
            });
          }
        });
        
        // Sort by date
        upcoming.sort((a, b) => {
          const dateA = parseGermanDate(a.date);
          const dateB = parseGermanDate(b.date);
          return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
        });
        
        setDueReminders(upcoming);
        
        // Show modal if there are due reminders
        if (upcoming.length > 0) {
          setShowRemindersModal(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch reminders:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (token) {
        fetchStats();
        fetchReminders();
      }
    }, [token])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
    fetchReminders();
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

  const categories = stats?.by_category ? Object.entries(stats.by_category) : [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          isDesktop && styles.scrollContentDesktop,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
          />
        }
      >
        <View style={[styles.contentWrapper, { maxWidth: isDesktop ? 1200 : isTablet ? 800 : '100%' }]}>
          <View style={styles.header}>
            <Text style={[styles.greeting, isDesktop && styles.greetingDesktop]}>
              Hallo, {user?.username}!
            </Text>
            <Text style={[styles.title, isDesktop && styles.titleDesktop]}>
              Dein Vertragsüberblick
            </Text>
          </View>

          <View style={[
            styles.summaryCards,
            isDesktop && styles.summaryCardsDesktop,
          ]}>
            <View style={[
              styles.summaryCard,
              styles.primaryCard,
              isDesktop && styles.summaryCardDesktop,
            ]}>
              <Ionicons name="wallet" size={isDesktop ? 36 : 28} color="#fff" />
              <Text style={[styles.summaryLabel, isDesktop && styles.summaryLabelDesktop]}>
                Monatliche Kosten
              </Text>
              <Text style={[styles.summaryValue, isDesktop && styles.summaryValueDesktop]}>
                {stats?.total_monthly_cost.toFixed(2)} €
              </Text>
            </View>
            <View style={[
              styles.summaryCard,
              styles.secondaryCard,
              isDesktop && styles.summaryCardDesktop,
            ]}>
              <Ionicons name="calendar" size={isDesktop ? 36 : 28} color="#fff" />
              <Text style={[styles.summaryLabel, isDesktop && styles.summaryLabelDesktop]}>
                Jährliche Kosten
              </Text>
              <Text style={[styles.summaryValue, isDesktop && styles.summaryValueDesktop]}>
                {stats?.total_yearly_cost.toFixed(2)} €
              </Text>
            </View>
          </View>

          <View style={[styles.statsCard, isDesktop && styles.statsCardDesktop]}>
            <View style={styles.statsHeader}>
              <Text style={[styles.statsTitle, isDesktop && styles.statsTitleDesktop]}>
                Verträge gesamt
              </Text>
              <Text style={[styles.statsCount, isDesktop && styles.statsCountDesktop]}>
                {stats?.total_contracts || 0}
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>
            Nach Kategorie
          </Text>

          {categories.length > 0 ? (
            <View style={[
              styles.categoryGrid,
              isDesktop && styles.categoryGridDesktop,
            ]}>
              {categories.map(([category, data]) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryCard,
                    isDesktop && styles.categoryCardDesktop,
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/contracts',
                      params: { category },
                    })
                  }
                >
                  <View
                    style={[
                      styles.categoryIcon,
                      isDesktop && styles.categoryIconDesktop,
                      { backgroundColor: CATEGORY_COLORS[category] || '#6b7280' },
                    ]}
                  >
                    <Ionicons
                      name={CATEGORY_ICONS[category] || 'folder'}
                      size={isDesktop ? 28 : 24}
                      color="#fff"
                    />
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text style={[styles.categoryName, isDesktop && styles.categoryNameDesktop]}>
                      {category}
                    </Text>
                    <Text style={[styles.categoryCount, isDesktop && styles.categoryCountDesktop]}>
                      {data.count} {data.count === 1 ? 'Vertrag' : 'Verträge'}
                    </Text>
                  </View>
                  <View style={styles.categoryCost}>
                    <Text style={[styles.categoryCostValue, isDesktop && styles.categoryCostValueDesktop]}>
                      {data.monthly_cost.toFixed(2)} €
                    </Text>
                    <Text style={[styles.categoryCostLabel, isDesktop && styles.categoryCostLabelDesktop]}>
                      / Monat
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={[styles.emptyState, isDesktop && styles.emptyStateDesktop]}>
              <Ionicons name="document-text-outline" size={isDesktop ? 64 : 48} color="#64748b" />
              <Text style={[styles.emptyText, isDesktop && styles.emptyTextDesktop]}>
                Noch keine Verträge vorhanden
              </Text>
              <TouchableOpacity
                style={[styles.addButton, isDesktop && styles.addButtonDesktop]}
                onPress={() => router.push('/contract/new')}
              >
                <Text style={[styles.addButtonText, isDesktop && styles.addButtonTextDesktop]}>
                  Vertrag hinzufügen
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Reminders Modal */}
      <Modal
        visible={showRemindersModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRemindersModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrapper}>
                <Ionicons name="alarm" size={32} color="#f59e0b" />
              </View>
              <Text style={[styles.modalTitle, isDesktop && styles.modalTitleDesktop]}>
                Anstehende Erinnerungen
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowRemindersModal(false)}
              >
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.remindersList}>
              {dueReminders.map((reminder, index) => {
                const reminderDate = parseGermanDate(reminder.date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isPast = reminderDate && reminderDate < today;
                const isToday = reminderDate && reminderDate.getTime() === today.getTime();
                
                return (
                  <TouchableOpacity
                    key={`${reminder.contractId}-${index}`}
                    style={[
                      styles.reminderCard,
                      isPast && styles.reminderCardPast,
                      isToday && styles.reminderCardToday,
                    ]}
                    onPress={() => {
                      setShowRemindersModal(false);
                      router.push(`/contract/${reminder.contractId}`);
                    }}
                  >
                    <View style={styles.reminderDateBadge}>
                      <Text style={[
                        styles.reminderDateText,
                        isPast && styles.reminderDatePast,
                        isToday && styles.reminderDateToday,
                      ]}>
                        {formatDateGerman(reminder.date)}
                      </Text>
                      {isPast && <Text style={styles.reminderOverdue}>Überfällig</Text>}
                      {isToday && <Text style={styles.reminderTodayBadge}>Heute</Text>}
                    </View>
                    <Text style={styles.reminderTitle}>{reminder.title}</Text>
                    <Text style={styles.reminderContract}>{reminder.contractName}</Text>
                    {reminder.description && (
                      <Text style={styles.reminderDescription}>{reminder.description}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowRemindersModal(false)}
            >
              <Text style={styles.modalButtonText}>Verstanden</Text>
            </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  scrollContentDesktop: {
    alignItems: 'center',
    padding: 32,
  },
  contentWrapper: {
    width: '100%',
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 4,
  },
  greetingDesktop: {
    fontSize: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  titleDesktop: {
    fontSize: 32,
  },
  summaryCards: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryCardsDesktop: {
    gap: 24,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  summaryCardDesktop: {
    padding: 32,
    borderRadius: 20,
  },
  primaryCard: {
    backgroundColor: '#3b82f6',
  },
  secondaryCard: {
    backgroundColor: '#8b5cf6',
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
  },
  summaryLabelDesktop: {
    fontSize: 16,
    marginTop: 12,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  summaryValueDesktop: {
    fontSize: 32,
    marginTop: 8,
  },
  statsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  statsCardDesktop: {
    padding: 24,
    borderRadius: 20,
    marginBottom: 32,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsTitle: {
    fontSize: 16,
    color: '#94a3b8',
  },
  statsTitleDesktop: {
    fontSize: 20,
  },
  statsCount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  statsCountDesktop: {
    fontSize: 48,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  sectionTitleDesktop: {
    fontSize: 24,
    marginBottom: 20,
  },
  categoryGrid: {
    gap: 12,
  },
  categoryGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
  },
  categoryCardDesktop: {
    flex: 1,
    minWidth: 300,
    maxWidth: 'calc(50% - 8px)',
    padding: 20,
    borderRadius: 16,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryIconDesktop: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  categoryInfo: {
    flex: 1,
    marginLeft: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  categoryNameDesktop: {
    fontSize: 18,
  },
  categoryCount: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  categoryCountDesktop: {
    fontSize: 15,
  },
  categoryCost: {
    alignItems: 'flex-end',
  },
  categoryCostValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  categoryCostValueDesktop: {
    fontSize: 20,
  },
  categoryCostLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  categoryCostLabelDesktop: {
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateDesktop: {
    paddingVertical: 80,
    backgroundColor: '#1e293b',
    borderRadius: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
    marginBottom: 20,
  },
  emptyTextDesktop: {
    fontSize: 20,
    marginTop: 20,
    marginBottom: 28,
  },
  addButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonDesktop: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  addButtonTextDesktop: {
    fontSize: 18,
  },
  // Modal styles
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
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalContentDesktop: {
    maxWidth: 600,
    padding: 32,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  modalTitleDesktop: {
    fontSize: 24,
  },
  modalCloseBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: 8,
  },
  remindersList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  reminderCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  reminderCardPast: {
    borderLeftColor: '#ef4444',
  },
  reminderCardToday: {
    borderLeftColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  reminderDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  reminderDateText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  reminderDatePast: {
    color: '#ef4444',
  },
  reminderDateToday: {
    color: '#f59e0b',
  },
  reminderOverdue: {
    fontSize: 12,
    color: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reminderTodayBadge: {
    fontSize: 12,
    color: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  reminderContract: {
    fontSize: 14,
    color: '#94a3b8',
  },
  reminderDescription: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
  },
  modalButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
