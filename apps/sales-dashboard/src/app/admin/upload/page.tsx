'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Check, Loader2 } from 'lucide-react';

export default function UploadDemoPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('other');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleUpload = async () => {
    if (!file || !businessName) return;
    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('business_name', businessName);
    formData.append('category', category);
    formData.append('city', city);
    formData.append('postcode', postcode);

    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Upload failed');
        return;
      }

      setSuccess(`Uploaded "${businessName}" — demo domain: ${data.data.demo_domain}`);
      setFile(null);
      setBusinessName('');
      setCity('');
      setPostcode('');
    } catch (err) {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-6">Upload Demo Site</h1>

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
        {/* File Upload */}
        <div>
          <label className="block text-[12px] text-[#888] mb-2">HTML File</label>
          <label className="flex items-center justify-center gap-2 p-8 border-2 border-dashed border-[#333] rounded-xl cursor-pointer hover:border-[#555] transition-colors">
            <Upload className="w-5 h-5 text-[#666]" />
            <span className="text-[14px] text-[#888]">
              {file ? file.name : 'Choose HTML file'}
            </span>
            <input
              type="file"
              accept=".html,.htm"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {/* Business Name */}
        <div>
          <label className="block text-[12px] text-[#888] mb-2">Business Name</label>
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="e.g. Mannys Barbers"
            className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-lg text-[14px] focus:border-white outline-none transition-colors"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-[12px] text-[#888] mb-2">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-lg text-[14px] focus:border-white outline-none transition-colors"
          >
            <option value="restaurant">Restaurant</option>
            <option value="retail">Retail</option>
            <option value="trades">Trades</option>
            <option value="beauty">Beauty</option>
            <option value="professional">Professional</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* City + Postcode */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] text-[#888] mb-2">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Aberdeen"
              className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-lg text-[14px] focus:border-white outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-[12px] text-[#888] mb-2">Postcode</label>
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              placeholder="e.g. AB10"
              className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-lg text-[14px] focus:border-white outline-none transition-colors"
            />
          </div>
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || !businessName || uploading}
          className="w-full bg-white text-black py-3 rounded-lg text-[15px] font-medium hover:bg-[#ededed] transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {uploading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
          ) : (
            <><Upload className="w-4 h-4" /> Upload Demo</>
          )}
        </button>
      </div>
    </div>
  );
}
