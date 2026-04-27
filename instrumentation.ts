export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startMonitoring } = await import("@/features/status/server/monitor");
    const { sites } = await import("@/lib/config");
    const { initDb } = await import("@/lib/db");

    try {
      await initDb();
      console.log("Database initialized from instrumentation");
      startMonitoring(sites);
      console.log("Monitoring service started from instrumentation");
    } catch (error) {
      console.error("Failed to initialize monitoring in instrumentation:", error);
    }
  }
}
