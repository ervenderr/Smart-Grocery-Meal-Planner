'use client';

import { User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAuthStore } from '@/lib/stores/auth-store';

export default function ProfilePage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Profile</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your account information
          </p>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-500 text-white text-2xl font-bold">
            {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {user?.firstName} {user?.lastName}
            </h2>
            <p className="text-sm text-gray-600">{user?.email}</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">First Name</label>
            <p className="mt-1 text-gray-900">{user?.firstName || 'Not set'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Last Name</label>
            <p className="mt-1 text-gray-900">{user?.lastName || 'Not set'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Email</label>
            <p className="mt-1 text-gray-900">{user?.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Member Since</label>
            <p className="mt-1 text-gray-900">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
            </p>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <div className="rounded-full bg-gray-100 p-4">
          <User className="h-12 w-12 text-gray-600" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Profile Editing</h3>
        <p className="mt-2 text-sm text-gray-600 max-w-sm">
          Profile editing is coming soon. You'll be able to update your information here.
        </p>
      </Card>
    </div>
  );
}
