import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <>
      <div className="px-6 md:px-8 py-5 border-b border-slate-100">
        <Link href="/settings" className="flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-600 mb-3">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Settings
        </Link>
        <h1 className="text-[15px] font-semibold text-slate-900">Privacy Policy</h1>
        <p className="text-[11px] text-slate-400 mt-0.5">Last updated: March 2026</p>
      </div>
      <div className="px-6 md:px-8 py-6 max-w-2xl">
        <div className="space-y-6">
          <LegalSection title="1. Data We Collect">
            We collect your name, PIN (hashed), area postcode, phone number (optional), and GPS location when you mark a lead as visited. We also store your sales activity, notes, and commission data.
          </LegalSection>
          <LegalSection title="2. How We Use Your Data">
            Your data is used to: assign leads to your area, track your sales activity and commissions, improve the platform, and communicate with you about your account.
          </LegalSection>
          <LegalSection title="3. Business Data">
            Lead information (business names, addresses, ratings, reviews) is collected from publicly available sources including Google Maps, social media, and business websites. This data is used to generate demo sites and sales intelligence.
          </LegalSection>
          <LegalSection title="4. Data Sharing">
            We do not sell your personal data. We may share anonymised, aggregated statistics. Your sales data is visible to platform administrators for operational purposes.
          </LegalSection>
          <LegalSection title="5. Data Storage">
            Data is stored on secure servers within the United Kingdom. We use encryption for sensitive data including PINs and authentication tokens.
          </LegalSection>
          <LegalSection title="6. Your Rights (GDPR)">
            You have the right to: access your data, correct inaccurate data, request deletion of your data, export your data in a portable format, and withdraw consent at any time. Contact support@salesflow.app to exercise these rights.
          </LegalSection>
          <LegalSection title="7. Data Retention">
            Account data is retained while your account is active. After account deletion, we retain financial records for 7 years as required by HMRC regulations. All other data is deleted within 30 days.
          </LegalSection>
          <LegalSection title="8. Cookies">
            We use a single session cookie to keep you signed in. We do not use tracking cookies, analytics cookies, or third-party advertising cookies.
          </LegalSection>
          <LegalSection title="9. GPS Data">
            Location data is collected only when you explicitly mark a lead as visited. It is used for visit verification and is not shared with third parties.
          </LegalSection>
          <LegalSection title="10. Contact">
            For privacy enquiries, contact: support@salesflow.app
          </LegalSection>
        </div>
      </div>
    </>
  );
}

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[13px] font-semibold text-slate-900 mb-2">{title}</h2>
      <p className="text-[12px] text-slate-500 leading-relaxed">{children}</p>
    </div>
  );
}
