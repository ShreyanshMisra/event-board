import type { Request, Response } from "express";
import type { UserRole } from "../auth/User";
import type { IAppBrowserSession } from "../session/AppSession";
import type { ILoggingService } from "../service/LoggingService";
import type { IRsvpToggleService } from "./RsvpService";

export interface IRsvpController {
  showDashboard(
    req: Request,
    res: Response,
    userId: string,
    session: IAppBrowserSession,
  ): Promise<void>;
  renderToggleSection(
    req: Request,
    res: Response,
    userId: string,
    userRole: UserRole,
    session: IAppBrowserSession,
  ): Promise<void>;
  toggleFromDetailPage(
    req: Request,
    res: Response,
    userId: string,
    userRole: UserRole,
    session: IAppBrowserSession,
  ): Promise<void>;
}

class RsvpController implements IRsvpController {
  constructor(
    private readonly service: IRsvpToggleService,
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

  async renderToggleSection(
    req: Request,
    res: Response,
    userId: string,
    userRole: UserRole,
    _session: IAppBrowserSession,
  ): Promise<void> {
    const eventId = req.params.id as string;
    const result = await this.service.getToggleState(userId, userRole, eventId);

    if (result.ok === false) {
      this.logger.warn(`Failed to load RSVP state: ${result.value.message}`);
      res.status(400).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    res.render("rsvps/partials/toggle", {
      eventId: result.value.eventId,
      rsvpStatus: result.value.status,
      attendeeCount: result.value.attendeeCount,
      layout: false,
    });
  }

  async toggleFromDetailPage(
    req: Request,
    res: Response,
    userId: string,
    userRole: UserRole,
    _session: IAppBrowserSession,
  ): Promise<void> {
    const eventId = req.params.id as string;
    const result = await this.service.toggleRsvp(userId, userRole, eventId);

    if (result.ok === false) {
      this.logger.warn(`Failed to toggle RSVP: ${result.value.message}`);
      res.status(400).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    res.render("rsvps/partials/toggle", {
      eventId: result.value.eventId,
      rsvpStatus: result.value.status,
      attendeeCount: result.value.attendeeCount,
      layout: false,
    });
  }
}

export function CreateRsvpController(
  service: IRsvpToggleService,
  logger: ILoggingService,
): IRsvpController {
  return new RsvpController(service, logger);
}
