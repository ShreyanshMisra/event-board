import type { Result } from "../lib/result";
import type { UserRole } from "../auth/User";
import type { EventError } from "./errors";
import type { IEventRecord } from "./Event";

export interface IEventRepository {
  create(event: IEventRecord): Promise<Result<IEventRecord, EventError>>;
  findById(id: string, userRole: UserRole): Promise<Result<IEventRecord | null, EventError>>;
  findByOrganizerId(organizerId: string): Promise<Result<IEventRecord[], EventError>>;
}
