import Link from "next/link";
import { SearchX } from "lucide-react";

export default function LibraryNotFound() { return <main className="state-page"><SearchX aria-hidden="true" /><h1>Library not found</h1><p>Check the code provided by your institution.</p><Link className="button button-primary" href="/">Enter another library code</Link></main>; }
