import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata = { title: "Verify Email — AI Tracker" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <VerifyLayout status="error" message="No verification token provided." />;
  }

  const record = await prisma.verificationToken.findUnique({ where: { token } });

  if (!record) {
    return <VerifyLayout status="error" message="Invalid or already used verification link." />;
  }

  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } });
    return <VerifyLayout status="error" message="This verification link has expired. Please sign up again." />;
  }

  await prisma.user.update({
    where: { id: record.userId },
    data: { emailVerified: new Date() },
  });
  await prisma.verificationToken.delete({ where: { token } });

  return <VerifyLayout status="success" message="Your email is verified! You can now sign in." />;
}

function VerifyLayout({ status, message }: { status: "success" | "error"; message: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 max-w-md w-full text-center space-y-4">
        <div className="text-5xl">{status === "success" ? "✅" : "❌"}</div>
        <h2 className="text-xl font-bold text-gray-900">
          {status === "success" ? "Email verified!" : "Verification failed"}
        </h2>
        <p className="text-sm text-gray-500">{message}</p>
        <Link
          href={status === "success" ? "/login" : "/signup"}
          className="inline-block mt-2 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {status === "success" ? "Go to login" : "Back to signup"}
        </Link>
      </div>
    </div>
  );
}
