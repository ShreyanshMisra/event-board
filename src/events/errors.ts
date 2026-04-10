export type EventError =
  | { name: "EventValidationError"; message: string }
  | { name: "EventNotFound"; message: string }
  | { name: "UnexpectedEventError"; message: string };

export const EventValidationError = (message: string): EventError => ({
  name: "EventValidationError",
  message,
});

export const EventNotFound = (message: string): EventError => ({
  name: "EventNotFound",
  message,
});

export const UnexpectedEventError = (message: string): EventError => ({
  name: "UnexpectedEventError",
  message,
});
