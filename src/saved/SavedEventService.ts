import { randomUUID } from "node:crypto";
import { Err, Ok, type Result } from "../lib/result";
import type { UserRole } from "../auth/User";
import type { IEventRepository } from "../events/EventRepository";
import {
  EventNotFound,
  SavedEventUnauthorized,
  UnexpectedSavedEventError,
  type SavedEventError,
} from "./errors";
import type { ISavedEventWithEvent } from "./SavedEvent";
import type { ISavedEventRepository } from "./SavedEventRepository";

export interface ISavedEventService {
  toggleSaved(
    eventId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<{ saved: boolean }, SavedEventError>>;
  listSaved(
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<ISavedEventWithEvent[], SavedEventError>>;
  isSaved(eventId: string, userId: string): Promise<boolean>;
}

class SavedEventService implements ISavedEventService {
  constructor(
    private readonly saved: ISavedEventRepository,
    private readonly events: IEventRepository,
  ) {}

  async toggleSaved(
    eventId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<{ saved: boolean }, SavedEventError>> {
    if (actingUserRole !== "user") {
      return Err(SavedEventUnauthorized("Only members can save events."));
    }

    const eventResult = await this.events.findById(eventId, actingUserRole);
    if (eventResult.ok === false) {
      return Err(UnexpectedSavedEventError(eventResult.value.message));
    }
    if (!eventResult.value) {
      return Err(EventNotFound("Event not found."));
    }

    const existingResult = await this.saved.findByUserIdAndEventId(actingUserId, eventId);
    if (existingResult.ok === false) {
      return Err(UnexpectedSavedEventError(existingResult.value.message));
    }

    if (existingResult.value) {
      const unsaveResult = await this.saved.unsave(actingUserId, eventId);
      if (unsaveResult.ok === false) {
        return Err(UnexpectedSavedEventError(unsaveResult.value.message));
      }
      return Ok({ saved: false });
    }

    const saveResult = await this.saved.save({
      id: randomUUID(),
      userId: actingUserId,
      eventId,
      createdAt: new Date().toISOString(),
    });
    if (saveResult.ok === false) {
      return Err(UnexpectedSavedEventError(saveResult.value.message));
    }
    return Ok({ saved: true });
  }

  async listSaved(
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<ISavedEventWithEvent[], SavedEventError>> {
    if (actingUserRole !== "user") {
      return Err(SavedEventUnauthorized("Only members have a saved events list."));
    }

    return this.saved.findByUserId(actingUserId);
  }

  async isSaved(eventId: string, userId: string): Promise<boolean> {
    const result = await this.saved.findByUserIdAndEventId(userId, eventId);
    return result.ok ? result.value !== null : false;
  }
}

export function CreateSavedEventService(
  saved: ISavedEventRepository,
  events: IEventRepository,
): ISavedEventService {
  return new SavedEventService(saved, events);
}
