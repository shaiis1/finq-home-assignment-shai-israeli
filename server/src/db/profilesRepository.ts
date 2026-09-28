import { db } from "./connection.js";
import type { ProfileName, ProfileRow, StoredProfile } from "../types.js";

// All SQL lives in this file. Route handlers stay thin (validate -> call repository -> respond).

function rowToProfile(row: ProfileRow): StoredProfile {
  return {
    id: row.id,
    name: {
      title: row.title,
      first: row.first_name,
      last: row.last_name,
    },
    gender: row.gender,
    dob: row.dob,
    age: row.age,
    location: {
      streetNumber: row.street_number,
      streetName: row.street_name,
      city: row.city,
      state: row.state,
      country: row.country,
    },
    email: row.email,
    phone: row.phone,
    picture: {
      thumbnail: row.picture_thumbnail,
      large: row.picture_large,
    },
  };
}

// `limit` is optional (code review #10) — a defensive cap for callers that want one; omitting it
// preserves the original unbounded behavior every existing flow depends on.
export function getAll(limit?: number): StoredProfile[] {
  const rows = (
    typeof limit === "number"
      ? db.prepare("SELECT * FROM profiles ORDER BY created_at ASC LIMIT ?").all(limit)
      : db.prepare("SELECT * FROM profiles ORDER BY created_at ASC").all()
  ) as ProfileRow[];
  return rows.map(rowToProfile);
}

export function getById(id: string): StoredProfile | undefined {
  const row = db
    .prepare("SELECT * FROM profiles WHERE id = ?")
    .get(id) as ProfileRow | undefined;
  return row ? rowToProfile(row) : undefined;
}

// Single atomic statement (code review #8): the `id` PRIMARY KEY constraint is the only guard
// against a duplicate — a violation throws a SqliteError (code SQLITE_CONSTRAINT_PRIMARYKEY) that
// the route layer catches and maps to 409, instead of a separate getById-then-insert check. Using
// RETURNING also avoids a second SELECT to hand back the stored row.
export function insert(profile: StoredProfile): StoredProfile {
  const row = db
    .prepare(
      `INSERT INTO profiles (
        id, title, first_name, last_name, gender, dob, age,
        street_number, street_name, city, state, country,
        email, phone, picture_thumbnail, picture_large
      ) VALUES (
        @id, @title, @first_name, @last_name, @gender, @dob, @age,
        @street_number, @street_name, @city, @state, @country,
        @email, @phone, @picture_thumbnail, @picture_large
      )
      RETURNING *`
    )
    .get({
      id: profile.id,
      title: profile.name.title,
      first_name: profile.name.first,
      last_name: profile.name.last,
      gender: profile.gender,
      dob: profile.dob,
      age: profile.age,
      street_number: profile.location.streetNumber,
      street_name: profile.location.streetName,
      city: profile.location.city,
      state: profile.location.state,
      country: profile.location.country,
      email: profile.email,
      phone: profile.phone,
      picture_thumbnail: profile.picture.thumbnail,
      picture_large: profile.picture.large,
    }) as ProfileRow;

  return rowToProfile(row);
}

// RETURNING lets a single statement both apply the update and report whether a row existed
// (undefined = no match = 404), instead of a pre-checking getById plus a post-update getById
// (code review #4).
export function updateName(id: string, name: ProfileName): StoredProfile | undefined {
  const row = db
    .prepare(
      "UPDATE profiles SET title = ?, first_name = ?, last_name = ? WHERE id = ? RETURNING *"
    )
    .get(name.title, name.first, name.last, id) as ProfileRow | undefined;
  return row ? rowToProfile(row) : undefined;
}

// Returns whether a row was actually deleted, so the route can 404 without a separate existence
// pre-check (code review #4).
export function remove(id: string): boolean {
  const result = db.prepare("DELETE FROM profiles WHERE id = ?").run(id);
  return result.changes > 0;
}
