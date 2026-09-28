import express from "express";
import type { ErrorRequestHandler } from "express";
import cors from "cors";
import { profilesRouter } from "./routes/profiles.js";
import "./db/connection.js"; // ensure schema is created on startup

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173", // Vite dev server origin
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/profiles", profilesRouter);

// Global error-handling backstop (qa-report-backend.md N3/N4): keeps the documented
// { error: { message } } shape uniform across every failure mode, including body-parser's
// malformed-JSON throw and any future unhandled exception from the route/DB layer, instead of
// leaking Express's default HTML stack-trace page.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = typeof err?.status === "number" ? err.status : 500;
  const message = status === 500 ? "Internal server error" : err?.message ?? "Bad request";
  res.status(status).json({ error: { message } });
};
app.use(errorHandler);

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
