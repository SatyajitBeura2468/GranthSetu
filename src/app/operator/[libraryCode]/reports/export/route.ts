import { getWorkspaceData } from "@/lib/operator/workspace";

type PopularBook = { title?: string; author?: string; loans?: number };

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ libraryCode: string }> },
) {
  const { libraryCode } = await params;
  const data = await getWorkspaceData(libraryCode, "reports");
  if (data.error) return new Response("Report data is unavailable.", { status: 503 });

  const rows = [
    ["Rank", "Title", "Author", "Recorded loans"],
    ...((data.popular ?? []) as PopularBook[]).map((book, index) => [index + 1, book.title, book.author, book.loans]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="granthsetu-${libraryCode.toLowerCase()}-circulation.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
