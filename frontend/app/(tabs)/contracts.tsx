import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Contract {
  id: string;
  name: string;
  provider: string;
  category: string;
  cost: number;
  cost_interval: string;
  family_member_id?: string;
}

interface FamilyMember {
  id: string;
  name: string;
}

const CATEGORIES = [
  'Alle',
  'Versicherungen',
  'Abonnements',
  'Telekommunikation',
  'Energie',
  'Sonstige',
];

const CATEGORY_COLORS: { [key: string]: string } = {
  'Versicherungen': '#10b981',
  'Abonnements': '#f59e0b',
  'Telekommunikation': '#8b5cf6',
  'Energie': '#ef4444',
  'Sonstige': '#6b7280',
};

export default function ContractsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(
    params.category ? String(params.category) : 'Alle'
  );
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      const [contractsRes, membersRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/contracts`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${BACKEND_URL}/api/family-members`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (contractsRes.ok) {
        const data = await contractsRes.json();
        setContracts(data);
      }

      if (membersRes.ok) {
        const data = await membersRes.json();
        setFamilyMembers(data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (token) {
        fetchData();
      }
    }, [token])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getMemberName = (memberId?: string) => {
    if (!memberId) return 'Ich';
    const member = familyMembers.find((m) => m.id === memberId);
    return member?.name || 'Unbekannt';
  };

  const filteredContracts = contracts.filter((c) => {
    const matchesCategory =
      selectedCategory === 'Alle' || c.category === selectedCategory;
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.provider.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const renderContract = ({ item }: { item: Contract }) => (
    <TouchableOpacity
      style={styles.contractCard}
      onPress={() => router.push(`/contract/${item.id}`)}
    >
      <View
        style={[
          styles.categoryIndicator,
          { backgroundColor: CATEGORY_COLORS[item.category] || '#6b7280' },
        ]}
      />
      <View style={styles.contractInfo}>
        <Text style={styles.contractName}>{item.name}</Text>
        <Text style={styles.contractProvider}>{item.provider}</Text>
        <View style={styles.contractMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={14} color="#64748b" />
            <Text style={styles.metaText}>{getMemberName(item.family_member_id)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="pricetag-outline" size={14} color="#64748b" />
            <Text style={styles.metaText}>{item.category}</Text>
          </View>
        </View>
      </View>
      <View style={styles.contractCost}>
        <Text style={styles.costValue}>{item.cost.toFixed(2)} €</Text>
        <Text style={styles.costInterval}>
          {item.cost_interval === 'monatlich' ? '/ Monat' :
           item.cost_interval === 'jährlich' ? '/ Jahr' : '/ Quartal'}
        </Text>
      </View>
    </TouchableOpacity>
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
      <View style={styles.header}>
        <Text style={styles.title}>Verträge</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/contract/new')}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Suchen..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#64748b" />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.categoryChip,
              selectedCategory === item && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(item)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === item && styles.categoryChipTextActive,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        )}
        style={styles.categoryFilter}
        contentContainerStyle={styles.categoryFilterContent}
        showsHorizontalScrollIndicator={false}
      />

      <FlatList
        data={filteredContracts}
        keyExtractor={(item) => item.id}
        renderItem={renderContract}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#64748b" />
            <Text style={styles.emptyText}>
              {searchQuery || selectedCategory !== 'Alle'
                ? 'Keine Verträge gefunden'
                : 'Noch keine Verträge vorhanden'}
            </Text>
            {!searchQuery && selectedCategory === 'Alle' && (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/contract/new')}
              >
                <Text style={styles.emptyButtonText}>Ersten Vertrag anlegen</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    backgroundColor: '#3b82f6',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: '#fff',
    fontSize: 16,
  },
  categoryFilter: {
    maxHeight: 44,
    marginBottom: 8,
  },
  categoryFilterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#3b82f6',
  },
  categoryChipText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  categoryChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  contractCard: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  categoryIndicator: {
    width: 4,
  },
  contractInfo: {
    flex: 1,
    padding: 16,
  },
  contractName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  contractProvider: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
  },
  contractMeta: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
  },
  contractCost: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 16,
  },
  costValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  costInterval: {
    fontSize: 12,
    color: '#64748b',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
