import type { Result } from "../lib/result";
import type { RsvpError } from "./errors";
import type { IRsvpRecord, IRsvpWithEvent } from "./Rsvp";

export interface IRsvpRepository {
  // Feature 4 (Dashboard) reads
  findByUserId(userId: string): Promise<Result<IRsvpWithEvent[], RsvpError>>;
  findByUserIdAndEventId(userId: string, eventId: string): Promise<Result<IRsvpRecord | null, RsvpError>>;

  // Feature 5 (Toggle) writes
  upsert(rsvp: IRsvpRecord): Promise<Result<IRsvpRecord, RsvpError>>;
  delete(userId: string, eventId: string): Promise<Result<void, RsvpError>>;

  // Shared
  countByEventId(eventId: string): Promise<Result<number, RsvpError>>;
}
