import crypto from "crypto";
import { env } from "@/lib/env";

export function verifySlackRequest(
  body: string,
  timestamp: string,
  signature: string,
): boolean {
  if (!env.SLACK_SIGNING_SECRET) return false;

  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp) < fiveMinutesAgo) return false;

  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature =
    "v0=" +
    crypto
      .createHmac("sha256", env.SLACK_SIGNING_SECRET)
      .update(sigBasestring)
      .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(signature),
  );
}
