export type RsvpStatus = "going" | "not_going";

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
