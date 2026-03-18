/**
 * Industry-specific landing page templates.
 * Uses {{variable}} mustache-style placeholders that the site-composer-agent fills.
 *
 * Common variables across all templates:
 *   {{business_name}}, {{tagline}}, {{phone}}, {{email}}, {{address}},
 *   {{services_list}}, {{about_text}}, {{cta_text}}, {{cta_url}},
 *   {{hero_image_url}}, {{primary_color}}, {{accent_color}}
 */

export interface SiteTemplate {
  id: string;
  name: string;
  vertical: string;
  template_type: "landing_page";
  html_template: string;
  css_template: string;
  config_schema_json: string;
}

const sharedCss = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; line-height: 1.6; }
.container { max-width: 1100px; margin: 0 auto; padding: 0 20px; }
.btn { display: inline-block; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 1rem; transition: opacity 0.2s; }
.btn:hover { opacity: 0.9; }
.btn-primary { background: {{primary_color}}; color: #fff; }
.btn-outline { border: 2px solid {{primary_color}}; color: {{primary_color}}; background: transparent; }

/* Header */
.header { padding: 16px 0; background: #fff; border-bottom: 1px solid #eee; }
.header .container { display: flex; justify-content: space-between; align-items: center; }
.logo { font-size: 1.5rem; font-weight: 700; color: {{primary_color}}; text-decoration: none; }
.header-phone { font-weight: 600; color: {{primary_color}}; text-decoration: none; font-size: 1.1rem; }

/* Hero */
.hero { padding: 80px 0; background: linear-gradient(135deg, {{primary_color}}15, {{accent_color}}10); text-align: center; }
.hero h1 { font-size: 2.5rem; margin-bottom: 16px; color: #1a1a2e; }
.hero p { font-size: 1.2rem; color: #555; margin-bottom: 32px; max-width: 600px; margin-left: auto; margin-right: auto; }

/* Services */
.services { padding: 60px 0; background: #fff; }
.services h2 { text-align: center; font-size: 2rem; margin-bottom: 40px; }
.services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px; }
.service-card { background: #f8f9fa; border-radius: 8px; padding: 24px; text-align: center; }
.service-card h3 { margin-bottom: 8px; color: {{primary_color}}; }

/* About */
.about { padding: 60px 0; background: #f8f9fa; }
.about h2 { font-size: 2rem; margin-bottom: 16px; }
.about p { font-size: 1.1rem; color: #555; max-width: 700px; }

/* CTA */
.cta-section { padding: 60px 0; background: {{primary_color}}; color: #fff; text-align: center; }
.cta-section h2 { font-size: 2rem; margin-bottom: 16px; }
.cta-section p { font-size: 1.1rem; margin-bottom: 24px; opacity: 0.9; }
.cta-section .btn { background: #fff; color: {{primary_color}}; }

/* Contact */
.contact { padding: 60px 0; background: #fff; }
.contact h2 { font-size: 2rem; margin-bottom: 24px; text-align: center; }
.contact-info { display: flex; flex-wrap: wrap; justify-content: center; gap: 32px; }
.contact-item { text-align: center; }
.contact-item strong { display: block; color: {{primary_color}}; margin-bottom: 4px; }

/* Footer */
.footer { padding: 24px 0; background: #1a1a2e; color: #aaa; text-align: center; font-size: 0.9rem; }

/* Responsive */
@media (max-width: 768px) {
  .hero h1 { font-size: 1.8rem; }
  .hero { padding: 50px 0; }
  .services, .about, .contact { padding: 40px 0; }
}
`;

const sharedHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{business_name}} — {{tagline}}</title>
  <meta name="description" content="{{business_name}} — {{tagline}}. {{about_text}}">
  <style>{{css}}</style>
</head>
<body>
  <header class="header">
    <div class="container">
      <a href="#" class="logo">{{business_name}}</a>
      <a href="tel:{{phone}}" class="header-phone">📞 {{phone}}</a>
    </div>
  </header>

  <section class="hero">
    <div class="container">
      <h1>{{tagline}}</h1>
      <p>{{hero_description}}</p>
      <a href="tel:{{phone}}" class="btn btn-primary">{{cta_text}}</a>
    </div>
  </section>

  <section class="services">
    <div class="container">
      <h2>Our Services</h2>
      <div class="services-grid">
        {{services_html}}
      </div>
    </div>
  </section>

  <section class="about">
    <div class="container">
      <h2>About {{business_name}}</h2>
      <p>{{about_text}}</p>
    </div>
  </section>

  <section class="cta-section">
    <div class="container">
      <h2>{{cta_heading}}</h2>
      <p>{{cta_subtext}}</p>
      <a href="tel:{{phone}}" class="btn">{{cta_text}}</a>
    </div>
  </section>

  <section class="contact">
    <div class="container">
      <h2>Get In Touch</h2>
      <div class="contact-info">
        <div class="contact-item">
          <strong>Phone</strong>
          <a href="tel:{{phone}}">{{phone}}</a>
        </div>
        <div class="contact-item">
          <strong>Email</strong>
          <a href="mailto:{{email}}">{{email}}</a>
        </div>
        <div class="contact-item">
          <strong>Address</strong>
          <span>{{address}}</span>
        </div>
      </div>
    </div>
  </section>

  <footer class="footer">
    <div class="container">
      &copy; {{year}} {{business_name}}. All rights reserved.
    </div>
  </footer>
</body>
</html>`;

const configSchema = JSON.stringify({
  type: "object",
  required: ["business_name", "tagline", "phone"],
  properties: {
    business_name: { type: "string" },
    tagline: { type: "string" },
    phone: { type: "string" },
    email: { type: "string" },
    address: { type: "string" },
    hero_description: { type: "string" },
    about_text: { type: "string" },
    services_html: { type: "string" },
    cta_text: { type: "string" },
    cta_heading: { type: "string" },
    cta_subtext: { type: "string" },
    primary_color: { type: "string" },
    accent_color: { type: "string" },
  },
});

export const siteTemplates: SiteTemplate[] = [
  {
    id: "trades-v1",
    name: "Trades Professional",
    vertical: "trades",
    template_type: "landing_page",
    html_template: sharedHtml,
    css_template: sharedCss,
    config_schema_json: configSchema,
  },
  {
    id: "restaurant-v1",
    name: "Restaurant & Cafe",
    vertical: "food",
    template_type: "landing_page",
    html_template: sharedHtml,
    css_template: sharedCss,
    config_schema_json: configSchema,
  },
  {
    id: "health-v1",
    name: "Health & Beauty",
    vertical: "health",
    template_type: "landing_page",
    html_template: sharedHtml,
    css_template: sharedCss,
    config_schema_json: configSchema,
  },
  {
    id: "professional-v1",
    name: "Professional Services",
    vertical: "professional",
    template_type: "landing_page",
    html_template: sharedHtml,
    css_template: sharedCss,
    config_schema_json: configSchema,
  },
  {
    id: "retail-v1",
    name: "Retail & Shop",
    vertical: "retail",
    template_type: "landing_page",
    html_template: sharedHtml,
    css_template: sharedCss,
    config_schema_json: configSchema,
  },
];

/**
 * Default color schemes per vertical.
 * The site-composer-agent uses these as defaults when generating content.
 */
export const verticalDefaults: Record<string, { primary_color: string; accent_color: string; cta_text: string }> = {
  trades: { primary_color: "#2563eb", accent_color: "#1e40af", cta_text: "Call Now For A Free Quote" },
  food: { primary_color: "#dc2626", accent_color: "#b91c1c", cta_text: "Book A Table" },
  health: { primary_color: "#7c3aed", accent_color: "#6d28d9", cta_text: "Book An Appointment" },
  professional: { primary_color: "#0f766e", accent_color: "#115e59", cta_text: "Get In Touch" },
  retail: { primary_color: "#ea580c", accent_color: "#c2410c", cta_text: "Visit Us Today" },
  general: { primary_color: "#2563eb", accent_color: "#1e40af", cta_text: "Contact Us" },
};

/**
 * Map business types to template verticals.
 */
export function resolveVertical(businessType: string): string {
  const lower = (businessType ?? "").toLowerCase();
  const trades = ["plumber", "electrician", "builder", "roofer", "painter", "decorator", "carpenter", "locksmith", "mechanic", "gardener", "cleaner", "handyman"];
  const food = ["restaurant", "cafe", "takeaway", "caterer", "baker", "butcher", "pub", "bar"];
  const health = ["dentist", "salon", "barber", "physio", "chiropractor", "spa", "gym", "fitness", "yoga", "beauty"];
  const professional = ["accountant", "lawyer", "solicitor", "architect", "consultant", "tutor"];
  const retail = ["shop", "store", "florist", "grocer", "pet", "nursery"];

  if (trades.some((t) => lower.includes(t))) return "trades";
  if (food.some((t) => lower.includes(t))) return "food";
  if (health.some((t) => lower.includes(t))) return "health";
  if (professional.some((t) => lower.includes(t))) return "professional";
  if (retail.some((t) => lower.includes(t))) return "retail";
  return "trades"; // default fallback
}
