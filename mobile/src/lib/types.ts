export interface User {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
}

export interface Traveller {
  id: string;
  name: string;
  relation: string | null;
  initials: string;
  age: number | null;
  kind: 'senior' | 'helper';
  homeCity: string | null;
  visitingCity: string | null;
  languages: string[];
  diet: string | null;
  mobility: string | null;
  phone: string | null;
  about: string | null;
  idVerified: boolean;
  vouchedBy: string | null;
}

export interface Trip {
  id: string;
  travellerId: string;
  airline: string;
  flightNumber: string;
  flightDate: string;
  origin: string;
  destination: string;
  departTime: string | null;
  arriveTime: string | null;
  arriveDate: string | null;
  seat: string | null;
  wheelchair: boolean;
  seeking: boolean;
  journeyStep: number;
  updatedAt: string;
}

export type Relation = 'same_flight' | 'same_arrival' | 'same_departure';

export interface Contact {
  familyName: string | null;
  familyPhone: string | null;
  travellerPhone: string | null;
}

export interface Companion {
  tripId: string;
  travellerId: string;
  name: string;
  initials: string;
  age: number | null;
  kind: 'senior' | 'helper';
  homeCity: string | null;
  visitingCity: string | null;
  languages: string[];
  diet: string | null;
  mobility: string | null;
  about: string | null;
  idVerified: boolean;
  vouchedBy: string | null;
  relation: Relation | null;
  gapMinutes: number | null;
  flightNumber: string;
  flightDate: string;
  origin: string;
  destination: string;
  departTime: string | null;
  arriveTime: string | null;
  seat: string | null;
  contact: Contact | null;
}

export interface Match extends Companion {
  score: number;
  sharedLanguages: string[];
  intro: { id: string; status: IntroStatus; direction: 'incoming' | 'outgoing' } | null;
}

export type IntroStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface Intro {
  id: string;
  status: IntroStatus;
  message: string | null;
  createdAt: string;
  myTripId: string;
  myTraveller: { name: string; relation: string | null } | null;
  companion: Companion;
}

export interface TripSummary extends Trip {
  traveller: Traveller;
  companions: Companion[];
  pendingRequests: number;
}

export interface TripEvent {
  id: number;
  kind: string;
  text: string;
  at: string;
}

export interface FlightStatus {
  provider: 'mock' | 'flightaware';
  state: 'scheduled' | 'boarding' | 'in_air' | 'landed' | 'cancelled' | 'unknown';
  label: string;
  progressPercent: number;
  departedAt: string | null;
  estimatedArrival: string | null;
}

export interface ParsedFlight {
  airline: string;
  flightNumber: string;
  date: string | null;
  origin: string | null;
  destination: string | null;
  departTime: string | null;
  arriveTime: string | null;
  seat: string | null;
}

export interface ParentHomeData {
  traveller: Traveller;
  family: { name: string | null; phone: string | null; relation: string | null };
  trip: Trip | null;
  companions: Companion[];
}
