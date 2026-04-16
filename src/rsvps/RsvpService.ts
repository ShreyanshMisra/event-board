import type { Result } from "../lib/result";
import type { RsvpError } from "./errors";
import type { IRsvpWithEvent } from "./Rsvp";
import type { IRsvpRepository } from "./RsvpRepository";

export interface IRsvpService {
  listUserRsvps(userId: string): Promise<Result<IRsvpWithEvent[], RsvpError>>;
}

class RsvpService implements IRsvpService {
  constructor(private readonly rsvps: IRsvpRepository) {}

  async listUserRsvps(userId: string): Promise<Result<IRsvpWithEvent[], RsvpError>> {
    return this.rsvps.findByUserId(userId);
  }
}

export function CreateRsvpService(rsvps: IRsvpRepository): IRsvpService {
  return new RsvpService(rsvps);
}
