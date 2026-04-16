# Contracts

What we are commiting to expose as a part of each feature

## Feature 1: Event Creation (Shrey)

#### Types

```ts
type EventStatus = "draft" | "published" | "cancelled" | "past";

type EventCategory =
  | "academic"
  | "social"
  | "sports"
  | "club"
  | "career"
  | "arts"
  | "volunteer"
  | "other";
```

#### IEventRecord

```ts
interface IEventRecord {
  id: string;
  title: string;
  description: string;
  location: string;
  category: EventCategory;
  capacity: number;
  startDate: string;       // ISO 8601
  endDate: string;         // ISO 8601
  status: EventStatus;
  organizerId: string;
  createdAt: string;
  updatedAt: string;
}
```

#### IEventSummary

```ts
interface IEventSummary {
  id: string;
  title: string;
  location: string;
  category: EventCategory;
  capacity: number;
  startDate: string;
  endDate: string;
  status: EventStatus;
}
```

#### `IEventService.createEvent`

```
Method: createEvent(input: CreateEventInput, organizerId: string): Promise<Result<IEventRecord, EventError>>
```

**Parameters:**
- `input.title` — string, required, 1–100 chars
- `input.description` — string, required, 1–2000 chars
- `input.location` — string, required, 1–200 chars
- `input.category` — string, must be a valid EventCategory
- `input.capacity` — string (parsed to number), must be a positive integer
- `input.startDate` — string, ISO 8601 datetime
- `input.endDate` — string, ISO 8601 datetime, must be after startDate
- `organizerId` — string, the authenticated user's ID (from session)

**Success:** `Ok<IEventRecord>` — the full event record with `status: "draft"`, generated `id`, `createdAt`, `updatedAt`

**Errors:**
- `EventValidationError` — any field is empty, too long, invalid category, non-positive capacity, or dates are invalid/misordered
- `UnexpectedEventError` — repository failure

#### `IEventRepository.findById` (shared — needed by Features 2, 3, 5, 8)

```
Method: findById(id: string): Promise<Result<IEventRecord | null, EventError>>
```

**Success:** `Ok<IEventRecord | null>` — the event if found, `null` if not

**Errors:**
- `UnexpectedEventError` — repository failure

#### `IEventRepository.findByOrganizerId` (shared — needed by organizer dashboards)

```
Method: findByOrganizerId(organizerId: string): Promise<Result<IEventRecord[], EventError>>
```

**Success:** `Ok<IEventRecord[]>` — all events by that organizer (may be empty)

**Errors:**
- `UnexpectedEventError` — repository failure

## Feature 2: Event Detail Page (Karl)

## Feature 3: Event Editing (Jay)

#### `IEventService.editEvent`

```
Method: editEvent(eventId: string, input: EditEventInput, actingUserId: string, actingUserRole: UserRole): Promise<Result<IEventRecord, EventError>>
```

**Parameters:**
- `eventId` — string, the ID of the event to edit
- `input.title` — string, required, 1–100 chars
- `input.description` — string, required, 1–2000 chars
- `input.location` — string, required, 1–200 chars
- `input.category` — string, must be a valid EventCategory
- `input.capacity` — string (parsed to number), must be a positive integer
- `input.startDate` — string, ISO 8601 datetime
- `input.endDate` — string, ISO 8601 datetime, must be after startDate
- `actingUserId` — string, the authenticated user's ID (from session)
- `actingUserRole` — `"admin" | "staff" | "user"`, the authenticated user's role (from session)

**Success:** `Ok<IEventRecord>` — the updated event record with refreshed `updatedAt`; all other fields (e.g. `status`, `organizerId`) are unchanged

**Errors:**
- `EventNotFound` — no event exists with the given `eventId`
- `EventUnauthorized` — acting user is not the organizer and not an admin
- `InvalidEventStateTransition` — event status is `"cancelled"` or `"past"`
- `TitleRequired`, `TitleTooLong`, `DescriptionRequired`, `DescriptionTooLong`, `LocationRequired`, `LocationTooLong`, `CategoryRequired`, `CategoryInvalid`, `CapacityRequired`, `CapacityInvalid`, `StartDateRequired`, `StartDateInvalid`, `EndDateRequired`, `EndDateInvalid`, `EndDateBeforeStartDate` — same validation rules as `createEvent`
- `UnexpectedEventError` — repository failure

#### `IEventRepository.update`

```
Method: update(event: IEventRecord): Promise<Result<IEventRecord, EventError>>
```

**Parameters:**
- `event` — the full `IEventRecord` with updated fields and refreshed `updatedAt`

**Success:** `Ok<IEventRecord>` — the saved event record

**Errors:**
- `EventNotFound` — no event exists with the given `id`
- `UnexpectedEventError` — repository failure

#### Routes

- `GET /events/:id/edit` — Auth: `staff` or `admin`. Renders pre-populated edit form. Returns 403 if user is a member, 400 if event is cancelled or past, 404 if event not found.
- `POST /events/:id/edit` — Auth: `staff` or `admin`. Submits edits. On success redirects to `/events/:id`. On validation failure re-renders the form with the error message.

## Feature 4: My RSVPs Dashboard (Shrey)

#### Types

