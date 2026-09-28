// The 4 backend calls, per architecture.md Section 6. Maps to/from the client `Profile` type
// (backend wire shape is `Profile` minus `savedInBackend`).
import { request } from './http';
import type { Profile, ProfileName, StoredProfile } from '../types';

function toProfile(stored: StoredProfile, savedInBackend: boolean): Profile {
  return { ...stored, savedInBackend };
}

function toStoredProfile(profile: Profile): StoredProfile {
  return {
    id: profile.id,
    name: profile.name,
    gender: profile.gender,
    dob: profile.dob,
    age: profile.age,
    location: profile.location,
    email: profile.email,
    phone: profile.phone,
    picture: profile.picture,
  };
}

export async function fetchProfiles(): Promise<Profile[]> {
  const rows = await request<StoredProfile[]>('/profiles');
  return rows.map((row) => toProfile(row, true));
}

export async function createProfile(profile: Profile): Promise<Profile> {
  const stored = await request<StoredProfile>('/profiles', {
    method: 'POST',
    body: JSON.stringify(toStoredProfile(profile)),
  });
  return toProfile(stored, true);
}

export async function updateProfileNameOnServer(
  id: string,
  name: ProfileName
): Promise<Profile> {
  const stored = await request<StoredProfile>(`/profiles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
  return toProfile(stored, true);
}

export async function deleteProfileOnServer(id: string): Promise<void> {
  await request<void>(`/profiles/${id}`, { method: 'DELETE' });
}
