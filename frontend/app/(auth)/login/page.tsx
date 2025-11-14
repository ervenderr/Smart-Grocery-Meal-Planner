'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { LoginForm } from '@/components/auth/login-form';
import { useAuthStore } from '@/lib/stores/auth-store';
import Image from 'next/image'; 

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Side - Form */}
      <div className="flex w-full flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:w-1/2 lg:px-20 xl:px-24 bg-white">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo */}
            <Link href="/" className="flex items-center">
            <Image
              src="/kitcha-logo-name.svg"
              alt="Kitcha"
              width={160}
              height={56}
              priority
              className="w-20"
            />
          </Link>

          {/* Title */}
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Log in to continue managing your meals and groceries
          </p>

          {/* Login Form */}
          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
      </div>

      {/* Right Side - Image/Illustration */}
      <div className="relative hidden lg:block lg:w-1/2">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-primary-700">
          <div className="flex h-full items-center justify-center p-12">
            <div className="max-w-md text-white">
              <h3 className="text-3xl font-bold">Plan smarter, shop better, save more</h3>
              <p className="mt-4 text-lg text-primary-100">
                Join thousands of users who are taking control of their grocery spending and
                reducing food waste.
              </p>
              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <span className="text-xl">📊</span>
                  </div>
                  <span className="text-sm">Track spending in real-time</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <span className="text-xl">🥗</span>
                  </div>
                  <span className="text-sm">Plan meals for the entire week</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <span className="text-xl">💰</span>
                  </div>
                  <span className="text-sm">Save money with budget insights</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
