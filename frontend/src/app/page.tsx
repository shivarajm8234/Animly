"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import mermaid from 'mermaid';
import { auth, database } from '../lib/firebase';
import { User, signOut, onAuthStateChanged } from 'firebase/auth';
import { ref, get, set, update, query, orderByChild, equalTo } from 'firebase/database';

export default function Home() {
  const router = useRouter();
  const [loadingUser, setLoadingUser] = useState(true);


  // User State
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<{ usedFreeTier?: boolean, freeTierStartTime?: number, customGroqKey: string | null, sarvamApiKey: string | null, email?: string } | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKeyInput, setTempKeyInput] = useState('');
  const [tempSarvamKeyInput, setTempSarvamKeyInput] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [pastSessions, setPastSessions] = useState<{ id: string, pdfText: string, createdAt: number, character: string, scenario?: string }[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleShare = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/classroom?id=${sessionId}`);
    setCopiedId(sessionId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Fetch user data
        const dbRef = ref(database, 'users/' + currentUser.uid);
        const snapshot = await get(dbRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          setUserData(data);
        }
        setLoadingUser(false);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Fetch Past Sessions
  useEffect(() => {
    if (!user) return;
    const sessionsRef = query(ref(database, 'sessions'), orderByChild('uid'), equalTo(user.uid));
    get(sessionsRef).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const sessionsArray = Object.keys(data).map(key => ({
          id: key,
          pdfText: data[key].pdfText ? data[key].pdfText.substring(0, 50) + "..." : "Classroom Session",
          createdAt: data[key].createdAt,
          character: data[key].character || "mr_newton",
          scenario: data[key].scenario || "modern_classroom"
        })).sort((a, b) => b.createdAt - a.createdAt);
        setPastSessions(sessionsArray);
      }
    }).catch(console.error);
  }, [user]);






  // Login logic moved to /login

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserData(null);
      setShowProfileMenu(false);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const saveCustomKey = async () => {
    if (!user) return;
    const dbRef = ref(database, 'users/' + user.uid);
    const updates = {
      customGroqKey: tempKeyInput.trim() || null,
      sarvamApiKey: tempSarvamKeyInput.trim() || null
    };
    await update(dbRef, updates);
    setUserData(prev => prev ? { ...prev, ...updates } : null);
    setShowKeyModal(false);
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
        {user && (
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
                      onClick={() => { 
                        setTempKeyInput(userData?.customGroqKey || ''); 
                        setTempSarvamKeyInput(userData?.sarvamApiKey || ''); 
                        setShowKeyModal(true); 
                        setShowProfileMenu(false); 
                      }} 
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

        {user && (
          <header className="text-center mb-12 mt-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-white drop-shadow-[0_0_25px_rgba(129,140,248,0.3)]">
              Transform PDFs into <span className="text-indigo-400">Interactive Tutors.</span>
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto font-light leading-relaxed mb-8">
              Welcome back to Animly. Jump into your recent sessions or start a new one.
            </p>
            <Link href="/create" className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] font-semibold tracking-wide text-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              Let's Start
            </Link>
          </header>
        )}
        
        {/* Recent Classes Section */}
        {pastSessions.length > 0 && (
          <div className="w-full max-w-4xl mt-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Recent Classes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastSessions.map((session) => (
                <div 
                  key={session.id} 
                  onClick={() => router.push(`/classroom?id=${session.id}`)}
                  className="bg-slate-900/20 hover:bg-slate-800/40 border border-transparent hover:border-white/5 rounded-2xl cursor-pointer transition-all h-full flex flex-col group overflow-hidden"
                >
                  <div className="relative w-full aspect-video bg-slate-800 overflow-hidden">
                    <img src={`/images/${session.scenario || 'modern_classroom'}.png`} alt="Thumbnail" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    
                    <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-medium text-white tracking-wider uppercase flex items-center gap-1">
                      <svg className="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      Session
                    </div>

                    <button 
                      onClick={(e) => handleShare(e, session.id)}
                      className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-indigo-600 text-white backdrop-blur-md transition-all z-10"
                      title="Share Classroom Link"
                    >
                      {copiedId === session.id ? (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                      )}
                    </button>
                    {copiedId === session.id && (
                      <div className="absolute top-12 right-3 bg-emerald-500/90 text-white text-xs px-2 py-1 rounded shadow-lg animate-in fade-in zoom-in slide-in-from-top-1">
                        Link Copied!
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-4 p-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 overflow-hidden flex-shrink-0 mt-0.5 border border-white/10">
                      <img src={`/images/${session.character}_idle.png`} alt={session.character} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col flex-1 pr-2">
                      <h3 className="font-semibold text-white capitalize text-base leading-tight mb-1 group-hover:text-indigo-300 transition-colors line-clamp-2">Class with {session.character.replace('_', ' ')}</h3>
                      <p className="text-sm text-slate-400 line-clamp-1 mb-1" title={session.pdfText}>"{session.pdfText}"</p>
                      <p className="text-xs text-slate-500">{new Date(session.createdAt).toLocaleDateString()} • {new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      )}

      {/* BYOK Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-white/10 p-8 rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-300">
            <h2 className="text-2xl font-bold text-white mb-2">API Keys Configuration</h2>
            <p className="text-slate-400 text-sm mb-6">
              {userData?.usedFreeTier ? "You have consumed your 1 free PDF session. " : ""}
              Please provide your custom API keys below to run the classroom and speech.
            </p>
            
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Groq API Key (for Chat)</label>
              <input
                type="password"
                placeholder="gsk_..."
                value={tempKeyInput}
                onChange={(e) => setTempKeyInput(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Don't have a Groq key? <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">Get one here</a>.</span>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Sarvam API Key (for Text-to-Speech)</label>
              <input
                type="password"
                placeholder="Enter Sarvam API Subscription Key"
                value={tempSarvamKeyInput}
                onChange={(e) => setTempSarvamKeyInput(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Don't have a Sarvam key? <a href="https://dashboard.sarvam.ai" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">Get one here</a>.</span>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowKeyModal(false)}
                className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveCustomKey}
                className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-colors font-semibold"
              >
                Save Keys
              </button>
            </div>
          </div>
        </div>
      )}


    </main>
  );
}
