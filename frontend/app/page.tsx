import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  ShoppingCart,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Sparkles,
  Wallet
} from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center">
            <Image
              src="/kitcha-logo-name.svg"
              alt="Kitcha"
              width={120}
              height={32}
              priority
              className="h-30 w-auto"
            />
          </Link>
          <div className="flex gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-gray-700 hover:text-gray-900">
                Log In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Plan Meals, Track Groceries,
            <span className="block text-primary-500">Stay Within Budget</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 sm:text-xl">
            The smart way to manage your pantry, plan weekly meals, and track your grocery spending with real-time budget insights.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/signup">
              <Button size="lg" className="w-full sm:w-auto">
                Start Free Today
              </Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Learn More
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-500">No credit card required • Free forever</p>
        </div>

        {/* Hero Image */}
        <div className="mt-16 rounded-2xl overflow-hidden shadow-2xl">
          <Image
            src="/top-view-tasty-food-devices.jpg"
            alt="Delicious food and grocery planning"
            width={1200}
            height={675}
            priority
            className="w-full h-auto object-cover"
          />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Everything You Need to Stay Organized
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Powerful features to help you save money and reduce food waste
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100">
                <ShoppingCart className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-gray-900">Pantry Management</h3>
              <p className="mt-2 text-gray-600">
                Track everything you have at home. Never forget what's in your fridge or pantry again.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-gray-900">Meal Planning</h3>
              <p className="mt-2 text-gray-600">
                Plan your weekly meals with ease. Drag and drop recipes to create the perfect week.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100">
                <Wallet className="h-6 w-6 text-amber-600" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-gray-900">Budget Tracking</h3>
              <p className="mt-2 text-gray-600">
                Monitor your spending with real-time budget insights and spending trends.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                <CheckCircle2 className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-gray-900">Shopping Lists</h3>
              <p className="mt-2 text-gray-600">
                Generate smart shopping lists from your meal plans. Check off items as you shop.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-gray-900">Price Analytics</h3>
              <p className="mt-2 text-gray-600">
                Track price trends and get alerts when you're approaching your budget limit.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-pink-100">
                <Sparkles className="h-6 w-6 text-pink-600" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-gray-900">Expiry Alerts</h3>
              <p className="mt-2 text-gray-600">
                Get notified before food expires. Reduce waste and save money by using items on time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary-500 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Ready to Take Control of Your Grocery Budget?
          </h2>
          <p className="mt-4 text-lg text-primary-100">
            Join thousands of users who are saving money and reducing food waste.
          </p>
          <div className="mt-8">
            <Link href="/signup">
              <Button size="lg" variant="secondary" className="bg-white text-primary-500 hover:bg-gray-100">
                Get Started for Free
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500 sm:px-6 lg:px-8">
          <p>&copy; 2025 Kitcha. Built with ❤️ for better grocery management.</p>
        </div>
      </footer>
    </div>
  );
}
