import { PrismaClient } from "@prisma/client";
import { Err, Ok, type Result } from "../lib/result";
import { UnexpectedRsvpError, type RsvpError } from "./errors";
import type { IRsvpRecord, IRsvpWithEvent, RsvpStatus } from "./Rsvp";
import type { IRsvpRepository } from "./RsvpRepository";

function toRsvpRecord(row: {
  id: string;
  userId: string;
  eventId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}): IRsvpRecord {
  return {
    id: row.id,
    userId: row.userId,
    eventId: row.eventId,
    status: row.status as RsvpStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

class PrismaRsvpRepository implements IRsvpRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(userId: string): Promise<Result<IRsvpWithEvent[], RsvpError>> {
    try {
      const rows = await this.prisma.rsvp.findMany({ where: { userId } });
      if (rows.length === 0) {
        return Ok([]);
      }

      const eventIds = rows.map((r) => r.eventId);
      const events = await this.prisma.event.findMany({
        where: { id: { in: eventIds } },
      });

      const eventMap = new Map(events.map((e) => [e.id, e]));

      const result: IRsvpWithEvent[] = [];
      for (const row of rows) {
        const event = eventMap.get(row.eventId);
        if (!event) continue;

        result.push({
          rsvp: toRsvpRecord(row),
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

      return Ok(result);
    } catch {
      return Err(UnexpectedRsvpError("Unable to load RSVPs."));
    }
  }

  async findByUserIdAndEventId(
    userId: string,
    eventId: string,
  ): Promise<Result<IRsvpRecord | null, RsvpError>> {
    try {
      const row = await this.prisma.rsvp.findUnique({
        where: { userId_eventId: { userId, eventId } },
      });
      return Ok(row ? toRsvpRecord(row) : null);
    } catch {
      return Err(UnexpectedRsvpError("Unable to find the RSVP."));
    }
  }

  async upsert(rsvp: IRsvpRecord): Promise<Result<IRsvpRecord, RsvpError>> {
    try {
      const row = await this.prisma.rsvp.upsert({
        where: { userId_eventId: { userId: rsvp.userId, eventId: rsvp.eventId } },
        create: rsvp,
        update: {
          status: rsvp.status,
          updatedAt: rsvp.updatedAt,
        },
      });
      return Ok(toRsvpRecord(row));
    } catch {
      return Err(UnexpectedRsvpError("Unable to save the RSVP."));
    }
  }

  async delete(userId: string, eventId: string): Promise<Result<void, RsvpError>> {
    try {
      await this.prisma.rsvp.delete({
        where: { userId_eventId: { userId, eventId } },
      });
      return Ok(undefined);
    } catch {
      return Err(UnexpectedRsvpError("Unable to remove the RSVP."));
    }
  }

  async countByEventId(eventId: string): Promise<Result<number, RsvpError>> {
    try {
      const count = await this.prisma.rsvp.count({ where: { eventId } });
      return Ok(count);
    } catch {
      return Err(UnexpectedRsvpError("Unable to count RSVPs."));
    }
  }
}

export function CreatePrismaRsvpRepository(prisma: PrismaClient): IRsvpRepository {
  return new PrismaRsvpRepository(prisma);
}