```ts
type RsvpStatus = "going" | "not_going";

interface IRsvpRecord {
  id: string;
  userId: string;
  eventId: string;
  status: RsvpStatus;
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
}

interface IRsvpWithEvent {
  rsvp: IRsvpRecord;
  event: {
    id: string;
    title: string;
    location: string;
    category: string;
    startDate: string;
    endDate: string;
    status: string;
  };
}
```

#### `IRsvpRepository` (shared contract — used by Features 4 and 5)

```ts
interface IRsvpRepository {
  // Feature 4 reads
  findByUserId(userId: string): Promise<Result<IRsvpWithEvent[], RsvpError>>;
  findByUserIdAndEventId(userId: string, eventId: string): Promise<Result<IRsvpRecord | null, RsvpError>>;

  // Feature 5 writes
  upsert(rsvp: IRsvpRecord): Promise<Result<IRsvpRecord, RsvpError>>;
  delete(userId: string, eventId: string): Promise<Result<void, RsvpError>>;

  // Shared
  countByEventId(eventId: string): Promise<Result<number, RsvpError>>;
}
```

#### `IRsvpService.listUserRsvps`

```
Method: listUserRsvps(userId: string): Promise<Result<IRsvpWithEvent[], RsvpError>>
```

**Parameters:**
- `userId` — string, the authenticated user's ID (from session)

**Success:** `Ok<IRsvpWithEvent[]>` — all RSVPs for the user joined with event details (may be empty)

**Errors:**
- `UnexpectedRsvpError` — repository failure

#### Route: `GET /my-rsvps`

- **Auth:** Requires authenticated user (any role)
- **Success:** Renders dashboard with list of user's RSVPs
- **Empty state:** "You haven't RSVP'd to any events yet."

#### Errors

```ts
type RsvpError =
  | { name: "RsvpNotFound"; message: string }
  | { name: "EventNotFound"; message: string }
  | { name: "AlreadyRsvped"; message: string }
  | { name: "InvalidRsvpStatus"; message: string }
  | { name: "UnexpectedRsvpError"; message: string };
```

## Feature 5: RSVP Toggle (Than)

#### Stub Route: `POST /events/:id/rsvp`

- **Auth:** Requires authenticated user (any role)
- **Current:** Renders placeholder page ("under construction")
- **Shared contract:** Uses `IRsvpRepository` defined in Feature 4 (see above)
- **Methods to use:** `upsert`, `delete`, `findByUserIdAndEventId`, `countByEventId`


## Feature 6: Event Search (Than) 

## Feature 7: Catagory and Date Filter (Karl)

## Feature 8: Save for Later (Jay)

#### Types

```ts
interface ISavedEventRecord {
  id: string;
  userId: string;
  eventId: string;
  createdAt: string;   // ISO 8601
}

interface ISavedEventWithEvent {
  saved: ISavedEventRecord;
  event: {
    id: string;
    title: string;
    location: string;
    category: string;
    startDate: string;
    endDate: string;
    status: string;
  };
}
```

#### `ISavedEventRepository`

```ts
interface ISavedEventRepository {
  findByUserId(userId: string): Promise<Result<ISavedEventWithEvent[], SavedEventError>>;
  findByUserIdAndEventId(userId: string, eventId: string): Promise<Result<ISavedEventRecord | null, SavedEventError>>;
  save(record: ISavedEventRecord): Promise<Result<ISavedEventRecord, SavedEventError>>;
  unsave(userId: string, eventId: string): Promise<Result<void, SavedEventError>>;
}
```

#### `ISavedEventService.toggleSaved`

```
Method: toggleSaved(eventId: string, actingUserId: string, actingUserRole: UserRole): Promise<Result<{ saved: boolean }, SavedEventError>>
```

**Parameters:**
- `eventId` — string, the ID of the event to save or unsave
- `actingUserId` — string, the authenticated user's ID (from session)
- `actingUserRole` — `"admin" | "staff" | "user"`, the authenticated user's role (from session)

**Success:** `Ok<{ saved: boolean }>` — `saved: true` if the event was just saved, `saved: false` if it was just unsaved

**Errors:**
- `SavedEventUnauthorized` — acting user is not a member (role is `"admin"` or `"staff"`)
- `EventNotFound` — no event exists with the given `eventId`
- `UnexpectedSavedEventError` — repository failure

#### `ISavedEventService.listSaved`

```
Method: listSaved(actingUserId: string, actingUserRole: UserRole): Promise<Result<ISavedEventWithEvent[], SavedEventError>>
```

**Parameters:**
- `actingUserId` — string, the authenticated user's ID (from session)
- `actingUserRole` — the authenticated user's role (from session)

**Success:** `Ok<ISavedEventWithEvent[]>` — all saved events for the user joined with event details (may be empty)

**Errors:**
- `SavedEventUnauthorized` — acting user is not a member (role is `"admin"` or `"staff"`)
- `UnexpectedSavedEventError` — repository failure

#### Routes

- `POST /events/:id/save` — Auth: `user` role only. Toggles saved state for the event. Responds inline (HTMX) with an updated save/unsave button reflecting the new state. Returns 403 for staff/admin, 404 if event not found.
- `GET /saved-events` — Auth: `user` role only. Renders the member's saved events list. Returns 403 for staff/admin.

#### Errors

```ts
type SavedEventError =
  | { name: "EventNotFound"; message: string }
  | { name: "SavedEventUnauthorized"; message: string }
  | { name: "UnexpectedSavedEventError"; message: string };
```