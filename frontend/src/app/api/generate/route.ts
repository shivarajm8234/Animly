import { NextResponse } from 'next/server';
import PDFParser from 'pdf2json';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    
    if (!file.name.endsWith('.pdf')) {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const text = await new Promise<string>((resolve, reject) => {
      // @ts-ignore
      const pdfParser = new PDFParser(null, 1);
      pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError || errData));
      pdfParser.on("pdfParser_dataReady", () => resolve(pdfParser.getRawTextContent()));
      pdfParser.parseBuffer(buffer);
    });
    
    return NextResponse.json({ text });
  } catch (error: any) {
    console.error("PDF parsing error:", error);
    return NextResponse.json({ error: error.message || "Failed to parse PDF" }, { status: 500 });
  }
}
