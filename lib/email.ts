const from = process.env.RESEND_FROM_EMAIL || "noreply@localhost";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function sendVerificationEmail(email: string, token: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");

  const verifyUrl = `${appUrl}/verify-email?token=${token}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Verify your email — AI Tracker",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#111">Verify your email address</h2>
          <p style="color:#555">Click the button below to verify your email and activate your account.</p>
          <a href="${verifyUrl}"
             style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">
            Verify Email
          </a>
          <p style="color:#999;font-size:13px">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${err}`);
  }
}
