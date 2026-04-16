import { Ok, Err, type Result } from "../lib/result";
import type { IEventRepository } from "../events/EventRepository";
import type { SavedEventError } from "./errors";
import { UnexpectedSavedEventError } from "./errors";
import type { ISavedEventRecord, ISavedEventWithEvent } from "./SavedEvent";
import type { ISavedEventRepository } from "./SavedEventRepository";

class InMemorySavedEventRepository implements ISavedEventRepository {
  private readonly records: ISavedEventRecord[] = [];

  constructor(private readonly events: IEventRepository) {}

  async findByUserId(userId: string): Promise<Result<ISavedEventWithEvent[], SavedEventError>> {
    try {
      const userRecords = this.records.filter((r) => r.userId === userId);
      const results: ISavedEventWithEvent[] = [];

      for (const saved of userRecords) {
        const eventResult = await this.events.findById(saved.eventId, "user");
        if (eventResult.ok && eventResult.value) {
          const e = eventResult.value;
          results.push({
            saved,
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

      return Ok(results);
    } catch {
      return Err(UnexpectedSavedEventError("Unable to load saved events."));
    }
  }

  async findByUserIdAndEventId(
    userId: string,
    eventId: string,
  ): Promise<Result<ISavedEventRecord | null, SavedEventError>> {
    try {
      const match = this.records.find((r) => r.userId === userId && r.eventId === eventId) ?? null;
      return Ok(match);
    } catch {
      return Err(UnexpectedSavedEventError("Unable to find saved event."));
    }
  }

  async save(record: ISavedEventRecord): Promise<Result<ISavedEventRecord, SavedEventError>> {
    try {
      this.records.push(record);
      return Ok(record);
    } catch {
      return Err(UnexpectedSavedEventError("Unable to save event."));
    }
  }

  async unsave(userId: string, eventId: string): Promise<Result<void, SavedEventError>> {
    try {
      const index = this.records.findIndex((r) => r.userId === userId && r.eventId === eventId);
      if (index !== -1) {
        this.records.splice(index, 1);
      }
      return Ok(undefined);
    } catch {
      return Err(UnexpectedSavedEventError("Unable to unsave event."));
    }
  }
}

export function CreateInMemorySavedEventRepository(
  events: IEventRepository,
): ISavedEventRepository {
  return new InMemorySavedEventRepository(events);
}
