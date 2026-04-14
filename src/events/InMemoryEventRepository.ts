import { Err, Ok, type Result } from "../lib/result";
import type { UserRole } from "../auth/User";
import { UnexpectedEventError, type EventError } from "./errors";
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

  async findById(id: string, _userRole: UserRole): Promise<Result<IEventRecord | null, EventError>> {
    try {
      const match = this.events.find((e) => e.id === id) ?? null;
      return Ok(match);
    } catch {
      return Err(UnexpectedEventError("Unable to find the event."));
    }
  }

  async findByOrganizerId(organizerId: string): Promise<Result<IEventRecord[], EventError>> {
    try {
      const matches = this.events.filter((e) => e.organizerId === organizerId);
      return Ok(matches);
    } catch {
      return Err(UnexpectedEventError("Unable to list events."));
    }
  }
  async findAll(): Promise<Result<IEventRecord[], Error>> {
  return Ok(this.events);
}
}

export function CreateInMemoryEventRepository(): IEventRepository {
  return new InMemoryEventRepository();
}
