import express from "express";
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

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
