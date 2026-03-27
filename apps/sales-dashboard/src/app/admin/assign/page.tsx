'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, UserPlus } from 'lucide-react';

interface Salesperson {
  id: string;
  name: string;
  area_postcode: string | null;
}

interface Demo {
  id: string;
  business_name: string;
  category: string;
  city: string | null;
}

export default function AssignLeadPage() {
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [demos, setDemos] = useState<Demo[]>([]);
  const [selectedSp, setSelectedSp] = useState('');
  const [selectedDemo, setSelectedDemo] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/salespeople').then(r => r.json()).then(d => setSalespeople(d.data ?? []));
    fetch('/api/admin/demos').then(r => r.json()).then(d => setDemos(d.data ?? []));
  }, []);

  const handleAssign = async () => {
    if (!selectedSp || !selectedDemo) return;
    setAssigning(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/admin/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesperson_id: selectedSp,
          business_profile_id: selectedDemo,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Assignment failed');
        return;
      }

      const spName = salespeople.find(s => s.id === selectedSp)?.name ?? '';
      setSuccess(`Assigned "${data.data.business_name}" to ${spName}`);
      setSelectedSp('');
      setSelectedDemo('');
    } catch (err) {
      setError('Assignment failed');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-6">Assign Lead to Salesperson</h1>

      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg mb-6">
          <Check className="w-4 h-4 text-emerald-400" />
          <p className="text-[13px] text-emerald-400">{success}</p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-6">
          <p className="text-[13px] text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-5">
        {/* Select Salesperson */}
        <div>
          <label className="block text-[12px] text-[#888] mb-2">Salesperson</label>
          <select
            value={selectedSp}
            onChange={(e) => setSelectedSp(e.target.value)}
            className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-lg text-[14px] focus:border-white outline-none transition-colors"
          >
            <option value="">Choose a salesperson...</option>
            {salespeople.map(sp => (
              <option key={sp.id} value={sp.id}>
                {sp.name} {sp.area_postcode ? `(${sp.area_postcode})` : ''}
              </option>
            ))}
          </select>
          {salespeople.length === 0 && (
            <p className="text-[11px] text-[#555] mt-1">No salespeople yet — they need to sign up first</p>
          )}
        </div>

        {/* Select Demo */}
        <div>
          <label className="block text-[12px] text-[#888] mb-2">Demo Site</label>
          <select
            value={selectedDemo}
            onChange={(e) => setSelectedDemo(e.target.value)}
            className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-lg text-[14px] focus:border-white outline-none transition-colors"
          >
            <option value="">Choose a demo site...</option>
            {demos.map(d => (
              <option key={d.id} value={d.id}>
                {d.business_name} ({d.category}{d.city ? `, ${d.city}` : ''})
              </option>
            ))}
          </select>
          {demos.length === 0 && (
            <p className="text-[11px] text-[#555] mt-1">No demos uploaded yet — upload one first</p>
          )}
        </div>

        <button
          onClick={handleAssign}
          disabled={!selectedSp || !selectedDemo || assigning}
          className="w-full bg-white text-black py-3 rounded-lg text-[15px] font-medium hover:bg-[#ededed] transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {assigning ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Assigning...</>
          ) : (
            <><UserPlus className="w-4 h-4" /> Assign Lead</>
          )}
        </button>
      </div>
    </div>
  );
}
