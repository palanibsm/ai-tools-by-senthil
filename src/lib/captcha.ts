export async function verifyCaptcha(token: string | undefined) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true as const, skipped: true as const };
  if (!token) return { ok: false as const, error: "captcha required" };

  const params = new URLSearchParams();
  params.set("secret", secret);
  params.set("response", token);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: params,
  });
  const data = (await res.json()) as { success?: boolean };
  if (!data.success) return { ok: false as const, error: "captcha verification failed" };
  return { ok: true as const, skipped: false as const };
}
