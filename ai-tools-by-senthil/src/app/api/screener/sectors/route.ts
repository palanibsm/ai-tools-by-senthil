import { NextResponse } from "next/server";
import { fetchScreenerSectors } from "@/lib/screener";

export async function GET() {
  try {
    const sectors = await fetchScreenerSectors();
    return NextResponse.json({ sectors });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch sectors" },
      { status: 500 }
    );
  }
}
