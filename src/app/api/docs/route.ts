import { NextRequest, NextResponse } from "next/server";
import { generateDocumentationPDF, generateDocumentationDOCX } from "@/utils/docsGenerator";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const format = request.nextUrl.searchParams.get("format") ?? "pdf";

    if (format === "docx") {
      const buffer = await generateDocumentationDOCX();
      return new NextResponse(buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": 'attachment; filename="Gunny-Bag-Weighing-System-Documentation.docx"',
        },
      });
    }

    const buffer = await generateDocumentationPDF();
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Gunny-Bag-Weighing-System-Documentation.pdf"',
      },
    });
  } catch (err) {
    console.error("Documentation generation error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
