import { Err, Ok, type Result } from "../lib/result";
import type { IEventRepository } from "../events/EventRepository";
import { UnexpectedRsvpError, type RsvpError } from "./errors";
import type { IRsvpRecord, IRsvpWithEvent } from "./Rsvp";
import type { IRsvpRepository } from "./RsvpRepository";

class InMemoryRsvpRepository implements IRsvpRepository {
  private readonly rsvps: IRsvpRecord[] = [];

  constructor(private readonly events: IEventRepository) {}

  async findByUserId(
    userId: string,
  ): Promise<Result<IRsvpWithEvent[], RsvpError>> {
    try {
      const userRsvps = this.rsvps.filter((r) => r.userId === userId);
      const results: IRsvpWithEvent[] = [];

      for (const rsvp of userRsvps) {
        const eventResult = await this.events.findById(rsvp.eventId, "user");

        if (eventResult.ok === false || !eventResult.value) {
          continue;
        }

        const event = eventResult.value;

        results.push({
          rsvp: { ...rsvp },
          event: {
            id: event.id,
            title: event.title,
            location: event.location,
            category: event.category,
            startDate: event.startDate,
            endDate: event.endDate,
            status: event.status,
          },
        });
      }

      return Ok(results);
    } catch {
      return Err(UnexpectedRsvpError("Unable to load RSVPs."));
    }
  }

  async findByUserIdAndEventId(
    userId: string,
    eventId: string,
  ): Promise<Result<IRsvpRecord | null, RsvpError>> {
    try {
      const match =
        this.rsvps.find((r) => r.userId === userId && r.eventId === eventId) ??
        null;

      return Ok(match ? { ...match } : null);
    } catch {
      return Err(UnexpectedRsvpError("Unable to find the RSVP."));
    }
  }

  async upsert(rsvp: IRsvpRecord): Promise<Result<IRsvpRecord, RsvpError>> {
    try {
      const index = this.rsvps.findIndex(
        (r) => r.userId === rsvp.userId && r.eventId === rsvp.eventId,
      );

      if (index >= 0) {
        this.rsvps[index] = { ...rsvp };
      } else {
        this.rsvps.push({ ...rsvp });
      }

      return Ok({ ...rsvp });
    } catch {
      return Err(UnexpectedRsvpError("Unable to save the RSVP."));
    }
  }

  async delete(
    userId: string,
    eventId: string,
  ): Promise<Result<void, RsvpError>> {
    try {
      const index = this.rsvps.findIndex(
        (r) => r.userId === userId && r.eventId === eventId,
      );

      if (index >= 0) {
        this.rsvps.splice(index, 1);
      }

      return Ok(undefined);
    } catch {
      return Err(UnexpectedRsvpError("Unable to remove the RSVP."));
    }
  }

  async countByEventId(eventId: string): Promise<Result<number, RsvpError>> {
    try {
      const count = this.rsvps.filter(
        (r) => r.eventId === eventId && r.status === "going",
      ).length;

      return Ok(count);
    } catch {
      return Err(UnexpectedRsvpError("Unable to count RSVPs."));
    }
  }
}

export function CreateInMemoryRsvpRepository(
  events: IEventRepository,
): IRsvpRepository {
  return new InMemoryRsvpRepository(events);
}