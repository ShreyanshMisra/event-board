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
  async findUpcoming(): Promise<Result<IEventRecord[], EventError>> {
    try {
      const nowIso = new Date().toISOString();
      const rows = await this.prisma.event.findMany({
        where: {
          startDate: { gt: nowIso },
          status: { notIn: ["cancelled", "past"] },
        },
        orderBy: { startDate: "asc" },
      });
      return Ok(rows.map(toEventRecord));
    } catch {
      return Err(UnexpectedEventError("Unable to list upcoming events."));
    }
  }

  async searchUpcoming(query: string): Promise<Result<IEventRecord[], EventError>> {
    try {
      const nowIso = new Date().toISOString();
      const lowerQuery = query.toLowerCase();

      const baseWhere: Record<string, unknown> = {
        startDate: { gt: nowIso },
        status: { notIn: ["cancelled", "past"] },
      };

      if (lowerQuery) {
        baseWhere.OR = [
          { title: { contains: lowerQuery } },
          { description: { contains: lowerQuery } },
          { location: { contains: lowerQuery } },
        ];
      }

      const rows = await this.prisma.event.findMany({
        where: baseWhere,
        orderBy: { startDate: "asc" },
      });
      return Ok(rows.map(toEventRecord));
    } catch {
      return Err(UnexpectedEventError("Unable to search upcoming events."));
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
        data: { status },
      });
      return Ok(toEventRecord(row));
    } catch {
      return Err(UnexpectedEventError("Unable to update event status."));
    }
  }

  async update(event: IEventRecord): Promise<Result<IEventRecord, EventError>> {
    try {
      const row = await this.prisma.event.update({
        where: { id: event.id },
        data: {
          title: event.title,
          description: event.description,
          location: event.location,
          category: event.category,
          capacity: event.capacity,
          startDate: event.startDate,
          endDate: event.endDate,
          updatedAt: event.updatedAt,
        },
      });
      return Ok(toEventRecord(row));
    } catch {
      return Err(UnexpectedEventError("Unable to update the event."));
    }
  }
}

export function CreatePrismaEventRepository(
  prisma: PrismaClient,
): IEventRepository {
  return new PrismaEventRepository(prisma);
}
