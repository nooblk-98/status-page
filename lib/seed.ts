import { dbOps } from "./db";
import { sites } from "./config";
import {
  DEFAULT_BRANDING,
  DEFAULT_RETENTION,
  notificationDefaultsFromEnv,
} from "./settings";

/**
 * First-run seeding. Only writes when the target is empty so re-deploys/restarts never
 * overwrite admin edits. lib/config.ts remains the source of truth for the initial monitors.
 */
export async function seedMonitorsIfEmpty(): Promise<void> {
  if ((await dbOps.countMonitors()) > 0) return;

  for (let i = 0; i < sites.length; i += 1) {
    const site = sites[i];
    await dbOps.insertMonitor({
      id: site.id, // preserve exact slug so existing checks history stays linked
      name: site.name,
      type: "http",
      url: site.url,
      method: "GET",
      interval_seconds: site.intervalSeconds,
      timeout_ms: site.timeoutMs,
      enabled: 1,
      sort_order: i,
    });
  }
  console.log(`Seeded ${sites.length} monitors from config`);
}

export async function seedSettingsDefaults(): Promise<void> {
  if (!(await dbOps.getSetting("branding"))) {
    await dbOps.setSetting("branding", DEFAULT_BRANDING);
  }
  if (!(await dbOps.getSetting("retention"))) {
    await dbOps.setSetting("retention", DEFAULT_RETENTION);
  }
  if (!(await dbOps.getSetting("notifications"))) {
    // Snapshot current env config so the admin UI shows what's active today.
    await dbOps.setSetting("notifications", notificationDefaultsFromEnv());
  }
}
