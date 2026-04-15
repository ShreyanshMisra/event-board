import { PrismaClient } from "@prisma/client";
import { Err, Ok, type Result } from "../lib/result";
import type { UserRole } from "../auth/User";
import { UnexpectedEventError, type EventError } from "./errors";
import type { IEventRecord, EventCategory } from "./Event";
import type { IEventRepository } from "./EventRepository";

function toEventRecord(row: {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  capacity: number;
  startDate: string;
  endDate: string;
  status: string;
  organizerId: string;
  createdAt: string;
  updatedAt: string;
}): IEventRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    category: row.category as EventCategory,
    capacity: row.capacity,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status as IEventRecord["status"],
    organizerId: row.organizerId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

class PrismaEventRepository implements IEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(event: IEventRecord): Promise<Result<IEventRecord, EventError>> {
    try {
      const row = await this.prisma.event.create({ data: event });
      return Ok(toEventRecord(row));
    } catch {
      return Err(UnexpectedEventError("Unable to create the event."));
    }
  }

  async findById(
    id: string,
    _userRole: UserRole,
  ): Promise<Result<IEventRecord | null, EventError>> {
    try {
      const row = await this.prisma.event.findUnique({ where: { id } });
      return Ok(row ? toEventRecord(row) : null);
    } catch {
      return Err(UnexpectedEventError("Unable to find the event."));
    }
  }

  async findByOrganizerId(
    organizerId: string,
  ): Promise<Result<IEventRecord[], EventError>> {
    try {
      const rows = await this.prisma.event.findMany({ where: { organizerId } });
      return Ok(rows.map(toEventRecord));
    } catch {
      return Err(UnexpectedEventError("Unable to list events."));
    }
  }
  async findAll(): Promise<Result<IEventRecord[], EventError>> {
    try {
      const rows = await this.prisma.event.findMany({
        orderBy: {
          startDate: "asc",
        },
      });

      return Ok(rows.map(toEventRecord));
    } catch {
      return Err(UnexpectedEventError("Unable to list events."));
    }
  }

  async updateStatus(
    id: string,
    status: IEventRecord["status"],
  ): Promise<Result<IEventRecord, EventError>> {
    try {
      const row = await this.prisma.event.update({
        where: { id },
        data: {
          status,
        },
      });

      return Ok(toEventRecord(row));
    } catch {
      return Err(UnexpectedEventError("Unable to update event status."));
    }
  }
}

export function CreatePrismaEventRepository(
  prisma: PrismaClient,
): IEventRepository {
  return new PrismaEventRepository(prisma);
}
