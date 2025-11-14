'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { User, Lock, Bell, Database, HelpCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ProfileSettings } from '@/components/settings/profile-settings';
import { PasswordSettings } from '@/components/settings/password-settings';
import { PreferencesSettings } from '@/components/settings/preferences-settings';
import { DataSettings } from '@/components/settings/data-settings';

type SettingsTab = 'profile' | 'password' | 'preferences' | 'data';

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['profile', 'password', 'preferences', 'data'].includes(tab)) {
      setActiveTab(tab as SettingsTab);
    }
  }, [searchParams]);

  const tabs = [
    { id: 'profile' as SettingsTab, name: 'Profile', icon: User, description: 'Manage your personal information' },
    { id: 'password' as SettingsTab, name: 'Password', icon: Lock, description: 'Change your password' },
    { id: 'preferences' as SettingsTab, name: 'Preferences', icon: Bell, description: 'Customize your experience' },
    { id: 'data' as SettingsTab, name: 'Data', icon: Database, description: 'Export or manage your data' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileSettings />;
      case 'password':
        return <PasswordSettings />;
      case 'preferences':
        return <PreferencesSettings />;
      case 'data':
        return <DataSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar Navigation */}
        <Card className="p-4 lg:col-span-1 h-fit">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                    isActive ? 'text-primary-600' : 'text-gray-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${
                      isActive ? 'text-primary-700' : 'text-gray-900'
                    }`}>
                      {tab.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">
                      {tab.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Help Link */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <a
              href="/help"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <HelpCircle className="h-5 w-5 text-gray-400" />
              <span className="text-sm font-medium">Help & Support</span>
            </a>
          </div>
        </Card>

        {/* Content Area */}
        <div className="lg:col-span-3">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}
