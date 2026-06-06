export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initDb } = await import("@/lib/db");
    const { seedMonitorsIfEmpty, seedSettingsDefaults } = await import("@/lib/seed");
    const { monitorManager } = await import("@/features/status/server/manager");

    try {
      await initDb();
      console.log("Database initialized from instrumentation");
      await seedMonitorsIfEmpty();
      await seedSettingsDefaults();
      await monitorManager.start();
      console.log("Monitoring service started from instrumentation");
    } catch (error) {
      console.error("Failed to initialize monitoring in instrumentation:", error);
    }
  }
}
