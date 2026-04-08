import { createLogger } from "../../lib/logger.js";
import { AgentHandler } from "../../pipeline/agentRuntime.js";

const log = createLogger("lead-scout");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface LeadScoutConfig {
  campaign_id?: string;
  /** Single vertical (legacy) or multi-vertical search */
  vertical?: string;
  /** Preferred: list of verticals to search */
  verticals?: string[];
  location: string;
  max_results?: number;
  max_results_per_vertical?: number;
  sources?: string[];
}

// ---------------------------------------------------------------------------
// Vertical classification
// ---------------------------------------------------------------------------

export type VerticalCategory = "food" | "beauty" | "retail" | "professional" | "trades" | "unknown";

/** Walk-in-friendly verticals — these are our primary targets */
const PREFERRED_VERTICALS = [
  "restaurant", "cafe", "takeaway", "bakery", "pub", "bar",
  "barber", "salon", "hairdresser", "spa", "nail bar", "tattoo",
  "gym", "fitness",
  "florist", "pet shop", "boutique", "shop",
];

/** Trades — soft-excluded (van-based, no premises to walk into) */
const TRADES_KEYWORDS = [
  "plumb", "electri", "build", "roof", "locksmith", "garden",
  "landscap", "decorator", "painter", "carpenter", "joiner",
  "glazier", "tiler", "paving", "fenc", "gutter", "pest control",
  "handyman", "removal", "clean", "window clean", "drain",
];

/** Google Places type → vertical category mapping */
const GOOGLE_TYPE_TO_CATEGORY: Record<string, VerticalCategory> = {
  restaurant: "food", food: "food", cafe: "food", bakery: "food",
  bar: "food", meal_takeaway: "food", meal_delivery: "food",
  night_club: "food",
  hair_care: "beauty", beauty_salon: "beauty", spa: "beauty",
  gym: "beauty", health: "beauty",
  store: "retail", shopping_mall: "retail", clothing_store: "retail",
  shoe_store: "retail", pet_store: "retail", florist: "retail",
  book_store: "retail", electronics_store: "retail",
  jewelry_store: "retail", furniture_store: "retail",
  home_goods_store: "retail",
  dentist: "professional", doctor: "professional", lawyer: "professional",
  accounting: "professional", real_estate_agency: "professional",
  veterinary_care: "professional", pharmacy: "professional",
  insurance_agency: "professional",
  plumber: "trades", electrician: "trades", roofing_contractor: "trades",
  locksmith: "trades", painter: "trades", moving_company: "trades",
  general_contractor: "trades",
};

/** Classify a business into a vertical category */
function classifyVertical(
  businessName: string,
  businessType: string | undefined,
  googleTypes: string[],
): VerticalCategory {
  // 1. Check Google Places types first (most reliable)
  for (const gType of googleTypes) {
    const category = GOOGLE_TYPE_TO_CATEGORY[gType];
    if (category) return category;
  }

  // 2. Check business name + type against keyword patterns
  const combined = `${businessName} ${businessType ?? ""}`.toLowerCase();

  for (const kw of TRADES_KEYWORDS) {
    if (combined.includes(kw)) return "trades";
  }

  if (/restaurant|cafe|coffee|pizza|burger|kebab|takeaway|bakery|pub|bar|grill|kitchen|diner|bistro|sushi|thai|indian|chinese|chippy|fish/i.test(combined)) return "food";
  if (/barber|salon|hair|beauty|spa|nail|tattoo|gym|fitness|yoga|pilates|wax/i.test(combined)) return "beauty";
  if (/shop|store|boutique|florist|pet|phone|repair|vape|jewel|gift|book|cloth/i.test(combined)) return "retail";
  if (/dentist|doctor|solicitor|accountant|estate agent|vet|pharmacy|optician|physio/i.test(combined)) return "professional";

  return "unknown";
}

