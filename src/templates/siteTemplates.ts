/**
 * Industry-specific landing page templates — v2.
 *
 * Each vertical gets a distinct layout and design language.
 * Uses {{variable}} mustache-style placeholders.
 * Supports conditional blocks: {{#flag}}...{{/flag}}
 *
 * New in v2:
 *  - Per-vertical unique layouts (not shared HTML)
 *  - Testimonials from Google reviews
 *  - Google Maps embed
 *  - Opening hours section
 *  - Star rating badge
 *  - Google Fonts loaded
 *  - Smooth scroll, subtle animations
 *  - Social image gallery integration
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

// ---------------------------------------------------------------------------
// Conditional block processor
// ---------------------------------------------------------------------------

export function processConditionals(html: string, vars: Record<string, string>): string {
  let result = html;
  let safety = 0;
  while (safety < 50) {
    safety++;
    const match = result.match(/\{\{#(\w+)\}\}((?:(?!\{\{#)[\s\S])*?)\{\{\/\1\}\}/);
    if (!match) break;
    const [fullMatch, flag, content] = match;
    const value = vars[flag];
    const keep = value !== undefined && value !== "" && value !== "false";
    result = result.replace(fullMatch, keep ? content : "");
  }
  return result;
}

// ---------------------------------------------------------------------------
// Shared CSS foundation
// ---------------------------------------------------------------------------

const resetAndBase = `
@import url('https://fonts.googleapis.com/css2?family={{heading_font_import}}&family={{body_font_import}}&display=swap');

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  font-family: '{{body_font}}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #1a1a2e; line-height: 1.7; -webkit-font-smoothing: antialiased;
}
h1, h2, h3, h4 { font-family: '{{heading_font}}', -apple-system, sans-serif; line-height: 1.25; }
img { max-width: 100%; height: auto; }
a { color: inherit; text-decoration: none; }
.container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }

/* Buttons */
.btn {
  display: inline-block; padding: 14px 32px; border-radius: 8px;
  font-weight: 600; font-size: 1rem; cursor: pointer;
  transition: all 0.3s ease; border: none; text-align: center;
}
.btn-primary { background: {{primary_color}}; color: #fff; box-shadow: 0 4px 14px {{primary_color}}40; }
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px {{primary_color}}60; }
.btn-outline { border: 2px solid {{primary_color}}; color: {{primary_color}}; background: transparent; }
.btn-outline:hover { background: {{primary_color}}; color: #fff; }
.btn-white { background: #fff; color: {{primary_color}}; box-shadow: 0 4px 14px rgba(0,0,0,0.15); }
.btn-white:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.2); }

