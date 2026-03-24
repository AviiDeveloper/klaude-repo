import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import { colors } from '../../src/theme/colors';

interface LeadDetail {
  id: string;
  business_name: string;
  business_type: string;
  postcode: string;
  address: string;
  phone: string;
  google_rating: number;
  google_review_count: number;
  status: string;
  has_demo_site: boolean;
  demo_site_domain?: string;
  opening_hours: string[];
  services: string[];
  trust_badges: string[];
  avoid_topics: string[];
}

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<LeadDetail>(`/leads/${id}`)
      .then(setLead)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.textMuted} />
      </View>
    );
  }

  if (!lead) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Lead not found</Text>
      </SafeAreaView>
    );
  }

  const statusColor = {
    new: colors.blue, visited: colors.yellow, pitched: colors.purple,
    sold: colors.green, rejected: colors.textMuted,
  }[lead.status] ?? colors.textMuted;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>← Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: '600', letterSpacing: -0.5 }}>
                {lead.business_name}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
                {lead.business_type} · {lead.postcode}
                {lead.google_rating > 0 ? ` · ★ ${lead.google_rating} (${lead.google_review_count})` : ''}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor }} />
              <Text style={{ color: statusColor, fontSize: 13, fontWeight: '500', textTransform: 'capitalize' }}>{lead.status}</Text>
            </View>
          </View>
        </View>

        {/* Divider sections */}
        <Section label="Hours">
          {(lead.opening_hours ?? []).map((h, i) => (
            <Text key={i} style={{ color: colors.text, fontSize: 14, marginBottom: 2 }}>{h}</Text>
          ))}
        </Section>

        <Section label="Services">
          <Text style={{ color: colors.text, fontSize: 14 }}>{(lead.services ?? []).join(' · ')}</Text>
        </Section>

        <Section label="Address">
          <Text style={{ color: colors.text, fontSize: 14 }}>{lead.address || lead.postcode}</Text>
        </Section>

        {lead.phone && (
          <Section label="Phone">
            <Text style={{ color: colors.blue, fontSize: 14 }}>{lead.phone}</Text>
          </Section>
        )}

        {/* Action buttons */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 8 }}>
          <TouchableOpacity
            onPress={() => api(`/leads/${id}/status`, { method: 'PATCH', body: { status: 'visited' }, offlineKey: `status-${id}` })}
            style={{ backgroundColor: colors.elevated, borderWidth: 0.5, borderColor: colors.border, borderRadius: 10, paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>Mark as Visited</Text>
          </TouchableOpacity>

          {lead.has_demo_site && (
            <TouchableOpacity
              onPress={() => router.push(`/lead/${id}/demo` as any)}
              style={{ backgroundColor: colors.elevated, borderWidth: 0.5, borderColor: colors.border, borderRadius: 10, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: colors.blue, fontSize: 14, fontWeight: '500' }}>Show Demo Site</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 0.5, borderTopColor: colors.borderSubtle }}>
      <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 6 }}>{label}</Text>
      {children}
    </View>
  );
}
