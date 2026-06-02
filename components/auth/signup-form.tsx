"use client";
import { useActionState } from "react";
import Link from "next/link";
import { signup } from "@/app/actions/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);

  if (state?.success) {
    return (
      <div className="text-center space-y-3">
        <div className="text-5xl">📧</div>
        <h3 className="text-lg font-semibold text-gray-900">Check your inbox</h3>
        <p className="text-sm text-gray-500">{state.message}</p>
        <Link href="/login" className="text-sm text-blue-600 hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state?.message && !state.success && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      <Input
        id="name"
        name="name"
        label="Full name"
        placeholder="John Doe"
        autoComplete="name"
        error={state?.errors?.name?.[0]}
      />
      <Input
        id="email"
        name="email"
        type="email"
        label="Email address"
        placeholder="you@example.com"
        autoComplete="email"
        error={state?.errors?.email?.[0]}
      />
      <Input
        id="password"
        name="password"
        type="password"
        label="Password"
        placeholder="At least 8 characters"
        autoComplete="new-password"
        error={state?.errors?.password?.[0]}
      />

      <Button type="submit" className="w-full" loading={pending}>
        Create account
      </Button>

      <p className="text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="text-blue-600 hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </form>
  );
}
