"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, database, googleProvider } from '../../lib/firebase';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { ref, get, set, update } from 'firebase/database';

export default function Login() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // If already logged in, redirect to home
        router.push('/');
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      
      // Fetch or init user data
      const dbRef = ref(database, 'users/' + result.user.uid);
      const snapshot = await get(dbRef);
      
      if (snapshot.exists()) {
        // Just update email if it doesn't exist
        const data = snapshot.val();
        if (!data.email) {
          await update(dbRef, { email: result.user.email });
        }
      } else {
        const newData = { 
          usedFreeTier: false, 
          customGroqKey: null,
          sarvamApiKey: null,
          email: result.user.email
        };
        await set(dbRef, newData);
      }
      
      // onAuthStateChanged will handle the redirect
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden relative flex flex-col items-center justify-center">
      {/* Dynamic Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-indigo-500/10 blur-[120px] rounded-full mix-blend-screen animate-pulse"></div>
        <div className="absolute top-1/2 left-1/4 w-full h-full bg-purple-600/10 blur-[150px] rounded-full mix-blend-screen animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="flex flex-col items-center justify-center min-h-[75vh] w-full animate-in fade-in zoom-in duration-700 relative z-10">
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
    </main>
  );
}
