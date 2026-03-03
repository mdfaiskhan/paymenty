const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const employeeRoutes = require("./routes/employee.routes");
const workRoutes = require("./routes/work.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const ruleRoutes = require("./routes/rule.routes");
const paymentRoutes = require("./routes/payment.routes");
const ownerRoutes = require("./routes/owner.routes");
const errorMiddleware = require("./middlewares/error.middleware");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/work", workRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/rules", ruleRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/owners", ownerRoutes);

app.use(errorMiddleware);

module.exports = app;
