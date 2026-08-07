import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "granthsetu",
    stage: "v3-platform-foundation",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "local",
    ...(process.env.VERCEL_GIT_COMMIT_SHA ? { commit: process.env.VERCEL_GIT_COMMIT_SHA } : {}),
  });
}
