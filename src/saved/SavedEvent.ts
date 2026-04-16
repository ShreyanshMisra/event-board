export interface ISavedEventRecord {
  id: string;
  userId: string;
  eventId: string;
  createdAt: string; // ISO 8601
}

export interface ISavedEventWithEvent {
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
