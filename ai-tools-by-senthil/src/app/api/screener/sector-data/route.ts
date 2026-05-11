import { NextRequest, NextResponse } from "next/server";
import { fetchScreenerSectorTable } from "@/lib/screener";

export async function GET(req: NextRequest) {
  try {
    const path = req.nextUrl.searchParams.get("path") || "";
    if (!path) {
      return NextResponse.json({ error: "Missing required query param: path" }, { status: 400 });
    }

    const data = await fetchScreenerSectorTable(path);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch sector table" },
      { status: 500 }
    );
  }
}
