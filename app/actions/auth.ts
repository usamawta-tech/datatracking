"use server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";

const SignupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-zA-Z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

const LoginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type AuthState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
} | undefined;

export async function signup(state: AuthState, formData: FormData): Promise<AuthState> {
  const raw = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const result = SignupSchema.safeParse(raw);
  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors };
  }

  const { name, email, password } = result.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { errors: { email: ["An account with this email already exists"] } };
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword },
  });

  // Create verification token
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: {
      token,
      userId: user.id,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // In development, auto-verify the user so the flow works without a real email service
  const hasRealResendKey = process.env.RESEND_API_KEY?.startsWith("re_") &&
    !process.env.RESEND_API_KEY?.includes("your_resend");
  if (process.env.NODE_ENV !== "production" && !hasRealResendKey) {
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
    await prisma.verificationToken.delete({ where: { token } });
    return { success: true, message: "Account created! (Dev mode: email auto-verified) You can now sign in." };
  }

  try {
    await sendVerificationEmail(email, token);
  } catch {
    // Don't block signup if email fails in dev
  }

  return { success: true, message: "Account created! Please check your email to verify your account." };
}

export async function login(state: AuthState, formData: FormData): Promise<AuthState> {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const result = LoginSchema.safeParse(raw);
  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors };
  }

  const { email, password } = result.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password) {
    return { errors: { email: ["Invalid email or password"] } };
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return { errors: { email: ["Invalid email or password"] } };
  }

  if (!user.emailVerified) {
    return { errors: { email: ["Please verify your email before logging in"] } };
  }

  await createSession(user.id, user.email);
  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
