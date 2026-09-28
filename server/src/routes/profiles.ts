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

// GET /api/profiles
profilesRouter.get("/", (_req: Request, res: Response) => {
  const profiles = profilesRepository.getAll();
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

  const existing = profilesRepository.getById(body.id);
  if (existing) {
    res
      .status(409)
      .json(errorBody(`Profile with id ${body.id} already exists`));
    return;
  }

  const stored = profilesRepository.insert(body);
  res.status(201).json(stored);
});

// PATCH /api/profiles/:id
profilesRouter.patch("/:id", (req: Request, res: Response) => {
  const id = req.params.id as string;

  const existing = profilesRepository.getById(id);
  if (!existing) {
    res.status(404).json(errorBody(`No profile found with id ${id}`));
    return;
  }

  const result = validatePatchNameBody(req.body);
  if (!result.valid) {
    res.status(400).json(errorBody(result.message));
    return;
  }

  const body = asPatchNameBody(req.body);
  const updated = profilesRepository.updateName(id, body.name);
  res.status(200).json(updated);
});

// DELETE /api/profiles/:id
profilesRouter.delete("/:id", (req: Request, res: Response) => {
  const id = req.params.id as string;

  const existing = profilesRepository.getById(id);
  if (!existing) {
    res.status(404).json(errorBody(`No profile found with id ${id}`));
    return;
  }

  profilesRepository.remove(id);
  res.status(204).send();
});
