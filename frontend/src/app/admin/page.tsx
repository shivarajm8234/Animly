"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { auth, database } from '../../lib/firebase';
import { ref, get, update } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';

type UserData = {
  usedFreeTier?: boolean;
  customGroqKey?: string | null;
  sarvamApiKey?: string | null;
  email?: string;
};

type ViewLog = {
  id: string;
  viewerUid: string;
  viewerEmail: string;
  sessionId: string;
  sessionOwnerUid: string;
  timestamp: number;
};

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [usersData, setUsersData] = useState<Record<string, UserData>>({});
  const [viewLogs, setViewLogs] = useState<ViewLog[]>([]);
  
  const extendFreeTier = async (uid: string) => {
    try {
      const dbRef = ref(database, 'users/' + uid);
      await update(dbRef, { freeTierStartTime: Date.now(), usedFreeTier: true });
      
      setUsersData(prev => ({
        ...prev,
        [uid]: {
          ...prev[uid],
          usedFreeTier: true,
        }
      }));
      alert('Free tier extended by 5 minutes for user.');
    } catch (e: any) {
      alert('Error extending free tier: ' + e.message);
    }
  };
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setError("You must be logged in to view this page.");
        setLoading(false);
        return;
      }
      
      setUser(currentUser);
      
      try {
        // Check if current user is admin by email
        if (currentUser.email !== 'shivarajmani2005@gmail.com') {
          setError("You do not have permission to view the Admin Dashboard.");
          setLoading(false);
          return;
        }

        // Fetch all users
        const usersRef = ref(database, 'users');
        const usersSnapshot = await get(usersRef);
        
        if (usersSnapshot.exists()) {
          setUsersData(usersSnapshot.val());
        }

        // Fetch all views
        const viewsRef = ref(database, 'views');
        const viewsSnapshot = await get(viewsRef);
        if (viewsSnapshot.exists()) {
          const viewsData = viewsSnapshot.val();
          const viewsArray = Object.keys(viewsData).map(key => ({
            id: key,
            ...viewsData[key]
          })).sort((a: any, b: any) => b.timestamp - a.timestamp);
          setViewLogs(viewsArray);
        }
      } catch (err: any) {
        setError("Error fetching data: " + err.message);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 max-w-lg w-full text-center">
          <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-slate-400 mb-8">{error}</p>
          <Link href="/" className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors inline-block">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const totalUsers = Object.keys(usersData).length;
  const usedFreeTier = Object.values(usersData).filter(u => u.usedFreeTier).length;
  const providedCustomKey = Object.values(usersData).filter(u => !!u.customGroqKey || !!u.sarvamApiKey).length;
  const adminUsers = Object.values(usersData).filter(u => u.email === 'shivarajmani2005@gmail.com').length;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">Admin Dashboard</h1>
            <p className="text-slate-400 mt-2">Manage users and view application usage statistics.</p>
          </div>
          <Link href="/" className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl transition-colors flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            Back to App
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Stat Cards */}
          <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            </div>
            <h3 className="text-slate-400 text-sm font-medium mb-1">Total Authenticated Users</h3>
            <p className="text-3xl font-bold">{totalUsers}</p>
          </div>

          <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <h3 className="text-slate-400 text-sm font-medium mb-1">Used Free Tier</h3>
            <p className="text-3xl font-bold">{usedFreeTier}</p>
          </div>

          <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
            </div>
            <h3 className="text-slate-400 text-sm font-medium mb-1">Custom API Keys Provided</h3>
            <p className="text-3xl font-bold">{providedCustomKey}</p>
          </div>

          <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-rose-500/20 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
            </div>
            <h3 className="text-slate-400 text-sm font-medium mb-1">Admin Users</h3>
            <p className="text-3xl font-bold">{adminUsers}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-6 border-b border-white/5 bg-white/[0.02]">
            <h2 className="text-xl font-semibold">User Login Details</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-slate-800/50 text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">User UID</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Used Free Tier</th>
                  <th className="px-6 py-4 font-medium">Has API Keys</th>
                  <th className="px-6 py-4 font-medium text-right">Role</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {Object.entries(usersData).map(([uid, data]) => (
                  <tr key={uid} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{uid}</td>
                    <td className="px-6 py-4 text-sm text-slate-200">{data.email || 'Unknown'}</td>
                    <td className="px-6 py-4">
                      {data.usedFreeTier ? (
                        <span className="inline-flex items-center gap-1.5 py-1 px-2 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 py-1 px-2 rounded-md bg-slate-500/10 text-slate-400 text-xs font-medium border border-slate-500/20">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        {data.customGroqKey ? (
                          <span className="inline-flex items-center gap-1 py-0.5 px-1.5 rounded bg-indigo-500/10 text-indigo-300 text-[10px] font-medium border border-indigo-500/20">
                            Groq: Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 py-0.5 px-1.5 rounded bg-slate-500/10 text-slate-400 text-[10px] font-medium border border-slate-500/10">
                            Groq: None
                          </span>
                        )}
                        {data.sarvamApiKey ? (
                          <span className="inline-flex items-center gap-1 py-0.5 px-1.5 rounded bg-emerald-500/10 text-emerald-300 text-[10px] font-medium border border-emerald-500/20">
                            Sarvam: Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 py-0.5 px-1.5 rounded bg-slate-500/10 text-slate-400 text-[10px] font-medium border border-slate-500/10">
                            Sarvam: None
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {data.email === 'shivarajmani2005@gmail.com' ? (
                        <span className="text-rose-400 font-medium text-xs tracking-wider uppercase">Admin</span>
                      ) : (
                        <span className="text-slate-500 font-medium text-xs tracking-wider uppercase">User</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {data.email !== 'shivarajmani2005@gmail.com' && (
                        <button onClick={() => extendFreeTier(uid)} className="px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 rounded-lg text-xs font-medium transition-colors border border-indigo-500/30">
                          Extend 5m
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                
                {Object.keys(usersData).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Viewer Logs Table */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden shadow-xl mt-12 mb-12">
          <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                Classroom Viewer Logs
              </h2>
              <p className="text-sm text-slate-400 mt-1">Track who is viewing shared classrooms.</p>
            </div>
            <div className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-sm border border-white/5 font-medium">
              Total Views: {viewLogs.length}
            </div>
          </div>
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-slate-800/50 text-slate-400 sticky top-0 backdrop-blur-md">
                <tr>
                  <th className="px-6 py-4 font-medium">Viewer Email</th>
                  <th className="px-6 py-4 font-medium">Viewer UID</th>
                  <th className="px-6 py-4 font-medium">Viewed Session ID</th>
                  <th className="px-6 py-4 font-medium">Session Owner UID</th>
                  <th className="px-6 py-4 font-medium text-right">Time Viewed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {viewLogs.length > 0 ? (
                  viewLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-200">
                        {log.viewerEmail}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">
                        {log.viewerUid}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-indigo-300">
                        <Link href={`/classroom?id=${log.sessionId}`} className="hover:underline">
                          {log.sessionId.substring(0, 8)}...
                        </Link>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">
                        {log.sessionOwnerUid === log.viewerUid ? (
                          <span className="text-emerald-400">Owner</span>
                        ) : (
                          log.sessionOwnerUid
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-slate-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">
                      No classroom views have been recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
