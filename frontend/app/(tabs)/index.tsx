import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>Hallo, {user?.username}!</Text>
          <Text style={styles.title}>Dein Vertragsüberblick</Text>
        </View>

        <View style={styles.summaryCards}>
          <View style={[styles.summaryCard, styles.primaryCard]}>
            <Ionicons name="wallet" size={28} color="#fff" />
            <Text style={styles.summaryLabel}>Monatliche Kosten</Text>
            <Text style={styles.summaryValue}>
              {stats?.total_monthly_cost.toFixed(2)} €
            </Text>
          </View>
          <View style={[styles.summaryCard, styles.secondaryCard]}>
            <Ionicons name="calendar" size={28} color="#fff" />
            <Text style={styles.summaryLabel}>Jährliche Kosten</Text>
            <Text style={styles.summaryValue}>
              {stats?.total_yearly_cost.toFixed(2)} €
            </Text>
          </View>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>Verträge gesamt</Text>
            <Text style={styles.statsCount}>{stats?.total_contracts || 0}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Nach Kategorie</Text>

        {stats?.by_category && Object.keys(stats.by_category).length > 0 ? (
          Object.entries(stats.by_category).map(([category, data]) => (
            <TouchableOpacity
              key={category}
              style={styles.categoryCard}
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
                  { backgroundColor: CATEGORY_COLORS[category] || '#6b7280' },
                ]}
              >
                <Ionicons
                  name={CATEGORY_ICONS[category] || 'folder'}
                  size={24}
                  color="#fff"
                />
              </View>
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryName}>{category}</Text>
                <Text style={styles.categoryCount}>
                  {data.count} {data.count === 1 ? 'Vertrag' : 'Verträge'}
                </Text>
              </View>
              <View style={styles.categoryCost}>
                <Text style={styles.categoryCostValue}>
                  {data.monthly_cost.toFixed(2)} €
                </Text>
                <Text style={styles.categoryCostLabel}>/ Monat</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#64748b" />
            <Text style={styles.emptyText}>Noch keine Verträge vorhanden</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push('/contract/new')}
            >
              <Text style={styles.addButtonText}>Vertrag hinzufügen</Text>
            </TouchableOpacity>
          </View>
        )}
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
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryCards: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
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
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  statsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
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
  statsCount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
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
  categoryCount: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  categoryCost: {
    alignItems: 'flex-end',
  },
  categoryCostValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  categoryCostLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
