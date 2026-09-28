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

export function getAll(): StoredProfile[] {
  const rows = db
    .prepare("SELECT * FROM profiles ORDER BY created_at ASC")
    .all() as ProfileRow[];
  return rows.map(rowToProfile);
}

export function getById(id: string): StoredProfile | undefined {
  const row = db
    .prepare("SELECT * FROM profiles WHERE id = ?")
    .get(id) as ProfileRow | undefined;
  return row ? rowToProfile(row) : undefined;
}

export function insert(profile: StoredProfile): StoredProfile {
  db.prepare(
    `INSERT INTO profiles (
      id, title, first_name, last_name, gender, dob, age,
      street_number, street_name, city, state, country,
      email, phone, picture_thumbnail, picture_large
    ) VALUES (
      @id, @title, @first_name, @last_name, @gender, @dob, @age,
      @street_number, @street_name, @city, @state, @country,
      @email, @phone, @picture_thumbnail, @picture_large
    )`
  ).run({
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
  });

  // getById is guaranteed to find the row we just inserted.
  return getById(profile.id) as StoredProfile;
}

export function updateName(id: string, name: ProfileName): StoredProfile | undefined {
  db.prepare(
    "UPDATE profiles SET title = ?, first_name = ?, last_name = ? WHERE id = ?"
  ).run(name.title, name.first, name.last, id);
  return getById(id);
}

export function remove(id: string): void {
  db.prepare("DELETE FROM profiles WHERE id = ?").run(id);
}
