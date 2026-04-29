import type { Result } from "../lib/result";
import type { SavedEventError } from "./errors";
import type { ISavedEventRecord, ISavedEventWithEvent } from "./SavedEvent";

export interface ISavedEventRepository {
  findByUserId(userId: string): Promise<Result<ISavedEventWithEvent[], SavedEventError>>;
  findByUserIdAndEventId(userId: string, eventId: string): Promise<Result<ISavedEventRecord | null, SavedEventError>>;
  save(record: ISavedEventRecord): Promise<Result<ISavedEventRecord, SavedEventError>>;
  unsave(userId: string, eventId: string): Promise<Result<void, SavedEventError>>;
}
