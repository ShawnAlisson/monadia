import { ensureSeeded } from "@/lib/civilization/store";
import { runProductionTick, runSimulationTick } from "@/lib/sim/engine";

const globalForSim = globalThis as unknown as {
  __monadiaSimStarted?: boolean;
  __monadiaSimTimer?: ReturnType<typeof setInterval>;
  __monadiaProdTimer?: ReturnType<typeof setInterval>;
};

export async function startSimulationLoop() {
  if (process.env.DISABLE_SIM === "true") return;
  await ensureSeeded();

  // Vercel functions are ephemeral: scheduled work runs through /api/cron/tick.
  if (process.env.VERCEL === "1") return;
  if (globalForSim.__monadiaSimStarted) return;
  globalForSim.__monadiaSimStarted = true;

  // Immediate first tick so the feed is alive on boot
  void runSimulationTick().catch((err) => console.error("sim tick error", err));

  globalForSim.__monadiaSimTimer = setInterval(() => {
    void runSimulationTick().catch((err) => console.error("sim tick error", err));
  }, Number(process.env.SIM_TICK_MS || 5000));

  globalForSim.__monadiaProdTimer = setInterval(() => {
    void runProductionTick().catch((err) => console.error("prod tick error", err));
  }, Number(process.env.PROD_TICK_MS || 60000));

  console.log("[monadia] simulation loop started");
}
