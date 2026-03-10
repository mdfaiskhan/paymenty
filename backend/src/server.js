const app = require("./app");
const connectDb = require("./config/db");
const env = require("./config/env");
const { ensureDefaultBusinesses } = require("./services/business.service");
const { startAnalyticsWarmLoop } = require("./services/analytics.service");

async function bootstrap() {
  await connectDb();
  await ensureDefaultBusinesses();
  app.listen(env.port, () => {
    startAnalyticsWarmLoop();
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${env.port}`);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Startup failure:", error);
  process.exit(1);
});
