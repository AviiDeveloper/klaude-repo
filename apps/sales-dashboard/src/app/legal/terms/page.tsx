import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="page-enter">
      <div className="px-6 md:px-8 py-5 border-b border-[#222]">
        <Link href="/settings" className="flex items-center gap-1.5 text-[12px] text-[#666] hover:text-white mb-3">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Settings
        </Link>
        <h1 className="text-[15px] font-semibold text-white">Terms of Service</h1>
        <p className="text-[11px] text-[#666] mt-0.5">Last updated: March 2026</p>
      </div>
      <div className="px-6 md:px-8 py-6 max-w-2xl">
        <div className="space-y-6">
          <LegalSection title="1. Introduction">
            These Terms of Service govern your use of the SalesFlow platform as an independent sales contractor. By creating an account, you agree to these terms.
          </LegalSection>
          <LegalSection title="2. Contractor Relationship">
            You are an independent contractor, not an employee of SalesFlow. You are free to set your own hours, choose which leads to pursue, and decline any assignment. SalesFlow does not control when, where, or how you work. You are responsible for your own tax obligations as a self-employed individual.
          </LegalSection>
          <LegalSection title="3. Commission Structure">
            You earn a flat commission of fifty pounds per confirmed sale. Commissions are processed weekly and paid to your registered bank account. A minimum payout threshold of fifty pounds applies. SalesFlow reserves the right to adjust commission rates with 30 days notice.
          </LegalSection>
          <LegalSection title="4. Lead Assignments">
            Leads are assigned automatically based on your registered area. You may reject any lead without penalty. Rejected leads are returned to the assignment pool. SalesFlow does not guarantee a minimum number of leads.
          </LegalSection>
          <LegalSection title="5. Acceptable Conduct">
            You must represent SalesFlow professionally. You must not make false claims about the product or service. You must not harass, pressure, or mislead business owners. Violations may result in account suspension or termination.
          </LegalSection>
          <LegalSection title="6. Intellectual Property">
            Demo websites, talking points, and marketing materials are the property of SalesFlow. You may use them solely for the purpose of making sales through the platform.
          </LegalSection>
          <LegalSection title="7. Termination">
            Either party may terminate this agreement at any time. Unpaid commissions for confirmed sales will be honoured. SalesFlow may suspend accounts that violate these terms.
          </LegalSection>
          <LegalSection title="8. Liability">
            SalesFlow is not liable for any losses incurred while performing sales activities. You operate at your own risk as an independent contractor.
          </LegalSection>
          <LegalSection title="9. Changes to Terms">
            We may update these terms from time to time. Material changes will be communicated via the app. Continued use constitutes acceptance.
          </LegalSection>
          <LegalSection title="10. Governing Law">
            These terms are governed by the laws of England and Wales.
          </LegalSection>
        </div>
      </div>
    </div>
  );
}

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[13px] font-semibold text-white mb-2">{title}</h2>
      <p className="text-[12px] text-[#666] leading-relaxed">{children}</p>
    </div>
  );
}
