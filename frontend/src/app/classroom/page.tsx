"use client";

import { useState, useEffect, Suspense, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import mermaid from 'mermaid';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { auth, database } from '../../lib/firebase';
import { User, onAuthStateChanged } from 'firebase/auth';
import { ref, get, update, set } from 'firebase/database';
import Groq from 'groq-sdk';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: any[] = [], edges: any[] = [], direction = 'TB') => {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeEdges = Array.isArray(edges) ? edges : [];
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  safeNodes.forEach((node) => {
    if (node && node.id) {
      dagreGraph.setNode(node.id, { width: 250, height: 60 });
    }
  });

  safeEdges.forEach((edge) => {
    if (edge && edge.source && edge.target) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  try {
    dagre.layout(dagreGraph);
  } catch (e) {
    console.error("Dagre layout error:", e);
  }

  const newNodes = safeNodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id) || { x: Math.random() * 200, y: Math.random() * 200 };
    const newNode = {
      ...node,
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      position: {
        x: nodeWithPosition.x - 250 / 2,
        y: nodeWithPosition.y - 60 / 2,
      },
    };
    return newNode;
  });

  return { nodes: newNodes, edges: safeEdges };
};

function ClassroomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id') as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);

  const [showKeyModal, setShowKeyModal] = useState(false);

  // Config State
  const [character, setCharacter] = useState('');
  const [scenario, setScenario] = useState('');
  const [pdfContext, setPdfContext] = useState("");

  // Chat & Animation State
  const [chatMessages, setChatMessages] = useState<{ role: string, text: string }[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [isTalking, setIsTalking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [characterFrame, setCharacterFrame] = useState('idle');
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const [whiteboardSlides, setWhiteboardSlides] = useState<any[]>([{
    type: 'html',
    content: `
      <div class="flex flex-col items-center justify-center h-full text-slate-900/50 animate-pulse mt-20">
        <svg class="w-20 h-20 mb-6 text-indigo-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
        <h2 class="text-3xl font-bold">Analyzing Pedagogical Material...</h2>
        <p class="mt-4 text-xl font-medium">Extracting core concepts and preparing interactive visual aids.</p>
      </div>
    `
  }]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [selectedNode, setSelectedNode] = useState<{ label: string, description: string } | null>(null);
  const [sessionOwnerUid, setSessionOwnerUid] = useState<string | null>(null);
  // Stop audio on component unmount
  useEffect(() => {
    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
    };
  }, []);

  const unlockSpeechSynthesis = () => {
    try {
      // Play a short silent buffer to unlock HTML5 Audio in the browser
      const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
      audio.play().catch(e => console.log("Audio priming ignored", e));
      
      // Prime window.speechSynthesis to bypass autoplay restrictions
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance("");
        window.speechSynthesis.speak(u);
      }
    } catch (e) {
      console.log("Audio priming error", e);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const dbRef = ref(database, 'users/' + currentUser.uid);
        const snapshot = await get(dbRef);
        if (snapshot.exists()) {
          setUserData(snapshot.val());
        }
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Load session from Firebase
  useEffect(() => {
    if (!id) return;
    const loadSession = async () => {
      const sessionRef = ref(database, 'sessions/' + id);
      const snapshot = await get(sessionRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        setCharacter(data.character);
        setScenario(data.scenario);
        setPdfContext(data.pdfContext);
        setSessionOwnerUid(data.uid);
        
        if (data.chatMessages && data.chatMessages.length > 0) {
          setChatMessages(data.chatMessages);
          if (data.whiteboardSlides) {
             setWhiteboardSlides(data.whiteboardSlides);
             setCurrentSlideIndex(data.whiteboardSlides.length - 1);
          }
        }
        
        setLoading(false);
      } else {
        setError("Classroom session not found.");
        setLoading(false);
      }
    };
    loadSession();
  }, [id]);

  // Record view log
  useEffect(() => {
    if (!user || !id || !sessionOwnerUid) return;
    
    // Check if we already logged this view in this browser session
    const viewKey = `viewed_${id}`;
    if (sessionStorage.getItem(viewKey)) return;

    const logView = async () => {
      try {
        const viewId = crypto.randomUUID();
        const viewRef = ref(database, 'views/' + viewId);
        await set(viewRef, {
          viewerUid: user.uid,
          viewerEmail: user.email || 'Unknown',
          sessionId: id,
          sessionOwnerUid: sessionOwnerUid,
          timestamp: Date.now()
        });
        sessionStorage.setItem(viewKey, 'true');
      } catch (e) {
        console.error("Failed to log view", e);
      }
    };

    logView();
  }, [user, id, sessionOwnerUid]);

  // Sync session state to Firebase (ONLY if owner)
  useEffect(() => {
    if (!sessionStarted || !id || !sessionOwnerUid) return;
    if (!user || user.uid !== sessionOwnerUid) return; // Prevent guests from overwriting!
    
    // Debounce or sync directly
    const sessionRef = ref(database, 'sessions/' + id);
    update(sessionRef, {
      chatMessages,
      whiteboardSlides
    }).catch(console.error);
  }, [chatMessages, whiteboardSlides, sessionStarted, id]);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'default' });
    mermaid.run({ querySelector: '.mermaid' }).catch(e => console.log('Mermaid error', e));
  }, [whiteboardSlides, currentSlideIndex]);

  // Enforce BYOK on load: If user data is loaded and they don't have a key, pop up immediately.
  useEffect(() => {
    if (userData && (!userData.customGroqKey || !userData.sarvamApiKey)) {
      setShowKeyModal(true);
    }
  }, [userData]);

  // Character Animation Controller
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSending) {
      setCharacterFrame('thinking');
    } else if (isTalking) {
      // Cycle between talking, idle (closed mouth), and teaching
      let frames = ['talking', 'idle', 'teaching', 'idle'];
      let idx = 0;
      setCharacterFrame(frames[idx]);
      interval = setInterval(() => {
        idx = (idx + 1) % frames.length;
        setCharacterFrame(frames[idx]);
      }, 350); // Fast dynamic speaking animation
    } else {
      setCharacterFrame('idle');
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSending, isTalking]);

  const isGenericQuery = (q: string): boolean => {
    const lower = q.toLowerCase().trim();
    const genericWords = [
      "summarize", "summary", "explain", "points", "detail", "details", 
      "hello", "hi", "hey", "introduce", "thanks", "thank you", 
      "yes", "no", "ok", "okay", "please", "help", "question", "answer",
      "tell me", "what is", "who are", "about", "write", "generate", "and", "or", "give", "all"
    ];
    
    const words = lower.split(/\s+/);
    const nonGenericWords = words.filter(w => !genericWords.includes(w) && w.length > 2);
    
    return nonGenericWords.length === 0;
  };

  const searchYouTube = async (rawQuery: string) => {
    const query = rawQuery.trim().split(/\s+/).slice(0, 5).join(" ");
    if (!query || isGenericQuery(query)) {
      console.log("YouTube search skipped: Query is generic or empty.");
      return [];
    }

    const instances = [
      "https://invidious.projectsegfau.lt",
      "https://yewtu.be",
      "https://inv.nadeko.net",
      "https://invidious.flokinet.to",
      "https://vid.puffyan.us"
    ];

    for (const instance of instances) {
      try {
        const targetUrl = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
        const res = await fetch(proxyUrl);
        if (res.ok) {
          const resData = await res.json();
          const data = typeof resData.contents === 'string' ? JSON.parse(resData.contents) : resData.contents;
          if (Array.isArray(data)) {
            const videoIds = data
              .filter((item: any) => item.videoId)
              .slice(0, 2)
              .map((item: any) => item.videoId);
            if (videoIds.length > 0) {
              console.log(`Successfully fetched YouTube videos from Invidious via proxy: ${instance}`);
              return videoIds;
            }
          }
        }
      } catch (e) {
        console.warn(`Proxy Invidious instance ${instance} failed:`, e);
      }
    }

    // Fallback: DuckDuckGo HTML search via AllOrigins/CorsProxy with simplified query
    const ddgUrl = `https://html.duckduckgo.com/html/?q=site:youtube.com+${encodeURIComponent(query)}`;
    
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(ddgUrl)}`;
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const data = await res.json();
        const html = data.contents || "";
        const matches = [...html.matchAll(/href="[^"]*youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/g)];
        const videoIds = [...new Set(matches.map(m => m[1]))].slice(0, 2);
        if (videoIds.length > 0) return videoIds;
      }
    } catch (e) {
      console.warn("AllOrigins YouTube search failed, trying fallback...", e);
    }

    try {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(ddgUrl)}`;
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const html = await res.text();
        const matches = [...html.matchAll(/href="[^"]*youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/g)];
        const videoIds = [...new Set(matches.map(m => m[1]))].slice(0, 2);
        if (videoIds.length > 0) return videoIds;
      }
    } catch (e) {
      console.warn("CorsProxy YouTube search failed...", e);
    }

    return [];
  };

  const renderMessageText = (text: string) => {
    if (!text) return null;
    
    // Match markdown links: [Link Text](http...)
    const matches = [...text.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)];
    
    if (matches.length === 0) {
      // Match raw URLs
      const urlMatches = [...text.matchAll(/(https?:\/\/[^\s]+)/g)];
      if (urlMatches.length === 0) {
        return text;
      }
      
      let lastIdx = 0;
      const parts: React.ReactNode[] = [];
      urlMatches.forEach((match, index) => {
        const url = match[1];
        const matchIdx = match.index || 0;
        if (matchIdx > lastIdx) {
          parts.push(text.substring(lastIdx, matchIdx));
        }
        parts.push(
          <a 
            key={`url-${index}`} 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-indigo-400 hover:text-indigo-300 underline font-semibold break-all"
          >
            {url}
          </a>
        );
        lastIdx = matchIdx + url.length;
      });
      if (lastIdx < text.length) {
        parts.push(text.substring(lastIdx));
      }
      return parts;
    }

    let lastIndex = 0;
    const parts: React.ReactNode[] = [];
    matches.forEach((match, index) => {
      const matchIdx = match.index || 0;
      const linkText = match[1];
      const linkUrl = match[2];

      if (matchIdx > lastIndex) {
        parts.push(text.substring(lastIndex, matchIdx));
      }

      parts.push(
        <a 
          key={`link-${index}`} 
          href={linkUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-indigo-400 hover:text-indigo-300 underline font-semibold break-all"
        >
          {linkText}
        </a>
      );

      lastIndex = matchIdx + match[0].length;
    });

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  const cleanTextForSpeech = (text: string): string => {
    if (!text) return "";
    return text
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]+`/g, '') // Remove inline code
      .replace(/[*_#~]/g, '') // Remove markdown formatting characters
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert markdown links to plain text
      .replace(/-\s+/g, '') // Remove list hyphens
      .replace(/\s+/g, ' ') // Normalize spacing
      .trim();
  };

  const speakTextBrowserFallback = (cleanedText: string) => {
    try {
      console.log("Playing speech via browser Web Speech API fallback...");
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        console.warn("Speech synthesis not supported in this browser.");
        setIsTalking(false);
        return;
      }
      
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(cleanedText);
      const isFemale = character === 'ada' || character === 'ms_curie';
      const voices = window.speechSynthesis.getVoices();
      
      let selectedVoice = voices.find(v => {
        const name = v.name.toLowerCase();
        const lang = v.lang.toLowerCase();
        if (lang.includes('en-in') || lang.includes('en-us') || lang.includes('en-gb')) {
          if (isFemale && (name.includes('female') || name.includes('zira') || name.includes('google us english') || name.includes('samantha') || name.includes('hazel') || name.includes('karen') || name.includes('moira') || name.includes('tessa'))) {
            return true;
          }
          if (!isFemale && (name.includes('male') || name.includes('david') || name.includes('google uk english') || name.includes('microsoft'))) {
            return true;
          }
        }
        return false;
      });

      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.toLowerCase().includes('en')) || voices[0];
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.pitch = character === 'ada' ? 1.25 : character === 'ms_curie' ? 1.05 : character === 'mr_newton' ? 0.95 : 1.0;
      utterance.rate = 1.0;

      utterance.onstart = () => {
        setIsTalking(true);
      };

      utterance.onend = () => {
        setIsTalking(false);
      };

      utterance.onerror = (e) => {
        console.error("Speech synthesis error:", e);
        setIsTalking(false);
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Browser fallback speech synthesis failed:", e);
      setIsTalking(false);
    }
  };

  const speakText = async (text: string) => {
    const cleanedText = cleanTextForSpeech(text);
    if (!cleanedText) return;

    // Stop any currently playing audio
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (!userData || !userData.sarvamApiKey) {
      console.warn("No Sarvam API key available for TTS. Falling back to Browser Web Speech API...");
      speakTextBrowserFallback(cleanedText);
      return;
    }

    try {
      const voiceMap: { [key: string]: string } = {
        ada: "ishita",
        leo: "shubh",
        mr_newton: "manan",
        ms_curie: "shreya"
      };
      const speakerId = voiceMap[character] || "shubh";

      const response = await fetch("https://api.sarvam.ai/text-to-speech", {
        method: "POST",
        headers: {
          "api-subscription-key": userData.sarvamApiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: cleanedText,
          model: "bulbul:v3",
          target_language_code: "en-IN",
          speaker: speakerId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.message || `Failed to generate speech: ${response.statusText}`);
      }

      const data = await response.json();
      const base64Audio = data.audios[0];
      
      const audioUrl = `data:audio/wav;base64,${base64Audio}`;
      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;

      audio.onplay = () => {
        setIsTalking(true);
      };

      audio.onended = () => {
        setIsTalking(false);
        activeAudioRef.current = null;
      };

      audio.onerror = (e) => {
        console.error("Audio playback error, falling back to Browser Web Speech API:", e);
        setIsTalking(false);
        activeAudioRef.current = null;
        speakTextBrowserFallback(cleanedText);
      };

      await audio.play();
    } catch (error) {
      console.error("Sarvam TTS Error, falling back to Browser Web Speech API:", error);
      speakTextBrowserFallback(cleanedText);
    }
  };

  // Initialize chat when ready is handled by "Enter Classroom" button now
  const handleStartSession = () => {
    unlockSpeechSynthesis();
    setSessionStarted(true);
    if (chatMessages.length === 0) {
       handleSendChat("Hello! Please introduce yourself verbally. On the whiteboard, please provide a brief text explanation and summary of the PDF to get us started.");
    }
  };

  const handleSendChat = async (overrideMessage?: string) => {
    if (user?.uid !== sessionOwnerUid) return; // Read-only for guests
    unlockSpeechSynthesis();


    const userMsg = overrideMessage || currentInput.trim();
    if (!userMsg || isSending) return;



    if (!overrideMessage) setCurrentInput("");
    
    if (!overrideMessage) {
      setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    }
    
    setIsSending(true);

    try {
      if (!userData || !userData.customGroqKey || !userData.sarvamApiKey) {
        setShowKeyModal(true);
        setIsSending(false);
        return;
      }

      const groq = new Groq({ 
        apiKey: userData.customGroqKey,
        dangerouslyAllowBrowser: true 
      });

      const systemPrompt = `You are ${character}, an interactive AI tutor. 
CRITICAL RULES:
1. You MUST strictly stick to the uploaded PDF material (context) provided below. 
2. Do NOT answer questions outside the scope of this material, unless it is a direct comparison to the material.
3. You MUST reply in JSON format with exactly four fields.
4. MINIMAL AND PRECISE INFO: You MUST keep all answers (both 'text' and 'whiteboard_html') extremely minimal, precise, and accurate. Each response MUST be at most 4-5 lines of text in total. Focus on high-yield, short key points. Do NOT exceed 5 lines of text.
5. DEFAULT TO TEXT & BULLET POINTS: You MUST ALWAYS populate whiteboard_html with minimal, beautifully formatted textual explanations. You MUST use bullet points (<ul> or <ol> with <li>) to explain concepts clearly, along with headings to summarize your response. Do NOT leave whiteboard_html empty.
6. IF ASKED FOR COMPARISON: If the user asks to compare or show differences, you MUST use an HTML <table> in the whiteboard_html. Do NOT use flowcharts for comparisons.
7. IF ASKED FOR VISUAL/FLOWCHART: If the user asks for a flowchart, visual graph, or diagram, populate react_flow_data with nodes and edges. Otherwise, leave it completely empty arrays [].
8. JSON ESCAPING: The whiteboard_html value MUST be a single valid JSON string. Ensure you escape all double quotes within the HTML string (e.g. class=\\"text-xl\\") or use single quotes instead.
9. YOUTUBE SEARCH: If the student asks for a video, or if you are explaining a complex visual/technical topic where a video tutorial would be highly beneficial, set 'youtube_search_query' to a highly relevant search phrase (e.g. 'Newton's laws of motion experiment animation'). Otherwise, set it to an empty string "". DO NOT put search links in whiteboard_html.
10. NODE DESCRIPTIONS: The 'description' field for each node in react_flow_data MUST be highly detailed, containing at least 3-4 full sentences explaining the concept thoroughly. DO NOT use one-line descriptions.

{
  "text": "Your concise, spoken response to the student (max 4-5 lines).",
  "youtube_search_query": "",
  "whiteboard_html": "HTML formatted content to display on the whiteboard. Use TailwindCSS classes for styling (e.g., <h2 class='text-3xl font-extrabold text-slate-900 mb-4'> and <p class='text-slate-800'>). You MUST make all text very dark (use text-slate-900). Use HTML <ul> or <ol> for bullet points, and properly formatted <table> for comparisons. MUST contain minimal, precise textual summaries (max 4-5 lines).",
  "react_flow_data": {
    "nodes": [{"id": "1", "data": {"label": "Node 1", "description": "A VERY long, highly detailed, multi-sentence paragraph explaining this concept in-depth."}, "position": {"x": 0, "y": 0}}],
    "edges": [{"id": "e1-2", "source": "1", "target": "2"}]
  }
}

Note: If no flow graph is requested, MUST leave nodes and edges as empty arrays []. The positions of nodes should be reasonably spaced (e.g., y: 0, 100, 200).

Use the following context if relevant: ${pdfContext ? pdfContext.substring(0, 5000) : "Student asks a question."}`;

      let chatCompletion;
      let data = { text: "I'm sorry, I couldn't formulate a response.", whiteboard_html: "", react_flow_data: null as any, youtube_search_query: "" };
      
      try {
        chatCompletion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg }
          ],
          model: 'llama-3.1-8b-instant',
          temperature: 0.7,
          response_format: { type: "json_object" },
          max_tokens: 4096
        });
        
        const responseContent = chatCompletion.choices[0]?.message?.content || "{}";
        try {
          data = JSON.parse(responseContent);
        } catch (e) {
          console.error("JSON parsing error, falling back to plain-text structure conversion:", e);
          data = {
            text: responseContent,
            whiteboard_html: `<div class='p-4'><h2 class='text-2xl font-bold text-slate-900 mb-2'>Lesson Notes</h2><p class='text-slate-800 whitespace-pre-wrap'>${responseContent.replace(/"/g, "'")}</p></div>`,
            react_flow_data: { nodes: [], edges: [] },
            youtube_search_query: userMsg.substring(0, 60)
          };
        }
      } catch (innerError: any) {
        console.warn("Groq JSON completion failed, retrying in plain-text fallback mode...", innerError);
        const fallbackSystemPrompt = `You are ${character}, an interactive AI tutor. 
CRITICAL RULES:
1. You MUST strictly stick to the uploaded PDF material (context) provided below. 
2. Do NOT answer questions outside the scope of this material.
3. Answer the user's question clearly, concisely, and directly.

Use the following context if relevant: ${pdfContext ? pdfContext.substring(0, 4000) : "Student asks a question."}`;

        chatCompletion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: fallbackSystemPrompt },
            { role: 'user', content: userMsg }
          ],
          model: 'llama-3.1-8b-instant',
          temperature: 0.7,
          max_tokens: 4096
        });

        const rawContent = chatCompletion.choices[0]?.message?.content || "I'm sorry, I couldn't formulate a response.";
        data = {
          text: rawContent,
          whiteboard_html: `<div class='p-4'><h2 class='text-2xl font-bold text-slate-900 mb-2'>Lesson Notes</h2><p class='text-slate-800 whitespace-pre-wrap'>${rawContent.replace(/"/g, "'")}</p></div>`,
          react_flow_data: { nodes: [], edges: [] },
          youtube_search_query: userMsg.substring(0, 60)
        };
      }

      setChatMessages(prev => [...prev, { role: 'tutor', text: data.text }]);

      let fetchedVideoIds: string[] = [];
      if (data.youtube_search_query) {
        fetchedVideoIds = await searchYouTube(data.youtube_search_query);
      }

      setWhiteboardSlides(prev => {
        let newSlides = prev.filter(s => !(s.type === 'html' && s.content.includes('Analyzing Pedagogical Material')));
        
        let addedSlides = 0;
        if (data.whiteboard_html) {
          newSlides = [...newSlides, { type: 'html', content: data.whiteboard_html }];
          addedSlides++;
        }
        
        if (data.react_flow_data && data.react_flow_data.nodes && data.react_flow_data.nodes.length > 0) {
          const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            data.react_flow_data.nodes,
            data.react_flow_data.edges,
            'TB' // Top to Bottom
          );
          newSlides = [...newSlides, { 
            type: 'react_flow', 
            content: { nodes: layoutedNodes, edges: layoutedEdges } 
          }];
          addedSlides++;
        }

        if (fetchedVideoIds.length > 0) {
          newSlides = [...newSlides, { type: 'youtube', content: fetchedVideoIds }];
          addedSlides++;
        }

        if (addedSlides > 0) {
          setCurrentSlideIndex(newSlides.length - addedSlides);
        }
        
        return newSlides;
      });

      // Play Audio using robust Web Speech API
      speakText(data.text);
    } catch (error: any) {
      console.error("Chat error:", error);
      
      let errorMsg = "Sorry, I encountered an error answering your question. Please verify your Groq API key is valid and has sufficient quota, then try again.";
      if (error?.error?.code === 'json_validate_failed' || (error.message && error.message.includes("json"))) {
         errorMsg = "Oops, I had trouble formatting the visuals. Please ask again in a slightly different way.";
      }
      
      setChatMessages(prev => [...prev, { role: 'tutor', text: errorMsg }]);
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-white mt-4">Loading Classroom...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <h1 className="text-2xl font-bold mb-4">{error}</h1>
        <Link href="/" className="px-6 py-2 bg-indigo-600 rounded-full">Return Home</Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes walkIn {
          0% { transform: translateX(-500px) translateY(20px); opacity: 0; }
          100% { transform: translateX(0) translateY(0); opacity: 1; }
        }
        @keyframes idleBreathing {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-5px) scale(1.01, 0.99); }
        }
        @keyframes talkingGesture {
          0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
          25% { transform: translateY(-15px) rotate(-1deg) scale(1.02, 0.98); }
          75% { transform: translateY(-5px) rotate(2deg) scale(1.01, 0.99); }
        }
        @keyframes thinkingSway {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(-3deg); }
        }
        .animate-walk-in { animation: walkIn 1.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .animate-idle { animation: idleBreathing 4s ease-in-out infinite; }
        .animate-talking { animation: talkingGesture 2s ease-in-out infinite; }
        .animate-thinking { animation: thinkingSway 3s ease-in-out infinite; }
        .active-transition { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
      `}} />

      <div className="fixed inset-0 w-full h-[100dvh] z-50 bg-slate-900 overflow-hidden animate-in fade-in duration-1000">

        <div
          className="absolute inset-0 z-0 transition-all duration-1000"
          style={{
            backgroundImage: `url(/images/${scenario}.png)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"></div>
        </div>

        <div className="absolute top-0 left-0 w-full p-4 lg:p-6 z-40 flex justify-between items-start pointer-events-none">
          <button
            onClick={() => router.push('/')}
            className="pointer-events-auto px-3 py-2 lg:px-5 lg:py-2.5 rounded-full bg-black/40 backdrop-blur-md text-sm text-white hover:bg-black/60 transition-colors border border-white/20 flex items-center gap-2 shadow-xl"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            <span className="hidden sm:inline">Leave Classroom</span>
          </button>



          <div className="pointer-events-auto flex items-center gap-4 bg-black/40 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20 shadow-xl">
            <div className={`w-8 h-8 rounded-full overflow-hidden border border-white/20 ${isTalking ? 'shadow-[0_0_15px_rgba(99,102,241,0.8)]' : ''}`}>
              <img src={`/images/${character}_${characterFrame}.png`} alt={character} className="w-full h-full object-cover transition-transform duration-200" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm capitalize leading-tight">{character.replace('_', ' ')}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isTalking ? 'bg-indigo-400 animate-ping' : 'bg-emerald-400'}`}></span>
                <span className={`text-[10px] font-bold tracking-wider ${isTalking ? 'text-indigo-400' : 'text-emerald-400'}`}>
                  {isTalking ? 'SPEAKING' : 'LISTENING'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute top-[80px] lg:top-[10%] left-2 lg:left-[20%] xl:left-[25%] right-2 lg:right-[28%] xl:right-[32%] bottom-[48%] lg:bottom-[10%] z-10 flex items-center justify-center pointer-events-none">
          <div className="w-full h-full max-w-6xl bg-white/90 backdrop-blur-xl p-4 md:p-6 rounded-3xl shadow-2xl border border-white/50 pointer-events-auto overflow-hidden flex flex-col relative">
            <div className="absolute top-4 right-4 flex gap-2 z-20">
              <button 
                onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                disabled={currentSlideIndex === 0}
                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 rounded-lg text-slate-700 text-sm font-medium transition-colors shadow-sm"
              >
                ← Prev
              </button>
              <span className="px-3 py-1 bg-white text-slate-700 font-bold rounded-lg text-sm shadow-sm border border-slate-200">
                {currentSlideIndex + 1} / {whiteboardSlides.length}
              </span>
              <button 
                onClick={() => setCurrentSlideIndex(Math.min(whiteboardSlides.length - 1, currentSlideIndex + 1))}
                disabled={currentSlideIndex === whiteboardSlides.length - 1}
                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 rounded-lg text-slate-700 text-sm font-medium transition-colors shadow-sm"
              >
                Next →
              </button>
            </div>
            
            <div className="flex-1 w-full h-full overflow-y-auto overflow-x-hidden pt-12 pb-4 px-6 relative">
              {whiteboardSlides[currentSlideIndex]?.type === 'html' ? (
                <div dangerouslySetInnerHTML={{ __html: whiteboardSlides[currentSlideIndex].content }} className="w-full text-slate-900 prose prose-slate max-w-none" />
              ) : whiteboardSlides[currentSlideIndex]?.type === 'react_flow' ? (
                <div className="w-full h-full min-h-[500px] text-slate-900 font-semibold">
                  <ReactFlow 
                    nodes={whiteboardSlides[currentSlideIndex].content.nodes} 
                    edges={whiteboardSlides[currentSlideIndex].content.edges}
                    onNodeClick={(event, node) => {
                      const label = node.data?.label || node.id;
                      const description = node.data?.description || "No detailed description provided for this concept.";
                      setSelectedNode({ label: label as string, description: description as string });
                    }}
                    fitView
                  >
                    <Background />
                    <Controls />
                  </ReactFlow>
                </div>
              ) : whiteboardSlides[currentSlideIndex]?.type === 'youtube' ? (
                <div className="w-full h-full flex flex-col items-center justify-start gap-6 pt-4">
                  <h2 className="text-3xl font-extrabold text-slate-900">Recommended Videos</h2>
                  {whiteboardSlides[currentSlideIndex].content.map((videoId: string) => (
                    <div key={videoId} className="w-full max-w-3xl aspect-video rounded-xl overflow-hidden shadow-2xl border border-slate-200">
                      <iframe 
                        className="w-full h-full"
                        src={`https://www.youtube.com/embed/${videoId}`} 
                        title="YouTube video player" 
                        frameBorder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen>
                      </iframe>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className={`absolute bottom-[-1%] left-[-2vw] md:left-[-5%] xl:left-0 z-40 md:z-20 w-[38vw] md:w-[500px] xl:w-[650px] origin-bottom animate-walk-in pointer-events-none active-transition ${
            isSending ? 'animate-thinking' : isTalking ? 'animate-talking' : 'animate-idle'
          }`}
          style={{ animationDelay: '0.2s' }}
        >
          <img src={`/images/${character}_${characterFrame}.png`} alt={character} className="w-full h-auto drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-transform duration-200" />
        </div>

        <div className="absolute right-2 md:right-6 left-[34vw] md:left-auto bottom-2 md:bottom-6 top-[54%] md:top-24 w-auto md:w-[400px] z-30 flex flex-col bg-slate-950/80 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="p-4 bg-white/5 border-b border-white/10 flex items-center gap-3">
            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
            <h3 className="font-semibold text-white">Live Discussion</h3>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto p-5 flex-1 scroll-smooth">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`max-w-[85%] px-5 py-3 text-sm rounded-2xl shadow-md leading-relaxed ${msg.role === 'tutor'
                    ? 'self-start bg-slate-800/80 border border-slate-700 rounded-tl-sm text-slate-200'
                    : 'self-end bg-indigo-600 text-white rounded-tr-sm'
                  }`}
              >
                {renderMessageText(msg.text)}
              </div>
            ))}
            {isSending && (
              <div className="self-start bg-slate-800/80 border border-slate-700 rounded-2xl rounded-tl-sm px-5 py-3 text-sm text-slate-400 shadow-md flex gap-1">
                <span className="animate-bounce">.</span>
                <span className="animate-bounce delay-100">.</span>
                <span className="animate-bounce delay-200">.</span>
              </div>
            )}
          </div>

          <div className="p-2 md:p-4 bg-black/20 border-t border-white/10 flex items-center gap-2 md:gap-3">
            <button className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:bg-indigo-500 hover:text-white transition-all flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
            </button>
            <input
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="Ask a question..."
              className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-full px-3 py-2 md:px-5 md:py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-slate-500"
              disabled={isSending}
            />
            <button
              onClick={() => handleSendChat()}
              disabled={isSending || !currentInput.trim()}
              className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 flex items-center justify-center transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] flex-shrink-0"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M12 5l7 7-7 7"></path></svg>
            </button>
          </div>
        </div>
      </div>
      
      {showKeyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-white/10 p-8 rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-300">
            <h2 className="text-2xl font-bold text-white mb-2">API Keys Configuration</h2>
            <p className="text-slate-400 text-sm mb-6">
              To build immersive interactive sessions, please ensure you have set both your custom Groq API Key and Sarvam API Key on the dashboard.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowKeyModal(false)}
                className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-colors"
              >
                Close
              </button>
              <Link href="/" className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-colors font-semibold flex items-center justify-center">
                Go to Home
              </Link>
            </div>
          </div>
        </div>
      )}

      {!sessionStarted && !loading && !error && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-md px-4">
          <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-300 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-indigo-400 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Ready to Learn?</h2>
            <p className="text-slate-400 text-sm mb-8">
              Click below to enter the classroom. Ensure your volume is turned up to hear your AI tutor!
            </p>
            <button
              onClick={handleStartSession}
              className="w-full py-4 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-all font-bold text-lg shadow-[0_0_20px_rgba(79,70,229,0.4)] flex items-center justify-center gap-2"
            >
              Enter Classroom
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </button>
          </div>
        </div>
      )}

      {selectedNode && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-2xl max-w-lg w-full animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{selectedNode.label}</h2>
            <p className="text-slate-700 text-base leading-relaxed mb-8">
              {selectedNode.description}
            </p>
            <button
              onClick={() => setSelectedNode(null)}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-colors font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Classroom() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading...</div>}>
      <ClassroomContent />
    </Suspense>
  );
}


