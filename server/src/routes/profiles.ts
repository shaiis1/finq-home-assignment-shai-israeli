import { Router, type Request, type Response } from "express";
import * as profilesRepository from "../db/profilesRepository.js";
import {
  asCreateProfileBody,
  asPatchNameBody,
  validateCreateProfileBody,
  validatePatchNameBody,
} from "../validation/profileValidation.js";
import type { ApiError } from "../types.js";

export const profilesRouter = Router();

function errorBody(message: string): ApiError {
  return { error: { message } };
}

// A malformed/absent ?limit is simply ignored (falls back to unbounded) rather than 400ing — this
// is a defensive cap for callers that want one, not a required parameter (code review #10).
function parsePositiveInt(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

// better-sqlite3 throws a SqliteError with this code on a PRIMARY KEY conflict — used to turn the
// atomic insert's constraint violation into a 409 (code review #8).
function isPrimaryKeyConflict(err: unknown): boolean {
  return (
    err instanceof Error &&
    "code" in err &&
    (err as { code?: unknown }).code === "SQLITE_CONSTRAINT_PRIMARYKEY"
  );
}

// GET /api/profiles
profilesRouter.get("/", (req: Request, res: Response) => {
  const limit = parsePositiveInt(req.query.limit);
  const profiles = profilesRepository.getAll(limit);
  res.status(200).json(profiles);
});

// POST /api/profiles
profilesRouter.post("/", (req: Request, res: Response) => {
  const result = validateCreateProfileBody(req.body);
  if (!result.valid) {
    res.status(400).json(errorBody(result.message));
    return;
  }

  const body = asCreateProfileBody(req.body);

  try {
    const stored = profilesRepository.insert(body);
    res.status(201).json(stored);
  } catch (err) {
    if (isPrimaryKeyConflict(err)) {
      res
        .status(409)
        .json(errorBody(`Profile with id ${body.id} already exists`));
      return;
    }
    throw err; // anything else is a real failure — let the global error handler map it to 500
  }
});

// PATCH /api/profiles/:id
profilesRouter.patch("/:id", (req: Request, res: Response) => {
  const id = req.params.id as string;

  const result = validatePatchNameBody(req.body);
  if (!result.valid) {
    res.status(400).json(errorBody(result.message));
    return;
  }

  const body = asPatchNameBody(req.body);
  const updated = profilesRepository.updateName(id, body.name);
  if (!updated) {
    res.status(404).json(errorBody(`No profile found with id ${id}`));
    return;
  }
  res.status(200).json(updated);
});

// DELETE /api/profiles/:id
profilesRouter.delete("/:id", (req: Request, res: Response) => {
  const id = req.params.id as string;

  const deleted = profilesRepository.remove(id);
  if (!deleted) {
    res.status(404).json(errorBody(`No profile found with id ${id}`));
    return;
  }
  res.status(204).send();
});
