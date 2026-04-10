export type EventStatus = "draft" | "published" | "cancelled" | "past";

export type EventCategory =
  | "academic"
  | "social"
  | "sports"
  | "club"
  | "career"
  | "arts"
  | "volunteer"
  | "other";

export const EVENT_CATEGORIES: EventCategory[] = [
  "academic",
  "social",
  "sports",
  "club",
  "career",
  "arts",
  "volunteer",
  "other",
];

export interface IEventRecord {
  id: string;
  title: string;
  description: string;
  location: string;
  category: EventCategory;
  capacity: number;
  startDate: string;
  endDate: string;
  status: EventStatus;
  organizerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface IEventSummary {
  id: string;
  title: string;
  location: string;
  category: EventCategory;
  capacity: number;
  startDate: string;
  endDate: string;
  status: EventStatus;
}

export function toEventSummary(event: IEventRecord): IEventSummary {
  return {
    id: event.id,
    title: event.title,
    location: event.location,
    category: event.category,
    capacity: event.capacity,
    startDate: event.startDate,
    endDate: event.endDate,
    status: event.status,
  };
}
