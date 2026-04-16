import type { Request, Response } from "express";
import type { IAppBrowserSession } from "../session/AppSession";
import type { ILoggingService } from "../service/LoggingService";
import type { IEventService, CreateEventInput } from "./EventService";
import type { EventError } from "./errors";

export interface IEventController {
  showCreateForm(
    res: Response,
    session: IAppBrowserSession,
    pageError?: string | null,
  ): Promise<void>;
  createFromForm(
    req: Request,
    res: Response,
    input: CreateEventInput,
    organizerId: string,
    session: IAppBrowserSession,
  ): Promise<void>;

  searchUpcoming(req: Request, res: Response): Promise<void>;
  showDetailPage(
    req: Request,
    res: Response,
    session: IAppBrowserSession,
  ): Promise<void>;
  showHomePage(res: Response, session: IAppBrowserSession): Promise<void>;
  publishFromDetailPage(
    req: Request,
    res: Response,
    session: IAppBrowserSession,
  ): Promise<void>;

  cancelFromDetailPage(
    req: Request,
    res: Response,
    session: IAppBrowserSession,
  ): Promise<void>;
}

class EventController implements IEventController {
  constructor(
    private readonly service: IEventService,
    private readonly logger: ILoggingService,
  ) {}

  private mapErrorStatus(error: EventError): number {
    if (error.name === "EventNotFound") return 404;
    if (error.name === "UnexpectedEventError") return 500;
    return 400;
  }

  async showCreateForm(
    res: Response,
    session: IAppBrowserSession,
    pageError: string | null = null,
  ): Promise<void> {
    res.render("events/create", { pageError, session });
  }

  async createFromForm(
    req: Request,
    res: Response,
    input: CreateEventInput,
    organizerId: string,
    session: IAppBrowserSession,
  ): Promise<void> {
    const result = await this.service.createEvent(input, organizerId);
    const isHtmx = req.get("HX-Request") === "true";

    if (result.ok === false) {
      const error = result.value;
      const status = this.mapErrorStatus(error);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Create event failed: ${error.message}`);

      if (isHtmx) {
        res.status(status).render("events/partials/form", {
          pageError: error.message,
          session,
          layout: false,
        });
        return;
      }

      res.status(status);
      await this.showCreateForm(res, session, error.message);
      return;
    }

    this.logger.info(
      `Created event "${result.value.title}" (${result.value.id})`,
    );

    if (isHtmx) {
      res.set("HX-Redirect", "/home");
      res.sendStatus(204);
      return;
    }

    res.redirect("/home");
  }

  async searchUpcoming(req: Request, res: Response): Promise<void> {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const result = await this.service.searchUpcoming(query);

    if (result.ok === false) {
      res.status(500).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    res.render("events/partials/list", {
      events: result.value,
      layout: false,
    });
  }

  async showDetailPage(
    req: Request,
    res: Response,
    session: IAppBrowserSession,
  ): Promise<void> {
    const eventId = req.params.id as string;

    const user = session.authenticatedUser;
    if (!user) {
      res.redirect("/login");
      return;
    }

    const result = await this.service.findVisibleEventById(
      eventId,
      user.userId,
      user.role,
    );

    if (result.ok === false) {
      const error = result.value;
      const status = this.mapErrorStatus(error);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Find event failed: ${error.message}`);

      res.status(status).render("errors/not-found", {
        pageError: error.message,
        session,
      });
      return;
    }

    if (!result.value) {
      res.status(404).render("errors/not-found", {
        pageError: "Event not found.",
        session,
      });
      return;
    }

    const event = result.value;

    const isOrganizer = event.organizerId === user.userId;
    const isAdmin = user.role === "admin";

    const canEdit = isOrganizer || isAdmin;
    const hasEnded = new Date(event.endDate).getTime() <= Date.now();
    const canRsvp =
      event.status === "published" && !isOrganizer && !isAdmin && !hasEnded;
    const canPublish = event.status === "draft" && (isOrganizer || isAdmin);
    const canCancel = event.status === "published" && (isOrganizer || isAdmin);

    res.render("events/detail", {
      event,
      session,
      pageError: null,
      canEdit,
      canRsvp,
      canPublish,
      canCancel,
    });
  }

  async showHomePage(
    res: Response,
    session: IAppBrowserSession,
  ): Promise<void> {
    const user = session.authenticatedUser;

    if (!user) {
      res.redirect("/login");
      return;
    }

    const result = await this.service.listVisibleEvents(user.userId, user.role);

    if (!result.ok) {
      const status = this.mapErrorStatus(result.value);
      res.status(status).render("home", {
        session,
        pageError: result.value.message,
        events: [],
      });
      return;
    }

    res.render("home", {
      session,
      pageError: null,
      events: result.value,
    });
  }

  async publishFromDetailPage(
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
    const result = await this.service.publishEvent(
      eventId,
      user.userId,
      user.role,
    );

    const isHtmx = req.get("HX-Request") === "true";

    if (result.ok === false) {
      const error = result.value;
      const status = this.mapErrorStatus(error);

      res.status(status).render("errors/not-found", {
        pageError: error.message,
        session,
        layout: isHtmx ? false : undefined,
      });
      return;
    }

    const event = result.value;

    const isOrganizer = event.organizerId === user.userId;
    const isAdmin = user.role === "admin";

    const canEdit = isOrganizer || isAdmin;
    const hasEnded = new Date(event.endDate).getTime() <= Date.now();
    const canRsvp =
      event.status === "published" && !isOrganizer && !isAdmin && !hasEnded;
    const canPublish = event.status === "draft" && (isOrganizer || isAdmin);
    const canCancel = event.status === "published" && (isOrganizer || isAdmin);

    if (isHtmx) {
      res.render("events/detail", {
        event,
        session,
        pageError: null,
        canEdit,
        canRsvp,
        canPublish,
        canCancel,
        layout: false,
      });
      return;
    }

    res.redirect(`/events/${event.id}`);
  }

  async cancelFromDetailPage(
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
    const result = await this.service.cancelEvent(
      eventId,
      user.userId,
      user.role,
    );

    const isHtmx = req.get("HX-Request") === "true";

    if (result.ok === false) {
      const error = result.value;
      const status = this.mapErrorStatus(error);

      res.status(status).render("errors/not-found", {
        pageError: error.message,
        session,
        layout: isHtmx ? false : undefined,
      });
      return;
    }

    const event = result.value;

    const isOrganizer = event.organizerId === user.userId;
    const isAdmin = user.role === "admin";

    const canEdit = isOrganizer || isAdmin;
    const hasEnded = new Date(event.endDate).getTime() <= Date.now();
    const canRsvp =
      event.status === "published" && !isOrganizer && !isAdmin && !hasEnded;
    const canPublish = event.status === "draft" && (isOrganizer || isAdmin);
    const canCancel = event.status === "published" && (isOrganizer || isAdmin);

    if (isHtmx) {
      res.render("events/detail", {
        event,
        session,
        pageError: null,
        canEdit,
        canRsvp,
        canPublish,
        canCancel,
        layout: false,
      });
      return;
    }

    res.redirect(`/events/${event.id}`);
  }
}

export function CreateEventController(
  service: IEventService,
  logger: ILoggingService,
): IEventController {
  return new EventController(service, logger);
}
