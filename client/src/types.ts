// Client-side types. Mirrors server/src/types.ts (minus savedInBackend, which is client-only —
// see docs/planning/architecture.md Section 3).

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

export interface Profile {
  id: string; // randomuser.me login.uuid — primary key everywhere
  name: ProfileName;
  gender: string;
  dob: string; // ISO 8601 date, e.g. "1985-04-12"
  age: number;
  location: ProfileLocation;
  email: string;
  phone: string;
  picture: ProfilePicture;
  savedInBackend: boolean; // CLIENT-ONLY. Not a DB column — presence in the table means true.
}

// The wire shape sent/received on the backend (Profile minus savedInBackend).
export type StoredProfile = Omit<Profile, 'savedInBackend'>;

export interface ApiError {
  error: { message: string };
}
