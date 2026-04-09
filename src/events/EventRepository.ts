import type { Result } from "../lib/result";
import type { EventError } from "./errors";
import type { IEventRecord } from "./Event";

export interface IEventRepository {
  create(event: IEventRecord): Promise<Result<IEventRecord, EventError>>;
  findById(id: string): Promise<Result<IEventRecord | null, EventError>>;
  findByOrganizerId(organizerId: string): Promise<Result<IEventRecord[], EventError>>;
}
