'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { SignupForm } from '@/components/auth/signup-form';
import { useAuthStore } from '@/lib/stores/auth-store';
import Image from 'next/image';

export default function SignupPage() {
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
      <div className="flex w-full flex-1 flex-col justify-center bg-white px-4 py-12 sm:px-6 lg:w-1/2 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image
              src="/kitcha-logo-name.png"
              alt="Kitcha"
              width={160}
              height={56}
              priority
              className="w-35"
            />
          </Link>

          {/* Title */}
          <h2 className="mt-8 text-3xl font-bold tracking-tight text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Join thousands who are saving money and reducing food waste
          </p>

          {/* Signup Form */}
          <div className="mt-8">
            <SignupForm />
          </div>
        </div>
      </div>

      {/* Right Side - Image/Illustration */}
      <div className="relative hidden lg:block lg:w-1/2">
        <div className="from-primary-500 to-primary-700 absolute inset-0 bg-gradient-to-br">
          <div className="flex h-full items-center justify-center p-12">
            <div className="max-w-md text-white">
              <h3 className="text-3xl font-bold">Start your journey to smarter shopping</h3>
              <p className="text-primary-100 mt-4 text-lg">
                Get personalized meal plans, track your pantry inventory, and never waste food
                again.
              </p>
              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <span className="text-xl">💳</span>
                  </div>
                  <span className="text-sm">Free forever - no credit card required</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <span className="text-xl">🤖</span>
                  </div>
                  <span className="text-sm">AI-powered meal suggestions</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <span className="text-xl">📝</span>
                  </div>
                  <span className="text-sm">Smart shopping lists and budget tracking</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
