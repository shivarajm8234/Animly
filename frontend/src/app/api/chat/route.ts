import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { search, SafeSearchType } from 'duck-duck-scrape';
import * as googleTTS from 'google-tts-api';
import { database } from '../../../lib/firebase';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';

export async function POST(request: Request) {
  try {
    const { message, character, context } = await request.json();
    
    // Auth Check
    const customKey = request.headers.get('x-groq-api-key');
    const groqKey = customKey || process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({ error: "Groq API Key is missing. Please provide it in settings." }, { status: 401 });
    }

    const groq = new Groq({ apiKey: groqKey });

    // Web Search Integration
    let searchResultsStr = "";
    let ytBasic = "", ytIntermediate = "", ytAdvanced = "";
    try {
      const searchResults = await search(message, { safeSearch: SafeSearchType.OFF });
      if (searchResults && searchResults.results && searchResults.results.length > 0) {
        const topResults = searchResults.results.slice(0, 3);
        searchResultsStr = "\\nOnline Research Context:\\n" + topResults.map((r: any) => `- ${r.title}: ${r.description}`).join("\\n");
        
        // If they asked for a video, do dedicated searches for 3 levels
        if (message.toLowerCase().includes('video')) {
          const [basicSearch, intSearch, advSearch] = await Promise.all([
            search(message + " basic beginner tutorial youtube", { safeSearch: SafeSearchType.OFF }),
            search(message + " intermediate tutorial youtube", { safeSearch: SafeSearchType.OFF }),
            search(message + " advanced expert tutorial youtube", { safeSearch: SafeSearchType.OFF })
          ]);

          const extractId = (res: any) => {
            const yt = res?.results?.find((r: any) => r.url.includes('youtube.com/watch?v='));
            if (yt) {
              try { return new URL(yt.url).searchParams.get('v') || ""; } catch (e) {}
            }
            return "";
          };

          ytBasic = extractId(basicSearch);
          ytIntermediate = extractId(intSearch);
          ytAdvanced = extractId(advSearch);
        }
      }
    } catch (e) {
      console.error("Web search error:", e);
    }

    const systemPrompt = `You are ${character}, an interactive AI tutor. 
CRITICAL RULES:
1. You MUST strictly stick to the uploaded PDF material (context) provided below. 
2. Do NOT answer questions outside the scope of this material, unless it is a direct comparison to the material.
3. You MUST reply in JSON format with exactly three fields.
4. DEFAULT TO TEXT & BULLET POINTS: You MUST ALWAYS populate whiteboard_html with detailed, beautifully formatted textual explanations. You MUST use bullet points (<ul> or <ol> with <li>) to explain concepts clearly, along with headings to summarize your response. Do NOT use massive walls of text; break them down into bulleted lists. Do NOT leave whiteboard_html empty.
5. IF ASKED FOR COMPARISON: If the user asks to compare or show differences, you MUST use an HTML <table> in the whiteboard_html. Do NOT use flowcharts for comparisons.
6. IF ASKED FOR VIDEO: If the user asks for videos, you MUST provide THREE videos: one basic, one intermediate, and one advanced. Use the exact video IDs provided in the 'Available Video' context below. IF AND ONLY IF the user explicitly asks for "links", just list the youtube.com/watch?v= URLs as text. OTHERWISE, you MUST embed them using this exact format for each: <div><h3 class='text-xl font-bold'>Basic/Intermediate/Advanced</h3><iframe class="w-full aspect-video rounded-xl shadow-lg border border-slate-200 mt-2 mb-4" src="https://www.youtube.com/embed/AVAILABLE_VIDEO_ID" allowfullscreen></iframe></div>. If no ID is provided, use M7lc1UVf-VE. NEVER just return a text list of video titles unless links were requested.
7. IF ASKED FOR VISUAL/FLOWCHART: If the user asks for a flowchart, visual graph, or diagram, populate react_flow_data with nodes and edges. Otherwise, leave it completely empty arrays [].
8. IF ASKED FROM INTERNET: If the user asks for outside info, strictly rely on the "Online Research Context" provided below to give accurate details.

EXAMPLE VIDEO RESPONSE:
{
  "text": "Here are some helpful videos ranging from beginner to advanced.",
  "whiteboard_html": "<div><h3 class='text-xl font-bold'>Basic</h3><iframe class='w-full aspect-video rounded-xl shadow-lg border border-slate-200 mt-2 mb-4' src='https://www.youtube.com/embed/M7lc1UVf-VE' allowfullscreen></iframe></div>",
  "react_flow_data": { "nodes": [], "edges": [] }
}

{
  "text": "Your concise, spoken response to the student.",
  "whiteboard_html": "HTML formatted content to display on the whiteboard. Use TailwindCSS classes for styling (e.g., <h2 class='text-3xl font-extrabold text-slate-900 mb-4'> and <p class='text-slate-800'>). You MUST make all text very dark (use text-slate-900). Use HTML <ul> or <ol> for bullet points, and properly formatted <table> for comparisons. MUST ALWAYS contain detailed textual summaries.",
  "react_flow_data": {
    "nodes": [{"id": "1", "data": {"label": "Node 1", "description": "A VERY long, highly detailed, multi-sentence paragraph explaining this concept in-depth."}, "position": {"x": 0, "y": 0}}],
    "edges": [{"id": "e1-2", "source": "1", "target": "2"}]
  }
}

Note: If no flow graph is requested, MUST leave nodes and edges as empty arrays []. The positions of nodes should be reasonably spaced (e.g., y: 0, 100, 200).

Use the following context if relevant: ${context.substring(0, 5000)}
${searchResultsStr}
Available Video IDs (if asked):
Basic: ${ytBasic || 'M7lc1UVf-VE'}
Intermediate: ${ytIntermediate || 'M7lc1UVf-VE'}
Advanced: ${ytAdvanced || 'M7lc1UVf-VE'}
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const responseContent = chatCompletion.choices[0]?.message?.content || "{}";
    let parsedResponse = { text: "I'm sorry, I couldn't formulate a response.", whiteboard_html: "", react_flow_data: null };
    
    try {
      parsedResponse = JSON.parse(responseContent);
    } catch (e) {
      console.error("JSON parsing error:", e);
    }

    // TTS Generation
    let audioBase64 = "";
    try {
      const ttsText = parsedResponse.text.substring(0, 200);
      audioBase64 = await googleTTS.getAudioBase64(ttsText, {
        lang: 'en',
        slow: false,
        host: 'https://translate.google.com',
      });
    } catch (e) {
      console.error("TTS generation error:", e);
    }

    return NextResponse.json({
      text: parsedResponse.text,
      whiteboard_html: parsedResponse.whiteboard_html,
      react_flow_data: parsedResponse.react_flow_data,
      audio_base64: audioBase64
    });

  } catch (error: any) {
    console.error("Chat API error:", error);
    let statusCode = error.status || 500;
    
    // Handle specific Groq JSON validate error
    if (error.error?.code === 'json_validate_failed') {
      statusCode = 400;
      return NextResponse.json({ error: "Failed to generate visual response. Please try asking again." }, { status: statusCode });
    }
    
    // Explicitly catch Invalid API Key errors from Groq SDK
    if (statusCode === 401 || (error.message && error.message.toLowerCase().includes("api key"))) {
      return NextResponse.json({ error: "Invalid API Key. Please provide a valid key." }, { status: 401 });
    }
    
    return NextResponse.json({ error: error.message || "Failed to chat" }, { status: statusCode });
  }
}
