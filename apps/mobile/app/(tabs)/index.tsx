import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import { useAuth } from '../../src/store/auth';
import { colors } from '../../src/theme/colors';

interface Lead {
  id: string;
  business_name: string;
  business_type: string;
  postcode: string;
  google_rating: number;
  google_review_count: number;
  status: string;
  has_demo_site: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  new: colors.blue,
  visited: colors.yellow,
  pitched: colors.purple,
  sold: colors.green,
  rejected: colors.textMuted,
};

export default function LeadsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [leadsData, statsData] = await Promise.all([
        api<{ leads: Lead[]; count: number }>('/leads'),
        api<Record<string, number>>('/leads/stats/summary'),
      ]);
      setLeads(leadsData.leads ?? []);
      setStats(statsData);
    } catch { /* */ }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const renderLead = ({ item }: { item: Lead }) => (
    <TouchableOpacity
      onPress={() => router.push(`/lead/${item.id}`)}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      {/* Initial */}
      <View style={{
        width: 36, height: 36, borderRadius: 8, backgroundColor: colors.hover,
        justifyContent: 'center', alignItems: 'center', marginRight: 12,
      }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
          {item.business_name.charAt(0)}
        </Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>{item.business_name}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
          {item.business_type} · {item.postcode}
        </Text>
      </View>

      {/* Rating + status */}
      <View style={{ alignItems: 'flex-end' }}>
        {item.google_rating > 0 && (
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: 'Menlo' }}>
            {item.google_rating}
          </Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
          <View style={{
            width: 5, height: 5, borderRadius: 3,
            backgroundColor: STATUS_COLORS[item.status] ?? colors.textMuted,
            marginRight: 5,
          }} />
          <Text style={{ color: colors.textMuted, fontSize: 11, textTransform: 'capitalize' }}>
            {item.status}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '600', letterSpacing: -0.5 }}>
          Leads
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
          {leads.length} assigned · £{(stats.earned ?? 0)} earned
        </Text>
      </View>

      {/* Stats row */}
      <View style={{
        flexDirection: 'row',
        marginHorizontal: 20,
        borderWidth: 0.5,
        borderColor: colors.border,
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 12,
      }}>
        {[
          { label: 'Queue', value: stats.queue ?? 0 },
          { label: 'Visited', value: stats.visited ?? 0 },
          { label: 'Pitched', value: stats.pitched ?? 0 },
          { label: 'Sold', value: stats.sold ?? 0, color: colors.green },
        ].map((s, i) => (
          <View key={s.label} style={{
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 10,
            backgroundColor: colors.surface,
            borderLeftWidth: i > 0 ? 0.5 : 0,
            borderLeftColor: colors.border,
          }}>
            <Text style={{ color: s.color ?? colors.text, fontSize: 18, fontWeight: '600', fontFamily: 'Menlo' }}>
              {s.value}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Lead list */}
      <FlatList
        data={leads}
        keyExtractor={item => item.id}
        renderItem={renderLead}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>No leads yet.</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>Pull down to refresh.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
