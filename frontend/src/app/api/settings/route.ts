import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Save to the root of the Animly project
    // Next.js runs from frontend directory, so we go up one level
    const configPath = path.join(process.cwd(), '..', 'config.json');
    
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');
    
    return NextResponse.json({ success: true, message: 'Configuration saved successfully.' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to save configuration.' },
      { status: 500 }
    );
  }
}
