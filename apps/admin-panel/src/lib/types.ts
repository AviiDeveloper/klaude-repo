export type AdminRole = 'owner' | 'manager' | 'viewer';
export type AssignmentStatus = 'new' | 'visited' | 'pitched' | 'sold' | 'rejected';

export interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  area_postcode: string | null;
  area_postcodes_json: string | null;
  max_active_leads: number;
  user_status: string;
  commission_rate: number;
  active: boolean;
  last_active_at: string | null;
  created_at: string | null;
  // Computed
  active_leads: number;
  total_visits: number;
  total_pitches: number;
  total_sales: number;
  total_commission: number;
  conversion_rate: number;
}

export interface LeadRow {
  assignment_id: string;
  lead_id: string;
  business_name: string;
  business_type: string | null;
  postcode: string | null;
  phone: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  status: AssignmentStatus;
  assigned_to_name: string | null;
  assigned_to_id: string | null;
  assigned_at: string | null;
  demo_site_domain: string | null;
}

export interface TeamStats {
  total_salespeople: number;
  active_salespeople: number;
  total_leads: number;
  unassigned_leads: number;
  total_visits: number;
  total_pitches: number;
  total_sales: number;
  total_revenue: number;
  conversion_rate: number;
  visits_this_week: number;
  sales_this_week: number;
  revenue_this_week: number;
}

export interface ConversionFunnel {
  assigned: number;
  visited: number;
  pitched: number;
  sold: number;
  rejected: number;
}

export interface AreaBreakdown {
  postcode: string;
  lead_count: number;
  assigned_count: number;
  sold_count: number;
}

export interface Alert {
  type: 'warning' | 'info' | 'danger';
  message: string;
  action?: string;
  actionUrl?: string;
}

export interface AssignmentRule {
  id: string;
  rule_type: string;
  config_json: string;
  priority: number;
  enabled: boolean;
  created_at: string | null;
}
