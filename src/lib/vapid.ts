export function vapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:ola@laro.pt";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}
