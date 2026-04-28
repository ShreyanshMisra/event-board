import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { CreateAdminUserService } from "./auth/AdminUserService";
import { CreateAuthController } from "./auth/AuthController";
import { CreateAuthService } from "./auth/AuthService";
import { CreateInMemoryUserRepository } from "./auth/InMemoryUserRepository";
import { CreatePasswordHasher } from "./auth/PasswordHasher";
import { CreateEventController } from "./events/EventController";
import { CreateEventService } from "./events/EventService";
import { CreatePrismaEventRepository } from "./events/PrismaEventRepository";
import { CreateInMemoryRsvpRepository } from "./rsvps/InMemoryRsvpRepository";
import { CreateRsvpController } from "./rsvps/RsvpController";
import {
  CreateRsvpService,
  CreateRsvpToggleService,
} from "./rsvps/RsvpService";
import { CreatePrismaRsvpRepository } from "./rsvps/PrismaRsvpRepository";
import { CreateSavedEventController } from "./saved/SavedEventController";
import { CreateSavedEventService } from "./saved/SavedEventService";
import { CreateInMemorySavedEventRepository } from "./saved/InMemorySavedEventRepository";
import { CreateApp } from "./app";
import type { IApp } from "./contracts";
import { CreateLoggingService } from "./service/LoggingService";
import type { ILoggingService } from "./service/LoggingService";

export function createComposedApp(logger?: ILoggingService): IApp {
  const resolvedLogger = logger ?? CreateLoggingService();

  // Authentication & authorization wiring
  const authUsers = CreateInMemoryUserRepository();
  const passwordHasher = CreatePasswordHasher();
  const authService = CreateAuthService(authUsers, passwordHasher);
  const adminUserService = CreateAdminUserService(authUsers, passwordHasher);
  const authController = CreateAuthController(
    authService,
    adminUserService,
    resolvedLogger,
  );

  // Prisma wiring (shared across repositories)
  const dbUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  const prisma = new PrismaClient({ adapter });

  // Event wiring
  const eventRepository = CreatePrismaEventRepository(prisma);
  const eventService = CreateEventService(eventRepository);
  const eventController = CreateEventController(eventService, resolvedLogger);

  // RSVP wiring
  const rsvpRepository = CreateInMemoryRsvpRepository(eventRepository);
  const rsvpService = CreateRsvpToggleService(rsvpRepository, eventRepository);
  const rsvpController = CreateRsvpController(rsvpService, resolvedLogger);

  // Saved events wiring
  const savedEventRepository = CreateInMemorySavedEventRepository(eventRepository);
  const savedEventService = CreateSavedEventService(savedEventRepository, eventRepository);
  const savedEventController = CreateSavedEventController(savedEventService, resolvedLogger);

  return CreateApp(
    authController,
    eventController,
    rsvpController,
    savedEventController,
    resolvedLogger,
  );
}
