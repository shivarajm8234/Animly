"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import mermaid from 'mermaid';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { auth, database } from '../../../lib/firebase';
import { User, onAuthStateChanged } from 'firebase/auth';
import { ref, get, update, set } from 'firebase/database';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    // Approx dimensions for a text node
    dagreGraph.setNode(node.id, { width: 250, height: 60 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
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

  return { nodes: newNodes, edges };
};

export default function Classroom() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

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
    if (userData && !userData.customGroqKey) {
      setShowKeyModal(true);
    }
  }, [userData]);

  // Initialize chat when ready is handled by "Enter Classroom" button now
  const handleStartSession = () => {
    setSessionStarted(true);
    if (chatMessages.length === 0) {
       handleSendChat("Hello! Please introduce yourself verbally. On the whiteboard, please provide a brief text explanation and summary of the PDF to get us started.");
    }
  };

  const handleSendChat = async (overrideMessage?: string) => {
    if (user?.uid !== sessionOwnerUid) return; // Read-only for guests

    const userMsg = overrideMessage || currentInput.trim();
    if (!userMsg || isSending) return;



    if (!overrideMessage) setCurrentInput("");
    
    if (!overrideMessage) {
      setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    }
    
    setIsSending(true);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (userData?.customGroqKey) {
        headers['X-Groq-Api-Key'] = userData.customGroqKey;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          message: userMsg,
          character: character,
          context: pdfContext ? pdfContext.substring(0, 5000) : "Student asks a question."
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
           setChatMessages(prev => [...prev, { role: 'tutor', text: "Error: Your API key is missing or invalid. Please check your settings." }]);
           setShowKeyModal(true);
        } else if (response.status === 400) {
           setChatMessages(prev => [...prev, { role: 'tutor', text: data.error || "Failed to generate visual response. Please adjust your prompt." }]);
        } else {
           throw new Error(data.error || "Failed to chat");
        }
        return;
      }

      setChatMessages(prev => [...prev, { role: 'tutor', text: data.text }]);

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

        if (addedSlides > 0) {
          // If both text and a diagram were added, show the text first (newSlides.length - 2) so they can read the explanation, then click Next for the diagram.
          setCurrentSlideIndex(addedSlides === 2 ? newSlides.length - 2 : newSlides.length - 1);
        }
        
        return newSlides;
      });

      // Play Audio
      if (data.audio_base64) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`);
        audio.onplay = () => setIsTalking(true);
        audio.onended = () => setIsTalking(false);
        audio.onerror = () => setIsTalking(false);
        try {
          await audio.play();
        } catch (audioError) {
          console.warn("Audio autoplay blocked by browser:", audioError);
          setIsTalking(false);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setChatMessages(prev => [...prev, { role: 'tutor', text: "Sorry, I encountered an error answering your question. Please try again." }]);
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
        @keyframes talkingGesture {
          0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
          25% { transform: translateY(-15px) rotate(-2deg) scale(1.02); }
          75% { transform: translateY(-5px) rotate(2deg) scale(1.02); }
        }
        .animate-walk-in {
          animation: walkIn 1.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .animate-talking {
          animation: talkingGesture 2s ease-in-out infinite;
        }
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
              <img src={`/images/${character}.png`} alt={character} className="w-full h-full object-cover" />
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
              ) : null}
            </div>
          </div>
        </div>

        <div
          className={`absolute bottom-[-1%] left-[-2vw] md:left-[-5%] xl:left-0 z-40 md:z-20 w-[38vw] md:w-[500px] xl:w-[650px] origin-bottom animate-walk-in pointer-events-none ${isTalking ? 'animate-talking' : ''}`}
          style={{ animationDelay: '0.2s' }}
        >
          <img src={`/images/${character}.png`} alt={character} className="w-full h-auto drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]" />
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
                {msg.text}
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

          <div className="p-4 bg-black/20 border-t border-white/10 flex items-center gap-3">
            <button className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:bg-indigo-500 hover:text-white transition-all flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
            </button>
            <input
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="Ask a question..."
              className="flex-1 bg-white/5 border border-white/10 rounded-full px-5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-slate-500"
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
            <h2 className="text-2xl font-bold text-white mb-2">API Key Configuration</h2>
            <p className="text-slate-400 text-sm mb-6">
              To build immersive interactive sessions, please provide your own Groq API Key.
              <br/><br/>
              Don't have an API key? <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">Get one here</a>.
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
