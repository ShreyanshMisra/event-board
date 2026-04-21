import type { Result } from "../lib/result";
import type { RsvpError } from "./errors";
import type { IRsvpWithEvent } from "./Rsvp";
import type { IRsvpRepository } from "./RsvpRepository";

import { randomUUID } from "node:crypto";
import type { UserRole } from "../auth/User";
import type { IEventRepository } from "../events/EventRepository";
import { Err, Ok } from "../lib/result";
import {
  EventClosedForRsvp,
  EventNotFound,
  EventNotPublishedForRsvp,
  OwnEventRsvpForbidden,
  RsvpForbiddenRole,
  UnexpectedRsvpError,
} from "./errors";
import type { IRsvpRecord, RsvpStatus } from "./Rsvp";

export interface IRsvpService {
  listUserRsvps(userId: string): Promise<Result<IRsvpWithEvent[], RsvpError>>;
}

class RsvpService implements IRsvpService {
  constructor(private readonly rsvps: IRsvpRepository) {}

  async listUserRsvps(
    userId: string,
  ): Promise<Result<IRsvpWithEvent[], RsvpError>> {
    return this.rsvps.findByUserId(userId);
  }
}

export function CreateRsvpService(rsvps: IRsvpRepository): IRsvpService {
  return new RsvpService(rsvps);
}

export interface ToggleRsvpResult {
  eventId: string;
  status: RsvpStatus;
  attendeeCount: number;
}

export interface IRsvpToggleService extends IRsvpService {
  getToggleState(
    userId: string,
    userRole: UserRole,
    eventId: string,
  ): Promise<Result<ToggleRsvpResult, RsvpError>>;

  toggleRsvp(
    userId: string,
    userRole: UserRole,
    eventId: string,
  ): Promise<Result<ToggleRsvpResult, RsvpError>>;
}

class RsvpToggleService implements IRsvpToggleService {
  constructor(
    private readonly base: IRsvpService,
    private readonly rsvps: IRsvpRepository,
    private readonly events: IEventRepository,
  ) {}

  async listUserRsvps(
    userId: string,
  ): Promise<Result<IRsvpWithEvent[], RsvpError>> {
    return this.base.listUserRsvps(userId);
  }

  async getToggleState(
    userId: string,
    userRole: UserRole,
    eventId: string,
  ): Promise<Result<ToggleRsvpResult, RsvpError>> {
    const eventCheck = await this.validateEventForRsvp(
      userId,
      userRole,
      eventId,
    );

    if (eventCheck.ok === false) {
      return eventCheck;
    }

    const existingResult = await this.rsvps.findByUserIdAndEventId(
      userId,
      eventId,
    );

    if (existingResult.ok === false) {
      return existingResult;
    }

    const countResult = await this.rsvps.countByEventId(eventId);

    if (countResult.ok === false) {
      return countResult;
    }

    return Ok({
      eventId,
      status: existingResult.value?.status ?? "not_going",
      attendeeCount: countResult.value,
    });
  }

  async toggleRsvp(
    userId: string,
    userRole: UserRole,
    eventId: string,
  ): Promise<Result<ToggleRsvpResult, RsvpError>> {
    const eventCheck = await this.validateEventForRsvp(
      userId,
      userRole,
      eventId,
    );

    if (eventCheck.ok === false) {
      return eventCheck;
    }

    const event = eventCheck.value;
    const existingResult = await this.rsvps.findByUserIdAndEventId(
      userId,
      eventId,
    );

    if (existingResult.ok === false) {
      return existingResult;
    }

    const existing = existingResult.value;
    const now = new Date().toISOString();

    if (existing && existing.status !== "not_going") {
      const updated: IRsvpRecord = {
        ...existing,
        status: "not_going",
        updatedAt: now,
      };

      const saved = await this.rsvps.upsert(updated);

      if (saved.ok === false) {
        return saved;
      }

      const countResult = await this.rsvps.countByEventId(eventId);

      if (countResult.ok === false) {
        return countResult;
      }

      return Ok({
        eventId,
        status: saved.value.status,
        attendeeCount: countResult.value,
      });
    }

    const countResult = await this.rsvps.countByEventId(eventId);

    if (countResult.ok === false) {
      return countResult;
    }

    const nextStatus: RsvpStatus =
      countResult.value >= event.capacity ? "waitlisted" : "going";

    const record: IRsvpRecord = {
      id: existing?.id ?? randomUUID(),
      userId,
      eventId,
      status: nextStatus,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const saved = await this.rsvps.upsert(record);

    if (saved.ok === false) {
      return saved;
    }

    const updatedCountResult = await this.rsvps.countByEventId(eventId);

    if (updatedCountResult.ok === false) {
      return updatedCountResult;
    }

    return Ok({
      eventId,
      status: saved.value.status,
      attendeeCount: updatedCountResult.value,
    });
  }

  private async validateEventForRsvp(
    userId: string,
    userRole: UserRole,
    eventId: string,
  ): Promise<Result<{ capacity: number; organizerId: string }, RsvpError>> {
    if (userRole !== "user") {
      return Err(RsvpForbiddenRole("Only members can RSVP to events."));
    }

    const eventResult = await this.events.findById(eventId, userRole);

    if (eventResult.ok === false) {
      return Err(UnexpectedRsvpError(eventResult.value.message));
    }

    const event = eventResult.value;

    if (!event) {
      return Err(EventNotFound("Event not found."));
    }

    if (event.organizerId === userId) {
      return Err(OwnEventRsvpForbidden("You cannot RSVP to your own event."));
    }

    if (event.status === "cancelled") {
      return Err(EventClosedForRsvp("You cannot RSVP to a cancelled event."));
    }

    if (event.status === "past" || new Date(event.endDate).getTime() <= Date.now()) {
      return Err(EventClosedForRsvp("You cannot RSVP to a past event."));
    }

    if (event.status !== "published") {
      return Err(
        EventNotPublishedForRsvp("You can only RSVP to published events."),
      );
    }

    return Ok({
      capacity: event.capacity,
      organizerId: event.organizerId,
    });
  }
}

export function CreateRsvpToggleService(
  rsvps: IRsvpRepository,
  events: IEventRepository,
): IRsvpToggleService {
  const base = CreateRsvpService(rsvps);
  return new RsvpToggleService(base, rsvps, events);
}