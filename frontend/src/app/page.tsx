"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import mermaid from 'mermaid';
import { auth, database, googleProvider } from '../lib/firebase';
import { signInWithPopup, User } from 'firebase/auth';
import { ref, get, set, update } from 'firebase/database';

export default function Home() {
  const [step, setStep] = useState(0);

  // User State
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<{ usedFreeTier: boolean, customGroqKey: string | null } | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKeyInput, setTempKeyInput] = useState('');

  // Config State
  const [character, setCharacter] = useState('mr_newton');
  const [scenario, setScenario] = useState('modern_classroom');

  // Upload State
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);

  // Chat & Animation State
  const [chatMessages, setChatMessages] = useState<{ role: string, text: string }[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [isTalking, setIsTalking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [whiteboardContent, setWhiteboardContent] = useState(`
    <h2 class="text-4xl font-extrabold text-slate-900 mb-6 border-b-4 border-indigo-500 pb-4 inline-block">Chapter 1: The Foundations</h2>
    <ul class="list-disc pl-6 space-y-5 text-slate-900 font-medium text-xl leading-relaxed">
      <li class="text-slate-900">Welcome to your immersive interactive session!</li>
      <li class="text-slate-900">I have successfully parsed the contents of your PDF.</li>
      <li class="text-slate-900">We will be covering the material step-by-step.</li>
      <li class="text-slate-900">Feel free to interrupt me at any time using the chat box below to clarify your doubts.</li>
    </ul>
  `);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'default' });
    mermaid.run({ querySelector: '.mermaid' }).catch(e => console.log('Mermaid error', e));
  }, [whiteboardContent]);

  // Initialize chat when entering classroom
  useEffect(() => {
    if (step === 4 && chatMessages.length === 0) {
      setChatMessages([
        { role: 'tutor', text: `Hello! I am ${character.replace('_', ' ')}. I've read your PDF. Let's begin the interactive session. What would you like to focus on first?` }
      ]);
    }
  }, [step, character, chatMessages.length]);

  const handleSendChat = async () => {
    if (!currentInput.trim() || isSending) return;

    const userMsg = currentInput.trim();
    setCurrentInput("");
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsSending(true);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (userData?.customGroqKey) {
        headers['X-Groq-Api-Key'] = userData.customGroqKey;
      }

      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          job_id: jobId,
          message: userMsg,
          character: character,
          context: "Student asks a question about the PDF material."
        })
      });

      const data = await response.json();

      setChatMessages(prev => [...prev, { role: 'tutor', text: data.text }]);

      if (data.whiteboard_content) {
        setWhiteboardContent(data.whiteboard_content);
      }

      // Play Audio
      if (data.audio_base64) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`);
        audio.onplay = () => setIsTalking(true);
        audio.onended = () => setIsTalking(false);
        audio.onerror = () => setIsTalking(false);
        await audio.play();
      }
    } catch (error) {
      console.error("Chat error:", error);
      setChatMessages(prev => [...prev, { role: 'tutor', text: "Sorry, I encountered an error answering your question. Please try again." }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      // Fetch or init user data
      const dbRef = ref(database, 'users/' + result.user.uid);
      const snapshot = await get(dbRef);
      if (snapshot.exists()) {
        setUserData(snapshot.val());
      } else {
        const newData = { usedFreeTier: false, customGroqKey: null };
        await set(dbRef, newData);
        setUserData(newData);
      }
      setStep(1); // Proceed to config after login
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const saveCustomKey = async () => {
    if (!user || !tempKeyInput.trim()) return;
    const dbRef = ref(database, 'users/' + user.uid);
    await update(dbRef, { customGroqKey: tempKeyInput.trim() });
    setUserData(prev => prev ? { ...prev, customGroqKey: tempKeyInput.trim() } : null);
    setShowKeyModal(false);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleGenerate = async () => {
    if (!file || !user || !userData) return;

    if (userData.usedFreeTier && !userData.customGroqKey) {
      setShowKeyModal(true);
      return;
    }

    setStep(3); // Moving to Generation step
    setIsGenerating(true);
    setProgress(5);
    setStatusMessage("Uploading PDF...");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("character", character);
    formData.append("scenario", scenario);

    try {
      const headers: Record<string, string> = {};
      if (userData.customGroqKey) {
        headers['X-Groq-Api-Key'] = userData.customGroqKey;
      }

      const response = await fetch("http://localhost:8000/api/generate", {
        method: "POST",
        headers: headers,
        body: formData,
      });

      const data = await response.json();

      if (data.job_id) {
        setJobId(data.job_id);
        
        // Mark free tier as used if it was their first time
        if (!userData.usedFreeTier) {
          const dbRef = ref(database, 'users/' + user.uid);
          await update(dbRef, { usedFreeTier: true });
          setUserData(prev => prev ? { ...prev, usedFreeTier: true } : null);
        }
      } else {
        throw new Error(data.detail || "Failed to start generation");
      }
    } catch (error) {
      setStatusMessage("Error: " + (error as Error).message);
    }
  };

  // Poll for status
  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/status/${jobId}`);
        const data = await response.json();

        setProgress(data.progress);
        setStatusMessage(data.message);

        if (data.status === "completed" || data.status === "failed") {
          clearInterval(interval);
          if (data.status === "completed") {
            setTimeout(() => {
              setStep(4); // Moving to Classroom
            }, 2000);
          }
        }
      } catch (error) {
        console.error("Status polling failed", error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId]);

  return (
    <main className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Custom Character Animations */}
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

      {/* Dynamic Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-indigo-500/10 blur-[120px] rounded-full mix-blend-screen animate-pulse"></div>
        <div className="absolute top-1/2 left-1/4 w-full h-full bg-purple-600/10 blur-[150px] rounded-full mix-blend-screen animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 container mx-auto px-6 py-12 flex flex-col items-center min-h-screen">

        {step > 0 && step < 4 && (
          <header className="text-center mb-12 mt-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-white drop-shadow-[0_0_25px_rgba(129,140,248,0.3)]">
              Transform PDFs into <span className="text-indigo-400">Interactive Tutors.</span>
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto font-light leading-relaxed">
              Build your custom learning experience before uploading your material.
            </p>
          </header>
        )}

        <div className="w-full max-w-4xl transition-all duration-500">

          {/* STEP 0: Premium Home Page */}
          {step === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[75vh] w-full animate-in fade-in zoom-in duration-700">

              <div className="relative z-10 flex flex-col items-center max-w-4xl mx-auto text-center">
                {/* Floating 3D-like Logo */}
                <div className="relative group mb-10">
                  <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full blur-xl opacity-40 group-hover:opacity-70 transition duration-500 animate-pulse"></div>

                </div>

                <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 text-transparent bg-clip-text bg-gradient-to-br from-white via-indigo-200 to-indigo-500 drop-shadow-2xl">
                  Welcome to Animly
                </h1>

                <p className="text-xl md:text-3xl text-slate-300/90 font-light leading-relaxed mb-14 max-w-3xl">
                  Experience the next generation of AI-powered education. Upload your documents and interact with our fully animated, intelligent tutors in an immersive 3D classroom.
                </p>

                {/* Primary CTA */}
                <button 
                  onClick={handleLogin} 
                  className="group relative px-12 py-6 bg-transparent overflow-hidden rounded-full transition-all duration-300 hover:scale-105"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-90 group-hover:opacity-100 transition-opacity"></div>
                  <div className="absolute inset-0 bg-white/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity blur-md"></div>
                  <div className="relative flex items-center justify-center gap-4 text-white font-bold text-xl tracking-widest uppercase shadow-[0_0_50px_rgba(79,70,229,0.5)]">
                    <span>Start Learning</span>
                    <svg className="w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: Configuration */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
              <div className="bg-slate-900/50 border border-white/10 rounded-[24px] p-8 md:p-12 backdrop-blur-xl shadow-2xl">

                <h2 className="text-2xl font-bold text-white mb-8 border-b border-white/5 pb-4">Configure your Session</h2>

                <div className="space-y-10">
                  {/* Character Selection */}
                  <section>
                    <div className="mb-5 flex items-baseline gap-3">
                      <span className="text-indigo-400 font-mono text-xs tracking-widest uppercase">Persona</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        { id: 'mr_newton', name: 'Mr. Newton', initials: 'MN' },
                        { id: 'ms_curie', name: 'Ms. Curie', initials: 'MC' },
                        { id: 'ada', name: 'Ada', initials: 'AD' },
                        { id: 'leo', name: 'Leo', initials: 'LE' }
                      ].map(opt => (
                        <div
                          key={opt.id}
                          onClick={() => setCharacter(opt.id)}
                          className={`cursor-pointer rounded-xl p-4 border transition-all duration-300 ${character === opt.id ? 'bg-indigo-900/40 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.2)]' : 'bg-slate-800/50 border-white/5 hover:bg-slate-700/50'}`}
                        >
                          <div className={`w-16 h-16 rounded-full mb-3 overflow-hidden border-2 transition-all ${character === opt.id ? 'border-indigo-400 shadow-[0_0_15px_rgba(129,140,248,0.5)]' : 'border-transparent'}`}>
                            <img src={`/images/${opt.id}.png`} alt={opt.name} className="w-full h-full object-cover bg-indigo-500/20" />
                          </div>
                          <h3 className="font-semibold text-white text-sm">{opt.name}</h3>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Scenario Selection */}
                  <section>
                    <div className="mb-5 flex items-baseline gap-3">
                      <span className="text-emerald-400 font-mono text-xs tracking-widest uppercase">Environment</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { id: 'modern_classroom', name: 'Modern Classroom', initial: 'C' },
                        { id: 'science_lab', name: 'Science Laboratory', initial: 'L' },
                        { id: 'tech_studio', name: 'Digital Tech Studio', initial: 'S' },
                        { id: 'cozy_library', name: 'Cozy Library', initial: 'B' }
                      ].map(opt => (
                        <div
                          key={opt.id}
                          onClick={() => setScenario(opt.id)}
                          className={`cursor-pointer flex items-center gap-4 rounded-xl p-4 border transition-all duration-300 ${scenario === opt.id ? 'bg-emerald-900/20 border-emerald-500/50 shadow-[0_0_15px_rgba(52,211,153,0.15)]' : 'bg-slate-800/50 border-white/5 hover:bg-slate-700/50'}`}
                        >
                          <div className={`w-16 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${scenario === opt.id ? 'border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)]' : 'border-transparent'}`}>
                            <img src={`/images/${opt.id}.png`} alt={opt.name} className="w-full h-full object-cover bg-emerald-500/20" />
                          </div>
                          <h3 className="font-medium text-white text-sm">{opt.name}</h3>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="mt-12 flex justify-end">
                  <button onClick={() => setStep(2)} className="px-8 py-3.5 rounded-full text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] font-semibold tracking-wide text-sm flex items-center gap-2">
                    Next: Upload PDF
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Upload */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
              <div
                className={`w-full rounded-3xl p-1 transition-all duration-500 ${isDragging ? 'bg-gradient-to-r from-indigo-500 to-purple-500 scale-[1.02]' : 'bg-white/5 hover:bg-white/10'}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="w-full h-[400px] rounded-[22px] bg-slate-900/90 backdrop-blur-xl border border-white/5 flex flex-col items-center justify-center relative overflow-hidden group">
                  <button onClick={() => setStep(1)} className="absolute top-6 left-6 text-slate-400 hover:text-white transition-colors text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    Back
                  </button>

                  {!file ? (
                    <>
                      <div className="w-20 h-20 rounded-full bg-indigo-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                        <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                        </svg>
                      </div>
                      <h3 className="text-2xl font-semibold mb-2 text-white">Upload your PDF</h3>
                      <p className="text-slate-400 text-sm mb-8">Provide the educational material for {character.replace('_', ' ')}</p>

                      <label className="cursor-pointer relative inline-flex items-center justify-center px-8 py-3.5 text-base font-medium text-white bg-indigo-600 border border-transparent rounded-full shadow-lg hover:bg-indigo-700 transition-all duration-300 hover:shadow-indigo-500/25">
                        Browse Files
                        <input type="file" className="hidden" accept=".pdf" onChange={(e) => e.target.files && setFile(e.target.files[0])} />
                      </label>
                    </>
                  ) : (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center mb-4 shadow-lg shadow-red-500/20">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                      </div>
                      <h3 className="text-xl font-medium text-white mb-1">{file.name}</h3>
                      <p className="text-slate-400 text-sm mb-8">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      <div className="flex gap-4">
                        <button onClick={() => setFile(null)} className="px-6 py-2.5 rounded-full text-slate-300 bg-white/5 hover:bg-white/10 transition-colors border border-white/10 text-sm">
                          Cancel
                        </button>
                        <button onClick={handleGenerate} className="px-8 py-2.5 rounded-full text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg shadow-indigo-500/25 font-semibold text-sm flex items-center gap-2 group">
                          Start Learning Scenario
                          <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Loading Generation */}
          {step === 3 && (
            <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-500">
              <div className="w-24 h-24 relative mb-8">
                <div className="absolute inset-0 border-t-2 border-indigo-500 rounded-full animate-spin"></div>
                <div className="absolute inset-2 border-r-2 border-purple-500 rounded-full animate-spin-reverse"></div>
                <div className="absolute inset-0 flex items-center justify-center text-indigo-400">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Preparing your lesson...</h3>

              <div className="w-full max-w-md h-2 bg-white/10 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>

              <div className="flex justify-between w-full max-w-md text-sm">
                <span className="text-slate-400">{statusMessage}</span>
                <span className="text-white font-medium">{progress}%</span>
              </div>
            </div>
          )}

          {/* STEP 4: Fullscreen Immersive Classroom UI */}
          {step === 4 && (
            <div className="fixed inset-0 w-full h-screen z-50 bg-slate-900 overflow-hidden animate-in fade-in duration-1000">

              {/* 1. Fullscreen Environment Background */}
              <div
                className="absolute inset-0 z-0 transition-all duration-1000"
                style={{
                  backgroundImage: `url(/images/${scenario}.png)`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {/* Dark Overlay for Depth */}
                <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"></div>
              </div>

              {/* Top Navigation Bar */}
              <div className="absolute top-0 left-0 w-full p-6 z-40 flex justify-between items-start pointer-events-none">
                <button
                  onClick={() => { setStep(1); setFile(null); setJobId(null); setIsGenerating(false); }}
                  className="pointer-events-auto px-5 py-2.5 rounded-full bg-black/40 backdrop-blur-md text-sm text-white hover:bg-black/60 transition-colors border border-white/20 flex items-center gap-2 shadow-xl"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                  Leave Classroom
                </button>

                {/* Tutor Status Indicator */}
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

              {/* 2. Interactive Whiteboard (Pushed Back in 3D Space) */}
              <div className="absolute top-[10%] left-[20%] xl:left-[25%] right-[28%] xl:right-[32%] bottom-[10%] z-10 flex items-center justify-center pointer-events-none">
                <div
                  className="w-full h-full max-w-6xl bg-white/90 backdrop-blur-xl p-12 rounded-3xl shadow-2xl border border-white/50 pointer-events-auto overflow-y-auto flex flex-col"
                  dangerouslySetInnerHTML={{ __html: whiteboardContent }}
                >
                </div>
              </div>

              {/* 3. The Teacher Character (Absolute Foreground) */}
              <div
                className={`absolute bottom-0 left-[-5%] xl:left-0 z-20 w-[500px] xl:w-[650px] origin-bottom animate-walk-in ${isTalking ? 'animate-talking' : ''}`}
                style={{ animationDelay: '0.2s' }}
              >
                <img src={`/images/${character}.png`} alt={character} className="w-full h-auto drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]" />
              </div>

              {/* 4. Floating Chat Pop-up (Right Side) */}
              <div className="absolute right-6 bottom-6 top-24 w-[400px] z-30 flex flex-col bg-slate-950/80 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
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
                    disabled={isSending || isTalking}
                  />
                  <button
                    onClick={handleSendChat}
                    disabled={isSending || isTalking || !currentInput.trim()}
                    className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 flex items-center justify-center transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] flex-shrink-0"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M12 5l7 7-7 7"></path></svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BYOK Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-white/10 p-8 rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-300">
            <h2 className="text-2xl font-bold text-white mb-2">Free Tier Exceeded</h2>
            <p className="text-slate-400 text-sm mb-6">
              You have consumed your 1 free PDF session. To continue building immersive interactive sessions, please provide your own Groq API Key.
            </p>
            <input
              type="password"
              placeholder="gsk_..."
              value={tempKeyInput}
              onChange={(e) => setTempKeyInput(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-6"
            />
            <div className="flex gap-4">
              <button
                onClick={() => setShowKeyModal(false)}
                className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveCustomKey}
                disabled={!tempKeyInput.trim()}
                className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-slate-700 transition-colors font-semibold"
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
