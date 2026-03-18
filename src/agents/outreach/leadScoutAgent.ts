import { AgentHandler } from "../../pipeline/agentRuntime.js";

export interface LeadScoutConfig {
  campaign_id: string;
  vertical: string;
  location: string;
  max_results?: number;
  sources?: string[];
}

export const leadScoutAgent: AgentHandler = async (input) => {
  const config = (input.config ?? {}) as Partial<LeadScoutConfig>;
  const vertical = config.vertical ?? "general";
  const location = config.location ?? "unknown";
  const maxResults = config.max_results ?? 50;
  const campaignId = config.campaign_id ?? input.run_id;

  const leads: Array<Record<string, unknown>> = [];
  const errors: string[] = [];

  // Google Places API integration
  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (googleApiKey) {
    try {
      const query = encodeURIComponent(`${vertical} in ${location}`);
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${googleApiKey}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = (await response.json()) as {
          results?: Array<{
            place_id: string;
            name: string;
            formatted_address: string;
            geometry?: { location?: { lat: number; lng: number } };
            rating?: number;
            user_ratings_total?: number;
            website?: string;
            types?: string[];
          }>;
        };
        for (const place of (data.results ?? []).slice(0, maxResults)) {
          leads.push({
            business_name: place.name,
            address: place.formatted_address,
            google_maps_url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
            google_rating: place.rating,
            google_review_count: place.user_ratings_total,
            website_url: place.website ?? null,
            has_website: place.website ? 1 : 0,
            business_type: vertical,
            source: "google_places",
            source_raw_json: JSON.stringify(place),
          });
        }
      } else {
        errors.push(`Google Places API error: ${response.status}`);
      }
    } catch (err) {
      errors.push(`Google Places fetch failed: ${String(err)}`);
    }
  }

  // Companies House API integration (free, no key needed for basic search)
  if (!config.sources || config.sources.includes("companies_house")) {
    try {
      const chApiKey = process.env.COMPANIES_HOUSE_API_KEY;
      if (chApiKey) {
        const query = encodeURIComponent(`${vertical} ${location}`);
        const url = `https://api.company-information.service.gov.uk/search/companies?q=${query}&items_per_page=${Math.min(maxResults, 20)}`;
        const response = await fetch(url, {
          headers: { Authorization: `Basic ${Buffer.from(`${chApiKey}:`).toString("base64")}` },
        });
        if (response.ok) {
          const data = (await response.json()) as {
            items?: Array<{
              company_number: string;
              title: string;
              address_snippet: string;
              company_status: string;
              date_of_creation: string;
            }>;
          };
          for (const company of (data.items ?? []).filter((c) => c.company_status === "active")) {
            // Deduplicate by checking if we already have this business
            const exists = leads.some(
              (l) => (l.business_name as string).toLowerCase() === company.title.toLowerCase(),
            );
            if (!exists) {
              leads.push({
                business_name: company.title,
                address: company.address_snippet,
                companies_house_number: company.company_number,
                has_website: 0,
                business_type: vertical,
                source: "companies_house",
                source_raw_json: JSON.stringify(company),
              });
            }
          }
        } else {
          errors.push(`Companies House API error: ${response.status}`);
        }
      }
    } catch (err) {
      errors.push(`Companies House fetch failed: ${String(err)}`);
    }
  }

  // If no API keys configured, return mock data for development
  if (leads.length === 0 && errors.length === 0) {
    for (let i = 1; i <= Math.min(maxResults, 10); i++) {
      leads.push({
        business_name: `${vertical.charAt(0).toUpperCase() + vertical.slice(1)} Business ${i}`,
        address: `${i * 10} High Street, ${location}`,
        postcode: `M${i} ${i}AB`,
        business_type: vertical,
        has_website: i % 3 === 0 ? 1 : 0,
        website_url: i % 3 === 0 ? `https://example-${vertical}-${i}.co.uk` : null,
        source: "manual" as const,
        google_rating: Number((3 + Math.random() * 2).toFixed(1)),
        google_review_count: Math.floor(Math.random() * 100),
      });
    }
  }

  return {
    summary: `Scouted ${leads.length} leads for "${vertical}" in "${location}" (campaign: ${campaignId}).${errors.length > 0 ? ` Errors: ${errors.length}` : ""}`,
    artifacts: {
      campaign_id: campaignId,
      vertical,
      location,
      leads,
      lead_count: leads.length,
      errors: errors.length > 0 ? errors : undefined,
    },
  };
};
