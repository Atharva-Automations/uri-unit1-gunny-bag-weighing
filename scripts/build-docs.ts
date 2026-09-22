import fs from "fs";
import path from "path";
import { generateDocumentationPDF, generateDocumentationDOCX } from "../src/utils/docsGenerator";

async function main() {
  console.log("Generating Updated PDF & DOCX...");
  const pdfBuffer = await generateDocumentationPDF();
  const docxBuffer = await generateDocumentationDOCX();

  const pdfPath = path.join(process.cwd(), "Gunny_Bag_Weighing_System_Documentation_Updated.pdf");
  const docxPath = path.join(process.cwd(), "Gunny_Bag_Weighing_System_Documentation_Updated.docx");

  fs.writeFileSync(pdfPath, pdfBuffer);
  fs.writeFileSync(docxPath, docxBuffer);

  console.log(`Generated PDF (${pdfBuffer.length} bytes) -> ${pdfPath}`);
  console.log(`Generated DOCX (${docxBuffer.length} bytes) -> ${docxPath}`);
}

main().catch(console.error);
