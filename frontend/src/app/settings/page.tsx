"use client";

import { useState } from 'react';
import Link from 'next/link';

export default function Settings() {
  const [character, setCharacter] = useState('mr_newton');
  const [scenario, setScenario] = useState('modern_classroom');
  const [voice, setVoice] = useState('professional_female');
  const [animationStyle, setAnimationStyle] = useState('smooth_disney');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    
    const configData = {
      character,
      scenario,
      voice,
      animationStyle,
      updatedAt: new Date().toISOString()
    };

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData),
      });
      
      if (response.ok) {
        setSaveMessage('Saved to config.json');
      } else {
        setSaveMessage('Failed to save');
      }
    } catch (error) {
      setSaveMessage('Error saving configuration');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 p-8 md:p-12">
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-3/4 h-full bg-indigo-500/5 blur-[150px] mix-blend-screen"></div>
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-purple-500/5 blur-[120px] mix-blend-screen"></div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto">
        <header className="mb-14 flex flex-col md:flex-row md:justify-between md:items-end border-b border-white/5 pb-8 gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-3">Tutor Configuration</h1>
            <p className="text-slate-400 text-lg">Personalize your real-time interactive learning experience.</p>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all shadow-sm backdrop-blur-md">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            Back to Dashboard
          </Link>
        </header>

        <div className="space-y-16">
          {/* Character Selection */}
          <section>
            <div className="mb-6 flex items-baseline gap-3">
              <span className="text-indigo-400 font-mono text-sm tracking-widest uppercase">Step 01</span>
              <h2 className="text-2xl font-semibold text-white">Choose a Persona</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { id: 'mr_newton', name: 'Mr. Newton', desc: 'Classic Math & Physics Professor. Authoritative and clear.', initials: 'MN' },
                { id: 'ms_curie', name: 'Ms. Curie', desc: 'Passionate Science & Biology teacher with an analytical approach.', initials: 'MC' },
                { id: 'ada', name: 'Ada', desc: 'Tech-savvy Computer Science instructor. Modern and snappy.', initials: 'AD' },
                { id: 'leo', name: 'Leo', desc: 'Warm History & Arts storyteller. Engaging and highly expressive.', initials: 'LE' }
              ].map(opt => (
                <div 
                  key={opt.id}
                  onClick={() => setCharacter(opt.id)}
                  className={`group cursor-pointer rounded-2xl p-6 border transition-all duration-500 ${character === opt.id ? 'bg-indigo-900/40 border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.15)]' : 'bg-slate-900/50 border-white/5 hover:bg-slate-800/80 hover:border-white/10'}`}
                >
                  <div className={`w-16 h-16 rounded-full mb-5 flex items-center justify-center text-xl font-bold tracking-wider transition-colors duration-500 ${character === opt.id ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'}`}>
                    {opt.initials}
                  </div>
                  <h3 className="font-semibold text-white text-lg mb-2">{opt.name}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{opt.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Scenario Selection */}
          <section>
            <div className="mb-6 flex items-baseline gap-3">
              <span className="text-emerald-400 font-mono text-sm tracking-widest uppercase">Step 02</span>
              <h2 className="text-2xl font-semibold text-white">Select the Environment</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                { id: 'modern_classroom', name: 'Modern Classroom', desc: 'Bright, clean whiteboard and wooden desks. Ideal for standard lectures.', initial: 'C' },
                { id: 'science_lab', name: 'Science Laboratory', desc: 'Filled with beakers and chemistry equipment. Great for experiments.', initial: 'L' },
                { id: 'tech_studio', name: 'Digital Tech Studio', desc: 'Dark mode with neon accents and floating holographic screens.', initial: 'S' },
                { id: 'cozy_library', name: 'Cozy Library', desc: 'Warm lighting, bookshelves, and chalkboards. Perfect for storytelling.', initial: 'B' }
              ].map(opt => (
                <div 
                  key={opt.id}
                  onClick={() => setScenario(opt.id)}
                  className={`group cursor-pointer flex items-start gap-5 rounded-2xl p-5 border transition-all duration-500 ${scenario === opt.id ? 'bg-emerald-900/20 border-emerald-500/50 shadow-[0_0_20px_rgba(52,211,153,0.1)]' : 'bg-slate-900/50 border-white/5 hover:bg-slate-800/80 hover:border-white/10'}`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-semibold shrink-0 transition-colors duration-500 ${scenario === opt.id ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700'}`}>
                    {opt.initial}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">{opt.name}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{opt.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Voice Selection */}
          <section>
            <div className="mb-6 flex items-baseline gap-3">
              <span className="text-purple-400 font-mono text-sm tracking-widest uppercase">Step 03</span>
              <h2 className="text-2xl font-semibold text-white">Voice Profile</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { id: 'professional_female', name: 'Professional Female', style: 'Clear & engaging' },
                { id: 'calm_male', name: 'Calm Male', style: 'Deep & methodical' },
                { id: 'enthusiastic_young', name: 'Enthusiastic', style: 'Upbeat & fast-paced' },
                { id: 'authoritative_storyteller', name: 'Storyteller', style: 'Warm & narrative' }
              ].map(opt => (
                <div 
                  key={opt.id}
                  onClick={() => setVoice(opt.id)}
                  className={`relative overflow-hidden cursor-pointer rounded-xl p-5 border transition-all duration-300 ${voice === opt.id ? 'bg-purple-900/30 border-purple-500/50' : 'bg-slate-900/50 border-white/5 hover:bg-slate-800/80'}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${voice === opt.id ? 'bg-purple-500 text-white shadow-md shadow-purple-500/30' : 'bg-slate-800 text-slate-500'}`}>
                      <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path></svg>
                    </div>
                  </div>
                  <h3 className="font-semibold text-white text-sm mb-1">{opt.name}</h3>
                  <p className="text-xs text-slate-400">{opt.style}</p>
                </div>
              ))}
            </div>
          </section>
          
          {/* Animation Style */}
          <section>
            <div className="mb-6 flex items-baseline gap-3">
              <span className="text-pink-400 font-mono text-sm tracking-widest uppercase">Step 04</span>
              <h2 className="text-2xl font-semibold text-white">Animation Style</h2>
            </div>
            <div className="flex flex-wrap gap-4">
              {[
                { id: 'smooth_disney', name: 'Smooth & Fluid' },
                { id: 'snappy_modern', name: 'Snappy & Modern' },
                { id: 'calm_minimalist', name: 'Calm & Minimalist' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setAnimationStyle(opt.id)}
                  className={`px-6 py-3 rounded-full text-sm font-medium transition-all duration-300 ${animationStyle === opt.id ? 'bg-pink-500 text-white shadow-[0_0_20px_rgba(236,72,153,0.3)] border-transparent' : 'bg-slate-900/50 text-slate-300 border border-white/5 hover:bg-slate-800 hover:border-white/10'}`}
                >
                  {opt.name}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-16 flex items-center justify-end border-t border-white/5 pt-8 gap-4">
          {saveMessage && (
            <span className="text-sm font-medium text-emerald-400 animate-in fade-in slide-in-from-right-4">
              {saveMessage}
            </span>
          )}
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-10 py-4 rounded-full text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-[0_0_30px_rgba(79,70,229,0.3)] font-semibold tracking-wide text-sm flex items-center gap-3 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
            {!isSaving && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>}
          </button>
        </div>
      </div>
    </main>
  );
}
