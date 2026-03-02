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
  
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

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

  useFocusEffect(
    useCallback(() => {
      if (token) {
        fetchStats();
      }
    }, [token])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
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
});
