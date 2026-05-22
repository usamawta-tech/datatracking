"use client";
import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/app/actions/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="space-y-4">
      {state?.errors?.email?.[0] && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.errors.email[0]}
        </div>
      )}

      <Input
        id="email"
        name="email"
        type="email"
        label="Email address"
        placeholder="you@example.com"
        autoComplete="email"
        error={state?.errors?.email?.[0] === "Invalid email or password" || state?.errors?.email?.[0] === "Please verify your email before logging in" ? state.errors.email[0] : undefined}
      />
      <Input
        id="password"
        name="password"
        type="password"
        label="Password"
        placeholder="Your password"
        autoComplete="current-password"
        error={state?.errors?.password?.[0]}
      />

      <Button type="submit" className="w-full" loading={pending}>
        Sign in
      </Button>

      <p className="text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-blue-600 hover:underline font-medium">
          Sign up
        </Link>
      </p>
    </form>
  );
}
