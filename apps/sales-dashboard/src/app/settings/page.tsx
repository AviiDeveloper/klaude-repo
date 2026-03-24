'use client';

import { useState } from 'react';
import { ChevronRight, Shield, MapPin, Bell, FileText, Lock, Trash2 } from 'lucide-react';

export default function SettingsPage() {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [area, setArea] = useState('Manchester City Centre');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const sections = [
    {
      id: 'security',
      title: 'Security',
      icon: Shield,
      description: 'Password and authentication',
    },
    {
      id: 'area',
      title: 'Coverage Area',
      icon: MapPin,
      description: area,
    },
    {
      id: 'notifications',
      title: 'Notifications',
      icon: Bell,
      description: 'Email and push preferences',
    },
    {
      id: 'legal',
      title: 'Legal',
      icon: FileText,
      description: 'Terms, privacy, and data',
    },
  ];

  return (
    <div className="py-8 page-enter">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[24px] font-semibold text-white tracking-[-0.03em] mb-1">Settings</h1>
        <p className="text-[13px] text-[#666]">Manage your account preferences</p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-3">
        {sections.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSection === section.id;

          return (
            <div key={section.id} className="bg-[#0a0a0a] rounded-xl border border-[#333] overflow-hidden">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-5 hover:bg-[#111] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#111] flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#999]" />
                  </div>
                  <div className="text-left">
                    <p className="text-[15px] font-medium text-white">{section.title}</p>
                    <p className="text-[13px] text-[#666]">{section.description}</p>
                  </div>
                </div>
                <ChevronRight
                  className={`w-5 h-5 text-[#666] transition-transform ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                />
              </button>

              {/* Section Content */}
              {isExpanded && (
                <div className="border-t border-[#222] p-5 bg-[#111]">
                  {/* Security Section */}
                  {section.id === 'security' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[13px] font-medium text-[#999] mb-2">
                          Current PIN
                        </label>
                        <input
                          type="password"
                          placeholder="Enter current PIN"
                          maxLength={4}
                          className="w-full px-4 py-2.5 bg-[#111] border border-[#333] rounded-lg text-[13px] text-white placeholder:text-[#666] focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-[13px] font-medium text-[#999] mb-2">
                          New PIN
                        </label>
                        <input
                          type="password"
                          placeholder="Enter new PIN"
                          maxLength={4}
                          className="w-full px-4 py-2.5 bg-[#111] border border-[#333] rounded-lg text-[13px] text-white placeholder:text-[#666] focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-[13px] font-medium text-[#999] mb-2">
                          Confirm New PIN
                        </label>
                        <input
                          type="password"
                          placeholder="Re-enter new PIN"
                          maxLength={4}
                          className="w-full px-4 py-2.5 bg-[#111] border border-[#333] rounded-lg text-[13px] text-white placeholder:text-[#666] focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
                        />
                      </div>

                      <button className="w-full px-4 py-2.5 bg-white text-black rounded-lg text-[13px] font-medium hover:bg-[#ededed] transition-colors">
                        Update PIN
                      </button>
                    </div>
                  )}

                  {/* Coverage Area Section */}
                  {section.id === 'area' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[13px] font-medium text-[#999] mb-2">
                          Your Coverage Area
                        </label>
                        <input
                          type="text"
                          value={area}
                          onChange={(e) => setArea(e.target.value)}
                          placeholder="e.g. Manchester City Centre"
                          className="w-full px-4 py-2.5 bg-[#111] border border-[#333] rounded-lg text-[13px] text-white placeholder:text-[#666] focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
                        />
                        <p className="mt-2 text-[12px] text-[#666]">
                          This helps us send you relevant leads in your area
                        </p>
                      </div>

                      <button className="w-full px-4 py-2.5 bg-white text-black rounded-lg text-[13px] font-medium hover:bg-[#ededed] transition-colors">
                        Save Area
                      </button>
                    </div>
                  )}

                  {/* Notifications Section */}
                  {section.id === 'notifications' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between py-3">
                        <div>
                          <p className="text-[13px] font-medium text-white">Email Notifications</p>
                          <p className="text-[12px] text-[#666]">New leads and updates</p>
                        </div>
                        <button
                          onClick={() => setEmailNotifications(!emailNotifications)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            emailNotifications ? 'bg-white' : 'bg-[#333]'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                              emailNotifications ? 'translate-x-6 bg-black' : 'translate-x-1 bg-[#666]'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between py-3 border-t border-[#333]">
                        <div>
                          <p className="text-[13px] font-medium text-white">Push Notifications</p>
                          <p className="text-[12px] text-[#666]">Real-time alerts</p>
                        </div>
                        <button
                          onClick={() => setPushNotifications(!pushNotifications)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            pushNotifications ? 'bg-white' : 'bg-[#333]'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                              pushNotifications ? 'translate-x-6 bg-black' : 'translate-x-1 bg-[#666]'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Legal Section */}
                  {section.id === 'legal' && (
                    <div className="space-y-3">
                      <a
                        href="/legal/terms"
                        className="flex items-center justify-between py-3 hover:bg-[#1a1a1a] rounded-lg px-3 -mx-3 transition-colors"
                      >
                        <span className="text-[13px] text-white">Terms of Service</span>
                        <ChevronRight className="w-4 h-4 text-[#666]" />
                      </a>

                      <a
                        href="/legal/privacy"
                        className="flex items-center justify-between py-3 hover:bg-[#1a1a1a] rounded-lg px-3 -mx-3 transition-colors"
                      >
                        <span className="text-[13px] text-white">Privacy Policy</span>
                        <ChevronRight className="w-4 h-4 text-[#666]" />
                      </a>

                      <button className="flex items-center justify-between w-full py-3 hover:bg-[#1a1a1a] rounded-lg px-3 -mx-3 transition-colors">
                        <span className="text-[13px] text-white">Download My Data</span>
                        <ChevronRight className="w-4 h-4 text-[#666]" />
                      </button>

                      <div className="pt-3 border-t border-[#333]">
                        <button className="flex items-center gap-2 text-[13px] text-red-400 hover:text-red-300 transition-colors">
                          <Trash2 className="w-4 h-4" />
                          Delete Account
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* App Info */}
      <div className="mt-8 text-center">
        <p className="text-[11px] text-[#666] uppercase tracking-wide mb-1">SalesFlow</p>
        <p className="text-[11px] text-[#666]">Version 2.1.0</p>
      </div>
    </div>
  );
}
