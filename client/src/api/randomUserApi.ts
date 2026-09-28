// fetchRandomUsers() + mapRandomUserToProfile() — maps https://randomuser.me/api/?results=10
// results into the shared `Profile` shape.
import type { Profile } from '../types';

const RANDOM_USER_URL = 'https://randomuser.me/api/?results=10';

// Minimal shape of one randomuser.me result — only the fields we consume.
interface RandomUserResult {
  gender: string;
  name: { title: string; first: string; last: string };
  location: {
    street: { number: number; name: string };
    city: string;
    state: string;
    country: string;
  };
  email: string;
  dob: { date: string; age: number };
  phone: string;
  picture: { large: string; thumbnail: string };
  login: { uuid: string };
}

interface RandomUserResponse {
  results: RandomUserResult[];
}

export function mapRandomUserToProfile(result: RandomUserResult): Profile {
  return {
    id: result.login.uuid,
    name: {
      title: result.name.title,
      first: result.name.first,
      last: result.name.last,
    },
    gender: result.gender,
    dob: result.dob.date.slice(0, 10), // ISO 8601 date only, e.g. "1985-04-12"
    age: result.dob.age,
    location: {
      streetNumber: result.location.street.number,
      streetName: result.location.street.name,
      city: result.location.city,
      state: result.location.state,
      country: result.location.country,
    },
    email: result.email,
    phone: result.phone,
    picture: {
      thumbnail: result.picture.thumbnail,
      large: result.picture.large,
    },
    savedInBackend: false,
  };
}

export async function fetchRandomUsers(): Promise<Profile[]> {
  let res: Response;
  try {
    res = await fetch(RANDOM_USER_URL);
  } catch {
    throw new Error('Network error — could not reach randomuser.me');
  }
  if (!res.ok) {
    throw new Error(`randomuser.me request failed with status ${res.status}`);
  }
  const data = (await res.json()) as RandomUserResponse;
  return data.results.map(mapRandomUserToProfile);
}
