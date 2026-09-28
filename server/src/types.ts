// Server-side types. Mirrors client/src/types.ts (see docs/planning/architecture.md Section 3),
// minus `savedInBackend` — a row's existence in SQLite is what "saved" means here.

export interface ProfileName {
  title: string;
  first: string;
  last: string;
}

export interface ProfileLocation {
  streetNumber: number;
  streetName: string;
  city: string;
  state: string;
  country: string;
}

export interface ProfilePicture {
  thumbnail: string;
  large: string;
}

// The wire shape used in request/response bodies (camelCase/nested), and returned by the
// repository after mapping a DB row.
export interface StoredProfile {
  id: string; // randomuser.me login.uuid — primary key everywhere
  name: ProfileName;
  gender: string;
  dob: string; // ISO 8601 date, e.g. "1985-04-12"
  age: number;
  location: ProfileLocation;
  email: string;
  phone: string;
  picture: ProfilePicture;
}

// The raw shape of a row as it comes back from better-sqlite3 (snake_case, flat).
export interface ProfileRow {
  id: string;
  title: string;
  first_name: string;
  last_name: string;
  gender: string;
  dob: string;
  age: number;
  street_number: number;
  street_name: string;
  city: string;
  state: string;
  country: string;
  email: string;
  phone: string;
  picture_thumbnail: string;
  picture_large: string;
  created_at: string;
}

// The body accepted by POST /api/profiles — full StoredProfile shape.
export type CreateProfileBody = StoredProfile;

// The body accepted by PATCH /api/profiles/:id.
export interface PatchNameBody {
  name: ProfileName;
}

export interface ApiError {
  error: { message: string };
}
