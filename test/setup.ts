import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve(__dirname, "../prisma/dev.db");

beforeAll(() => {
  const db = new Database(dbPath);
  db.exec("DELETE FROM SavedEvent; DELETE FROM Rsvp; DELETE FROM Event;");
  db.close();
});
