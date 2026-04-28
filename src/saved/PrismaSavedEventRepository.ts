import { PrismaClient } from "@prisma/client";
import { Err, Ok, type Result } from "../lib/result";
import { UnexpectedSavedEventError, type SavedEventError } from "./errors";
import type { ISavedEventRecord, ISavedEventWithEvent } from "./SavedEvent";
import type { ISavedEventRepository } from "./SavedEventRepository";
import type { IEventRepository } from "../events/EventRepository";

function toSavedEventRecord(row: {
  id: string;
  userId: string;
  eventId: string;
  createdAt: string;
}): ISavedEventRecord {
  return {
    id: row.id,
    userId: row.userId,
    eventId: row.eventId,
    createdAt: row.createdAt,
  };
}

class PrismaSavedEventRepository implements ISavedEventRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly events: IEventRepository,
  ) {}

  async findByUserId(userId: string): Promise<Result<ISavedEventWithEvent[], SavedEventError>> {
    try {
      const rows = await this.prisma.savedEvent.findMany({ where: { userId } });
      if (rows.length === 0) return Ok([]);

      const result: ISavedEventWithEvent[] = [];
      for (const row of rows) {
        const eventResult = await this.events.findById(row.eventId, "user");
        if (eventResult.ok && eventResult.value) {
          const e = eventResult.value;
          result.push({
            saved: toSavedEventRecord(row),
            event: {
              id: e.id,
              title: e.title,
              location: e.location,
              category: e.category,
              startDate: e.startDate,
              endDate: e.endDate,
              status: e.status,
            },
          });
        }
      }

      return Ok(result);
    } catch {
      return Err(UnexpectedSavedEventError("Unable to load saved events."));
    }
  }

  async findByUserIdAndEventId(
    userId: string,
    eventId: string,
  ): Promise<Result<ISavedEventRecord | null, SavedEventError>> {
    try {
      const row = await this.prisma.savedEvent.findUnique({
        where: { userId_eventId: { userId, eventId } },
      });
      return Ok(row ? toSavedEventRecord(row) : null);
    } catch {
      return Err(UnexpectedSavedEventError("Unable to find saved event."));
    }
  }

  async save(record: ISavedEventRecord): Promise<Result<ISavedEventRecord, SavedEventError>> {
    try {
      const row = await this.prisma.savedEvent.create({ data: record });
      return Ok(toSavedEventRecord(row));
    } catch {
      return Err(UnexpectedSavedEventError("Unable to save event."));
    }
  }

  async unsave(userId: string, eventId: string): Promise<Result<void, SavedEventError>> {
    try {
      await this.prisma.savedEvent.delete({
        where: { userId_eventId: { userId, eventId } },
      });
      return Ok(undefined);
    } catch {
      return Err(UnexpectedSavedEventError("Unable to unsave event."));
    }
  }
}

export function CreatePrismaSavedEventRepository(
  prisma: PrismaClient,
  events: IEventRepository,
): ISavedEventRepository {
  return new PrismaSavedEventRepository(prisma, events);
}
