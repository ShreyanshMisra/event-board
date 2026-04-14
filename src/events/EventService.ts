import { randomUUID } from "node:crypto";
import { Err, Ok, type Result } from "../lib/result";
import {
  TitleRequired,
  TitleTooLong,
  DescriptionRequired,
  DescriptionTooLong,
  LocationRequired,
  LocationTooLong,
  CategoryRequired,
  CategoryInvalid,
  CapacityRequired,
  CapacityInvalid,
  StartDateRequired,
  StartDateInvalid,
  EndDateRequired,
  EndDateInvalid,
  EndDateBeforeStartDate,
  UnexpectedEventError,
  type EventError,
  InvalidEventStateTransition,
  EventUnauthorized,
  EventNotFound,
} from "./errors";
import {
  EVENT_CATEGORIES,
  type EventCategory,
  type IEventRecord,
} from "./Event";
import type { IEventRepository } from "./EventRepository";
import type { UserRole } from "../auth/User";

export interface CreateEventInput {
  title: string;
  description: string;
  location: string;
  category: string;
  capacity: string;
  startDate: string;
  endDate: string;
}

export interface IEventService {
  createEvent(
    input: CreateEventInput,
    organizerId: string,
  ): Promise<Result<IEventRecord, EventError>>;
  findById(
    id: string,
    userRole: UserRole,
  ): Promise<Result<IEventRecord | null, EventError>>;
  findVisibleEventById(
    id: string,
    userId: string,
    userRole: UserRole,
  ): Promise<Result<IEventRecord | null, EventError>>;
  listVisibleEvents(
    userId: string,
    userRole: UserRole,
  ): Promise<Result<IEventRecord[], EventError>>;
  publishEvent(
    eventId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<IEventRecord, EventError>>;
  cancelEvent(
    eventId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<IEventRecord, EventError>>;
}

class EventService implements IEventService {
  constructor(private readonly events: IEventRepository) {}

  async createEvent(
    input: CreateEventInput,
    organizerId: string,
  ): Promise<Result<IEventRecord, EventError>> {
    const title = input.title.trim();
    const description = input.description.trim();
    const location = input.location.trim();
    const categoryRaw = input.category.trim();
    const capacityRaw = input.capacity.trim();
    const startDateRaw = input.startDate.trim();
    const endDateRaw = input.endDate.trim();

    if (!title) {
      return Err(TitleRequired("Title is required."));
    }
    if (title.length > 100) {
      return Err(TitleTooLong("Title must be 100 characters or fewer."));
    }

    if (!description) {
      return Err(DescriptionRequired("Description is required."));
    }
    if (description.length > 2000) {
      return Err(
        DescriptionTooLong("Description must be 2000 characters or fewer."),
      );
    }

    if (!location) {
      return Err(LocationRequired("Location is required."));
    }
    if (location.length > 200) {
      return Err(LocationTooLong("Location must be 200 characters or fewer."));
    }

    if (!categoryRaw) {
      return Err(CategoryRequired("Category is required."));
    }
    if (!EVENT_CATEGORIES.includes(categoryRaw as EventCategory)) {
      return Err(
        CategoryInvalid(
          "Category must be one of: " + EVENT_CATEGORIES.join(", ") + ".",
        ),
      );
    }
    const category = categoryRaw as EventCategory;

    if (!capacityRaw) {
      return Err(CapacityRequired("Capacity is required."));
    }
    const capacity = Number(capacityRaw);
    if (!Number.isInteger(capacity) || capacity < 1) {
      return Err(CapacityInvalid("Capacity must be a positive whole number."));
    }

    if (!startDateRaw) {
      return Err(StartDateRequired("Start date is required."));
    }
    const startDate = new Date(startDateRaw);
    if (isNaN(startDate.getTime())) {
      return Err(StartDateInvalid("Start date is not a valid date."));
    }

    if (!endDateRaw) {
      return Err(EndDateRequired("End date is required."));
    }
    const endDate = new Date(endDateRaw);
    if (isNaN(endDate.getTime())) {
      return Err(EndDateInvalid("End date is not a valid date."));
    }

    if (endDate.getTime() <= startDate.getTime()) {
      return Err(
        EndDateBeforeStartDate("End date must be after the start date."),
      );
    }

    const now = new Date().toISOString();
    const event: IEventRecord = {
      id: randomUUID(),
      title,
      description,
      location,
      category,
      capacity,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status: "draft",
      organizerId,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.events.create(event);
    if (result.ok === false) {
      return Err(UnexpectedEventError(result.value.message));
    }

    return Ok(result.value);
  }
  async findById(
    id: string,
    userRole: UserRole,
  ): Promise<Result<IEventRecord | null, EventError>> {
    const result = await this.events.findById(id, userRole);

    if (result.ok === false) {
      return Err(UnexpectedEventError(result.value.message));
    }

    const event = result.value;

    if (!event) {
      return Ok(null);
    }

    if (event.status === "draft" && userRole !== "admin") {
      return Ok(null);
    }

    return Ok(event);
  }

  async findVisibleEventById(
    id: string,
    userId: string,
    userRole: UserRole,
  ): Promise<Result<IEventRecord | null, EventError>> {
    const result = await this.events.findById(id, userRole);

    if (result.ok === false) {
      return Err(UnexpectedEventError(result.value.message));
    }

    const event = result.value;

    if (!event) {
      return Ok(null);
    }

    const canViewDraft = userRole === "admin" || event.organizerId === userId;

    if (event.status === "draft" && !canViewDraft) {
      return Ok(null);
    }

    return Ok(event);
  }

  async listVisibleEvents(
    userId: string,
    userRole: UserRole,
  ): Promise<Result<IEventRecord[], EventError>> {
    const result = await this.events.findAll();

    if (result.ok === false) {
      return Err(UnexpectedEventError(result.value.message));
    }

    const visibleEvents = result.value.filter((event) => {
      if (event.status !== "draft") {
        return true;
      }

      return userRole === "admin" || event.organizerId === userId;
    });

    return Ok(visibleEvents);
  }

  async publishEvent(
    eventId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<IEventRecord, EventError>> {
    const result = await this.events.findById(eventId, actingUserRole);

    if (result.ok === false) {
      return Err(UnexpectedEventError(result.value.message));
    }

    const event = result.value;

    if (!event) {
      return Err(EventNotFound("Event not found."));
    }

    const isOrganizer = event.organizerId === actingUserId;
    const isAdmin = actingUserRole === "admin";

    if (!isOrganizer && !isAdmin) {
      return Err(
        EventUnauthorized("You are not allowed to publish this event."),
      );
    }

    if (event.status !== "draft") {
      return Err(
        InvalidEventStateTransition("Only draft events can be published."),
      );
    }

    const updated = await this.events.updateStatus(eventId, "published");

    if (updated.ok === false) {
      return Err(UnexpectedEventError(updated.value.message));
    }

    return Ok(updated.value);
  }

  async cancelEvent(
    eventId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<IEventRecord, EventError>> {
    const result = await this.events.findById(eventId, actingUserRole);

    if (result.ok === false) {
      return Err(UnexpectedEventError(result.value.message));
    }

    const event = result.value;

    if (!event) {
      return Err(EventNotFound("Event not found."));
    }

    const isOrganizer = event.organizerId === actingUserId;
    const isAdmin = actingUserRole === "admin";

    if (!isOrganizer && !isAdmin) {
      return Err(
        EventUnauthorized("You are not allowed to cancel this event."),
      );
    }

    if (event.status !== "published") {
      return Err(
        InvalidEventStateTransition("Only published events can be cancelled."),
      );
    }

    const updated = await this.events.updateStatus(eventId, "cancelled");

    if (updated.ok === false) {
      return Err(UnexpectedEventError(updated.value.message));
    }

    return Ok(updated.value);
  }
}

export function CreateEventService(events: IEventRepository): IEventService {
  return new EventService(events);
}
