'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import toast from 'react-hot-toast';

const signupSchema = z
  .object({
    firstName: z.string().min(2, 'First name must be at least 2 characters'),
    lastName: z.string().min(2, 'Last name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type SignupFormData = z.infer<typeof signupSchema>;

export function SignupForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { setAuth } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
    getValues,
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: 'onChange',
  });

  const handleNextStep = async () => {
    let isValid = false;

    if (step === 1) {
      isValid = await trigger(['firstName', 'lastName', 'email']);
    } else if (step === 2) {
      isValid = await trigger(['password', 'confirmPassword']);
    }

    if (isValid) {
      setStep(step + 1);
    }
  };

  const handlePrevStep = () => {
    setStep(step - 1);
  };

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);

    try {
      const signupData = {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      };

      const response = await authApi.signup(signupData);

      // Store auth data
      setAuth(response.token, response.user);

      // Show success message
      toast.success('Account created successfully! Welcome aboard!');

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Signup error:', error);

      // Show error message
      const errorMessage =
        error?.response?.data?.message || 'Failed to create account. Please try again.';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Progress Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-12 rounded-full transition-colors ${
              step >= 1 ? 'bg-primary-500' : 'bg-gray-200'
            }`}
          />
          <div
            className={`h-2 w-12 rounded-full transition-colors ${
              step >= 2 ? 'bg-primary-500' : 'bg-gray-200'
            }`}
          />
          <div
            className={`h-2 w-12 rounded-full transition-colors ${
              step >= 3 ? 'bg-primary-500' : 'bg-gray-200'
            }`}
          />
        </div>
        <span className="text-sm text-gray-500">Step {step} of 3</span>
      </div>

      {/* Step 1: Basic Information */}
      {step === 1 && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-lg font-semibold text-gray-900">Let's get started</h3>
          <p className="text-sm text-gray-600">Tell us a bit about yourself</p>

          <Input
            label="First Name"
            type="text"
            placeholder="John"
            icon={<User className="h-4 w-4" />}
            error={errors.firstName?.message}
            required
            {...register('firstName')}
          />

          <Input
            label="Last Name"
            type="text"
            placeholder="Doe"
            icon={<User className="h-4 w-4" />}
            error={errors.lastName?.message}
            required
            {...register('lastName')}
          />

          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            icon={<Mail className="h-4 w-4" />}
            error={errors.email?.message}
            required
            {...register('email')}
          />

          <Button type="button" fullWidth onClick={handleNextStep}>
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Step 2: Password Setup */}
      {step === 2 && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-lg font-semibold text-gray-900">Create a secure password</h3>
          <p className="text-sm text-gray-600">
            Your password must be at least 8 characters with uppercase, lowercase, and a number
          </p>

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              icon={<Lock className="h-4 w-4" />}
              error={errors.password?.message}
              required
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="relative">
            <Input
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="••••••••"
              icon={<Lock className="h-4 w-4" />}
              error={errors.confirmPassword?.message}
              required
              {...register('confirmPassword')}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" fullWidth onClick={handlePrevStep}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button type="button" fullWidth onClick={handleNextStep}>
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Submit */}
      {step === 3 && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-lg font-semibold text-gray-900">Review your details</h3>
          <p className="text-sm text-gray-600">Make sure everything looks good</p>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div>
              <p className="text-xs text-gray-500">Full Name</p>
              <p className="text-sm font-medium text-gray-900">
                {getValues('firstName')} {getValues('lastName')}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="text-sm font-medium text-gray-900">{getValues('email')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Password</p>
              <p className="text-sm font-medium text-gray-900">••••••••</p>
            </div>
          </div>

          <div className="rounded-lg border border-primary-200 bg-primary-50 p-3">
            <p className="text-xs text-primary-800">
              By creating an account, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" fullWidth onClick={handlePrevStep}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button type="submit" fullWidth loading={isLoading} disabled={isLoading}>
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </div>
        </div>
      )}

      {/* Sign In Link */}
      <p className="text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary-500 hover:text-primary-600">
          Sign in
        </Link>
      </p>
    </form>
  );
}
