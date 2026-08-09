import Image from "next/image";

const palettes = ["cover-forest", "cover-coral", "cover-ink", "cover-sand", "cover-sage", "cover-rust"];
function palette(title: string) { return palettes[Array.from(title).reduce((sum, char) => sum + char.charCodeAt(0), 0) % palettes.length]; }

export function BookCover({ title, author, coverUrl, priority = false }: { title: string; author: string; coverUrl?: string | null; priority?: boolean }) {
  if (coverUrl) return <div className="book-cover book-cover-image"><Image src={coverUrl} alt={`Cover of ${title}`} fill sizes="(max-width: 600px) 42vw, 180px" priority={priority} /></div>;
  return <div className={`book-cover book-cover-fallback ${palette(title)}`} role="img" aria-label={`No cover available for ${title}`}><span className="cover-rule" /><strong>{title}</strong><small>{author}</small><span className="cover-mark">GS</span></div>;
}
