import type { Request, Response } from "express";
import type { IAppBrowserSession } from "../session/AppSession";
import type { ILoggingService } from "../service/LoggingService";
import type { IRsvpService } from "./RsvpService";

export interface IRsvpController {
  showDashboard(
    req: Request,
    res: Response,
    userId: string,
    session: IAppBrowserSession,
  ): Promise<void>;
  showTogglePlaceholder(
    req: Request,
    res: Response,
    session: IAppBrowserSession,
  ): Promise<void>;
}

class RsvpController implements IRsvpController {
  constructor(
    private readonly service: IRsvpService,
    private readonly logger: ILoggingService,
  ) {}

  async showDashboard(
    _req: Request,
    res: Response,
    userId: string,
    session: IAppBrowserSession,
  ): Promise<void> {
    const result = await this.service.listUserRsvps(userId);

    if (result.ok === false) {
      this.logger.error(`Failed to load RSVPs: ${result.value.message}`);
      res.status(500).render("partials/error", {
        message: "Unable to load your RSVPs.",
        layout: false,
      });
      return;
    }

    this.logger.info(`Loaded ${result.value.length} RSVPs for user ${userId}`);
    res.render("rsvps/dashboard", {
      rsvps: result.value,
      session,
      pageError: null,
    });
  }

  async showTogglePlaceholder(
    _req: Request,
    res: Response,
    session: IAppBrowserSession,
  ): Promise<void> {
    res.render("rsvps/toggle-placeholder", { session, pageError: null });
  }
}

export function CreateRsvpController(
  service: IRsvpService,
  logger: ILoggingService,
): IRsvpController {
  return new RsvpController(service, logger);
}
