import Link from "next/link";
import { BookX } from "lucide-react";
import { Brand } from "@/components/brand/brand";

export default function NotFoundPage() {
  return <main className="state-page"><Brand /><BookX aria-hidden="true" /><p className="step-label">Room not found</p><h1>This shelf is not here.</h1><p>The Library Room code or page may be incorrect. Check the code shared by your institution and try again.</p><div className="state-actions"><Link className="button button-primary" href="/">Enter another code</Link><Link className="button button-secondary" href="/staff">Staff access</Link></div></main>;
}