/* Section spacing */
.section { padding: 80px 0; }
.section-alt { background: #f8fafc; }
.section-title { font-size: 2rem; text-align: center; margin-bottom: 12px; }
.section-subtitle { text-align: center; color: #64748b; font-size: 1.1rem; margin-bottom: 48px; max-width: 600px; margin-left: auto; margin-right: auto; }

/* Fade-in on scroll */
.fade-in { opacity: 0; transform: translateY(20px); transition: opacity 0.6s ease, transform 0.6s ease; }
.fade-in.visible { opacity: 1; transform: translateY(0); }

/* Header */
.header {
  padding: 16px 0; background: #fff;
  border-bottom: 1px solid #f1f5f9;
  position: sticky; top: 0; z-index: 100;
  backdrop-filter: blur(12px); background: rgba(255,255,255,0.95);
}
.header .container { display: flex; justify-content: space-between; align-items: center; }
.logo { display: flex; align-items: center; gap: 12px; font-size: 1.4rem; font-weight: 800; color: {{primary_color}}; }
.logo-img { max-height: 44px; width: auto; object-fit: contain; }
.nav-links { display: flex; gap: 24px; align-items: center; }
.nav-links a { font-weight: 500; color: #475569; transition: color 0.2s; }
.nav-links a:hover { color: {{primary_color}}; }
.header-cta { padding: 10px 24px; font-size: 0.9rem; }

/* Rating badge */
.rating-badge {
  display: inline-flex; align-items: center; gap: 8px;
  background: #fff; padding: 8px 16px; border-radius: 50px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.1); font-weight: 600; font-size: 0.95rem;
}
.rating-stars { color: #f59e0b; letter-spacing: 2px; }

/* Testimonials */
.testimonials { padding: 80px 0; background: #f8fafc; }
.testimonials-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; }
.testimonial-card {
  background: #fff; border-radius: 12px; padding: 28px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06); position: relative;
}
.testimonial-card::before {
  content: '"'; position: absolute; top: 12px; left: 20px;
  font-size: 3rem; color: {{primary_color}}20; font-family: Georgia, serif; line-height: 1;
}
.testimonial-text { font-size: 1rem; color: #475569; margin-bottom: 16px; font-style: italic; padding-top: 12px; }
.testimonial-author { font-weight: 700; font-size: 0.9rem; color: #1a1a2e; }
.testimonial-rating { color: #f59e0b; font-size: 0.85rem; margin-top: 4px; }

/* Map */
.map-section { padding: 0; }
.map-section iframe { width: 100%; height: 350px; border: 0; display: block; }

/* Opening hours */
.hours-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; max-width: 500px; margin: 0 auto; }
.hours-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
.hours-day { font-weight: 600; }
.hours-time { color: #64748b; }

/* Gallery */
.gallery-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;
}
.gallery-item {
  border-radius: 12px; overflow: hidden; aspect-ratio: 4/3;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: transform 0.3s ease;
}
.gallery-item:hover { transform: scale(1.02); }
.gallery-item img { width: 100%; height: 100%; object-fit: cover; }

/* Services */
.services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; }
.service-card {
  background: #fff; border-radius: 12px; padding: 32px 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06); text-align: center;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  border-top: 3px solid transparent;
}
.service-card:hover { transform: translateY(-4px); box-shadow: 0 8px 25px rgba(0,0,0,0.1); border-top-color: {{primary_color}}; }
.service-card h3 { margin-bottom: 8px; color: {{primary_color}}; font-size: 1.15rem; }
.service-card p { color: #64748b; font-size: 0.95rem; }

/* Menu */
.menu-list { max-width: 700px; margin: 0 auto; }
.menu-category { font-size: 1.3rem; color: {{primary_color}}; margin: 32px 0 16px; font-weight: 700; }
.menu-category:first-child { margin-top: 0; }
.menu-item { display: flex; justify-content: space-between; align-items: baseline; padding: 14px 0; border-bottom: 1px dashed #e2e8f0; }
.menu-item-name { font-weight: 600; font-size: 1.05rem; }
.menu-item-price { color: {{primary_color}}; font-weight: 700; font-size: 1.1rem; white-space: nowrap; margin-left: 16px; }
.menu-item-desc { font-size: 0.85rem; color: #94a3b8; }

/* Contact */
.contact-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 32px; text-align: center; }
.contact-item { padding: 24px; }
.contact-icon { font-size: 1.5rem; margin-bottom: 8px; }
.contact-label { font-weight: 700; color: {{primary_color}}; margin-bottom: 4px; display: block; }
.contact-value { color: #475569; }
.contact-value a { color: {{primary_color}}; font-weight: 500; }

/* CTA Section */
.cta-section {
  padding: 80px 0; text-align: center; position: relative; overflow: hidden;
  background: linear-gradient(135deg, {{primary_color}}, {{accent_color}});
  color: #fff;
}
.cta-section h2 { font-size: 2.2rem; margin-bottom: 16px; }
.cta-section p { font-size: 1.15rem; margin-bottom: 32px; opacity: 0.9; max-width: 500px; margin-left: auto; margin-right: auto; }

/* Footer */
.footer {
  padding: 32px 0; background: #0f172a; color: #94a3b8;
  text-align: center; font-size: 0.9rem;
}
.footer a { color: #60a5fa; }
.footer-links { display: flex; justify-content: center; gap: 24px; margin-bottom: 12px; }

/* Responsive */
@media (max-width: 768px) {
  .section { padding: 56px 0; }
  .section-title { font-size: 1.6rem; }
  .hero-title { font-size: 2rem !important; }
  .nav-links { display: none; }
  .gallery-grid { grid-template-columns: 1fr 1fr; }
  .testimonials-grid { grid-template-columns: 1fr; }
  .contact-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 480px) {
  .gallery-grid { grid-template-columns: 1fr; }
  .contact-grid { grid-template-columns: 1fr; }
}
`;

// ---------------------------------------------------------------------------
// Vertical-specific hero CSS
// ---------------------------------------------------------------------------

const tradesCss = `
/* Trades hero — bold, trust-focused */
.hero {
  padding: 100px 0 80px; position: relative; overflow: hidden;
  background: linear-gradient(135deg, #0f172a 0%, {{primary_color}}dd 100%);
  color: #fff;
}
.hero-content { max-width: 600px; }
.hero-title { font-size: 3rem; font-weight: 900; margin-bottom: 20px; line-height: 1.1; }
.hero-desc { font-size: 1.2rem; opacity: 0.9; margin-bottom: 32px; line-height: 1.6; }
.hero-buttons { display: flex; gap: 16px; flex-wrap: wrap; }
.hero-trust { display: flex; gap: 24px; margin-top: 40px; }
.trust-item { display: flex; align-items: center; gap: 8px; font-size: 0.95rem; opacity: 0.85; }
.trust-check { color: #4ade80; font-weight: 700; }
`;

const foodCss = `
/* Food hero — warm, inviting */
.hero {
  padding: 120px 0 100px; text-align: center; position: relative;
  background: linear-gradient(to bottom, #0f172a, {{primary_color}}22);
  color: #fff;
}
.hero--image {
  background-size: cover; background-position: center;
}
.hero--image::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0.7));
}
.hero--image .hero-content { position: relative; z-index: 1; }
.hero-content { max-width: 650px; margin: 0 auto; }
.hero-title { font-size: 3.2rem; font-weight: 800; margin-bottom: 20px; font-family: '{{heading_font}}', Georgia, serif; }
.hero-desc { font-size: 1.2rem; opacity: 0.9; margin-bottom: 36px; }
.hero-buttons { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
`;

const healthCss = `
/* Health & beauty hero — clean, calm, premium */
.hero {
  padding: 100px 0; position: relative; overflow: hidden;
  background: linear-gradient(160deg, #faf5ff 0%, {{primary_color}}12 50%, #f0fdf4 100%);
}
.hero-content { max-width: 550px; }
.hero-title { font-size: 2.8rem; font-weight: 800; margin-bottom: 20px; color: #1a1a2e; }
.hero-desc { font-size: 1.15rem; color: #475569; margin-bottom: 32px; }
.hero-buttons { display: flex; gap: 16px; flex-wrap: wrap; }
.hero-image-col { display: flex; align-items: center; justify-content: center; }
.hero-image-col img { border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.1); max-height: 400px; object-fit: cover; }
.hero-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
@media (max-width: 768px) { .hero-two-col { grid-template-columns: 1fr; } .hero-image-col { order: -1; } }
`;

const professionalCss = `
/* Professional — authoritative, clean */
.hero {
  padding: 100px 0 80px; position: relative;
  background: #fff; border-bottom: 1px solid #e2e8f0;
}
.hero-content { max-width: 600px; }
.hero-title { font-size: 2.8rem; font-weight: 800; margin-bottom: 20px; color: #0f172a; }
.hero-accent { color: {{primary_color}}; }
.hero-desc { font-size: 1.15rem; color: #475569; margin-bottom: 32px; }
.hero-buttons { display: flex; gap: 16px; flex-wrap: wrap; }
.hero-stats { display: flex; gap: 48px; margin-top: 48px; padding-top: 32px; border-top: 1px solid #e2e8f0; }
.stat-number { font-size: 2rem; font-weight: 800; color: {{primary_color}}; display: block; }
.stat-label { font-size: 0.9rem; color: #64748b; }
`;

const retailCss = `
/* Retail — vibrant, product-focused */
.hero {
  padding: 100px 0; position: relative; overflow: hidden;
  background: linear-gradient(135deg, {{primary_color}}08, {{accent_color}}12);
}
.hero-content { text-align: center; max-width: 650px; margin: 0 auto; }
.hero-title { font-size: 3rem; font-weight: 900; margin-bottom: 20px; }
.hero-desc { font-size: 1.2rem; color: #475569; margin-bottom: 32px; }
.hero-buttons { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
`;

// ---------------------------------------------------------------------------
// Per-vertical HTML
// ---------------------------------------------------------------------------

const tradesHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{business_name}} — {{tagline}}</title>
  <meta name="description" content="{{hero_description}}">
  <style>{{css}}</style>
</head>
<body>
  <header class="header">
    <div class="container">
      <a href="#" class="logo">
        {{#has_logo}}<img src="{{logo_url}}" alt="{{business_name}}" class="logo-img">{{/has_logo}}
        <span>{{business_name}}</span>
      </a>
      <nav class="nav-links">
        <a href="#services">Services</a>
        {{#has_gallery}}<a href="#gallery">Our Work</a>{{/has_gallery}}
        {{#has_reviews}}<a href="#reviews">Reviews</a>{{/has_reviews}}
        <a href="#contact">Contact</a>
        <a href="tel:{{phone}}" class="btn btn-primary header-cta">{{cta_text}}</a>
      </nav>
    </div>
  </header>

  <section class="hero">
    <div class="container">
      <div class="hero-content">
        {{#has_rating}}<div class="rating-badge"><span class="rating-stars">{{stars_html}}</span> {{google_rating}} from {{google_review_count}} reviews</div>{{/has_rating}}
        <h1 class="hero-title">{{tagline}}</h1>
        <p class="hero-desc">{{hero_description}}</p>
        <div class="hero-buttons">
          <a href="tel:{{phone}}" class="btn btn-white">{{cta_text}}</a>
          <a href="#services" class="btn btn-outline" style="border-color:#fff;color:#fff">View Services</a>
        </div>
        <div class="hero-trust">
          <div class="trust-item"><span class="trust-check">✓</span> Free Quotes</div>
          <div class="trust-item"><span class="trust-check">✓</span> Fully Insured</div>
          <div class="trust-item"><span class="trust-check">✓</span> Local & Reliable</div>
        </div>
      </div>
    </div>
  </section>

  <section id="services" class="section">
    <div class="container">
      <h2 class="section-title">What We Do</h2>
      <p class="section-subtitle">{{services_subtitle}}</p>
      <div class="services-grid fade-in">
        {{services_html}}
      </div>
    </div>
  </section>

  {{#has_gallery}}
  <section id="gallery" class="section section-alt">
    <div class="container">
      <h2 class="section-title">Our Work</h2>
      <p class="section-subtitle">See examples of our recent projects</p>
      <div class="gallery-grid fade-in">
        {{gallery_html}}
      </div>
    </div>
  </section>
  {{/has_gallery}}

  {{#has_reviews}}
  <section id="reviews" class="testimonials">
    <div class="container">
      <h2 class="section-title">What Our Customers Say</h2>
      <p class="section-subtitle">Real reviews from real customers</p>
      <div class="testimonials-grid fade-in">
        {{reviews_html}}
      </div>
    </div>
  </section>
  {{/has_reviews}}

  <section class="cta-section">
    <div class="container">
      <h2>{{cta_heading}}</h2>
      <p>{{cta_subtext}}</p>
      <a href="tel:{{phone}}" class="btn btn-white">{{cta_text}}</a>
    </div>
  </section>

  {{#has_hours}}
  <section class="section">
    <div class="container">
      <h2 class="section-title">Opening Hours</h2>
      <div class="hours-grid fade-in">
        {{hours_html}}
      </div>
    </div>
  </section>
  {{/has_hours}}

  <section id="contact" class="section section-alt">
    <div class="container">
      <h2 class="section-title">Get In Touch</h2>
      <p class="section-subtitle">We'd love to hear from you</p>
      <div class="contact-grid fade-in">
        <div class="contact-item">
          <div class="contact-icon">📞</div>
          <span class="contact-label">Phone</span>
          <span class="contact-value"><a href="tel:{{phone}}">{{phone}}</a></span>
        </div>
        <div class="contact-item">
          <div class="contact-icon">✉️</div>
          <span class="contact-label">Email</span>
          <span class="contact-value"><a href="mailto:{{email}}">{{email}}</a></span>
        </div>
        {{#has_address}}
        <div class="contact-item">
          <div class="contact-icon">📍</div>
          <span class="contact-label">Location</span>
          <span class="contact-value">{{address}}</span>
        </div>
        {{/has_address}}
      </div>
    </div>
  </section>

  {{#has_map}}
  <section class="map-section">
    <iframe src="{{maps_embed_url}}" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
  </section>
  {{/has_map}}

  <footer class="footer">
    <div class="container">
      <p>&copy; {{year}} {{business_name}}. All rights reserved.</p>
    </div>
  </footer>

  <script>
  // Fade-in on scroll
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
  </script>
</body>
</html>`;

const foodHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{business_name}} — {{tagline}}</title>
  <meta name="description" content="{{hero_description}}">
  <style>{{css}}</style>
</head>
<body>
  <header class="header">
    <div class="container">
      <a href="#" class="logo">
        {{#has_logo}}<img src="{{logo_url}}" alt="{{business_name}}" class="logo-img">{{/has_logo}}
        <span>{{business_name}}</span>
      </a>
      <nav class="nav-links">
        {{#has_menu}}<a href="#menu">Menu</a>{{/has_menu}}
        {{#has_gallery}}<a href="#gallery">Photos</a>{{/has_gallery}}
        {{#has_reviews}}<a href="#reviews">Reviews</a>{{/has_reviews}}
        <a href="#contact">Find Us</a>
        <a href="tel:{{phone}}" class="btn btn-primary header-cta">{{cta_text}}</a>
      </nav>
    </div>
  </header>

  <section class="hero {{#has_hero_image}}hero--image{{/has_hero_image}}" {{#has_hero_image}}style="background-image: url('{{hero_image_url}}')"{{/has_hero_image}}>
    <div class="hero-content">
      <h1 class="hero-title">{{tagline}}</h1>
      <p class="hero-desc">{{hero_description}}</p>
      {{#has_rating}}<div class="rating-badge" style="margin-bottom:24px"><span class="rating-stars">{{stars_html}}</span> {{google_rating}} stars · {{google_review_count}} reviews</div>{{/has_rating}}
      <div class="hero-buttons">
        <a href="tel:{{phone}}" class="btn btn-white">{{cta_text}}</a>
        {{#has_menu}}<a href="#menu" class="btn btn-outline" style="border-color:#fff;color:#fff">View Menu</a>{{/has_menu}}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <h2 class="section-title">About {{business_name}}</h2>
      <p class="section-subtitle">{{about_text}}</p>
    </div>
  </section>

  {{#has_menu}}
  <section id="menu" class="section section-alt">
    <div class="container">
      <h2 class="section-title">Our Menu</h2>
      <p class="section-subtitle">Fresh, delicious, made with care</p>
      <div class="menu-list fade-in">
        {{menu_html}}
      </div>
    </div>
  </section>
  {{/has_menu}}

  {{#has_gallery}}
  <section id="gallery" class="section">
    <div class="container">
      <h2 class="section-title">Gallery</h2>
      <div class="gallery-grid fade-in">
        {{gallery_html}}
      </div>
    </div>
  </section>
  {{/has_gallery}}

  {{#has_reviews}}
  <section id="reviews" class="testimonials">
    <div class="container">
      <h2 class="section-title">What People Are Saying</h2>
      <div class="testimonials-grid fade-in">
        {{reviews_html}}
      </div>
    </div>
  </section>
  {{/has_reviews}}

  {{#has_hours}}
  <section class="section section-alt">
    <div class="container">
      <h2 class="section-title">Opening Hours</h2>
      <div class="hours-grid fade-in">
        {{hours_html}}
      </div>
    </div>
  </section>
  {{/has_hours}}

  <section class="cta-section">
    <div class="container">
      <h2>{{cta_heading}}</h2>
      <p>{{cta_subtext}}</p>
      <a href="tel:{{phone}}" class="btn btn-white">{{cta_text}}</a>
    </div>
  </section>

  <section id="contact" class="section">
    <div class="container">
      <h2 class="section-title">Find Us</h2>
      <div class="contact-grid fade-in">
        <div class="contact-item">
          <div class="contact-icon">📞</div>
          <span class="contact-label">Phone</span>
          <span class="contact-value"><a href="tel:{{phone}}">{{phone}}</a></span>
        </div>
        <div class="contact-item">
          <div class="contact-icon">✉️</div>
          <span class="contact-label">Email</span>
          <span class="contact-value"><a href="mailto:{{email}}">{{email}}</a></span>
        </div>
        {{#has_address}}
        <div class="contact-item">
          <div class="contact-icon">📍</div>
          <span class="contact-label">Location</span>
          <span class="contact-value">{{address}}</span>
        </div>
        {{/has_address}}
      </div>
    </div>
  </section>

  {{#has_map}}
  <section class="map-section">
    <iframe src="{{maps_embed_url}}" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
  </section>
  {{/has_map}}

  <footer class="footer">
    <div class="container">
      <p>&copy; {{year}} {{business_name}}. All rights reserved.</p>
    </div>
  </footer>

  <script>
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
  </script>
</body>
</html>`;

const healthHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{business_name}} — {{tagline}}</title>
  <meta name="description" content="{{hero_description}}">
  <style>{{css}}</style>
</head>
<body>
  <header class="header">
    <div class="container">
      <a href="#" class="logo">
        {{#has_logo}}<img src="{{logo_url}}" alt="{{business_name}}" class="logo-img">{{/has_logo}}
        <span>{{business_name}}</span>
      </a>
      <nav class="nav-links">
        <a href="#services">Services</a>
        {{#has_gallery}}<a href="#gallery">Gallery</a>{{/has_gallery}}
        {{#has_reviews}}<a href="#reviews">Reviews</a>{{/has_reviews}}
        <a href="#contact">Contact</a>
        <a href="tel:{{phone}}" class="btn btn-primary header-cta">{{cta_text}}</a>
      </nav>
    </div>
  </header>

  <section class="hero">
    <div class="container">
      <div class="hero-two-col">
        <div class="hero-content">
          {{#has_rating}}<div class="rating-badge"><span class="rating-stars">{{stars_html}}</span> {{google_rating}} · {{google_review_count}} reviews</div>{{/has_rating}}
          <h1 class="hero-title">{{tagline}}</h1>
          <p class="hero-desc">{{hero_description}}</p>
          <div class="hero-buttons">
            <a href="tel:{{phone}}" class="btn btn-primary">{{cta_text}}</a>
            <a href="#services" class="btn btn-outline">Our Services</a>
          </div>
        </div>
        {{#has_hero_image}}
        <div class="hero-image-col">
          <img src="{{hero_image_url}}" alt="{{business_name}}">
        </div>
        {{/has_hero_image}}
      </div>
    </div>
  </section>

  <section id="services" class="section section-alt">
    <div class="container">
      <h2 class="section-title">Our Services</h2>
      <p class="section-subtitle">{{services_subtitle}}</p>
      <div class="services-grid fade-in">
        {{services_html}}
      </div>
    </div>
  </section>

  {{#has_gallery}}
  <section id="gallery" class="section">
    <div class="container">
      <h2 class="section-title">Gallery</h2>
      <div class="gallery-grid fade-in">
        {{gallery_html}}
      </div>
    </div>
  </section>
  {{/has_gallery}}

  {{#has_reviews}}
  <section id="reviews" class="testimonials">
    <div class="container">
      <h2 class="section-title">Client Reviews</h2>
      <div class="testimonials-grid fade-in">
        {{reviews_html}}
      </div>
    </div>
  </section>
  {{/has_reviews}}

  <section class="section">
    <div class="container">
      <h2 class="section-title">About {{business_name}}</h2>
      <p class="section-subtitle">{{about_text}}</p>
    </div>
  </section>

  {{#has_hours}}
  <section class="section section-alt">
    <div class="container">
      <h2 class="section-title">Opening Hours</h2>
      <div class="hours-grid fade-in">
        {{hours_html}}
      </div>
    </div>
  </section>
  {{/has_hours}}

  <section class="cta-section">
    <div class="container">
      <h2>{{cta_heading}}</h2>
      <p>{{cta_subtext}}</p>
      <a href="tel:{{phone}}" class="btn btn-white">{{cta_text}}</a>
    </div>
  </section>

  <section id="contact" class="section">
    <div class="container">
      <h2 class="section-title">Get In Touch</h2>
      <div class="contact-grid fade-in">
        <div class="contact-item">
          <div class="contact-icon">📞</div>
          <span class="contact-label">Phone</span>
          <span class="contact-value"><a href="tel:{{phone}}">{{phone}}</a></span>
        </div>
        <div class="contact-item">
          <div class="contact-icon">✉️</div>
          <span class="contact-label">Email</span>
          <span class="contact-value"><a href="mailto:{{email}}">{{email}}</a></span>
        </div>
        {{#has_address}}
        <div class="contact-item">
          <div class="contact-icon">📍</div>
          <span class="contact-label">Location</span>
          <span class="contact-value">{{address}}</span>
        </div>
        {{/has_address}}
      </div>
    </div>
  </section>

  {{#has_map}}
  <section class="map-section">
    <iframe src="{{maps_embed_url}}" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
  </section>
  {{/has_map}}

  <footer class="footer">
    <div class="container">
      <p>&copy; {{year}} {{business_name}}. All rights reserved.</p>
    </div>
  </footer>

  <script>
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
  </script>
</body>
</html>`;

// Professional and retail use the trades structure with their own hero CSS
const professionalHtml = tradesHtml
  .replace("What We Do", "Our Services")
  .replace("See examples of our recent projects", "Delivering results for businesses like yours")
  .replace(/Free Quotes/g, "Trusted Advice")
  .replace(/Fully Insured/g, "Qualified Experts")
  .replace(/Local & Reliable/g, "Confidential Service");

const retailHtml = tradesHtml
  .replace("What We Do", "What We Offer")
  .replace("See examples of our recent projects", "Quality products, friendly service")
  .replace("Our Work", "Products")
  .replace(/Free Quotes/g, "Quality Products")
  .replace(/Fully Insured/g, "Friendly Service")
  .replace(/Local & Reliable/g, "Visit Us Today");

// ---------------------------------------------------------------------------
// Config schema
// ---------------------------------------------------------------------------

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
    reviews_html: { type: "string" },
    hours_html: { type: "string" },
    gallery_html: { type: "string" },
    menu_html: { type: "string" },
    maps_embed_url: { type: "string" },
    primary_color: { type: "string" },
    accent_color: { type: "string" },
    logo_url: { type: "string" },
    hero_image_url: { type: "string" },
    heading_font: { type: "string" },
    body_font: { type: "string" },
    google_rating: { type: "string" },
    google_review_count: { type: "string" },
    stars_html: { type: "string" },
  },
});

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const siteTemplates: SiteTemplate[] = [
  {
    id: "trades-v1",
    name: "Trades Professional",
    vertical: "trades",
    template_type: "landing_page",
    html_template: tradesHtml,
    css_template: resetAndBase + tradesCss,
    config_schema_json: configSchema,
  },
  {
    id: "restaurant-v1",
    name: "Restaurant & Cafe",
    vertical: "food",
    template_type: "landing_page",
    html_template: foodHtml,
    css_template: resetAndBase + foodCss,
    config_schema_json: configSchema,
  },
  {
    id: "health-v1",
    name: "Health & Beauty",
    vertical: "health",
    template_type: "landing_page",
    html_template: healthHtml,
    css_template: resetAndBase + healthCss,
    config_schema_json: configSchema,
  },
  {
    id: "professional-v1",
    name: "Professional Services",
    vertical: "professional",
    template_type: "landing_page",
    html_template: professionalHtml,
    css_template: resetAndBase + professionalCss,
    config_schema_json: configSchema,
  },
  {
    id: "retail-v1",
    name: "Retail & Shop",
    vertical: "retail",
    template_type: "landing_page",
    html_template: retailHtml,
    css_template: resetAndBase + retailCss,
    config_schema_json: configSchema,
  },
];

// ---------------------------------------------------------------------------
// Vertical defaults
// ---------------------------------------------------------------------------

export const verticalDefaults: Record<string, {
  primary_color: string;
  accent_color: string;
  cta_text: string;
  heading_font: string;
  heading_font_import: string;
  body_font: string;
  body_font_import: string;
}> = {
  trades:       { primary_color: "#2563eb", accent_color: "#1e40af", cta_text: "Call Now — Free Quote", heading_font: "Inter", heading_font_import: "Inter:wght@600;800;900", body_font: "Inter", body_font_import: "Inter:wght@400;500;600" },
  food:         { primary_color: "#dc2626", accent_color: "#991b1b", cta_text: "Book A Table", heading_font: "Playfair Display", heading_font_import: "Playfair+Display:wght@600;700;800", body_font: "Inter", body_font_import: "Inter:wght@400;500;600" },
  health:       { primary_color: "#7c3aed", accent_color: "#6d28d9", cta_text: "Book An Appointment", heading_font: "DM Sans", heading_font_import: "DM+Sans:wght@500;700;800", body_font: "DM Sans", body_font_import: "DM+Sans:wght@400;500" },
  professional: { primary_color: "#0f766e", accent_color: "#115e59", cta_text: "Get In Touch", heading_font: "Inter", heading_font_import: "Inter:wght@600;800;900", body_font: "Inter", body_font_import: "Inter:wght@400;500;600" },
  retail:       { primary_color: "#ea580c", accent_color: "#c2410c", cta_text: "Visit Us Today", heading_font: "Inter", heading_font_import: "Inter:wght@600;800;900", body_font: "Inter", body_font_import: "Inter:wght@400;500;600" },
  general:      { primary_color: "#2563eb", accent_color: "#1e40af", cta_text: "Contact Us", heading_font: "Inter", heading_font_import: "Inter:wght@600;800;900", body_font: "Inter", body_font_import: "Inter:wght@400;500;600" },
};

/**
 * Map business types to template verticals.
 */
export function resolveVertical(businessType: string): string {
  const lower = (businessType ?? "").toLowerCase();
  const trades = ["plumber", "electrician", "builder", "roofer", "painter", "decorator", "carpenter", "locksmith", "mechanic", "gardener", "cleaner", "handyman", "fencer", "tiler"];
  const food = ["restaurant", "cafe", "takeaway", "caterer", "baker", "butcher", "pub", "bar", "bistro", "pizza", "coffee", "kitchen", "grill"];
  const health = ["dentist", "salon", "barber", "physio", "chiropractor", "spa", "gym", "fitness", "yoga", "beauty", "massage", "therapist", "clinic"];
  const professional = ["accountant", "lawyer", "solicitor", "architect", "consultant", "tutor", "financial", "estate agent"];
  const retail = ["shop", "store", "florist", "grocer", "pet", "nursery", "boutique", "jeweller"];

  if (trades.some((t) => lower.includes(t))) return "trades";
  if (food.some((t) => lower.includes(t))) return "food";
  if (health.some((t) => lower.includes(t))) return "health";
  if (professional.some((t) => lower.includes(t))) return "professional";
  if (retail.some((t) => lower.includes(t))) return "retail";
  return "trades";
}
