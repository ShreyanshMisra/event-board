export type SavedEventError =
  | { name: "EventNotFound"; message: string }
  | { name: "EventNotSaveable"; message: string }
  | { name: "SavedEventUnauthorized"; message: string }
  | { name: "UnexpectedSavedEventError"; message: string };

export const EventNotFound = (message: string): SavedEventError => ({
  name: "EventNotFound",
  message,
});

export const EventNotSaveable = (message: string): SavedEventError => ({
  name: "EventNotSaveable",
  message,
});

export const SavedEventUnauthorized = (message: string): SavedEventError => ({
  name: "SavedEventUnauthorized",
  message,
});

export const UnexpectedSavedEventError = (message: string): SavedEventError => ({
  name: "UnexpectedSavedEventError",
  message,
});