/** Check if Google types suggest physical premises */
function hasPremisesSignal(googleTypes: string[]): boolean {
  const premisesTypes = [
    "store", "restaurant", "cafe", "bar", "bakery", "salon",
    "beauty_salon", "hair_care", "spa", "gym", "shopping_mall",
    "clothing_store", "pet_store", "florist", "establishment",
    "food", "meal_takeaway", "night_club", "dentist", "pharmacy",
    "veterinary_care", "book_store",
  ];
  return googleTypes.some((t) => premisesTypes.includes(t));
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export const leadScoutAgent: AgentHandler = async (input) => {
  const config = (input.config ?? {}) as Partial<LeadScoutConfig>;
  const location = config.location ?? "unknown";
  const campaignId = config.campaign_id ?? input.run_id;
  const maxPerVertical = config.max_results_per_vertical ?? config.max_results ?? 5;

  // Support both single vertical (legacy) and multi-vertical
  const verticals = config.verticals ?? (config.vertical ? [config.vertical] : PREFERRED_VERTICALS.slice(0, 6));

  const leads: Array<Record<string, unknown>> = [];
  const errors: string[] = [];
  const seenPlaceIds = new Set<string>();

  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (googleApiKey) {
    // Run one search per vertical, merge and deduplicate
    for (const vertical of verticals) {
      try {
        const query = encodeURIComponent(`${vertical} in ${location}`);
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${googleApiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
          errors.push(`Google Places error for "${vertical}": ${response.status}`);
          continue;
        }

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
          status?: string;
        };

        if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
          errors.push(`Google Places status for "${vertical}": ${data.status}`);
          continue;
        }

        for (const place of (data.results ?? []).slice(0, maxPerVertical)) {
          // Deduplicate across verticals
          if (seenPlaceIds.has(place.place_id)) continue;
          seenPlaceIds.add(place.place_id);

          const googleTypes = place.types ?? [];
          const verticalCategory = classifyVertical(place.name, vertical, googleTypes);

          leads.push({
            business_name: place.name,
            address: place.formatted_address,
            google_maps_url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
            google_place_id: place.place_id,
            google_rating: place.rating,
            google_review_count: place.user_ratings_total,
            google_types: googleTypes,
            website_url: place.website ?? null,
            has_website: place.website ? 1 : 0,
            business_type: vertical,
            vertical_category: verticalCategory,
            has_premises: hasPremisesSignal(googleTypes),
            lat: place.geometry?.location?.lat,
            lng: place.geometry?.location?.lng,
            source: "google_places",
          });
        }

        log.info(`searched "${vertical}" in ${location}`, {
          results: (data.results ?? []).length,
          added: leads.length,
        });
      } catch (err) {
        errors.push(`Google Places fetch failed for "${vertical}": ${String(err)}`);
      }
    }
  }

  // Companies House (UK businesses)
  if (!config.sources || config.sources.includes("companies_house")) {
    const chApiKey = process.env.COMPANIES_HOUSE_API_KEY;
    if (chApiKey) {
      try {
        for (const vertical of verticals.slice(0, 3)) {
          const query = encodeURIComponent(`${vertical} ${location}`);
          const url = `https://api.company-information.service.gov.uk/search/companies?q=${query}&items_per_page=10`;
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
              }>;
            };
            for (const company of (data.items ?? []).filter((c) => c.company_status === "active")) {
              const exists = leads.some(
                (l) => (l.business_name as string).toLowerCase() === company.title.toLowerCase(),
              );
              if (!exists) {
                const verticalCategory = classifyVertical(company.title, vertical, []);
                leads.push({
                  business_name: company.title,
                  address: company.address_snippet,
                  companies_house_number: company.company_number,
                  has_website: 0,
                  business_type: vertical,
                  vertical_category: verticalCategory,
                  has_premises: false,
                  source: "companies_house",
                });
              }
            }
          }
        }
      } catch (err) {
        errors.push(`Companies House fetch failed: ${String(err)}`);
      }
    }
  }

  // Mock data fallback for development
  if (leads.length === 0 && errors.length === 0) {
    const mockVerticals = verticals.length > 0 ? verticals : ["restaurant", "barber", "cafe"];
    let idx = 0;
    for (const v of mockVerticals) {
      for (let i = 1; i <= 3; i++) {
        idx++;
        const category = classifyVertical(v, v, []);
        leads.push({
          business_name: `${v.charAt(0).toUpperCase() + v.slice(1)} Business ${idx}`,
          address: `${idx * 10} High Street, ${location}`,
          postcode: `M${idx} ${idx}AB`,
          business_type: v,
          vertical_category: category,
          has_premises: category !== "trades",
          has_website: idx % 3 === 0 ? 1 : 0,
          website_url: idx % 3 === 0 ? `https://example-${v}-${idx}.co.uk` : null,
          source: "mock",
          google_rating: Number((3.5 + Math.random() * 1.5).toFixed(1)),
          google_review_count: Math.floor(Math.random() * 150),
        });
      }
    }
  }

  // Summary stats
  const byCategory = new Map<string, number>();
  for (const lead of leads) {
    const cat = (lead.vertical_category as string) ?? "unknown";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
  }
  const categoryBreakdown = Object.fromEntries(byCategory);

  log.info(`scouting complete`, {
    total: leads.length,
    categories: categoryBreakdown,
    errors: errors.length,
  });

  return {
    summary: `Scouted ${leads.length} leads in "${location}". ${JSON.stringify(categoryBreakdown)}.${errors.length > 0 ? ` Errors: ${errors.length}` : ""}`,
    artifacts: {
      campaign_id: campaignId,
      verticals,
      location,
      leads,
      lead_count: leads.length,
      category_breakdown: categoryBreakdown,
      errors: errors.length > 0 ? errors : undefined,
      _decision: {
        reasoning: `Searched ${verticals.length} verticals in ${location}. Found ${leads.length} leads: ${JSON.stringify(categoryBreakdown)}. Deduped by place_id.`,
        alternatives: ["Could search more verticals", "Could use Google Places Nearby Search for radius-based discovery"],
        confidence: leads.length >= 10 ? 0.85 : 0.5,
        tags: [`location:${location}`, ...verticals.map((v) => `vertical:${v}`)],
      },
    },
  };
};

export { classifyVertical, hasPremisesSignal };
