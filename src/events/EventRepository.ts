import type { Result } from "../lib/result";
import type { UserRole } from "../auth/User";
import type { EventError } from "./errors";
import type { IEventRecord } from "./Event";

export interface IEventRepository {
  create(event: IEventRecord): Promise<Result<IEventRecord, EventError>>;
  findById(id: string, userRole: UserRole): Promise<Result<IEventRecord | null, EventError>>;
  findByOrganizerId(organizerId: string): Promise<Result<IEventRecord[], EventError>>;
  
  findUpcoming(): Promise<Result<IEventRecord[], EventError>>;
  findAll(): Promise<Result<IEventRecord[], EventError>>;
  updateStatus(id: string,status: IEventRecord["status"],): Promise<Result<IEventRecord, EventError>>;
  update(event: IEventRecord): Promise<Result<IEventRecord, EventError>>;
}
