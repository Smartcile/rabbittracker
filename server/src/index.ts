import { createApp } from "./app.ts";
import { config } from "./config.ts";
import { runMigrations } from "./db/migrate.ts";
import { ensureBreedNormSeed } from "./lib/breedNormSeed.ts";
import { ensureChecklistSeed } from "./lib/checklistSeed.ts";
import { ensureCheckLogSeed } from "./lib/checkLogSeed.ts";
import { ensureDrugSeed } from "./lib/drugSeed.ts";
import { ensureFaqSeed } from "./lib/faqSeed.ts";
import { ensureGrowthStageSeed } from "./lib/growthStageSeed.ts";
import { ensureLookupSeed } from "./lib/lookupSeed.ts";
import { ensureSettingsRow } from "./lib/settingsStore.ts";

async function main(): Promise<void> {
  await runMigrations();
  await ensureSettingsRow();
  await ensureFaqSeed();
  await ensureDrugSeed();
  await ensureChecklistSeed();
  await ensureCheckLogSeed();
  await ensureLookupSeed();
  await ensureBreedNormSeed();
  await ensureGrowthStageSeed();
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`RabbitTracker listening on http://localhost:${config.port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
