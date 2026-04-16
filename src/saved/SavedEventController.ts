import type { Request, Response } from "express";
import type { IAppBrowserSession } from "../session/AppSession";
import type { ILoggingService } from "../service/LoggingService";
import type { ISavedEventService } from "./SavedEventService";

export interface ISavedEventController {
  toggleFromDetailPage(
    req: Request,
    res: Response,
    session: IAppBrowserSession,
  ): Promise<void>;
  showSavedList(
    req: Request,
    res: Response,
    session: IAppBrowserSession,
  ): Promise<void>;
  isSaved(eventId: string, userId: string): Promise<boolean>;
}

class SavedEventController implements ISavedEventController {
  constructor(
    private readonly service: ISavedEventService,
    private readonly logger: ILoggingService,
  ) {}

  async toggleFromDetailPage(
    req: Request,
    res: Response,
    session: IAppBrowserSession,
  ): Promise<void> {
    const user = session.authenticatedUser;
    if (!user) {
      res.redirect("/login");
      return;
    }

    const eventId = req.params.id as string;
    const isHtmx = req.get("HX-Request") === "true";
    const result = await this.service.toggleSaved(eventId, user.userId, user.role);

    if (result.ok === false) {
      const error = result.value;
      const status = error.name === "EventNotFound" ? 404
        : error.name === "SavedEventUnauthorized" ? 403
        : 500;
      this.logger.warn(`Toggle save failed: ${error.message}`);
      res.status(status).render("partials/error", { message: error.message, layout: false });
      return;
    }

    const isSaved = result.value.saved;
    this.logger.info(`User ${user.userId} ${isSaved ? "saved" : "unsaved"} event ${eventId}`);

    if (isHtmx) {
      res.render("saved/partials/save-button", {
        eventId,
        isSaved,
        layout: false,
      });
      return;
    }

    res.redirect(`/events/${eventId}`);
  }

  async showSavedList(
    _req: Request,
    res: Response,
    session: IAppBrowserSession,
  ): Promise<void> {
    const user = session.authenticatedUser;
    if (!user) {
      res.redirect("/login");
      return;
    }

    const result = await this.service.listSaved(user.userId, user.role);

    if (result.ok === false) {
      this.logger.error(`Failed to load saved events: ${result.value.message}`);
      res.status(500).render("partials/error", {
        message: "Unable to load your saved events.",
        layout: false,
      });
      return;
    }

    this.logger.info(`Loaded ${result.value.length} saved events for user ${user.userId}`);
    res.render("saved/list", { savedEvents: result.value, session, pageError: null });
  }

  async isSaved(eventId: string, userId: string): Promise<boolean> {
    const result = await this.service.isSaved(eventId, userId);
    return result;
  }
}

export function CreateSavedEventController(
  service: ISavedEventService,
  logger: ILoggingService,
): ISavedEventController {
  return new SavedEventController(service, logger);
}
