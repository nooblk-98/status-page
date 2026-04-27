import { NextResponse } from "next/server";
import { sites } from "@/lib/config";

export async function GET() {
  return NextResponse.json({ sites });
}
