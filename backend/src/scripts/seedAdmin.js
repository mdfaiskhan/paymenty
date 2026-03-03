const bcrypt = require("bcrypt");
const connectDb = require("../config/db");
const Admin = require("../models/Admin.model");

async function run() {
  const email = process.env.ADMIN_EMAIL || "admin@paymenty.local";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const passwordHash = await bcrypt.hash(password, 10);

  await connectDb();

  await Admin.findOneAndUpdate(
    { email },
    { email, passwordHash, role: "admin", isActive: true },
    { upsert: true, new: true }
  );

  // eslint-disable-next-line no-console
  console.log(`Admin seeded: ${email}`);
  process.exit(0);
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
