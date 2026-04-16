export type RsvpStatus = "going" | "waitlisted" | "not_going";

export interface IRsvpRecord {
  id: string;
  userId: string;
  eventId: string;
  status: RsvpStatus;
  createdAt: string;
  updatedAt: string;
}

export interface IRsvpWithEvent {
  rsvp: IRsvpRecord;
  event: {
    id: string;
    title: string;
    location: string;
    category: string;
    startDate: string;
    endDate: string;
    status: string;
  };
}

export interface IGroupedRsvps {
  upcoming: IRsvpWithEvent[];
  past: IRsvpWithEvent[];
}