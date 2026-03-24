import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ContractorAgreementPage() {
  return (
    <div className="page-enter">
      <div className="px-6 md:px-8 py-5 border-b border-[#222]">
        <Link href="/settings" className="flex items-center gap-1.5 text-[12px] text-[#666] hover:text-white mb-3">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Settings
        </Link>
        <h1 className="text-[15px] font-semibold text-white">Contractor Agreement</h1>
        <p className="text-[11px] text-[#666] mt-0.5">Last updated: March 2026</p>
      </div>
      <div className="px-6 md:px-8 py-6 max-w-2xl">
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 mb-6">
          <p className="text-[12px] text-yellow-500 leading-relaxed">
            This agreement confirms that you operate as an independent contractor, not an employee of SalesFlow. Please read carefully.
          </p>
        </div>

        <div className="space-y-6">
          <LegalSection title="1. Contractor Status">
            By using the SalesFlow platform, you confirm that you are operating as a self-employed independent contractor. You are not an employee, worker, or agent of SalesFlow. This agreement does not create an employment relationship, partnership, or joint venture.
          </LegalSection>
          <LegalSection title="2. Freedom to Work">
            You are free to: choose when and where you work, accept or decline any lead assignment, work for other companies simultaneously, and cease working at any time without notice. SalesFlow does not set working hours, require minimum activity, or impose targets.
          </LegalSection>
          <LegalSection title="3. Tax Obligations">
            As a self-employed individual, you are responsible for: registering with HMRC as self-employed, filing your own tax returns, paying income tax and National Insurance contributions, and keeping accurate records of your earnings. SalesFlow does not deduct tax from your commissions.
          </LegalSection>
          <LegalSection title="4. Commission Payments">
            Commission is fifty pounds per confirmed sale. Payment is not a salary or wage. No commission is payable for leads that are not converted to sales. SalesFlow reserves the right to withhold commission in cases of fraud or misrepresentation.
          </LegalSection>
          <LegalSection title="5. No Benefits">
            As an independent contractor, you are not entitled to: holiday pay, sick pay, pension contributions, redundancy payments, or any other employment benefits. You may wish to arrange your own insurance.
          </LegalSection>
          <LegalSection title="6. Equipment">
            You are responsible for providing your own equipment including a smartphone and internet access. SalesFlow provides the app and digital materials at no cost.
          </LegalSection>
          <LegalSection title="7. Professional Conduct">
            While representing the SalesFlow platform, you agree to: act professionally and honestly, not misrepresent the product or service, respect business owners and their decisions, and comply with all applicable laws.
          </LegalSection>
          <LegalSection title="8. Termination">
            Either party may end this agreement at any time without notice. Outstanding commissions for confirmed sales will be paid within 30 days of termination.
          </LegalSection>
          <LegalSection title="9. Disputes">
            Any disputes will be resolved through mediation before legal action. This agreement is governed by the laws of England and Wales. The courts of England and Wales have exclusive jurisdiction.
          </LegalSection>
          <LegalSection title="10. Acceptance">
            By creating a SalesFlow account, you acknowledge that you have read, understood, and agree to this Contractor Agreement.
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
