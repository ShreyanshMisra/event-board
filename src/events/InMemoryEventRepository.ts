import { Err, Ok, type Result } from "../lib/result";
import type { UserRole } from "../auth/User";
import { EventNotFound, UnexpectedEventError, type EventError } from "./errors";
import type { IEventRecord } from "./Event";
import type { IEventRepository } from "./EventRepository";

class InMemoryEventRepository implements IEventRepository {
  private readonly events: IEventRecord[] = [];

  async create(event: IEventRecord): Promise<Result<IEventRecord, EventError>> {
    try {
      this.events.push(event);
      return Ok(event);
    } catch {
      return Err(UnexpectedEventError("Unable to create the event."));
    }
  }

  async findById(
    id: string,
    _userRole: UserRole,
  ): Promise<Result<IEventRecord | null, EventError>> {
    try {
      const match = this.events.find((e) => e.id === id) ?? null;
      return Ok(match);
    } catch {
      return Err(UnexpectedEventError("Unable to find the event."));
    }
  }

  async findByOrganizerId(
    organizerId: string,
  ): Promise<Result<IEventRecord[], EventError>> {
    try {
      const matches = this.events.filter((e) => e.organizerId === organizerId);
      return Ok(matches);
    } catch {
      return Err(UnexpectedEventError("Unable to list events."));
    }
  }
    async findUpcoming(): Promise<Result<IEventRecord[], EventError>> {
    const now = Date.now();

    const matches = this.events
      .filter(
        (event) =>
          new Date(event.startDate).getTime() > now &&
          event.status !== "cancelled" &&
          event.status !== "past",
      )
      .map((event) => ({ ...event }));

    return Ok(matches);
  }

  async searchUpcoming(query: string): Promise<Result<IEventRecord[], EventError>> {
    const now = Date.now();
    const lowerQuery = query.toLowerCase();

    const matches = this.events
      .filter(
        (event) =>
          new Date(event.startDate).getTime() > now &&
          event.status === "published",
      )
      .filter((event) => {
        if (!lowerQuery) return true;
        return (
          event.title.toLowerCase().includes(lowerQuery) ||
          event.description.toLowerCase().includes(lowerQuery) ||
          event.location.toLowerCase().includes(lowerQuery)
        );
      })
      .map((event) => ({ ...event }));

    return Ok(matches);
  }

  async findAll(): Promise<Result<IEventRecord[], EventError>> {
    return Ok(this.events);
  }
  async updateStatus(
    id: string,
    status: IEventRecord["status"],
  ): Promise<Result<IEventRecord, EventError>> {
    const index = this.events.findIndex((event) => event.id === id);

    if (index === -1) {
      return Err(EventNotFound("Event not found."));
    }

    const current = this.events[index];
    const updated: IEventRecord = {
      ...current,
      status,
      updatedAt: new Date().toISOString(),
    };

    this.events[index] = updated;
    return Ok(updated);
  }
  async update(event: IEventRecord): Promise<Result<IEventRecord, EventError>> {
    const index = this.events.findIndex((e) => e.id === event.id);
    if (index === -1) {
      return Err(EventNotFound("Event not found."));
    }
    this.events[index] = event;
    return Ok(event);
  }
}


export function CreateInMemoryEventRepository(): IEventRepository {
  return new InMemoryEventRepository();
}
