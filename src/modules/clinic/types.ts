export type ClinicStatus = 'active' | 'inactive' | 'archived';

export interface WorkingHoursEntry {
  day: string;
  hours: string;
}

export interface Clinic {
  id: string;
  slug: string;
  name: string;
  nameAr?: string | null;
  cardImage?: string | null;
  logo?: string | null;
  coverImage?: string | null;
  gallery?: string[] | null;

  phone?: string | null;
  email?: string | null;
  website?: string | null;

  address?: string | null;
  addressAr?: string | null;
  coordinates?: { lat: number | null; lng: number | null } | null;
  googleMapsUrl?: string | null;

  description?: string | null;
  descriptionAr?: string | null;

  workingHours?: WorkingHoursEntry[] | null;
  workingHoursAr?: WorkingHoursEntry[] | null;

  acceptsInPerson?: boolean;
  redirectUrl?: string | null;

  status: ClinicStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

export interface CreateClinicDto {
  name: string;
  nameAr?: string | null;
  slug: string;
  cardImage?: string | null;
  logo?: string | null;
  coverImage?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  addressAr?: string | null;
  coordinates?: { lat: number | null; lng: number | null } | null;
  googleMapsUrl?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  workingHours?: WorkingHoursEntry[] | null;
  workingHoursAr?: WorkingHoursEntry[] | null;
  acceptsInPerson?: boolean;
  redirectUrl?: string | null;
  status?: ClinicStatus;
}

export interface UpdateClinicDto {
  name?: string;
  nameAr?: string | null;
  slug?: string;
  cardImage?: string | null;
  logo?: string | null;
  coverImage?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  addressAr?: string | null;
  coordinates?: { lat: number | null; lng: number | null } | null;
  googleMapsUrl?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  workingHours?: WorkingHoursEntry[] | null;
  workingHoursAr?: WorkingHoursEntry[] | null;
  acceptsInPerson?: boolean;
  redirectUrl?: string | null;
  status?: ClinicStatus;
}

export interface DeleteClinicConsequences {
  clinicId: string;
  slug: string;
  name: string;
  status: ClinicStatus;
}
