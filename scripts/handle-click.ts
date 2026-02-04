import { loadAnalytics, saveAnalytics, recordClick } from "./utils/analytics-store";
import { resolve } from "path";

export async function handleClick(): Promise<{
  success: boolean;
  message: string;
}> {
  const eventPayload = process.env["CLIENT_PAYLOAD"];
  if (!eventPayload) {
    return { success: false, message: "No click payload provided" };
  }

  let payload: { banner_id?: string; timestamp?: string; referrer?: string };
  try {
    payload = JSON.parse(eventPayload);
  } catch {
    return { success: false, message: "Invalid click payload JSON" };
  }

  const bannerId = payload.banner_id || "unknown";
  const timestamp = payload.timestamp || new Date().toISOString();
  const referrer = payload.referrer;

  const analyticsPath = resolve(process.cwd(), "data/analytics.json");
  const analytics = await loadAnalytics(analyticsPath);
  const updated = recordClick(analytics, bannerId, timestamp, referrer);
  await saveAnalytics(updated, analyticsPath);

  const msg = `Click recorded: banner=${bannerId}, referrer=${referrer || "none"}`;
  console.log(`✓ ${msg}`);
  return { success: true, message: msg };
}

if (import.meta.main) {
  handleClick().catch((err) => {
    console.error("Error handling click:", err);
    process.exit(1);
  });
}
