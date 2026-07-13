import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export type EmailPayload = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail(payload: EmailPayload): Promise<{ id: string | null }> {
  const env = getEnv();
  if (!env.RESEND_API_KEY) {
    logger.info("email_skipped_no_key", {
      to: payload.to,
      subject: payload.subject,
    });
    return { id: null };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });

  if (result.error) {
    logger.error("email_send_failed", { error: result.error.message });
    throw new Error(result.error.message);
  }

  return { id: result.data?.id ?? null };
}
