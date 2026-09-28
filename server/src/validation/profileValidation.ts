import type { CreateProfileBody, PatchNameBody, ProfileName } from "../types.js";

// Minimal, manual validation — no schema library needed for this small a shape. Each function
// returns either { valid: true } or { valid: false, message } so route handlers can respond with
// a clear 400 message without needing a type-guard-only API.

export type ValidationResult =
  | { valid: true }
  | { valid: false; message: string };

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidName(value: unknown): value is ProfileName {
  if (typeof value !== "object" || value === null) return false;
  const name = value as Record<string, unknown>;
  return isString(name.title) && isString(name.first) && isString(name.last);
}

export function validateCreateProfileBody(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { valid: false, message: "Request body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;

  if (!isString(b.id)) {
    return { valid: false, message: "Missing or invalid field: id" };
  }
  if (!isValidName(b.name)) {
    return { valid: false, message: "Missing or invalid field: name" };
  }
  if (!isString(b.gender)) {
    return { valid: false, message: "Missing or invalid field: gender" };
  }
  if (!isString(b.dob)) {
    return { valid: false, message: "Missing or invalid field: dob" };
  }
  if (!isFiniteNumber(b.age)) {
    return { valid: false, message: "Missing or invalid field: age" };
  }

  if (typeof b.location !== "object" || b.location === null) {
    return { valid: false, message: "Missing or invalid field: location" };
  }
  const location = b.location as Record<string, unknown>;
  if (!isFiniteNumber(location.streetNumber)) {
    return { valid: false, message: "Missing or invalid field: location.streetNumber" };
  }
  if (!isString(location.streetName)) {
    return { valid: false, message: "Missing or invalid field: location.streetName" };
  }
  if (!isString(location.city)) {
    return { valid: false, message: "Missing or invalid field: location.city" };
  }
  if (!isString(location.state)) {
    return { valid: false, message: "Missing or invalid field: location.state" };
  }
  if (!isString(location.country)) {
    return { valid: false, message: "Missing or invalid field: location.country" };
  }

  if (!isString(b.email)) {
    return { valid: false, message: "Missing or invalid field: email" };
  }
  if (!isString(b.phone)) {
    return { valid: false, message: "Missing or invalid field: phone" };
  }

  if (typeof b.picture !== "object" || b.picture === null) {
    return { valid: false, message: "Missing or invalid field: picture" };
  }
  const picture = b.picture as Record<string, unknown>;
  if (!isString(picture.thumbnail)) {
    return { valid: false, message: "Missing or invalid field: picture.thumbnail" };
  }
  if (!isString(picture.large)) {
    return { valid: false, message: "Missing or invalid field: picture.large" };
  }

  return { valid: true };
}

export function validatePatchNameBody(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { valid: false, message: "Request body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;

  if (!isValidName(b.name)) {
    return {
      valid: false,
      message: "Missing or invalid field: name (expected { title, first, last })",
    };
  }

  return { valid: true };
}

// Type-guard helpers for use after a successful validation result, so downstream code gets a
// narrowed type without re-checking.
export function asCreateProfileBody(body: unknown): CreateProfileBody {
  return body as CreateProfileBody;
}

export function asPatchNameBody(body: unknown): PatchNameBody {
  return body as PatchNameBody;
}
