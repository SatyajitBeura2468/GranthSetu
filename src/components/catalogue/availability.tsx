import { AlertCircle, CheckCircle2, Clock3 } from "lucide-react";
import type { PublicBook } from "@/lib/library/public-data";

export function Availability({ book, detailed = false }: { book: PublicBook; detailed?: boolean }) {
  const available = book.availableCopies > 0;
  const Icon = available ? CheckCircle2 : book.expectedAvailability ? Clock3 : AlertCircle;
  const label = available ? (book.availableCopies === 1 ? "Limited availability" : "Available") : book.expectedAvailability ? "On loan" : "Unavailable";
  return <div className={`availability availability-${book.availabilityState}`}><Icon aria-hidden="true" /><span><strong>{label}</strong>{detailed ? <small>{available ? `${book.availableCopies} of ${book.totalCopies} copies available` : book.expectedAvailability ? `Expected availability: ${new Date(book.expectedAvailability).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "No lendable copies currently available"}</small> : null}</span></div>;
}
