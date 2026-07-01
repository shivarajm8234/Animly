"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import mermaid from 'mermaid';
import { auth, database } from '../../lib/firebase';
import { User, signOut, onAuthStateChanged } from 'firebase/auth';
import { ref, get, set, update } from 'firebase/database';

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loadingUser, setLoadingUser] = useState(true);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  // User State
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<{ usedFreeTier?: boolean, freeTierStartTime?: number, customGroqKey: string | null, email?: string } | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKeyInput, setTempKeyInput] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Config State
  const [character, setCharacter] = useState('mr_newton');
  const [scenario, setScenario] = useState('modern_classroom');

  // Upload State
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [pdfContext, setPdfContext] = useState<string>("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Fetch user data
        const dbRef = ref(database, 'users/' + currentUser.uid);
        const snapshot = await get(dbRef);
        if (snapshot.exists()) {
          setUserData(snapshot.val());
        }
        setLoadingUser(false);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);



  // Timer Logic
  useEffect(() => {
    if (step !== 4 || !user || !userData) return;
    const isAdmin = user.email === 'shivarajmani2005@gmail.com';
    
    if (isAdmin || userData.customGroqKey) {
      setTimeLeft(null);
      return;
    }

    const startTime = userData.freeTierStartTime;
    if (!startTime) return;

    const interval = setInterval(() => {
      const elapsedMs = Date.now() - startTime;
      const remainingMs = 5 * 60 * 1000 - elapsedMs;
      
      if (remainingMs <= 0) {
        clearInterval(interval);
        setStep(1);
        setFile(null);
        localStorage.removeItem('animly_session');
        setShowKeyModal(true);
      } else {
        const mins = Math.floor(remainingMs / 60000);
        const secs = Math.floor((remainingMs % 60000) / 1000);
        setTimeLeft(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [step, user, userData]);



  // Login logic moved to /login

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserData(null);
      setStep(0);
      setShowProfileMenu(false);
    } catch (error) {
      console.error("Logout failed:", error);
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

    if (!userData.customGroqKey) {
      setShowKeyModal(true);
      return;
    }

    setStep(3); // Moving to Generation step
    setIsGenerating(true);
    setProgress(0);
    setStatusMessage("Reading pedagogical material...");

    // Smooth loading numbers effect
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 5) + 2;
      if (currentProgress > 95) currentProgress = 95;
      setProgress(currentProgress);
      
      if (currentProgress > 70) setStatusMessage("Extracting core concepts...");
      if (currentProgress > 85) setStatusMessage("Preparing interactive tutor...");
    }, 400);

    try {
      if (!userData || !userData.customGroqKey) {
        setShowKeyModal(true);
        clearInterval(progressInterval);
        return;
      }

      // Parse PDF client-side
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        text += pageText + '\n';
      }

      clearInterval(progressInterval);

      if (text) {
        setPdfContext(text);
        setProgress(100);
        setStatusMessage("Waking up AI tutor...");
        
        setTimeout(async () => {
          const sessionId = crypto.randomUUID();
          const sessionRef = ref(database, 'sessions/' + sessionId);
          await set(sessionRef, {
            character,
            scenario,
            pdfContext: text,
            uid: user.uid,
            createdAt: Date.now()
          });
          router.push('/classroom?id=' + sessionId);
        }, 1500);
      } else {
        throw new Error("Failed to extract text from PDF");
      }
    } catch (error) {
      clearInterval(progressInterval);
      setStatusMessage("Error: " + (error as Error).message);
    }
  };

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

      {loadingUser ? (
        <div className="min-h-screen flex items-center justify-center relative z-10">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="relative z-10 container mx-auto px-6 py-12 flex flex-col items-center min-h-screen">
        
        {/* Top Header for Logged in Users */}
        {user && step > 0 && step < 4 && (
          <div className="absolute top-6 right-8 z-50">
            <div className="relative">
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-3 bg-slate-800/80 hover:bg-slate-700/80 transition-all border border-white/10 rounded-full py-1.5 pl-1.5 pr-4 backdrop-blur-md"
              >
                <div className="w-9 h-9 rounded-full bg-indigo-600 overflow-hidden border border-indigo-400/50 flex items-center justify-center font-bold text-white">
                  {user.photoURL ? <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" /> : user.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="text-sm font-medium text-slate-200 hidden sm:block">{user.displayName || user.email?.split('@')[0]}</span>
              </button>
              
              {showProfileMenu && (
                <div className="absolute right-0 mt-3 w-56 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="p-3 border-b border-white/10">
                    <p className="text-xs text-slate-400">Signed in as</p>
                    <p className="text-sm font-medium text-white truncate">{user.email}</p>
                  </div>
                  <div className="p-2">
                    {user?.email === 'shivarajmani2005@gmail.com' && (
                      <Link href="/admin" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                        Admin Dashboard
                      </Link>
                    )}
                    <button 
                      onClick={() => { setShowKeyModal(true); setShowProfileMenu(false); }} 
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors text-left"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                      Settings / API Key
                    </button>
                    <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors text-left mt-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
                            <img src={`/images/${opt.id}.png?v=2`} alt={opt.name} className="w-full h-full object-cover bg-indigo-500/20" />
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
                          {!userData?.usedFreeTier ? "Start Free Demo" : "Start Session (Uses API Key)"}
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


        </div>
        </div>
      )}

      {/* BYOK Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-white/10 p-8 rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-300">
            <h2 className="text-2xl font-bold text-white mb-2">API Key Configuration</h2>
            <p className="text-slate-400 text-sm mb-6">
              {userData?.usedFreeTier ? "You have consumed your 1 free PDF session. " : ""}
              To build immersive interactive sessions, please provide your own Groq API Key.
              <br/><br/>
              Don't have an API key? <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">Get one here</a>.
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
