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

## Feature 4: My RSVPs Dashboard (Shrey) 

## Feature 5: RSVP Toggle (Than) 

## Feature 6: Event Search (Than) 

## Feature 7: Catagory and Date Filter (Karl)

## Feature 8: Save for Later (Jay)