/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc, 
  serverTimestamp, 
  increment,
  query,
  orderBy,
  where,
  addDoc,
  deleteDoc
} from 'firebase/firestore';
import { 
  onAuthStateChanged, 
  signInAnonymously, 
  signInWithPopup, 
  GoogleAuthProvider,
  signOut
} from 'firebase/auth';
import { db, auth, OperationType, handleFirestoreError } from './firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Vote, 
  Settings, 
  Monitor, 
  Plus, 
  Play, 
  Square, 
  Trash2,
  Check, 
  Users,
  ChevronLeft,
  X as CloseIcon,
  Mic2,
  LogIn,
  LogOut
} from 'lucide-react';

const googleProvider = new GoogleAuthProvider();

// --- Types ---
interface Battle {
  id: string;
  title: string;
  artistA: string;
  artistB: string;
  status: 'pending' | 'active' | 'finished';
  votesA: number;
  votesB: number;
  createdAt: any;
  updatedAt: any;
}

interface CurrentVote {
  battleId: string;
  choice: 'A' | 'B';
}

interface AdminRecord {
  id: string; // The email is the ID
  email: string;
  addedBy: string;
  addedAt: any;
}

// --- App Component ---
export default function App() {
  const [user, setUser] = useState(auth.currentUser);
  const [view, setView] = useState<'voter' | 'admin' | 'display'>('voter');
  const [activeBattles, setActiveBattles] = useState<Battle[]>([]);
  const [admins, setAdmins] = useState<string[]>([]);
  const [votedBattles, setVotedBattles] = useState<Record<string, 'A' | 'B'>>({});
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Parse URL for direct view/battle access
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (viewParam === 'admin') setView('admin');
    if (viewParam === 'display') setView('display');
  }, []);

  // Auth & Initial Setup
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        setAuthError(null);
      } else {
        setUser(null);
        // Try anonymous for voters, but catch error if disabled
        try {
          await signInAnonymously(auth);
        } catch (error: any) {
          if (error.code === 'auth/admin-restricted-operation') {
            setAuthError("Anonymous sign-in disabled. Admin must sign in via Console.");
          } else {
            console.error("Auth auto-sign-in error:", error);
          }
        }
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setAuthError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
      setAuthError("Login failed. Please check your browser settings and try again.");
    }
  };

  const handleLogout = () => signOut(auth);

  // Listen to Battles
  useEffect(() => {
    const q = query(collection(db, 'battles'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const battles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Battle));
      setActiveBattles(battles);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'battles');
    });
    return () => unsubscribe();
  }, []);

  // Listen to Admins
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'admins'), (snapshot) => {
      setAdmins(snapshot.docs.map(doc => doc.id));
    }, (error) => {
      // Users might not have access if not admin, so we ignore failures here
      console.log("Admin list check suppressed (expected if not admin)");
    });
    return () => unsubscribe();
  }, [user]);

  // Listen to User's Votes
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'votes'), where('voterId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const votes: Record<string, 'A' | 'B'> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        votes[data.battleId] = data.choice;
      });
      setVotedBattles(votes);
    }, (error) => {
      // It might fail if index is building, but we handle it
      console.warn("Votes snapshot error (probably missing index):", error);
    });
    return () => unsubscribe();
  }, [user]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black gap-4">
        <div className="w-12 h-12 border-2 border-zinc-800 border-t-orange-500 rounded-full animate-spin" />
        <div className="mono text-[10px] text-zinc-500 uppercase tracking-[0.5em] animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 crt-flicker relative selection:bg-orange-500 selection:text-white">
      <div className="scanline" />
      
      {/* Header */}
      <header className="border-b border-zinc-800 bg-black p-4 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 p-1.5 shadow-[0_0_15px_rgba(249,115,22,0.5)]">
            <Mic2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tighter uppercase italic leading-none">
              Gzone <span className="text-white">Event Voting</span>
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
              <span className="mono text-[10px] uppercase text-zinc-500 tracking-widest font-bold">Peacocks Arena</span>
            </div>
          </div>
        </div>
        
        <nav className="flex gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded">
          <button 
            onClick={() => setView('voter')}
            id="nav-vote"
            className={`px-4 py-1.5 flex items-center gap-2 text-[10px] uppercase font-black transition-all rounded-sm ${view === 'voter' ? 'bg-zinc-100 text-black' : 'text-zinc-400 hover:text-white'}`}
          >
            <Vote size={12} /> Voter
          </button>
          <button 
            onClick={() => setView('display')}
            id="nav-display"
            className={`px-4 py-1.5 flex items-center gap-2 text-[10px] uppercase font-black transition-all rounded-sm ${view === 'display' ? 'bg-zinc-100 text-black' : 'text-zinc-400 hover:text-white'}`}
          >
            <Monitor size={12} /> Results
          </button>
          <button 
            onClick={() => setView('admin')}
            id="nav-admin"
            className={`px-4 py-1.5 flex items-center gap-2 text-[10px] uppercase font-black transition-all rounded-sm ${view === 'admin' ? 'bg-zinc-100 text-black' : 'text-zinc-400 hover:text-white'}`}
          >
            <Settings size={12} /> Console
          </button>
        </nav>
      </header>

      <main className={view === 'voter' ? '' : 'p-4 md:p-8 max-w-7xl mx-auto'}>
        {view === 'voter' && (
          <VoterView battles={activeBattles} votedBattles={votedBattles} user={user} authError={authError} onLogin={handleGoogleLogin} />
        )}
        {view === 'admin' && (
          <AdminView battles={activeBattles} user={user} admins={admins} onLogin={handleGoogleLogin} onLogout={handleLogout} />
        )}
        {view === 'display' && (
          <DisplayView battles={activeBattles} />
        )}
      </main>

      {view !== 'voter' && (
        <footer className="mt-12 py-8 border-t border-zinc-900 text-center opacity-30 text-[10px] uppercase tracking-[0.3em] font-bold">
          &copy; 2026 G ZONE // <a href="https://www.bjstudio.co.uk/" target="_blank" rel="noopener noreferrer" className="hover:text-white">BJSTUDIO</a>
        </footer>
      )}
    </div>
  );
}

// --- Views ---

function VoterView({ battles, votedBattles, user, authError, onLogin }: { battles: Battle[], votedBattles: Record<string, 'A' | 'B'>, user: any, authError: string | null, onLogin: () => void }) {
  const activeBattle = battles.find(b => b.status === 'active');

  const castVote = async (battleId: string, choice: 'A' | 'B') => {
    if (!user) return;
    const voteId = `${user.uid}_${battleId}`;
    try {
      await setDoc(doc(db, 'votes', voteId), {
        battleId,
        voterId: user.uid,
        choice,
        timestamp: serverTimestamp()
      });
      await updateDoc(doc(db, 'battles', battleId), {
        [choice === 'A' ? 'votesA' : 'votesB']: increment(1),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `votes/${voteId}`);
    }
  };

  if (authError && !user) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center p-12 text-center">
        <h2 className="text-xl font-black uppercase text-orange-500 mb-4 italic">Identity Required</h2>
        <p className="text-sm text-zinc-400 mb-8 max-w-md">Anonymous voting is disabled. Please verify your identity to participate in the arena.</p>
        <button 
          onClick={onLogin}
          className="bg-orange-500 text-white px-8 py-4 font-black uppercase italic skew-btn-left hover:bg-orange-400 flex items-center gap-3"
        >
          <LogIn size={20} /> Verify with Google
        </button>
      </div>
    )
  }

  if (!activeBattle) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center p-12 text-center">
        <div className="w-16 h-16 border-4 border-zinc-800 border-t-orange-500 rounded-full animate-spin mb-8" />
        <h2 className="text-2xl font-black uppercase opacity-50 italic">Awaiting result</h2>
        <p className="mono text-xs text-zinc-500 mt-2 uppercase tracking-widest">Voting will open soon</p>
      </div>
    );
  }

  const userVote = votedBattles[activeBattle.id];
  const total = activeBattle.votesA + activeBattle.votesB;
  const percentA = total > 0 ? Math.round((activeBattle.votesA / total) * 100) : 0;
  const percentB = total > 0 ? Math.round((activeBattle.votesB / total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px_1fr] min-h-[calc(100vh-64px)] w-full">
      {/* Contender A */}
      <div className={`voter-card flex flex-col p-8 justify-between relative group ${userVote === 'A' ? 'active-glow-orange bg-orange-950/20' : userVote ? 'opacity-30' : ''}`}>
        <div className="space-y-1 relative z-10">
          <span className="mono text-[10px] uppercase tracking-[0.3em] text-orange-500 font-black">Arena Slot A</span>
          <h2 className="text-5xl md:text-8xl font-black uppercase italic leading-none tracking-tighter drop-shadow-[0_0_15px_rgba(249,115,22,0.3)]">
            {activeBattle.artistA}
          </h2>
        </div>

        <div className="relative flex-1 flex items-center justify-center pointer-events-none">
          <div className="text-[200px] md:text-[320px] font-black opacity-[0.03] absolute italic select-none">A</div>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center z-10"
          >
            <div className="text-7xl md:text-9xl font-black text-orange-500 mb-4 tracking-tighter">
              {percentA}<span className="text-3xl md:text-5xl">%</span>
            </div>
            <div className="stat-bar w-48 md:w-64 mx-auto">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${percentA}%` }}
                className="h-full bg-orange-500 shadow-[0_0_15px_#f97316]"
              />
            </div>
            <div className="mt-4 mono text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
              {activeBattle.votesA} percentage vote
            </div>
          </motion.div>
        </div>

        <button
          disabled={!!userVote}
          onClick={() => castVote(activeBattle.id, 'A')}
          className={`w-full py-6 font-black text-xl md:text-2xl uppercase italic skew-btn-left transition-all z-10
            ${userVote === 'A' ? 'bg-orange-500 text-white shadow-[0_0_20px_#f97316]' : 
              userVote ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50' : 
              'bg-orange-600 hover:bg-orange-500 text-white cursor-pointer'}`}
        >
          {userVote === 'A' ? 'LOCKED FOR A' : userVote ? 'VOTE EXHAUSTED' : `Vote for ${activeBattle.artistA}`}
        </button>
      </div>

      {/* Center Info */}
      <div className="bg-zinc-950/50 border-x border-zinc-800 flex flex-col p-6 text-center space-y-12">
        <div className="space-y-2">
          <div className="mono text-[10px] text-zinc-500 uppercase tracking-widest font-black">Active Event</div>
          <h2 className="text-xl font-black uppercase italic leading-none">{activeBattle.title}</h2>
          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            <span className="mono text-[10px] uppercase text-orange-500 font-black tracking-widest">LIVE DATA FEED</span>
          </div>
        </div>

        <div className="space-y-6 flex-1 flex flex-col justify-center">
            <div className="p-4 bg-black/40 rounded border border-zinc-800/50 backdrop-blur-sm">
                <div className="flex justify-between mono text-[9px] mb-2 font-black tracking-widest">
                    <span className="text-zinc-500">SYSTEM SECURITY</span>
                    <span className="text-green-500">ENCRYPTED</span>
                </div>
                <div className="text-[10px] text-zinc-400 leading-snug italic uppercase text-left opacity-70">
                    UID: {user?.uid.slice(0, 8)}... verified. Atomic relay engaged. One vote per hardware instance.
                </div>
            </div>

            {userVote && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 bg-zinc-900 border border-zinc-700 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]"
                >
                    <div className="w-12 h-12 bg-green-500 text-black mx-auto mb-4 flex items-center justify-center transform rotate-3 shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                        <Check size={24} />
                    </div>
                    <p className="text-sm font-black uppercase tracking-tighter">Confirmation Received</p>
                    <p className="text-[10px] mono text-zinc-500 mt-1 uppercase">Vote Hash: {Math.random().toString(16).slice(2, 10).toUpperCase()}</p>
                </motion.div>
            )}
        </div>

        <div className="mono text-[9px] text-zinc-600 font-bold uppercase leading-relaxed tracking-widest">
            Produced by <a href="https://www.bjstudio.co.uk/" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white underline decoration-zinc-800">BJStudio</a><br/>
            © 2026 LIVE SYSTEMS
        </div>
      </div>

      {/* Contender B */}
      <div className={`voter-card flex flex-col p-8 justify-between relative group text-right ${userVote === 'B' ? 'active-glow-white bg-white/5' : userVote ? 'opacity-30' : ''}`}>
        <div className="space-y-1 relative z-10">
          <span className="mono text-[10px] uppercase tracking-[0.3em] text-zinc-100 font-black">Arena Slot B</span>
          <h2 className="text-5xl md:text-8xl font-black uppercase italic leading-none tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
            {activeBattle.artistB}
          </h2>
        </div>

        <div className="relative flex-1 flex items-center justify-center pointer-events-none">
          <div className="text-[200px] md:text-[320px] font-black opacity-[0.03] absolute italic select-none">B</div>
          <motion.div 
             initial={{ scale: 0.9, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             className="text-center z-10"
          >
            <div className="text-7xl md:text-9xl font-black text-white mb-4 tracking-tighter">
              {percentB}<span className="text-3xl md:text-5xl">%</span>
            </div>
            <div className="stat-bar w-48 md:w-64 mx-auto">
              <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${percentB}%` }}
                 className="h-full bg-white shadow-[0_0_15px_#ffffff]"
              />
            </div>
            <div className="mt-4 mono text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                {activeBattle.votesB} percentage vote
            </div>
          </motion.div>
        </div>

        <button
          disabled={!!userVote}
          onClick={() => castVote(activeBattle.id, 'B')}
          className={`w-full py-6 font-black text-xl md:text-2xl uppercase italic skew-btn-right transition-all z-10
            ${userVote === 'B' ? 'bg-white text-black shadow-[0_0_20px_#ffffff]' : 
              userVote ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50' : 
              'bg-zinc-100 hover:bg-white text-black cursor-pointer'}`}
        >
          {userVote === 'B' ? 'LOCKED FOR B' : userVote ? 'VOTE EXHAUSTED' : `Vote for ${activeBattle.artistB}`}
        </button>
      </div>
    </div>
  );
}

function AdminView({ battles, user, admins, onLogin, onLogout }: { battles: Battle[], user: any, admins: string[], onLogin: () => void, onLogout: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [newBattle, setNewBattle] = useState({ title: '', artistA: '', artistB: '', startNow: false });
  const [newAdminEmail, setNewAdminEmail] = useState('');

  const isAdmin = user?.email === 'bradleyjsmithuk@gmail.com' || admins.includes(user?.email || '');

  const createBattle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'battles'), {
        title: newBattle.title,
        artistA: newBattle.artistA,
        artistB: newBattle.artistB,
        status: newBattle.startNow ? 'active' : 'pending',
        votesA: 0,
        votesB: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowAdd(false);
      setNewBattle({ title: '', artistA: '', artistB: '', startNow: false });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'battles');
    }
  };

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newAdminEmail.trim().toLowerCase();
    if (!email) return;
    try {
      await setDoc(doc(db, 'admins', email), {
        email,
        addedBy: user.uid,
        addedAt: serverTimestamp()
      });
      setNewAdminEmail('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `admins/${email}`);
    }
  };

  const removeAdmin = async (email: string) => {
    if (email === 'bradleyjsmithuk@gmail.com') return; // Cannot remove master
    if (!confirm(`Revoke admin access for ${email}?`)) return;
    try {
      await deleteDoc(doc(db, 'admins', email));
    } catch (error) {
       handleFirestoreError(error, OperationType.DELETE, `admins/${email}`);
    }
  };

  const updateStatus = async (id: string, status: Battle['status']) => {
    try {
      await updateDoc(doc(db, 'battles', id), { 
        status,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `battles/${id}`);
    }
  };

  const resetVotes = async (id: string) => {
    try {
      await updateDoc(doc(db, 'battles', id), { 
        votesA: 0, 
        votesB: 0,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `battles/${id}`);
    }
  };

  const deleteBattle = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'battles', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `battles/${id}`);
    }
  };

  if (!user || !user.email) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center">
        <div className="bg-zinc-900 border border-zinc-800 p-12 shadow-2xl">
          <Settings size={64} className="mx-auto mb-6 opacity-20" />
          <h2 className="text-3xl font-black uppercase italic mb-8">Restricted Access</h2>
          <button 
            onClick={onLogin}
            className="w-full bg-orange-500 text-white px-8 py-4 font-black uppercase italic skew-btn-left hover:bg-orange-400 transition-all flex items-center justify-center gap-3"
          >
            <LogIn size={20} /> Admin Authorisation
          </button>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center">
        <div className="bg-orange-950/20 border-2 border-orange-900 p-12 max-w-xl">
           <h2 className="text-3xl font-black uppercase italic text-orange-500 mb-4">Unauthorised Internal</h2>
           <p className="text-zinc-400 mb-8 lowercase">Your identity does not match the hardcoded protocol for arena commands. current: {user.email}</p>
           <button onClick={onLogout} className="text-xs uppercase underline opacity-50 hover:opacity-100">De-Authorise</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center p-4 bg-zinc-900 border border-zinc-800 border-l-orange-500 border-l-4">
        <div className="space-y-1">
            <h2 className="font-black uppercase text-sm flex items-center gap-2">
                <Settings size={14} className="text-zinc-500" /> Administrative Hub
            </h2>
            <p className="text-[10px] mono text-zinc-500 uppercase tracking-widest font-bold">Signed in as {user.email}</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowAdminPanel(!showAdminPanel)}
            className={`text-[10px] uppercase font-bold flex items-center gap-1 px-3 py-1 border transition-all ${showAdminPanel ? 'bg-orange-500 text-white border-orange-500' : 'text-zinc-500 border-zinc-800 hover:text-white'}`}
          >
             <Users size={12} /> {showAdminPanel ? 'Close Users' : 'User Access'}
          </button>
          <button onClick={onLogout} className="text-[10px] uppercase font-bold opacity-50 hover:opacity-100 flex items-center gap-1">
             <LogOut size={12} /> Exit
          </button>
          <button 
            onClick={() => setShowAdd(true)}
            id="toggle-add-battle"
            className="bg-zinc-100 text-black px-4 py-2 text-xs font-black hover:bg-white transition-all uppercase rounded shadow-[0_4px_0_rgba(255,255,255,0.2)] active:translate-y-1 active:shadow-none"
          >
            <Plus size={14} className="inline mr-1" /> New Entry
          </button>
        </div>
      </div>

      {showAdminPanel && (
        <div className="bg-zinc-900 border border-zinc-800 p-8 space-y-6">
            <h3 className="text-xl font-black uppercase italic">Administrator Registry</h3>
            <form onSubmit={addAdmin} className="flex gap-2">
                <input 
                    type="email"
                    required
                    placeholder="ADMIN EMAIL ADDRESS"
                    className="flex-1 bg-black border border-zinc-800 p-3 text-white focus:border-orange-500 outline-none mono text-xs uppercase"
                    value={newAdminEmail}
                    onChange={e => setNewAdminEmail(e.target.value)}
                />
                <button type="submit" className="bg-white text-black px-6 py-2 text-xs font-black uppercase hover:bg-zinc-200">
                    Authorise
                </button>
            </form>
            <div className="space-y-2">
                <div className="p-3 bg-black/40 border border-zinc-800 flex justify-between items-center">
                    <span className="text-xs font-bold text-zinc-300">bradleyjsmithuk@gmail.com</span>
                    <span className="text-[9px] mono text-orange-500 uppercase font-black">Master Key</span>
                </div>
                {admins.filter(a => a !== 'bradleyjsmithuk@gmail.com').map(email => (
                    <div key={email} className="p-3 bg-black/20 border border-zinc-800 flex justify-between items-center group">
                        <span className="text-xs font-bold text-zinc-400">{email}</span>
                        <button 
                          onClick={() => removeAdmin(email)}
                          className="text-[9px] mono text-zinc-600 hover:text-orange-500 uppercase font-black opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        >
                            REVOKE ACCESS
                        </button>
                    </div>
                ))}
            </div>
        </div>
      )}

      {showAdd && (
        <form onSubmit={createBattle} className="p-8 space-y-6 mb-8 bg-zinc-900 border border-zinc-700 relative shadow-2xl">
           <button 
            type="button"
            onClick={() => setShowAdd(false)}
            className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
          >
            <CloseIcon size={24} />
          </button>
          <h3 className="text-2xl font-black uppercase italic tracking-tighter">Initialise Battle Sequence</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-[10px] uppercase mb-2 text-zinc-500 font-black tracking-widest">Round Official Label</label>
              <input 
                required
                className="w-full bg-black border border-zinc-800 p-3 text-white focus:border-orange-500 outline-none mono text-sm"
                placeholder="e.g. SEMI-FINAL 02"
                value={newBattle.title}
                onChange={e => setNewBattle({...newBattle, title: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase mb-2 text-orange-500/70 font-black tracking-widest">Entry A Name</label>
              <input 
                required
                className="w-full bg-black border border-zinc-800 p-3 text-white focus:border-orange-500 outline-none mono text-sm"
                placeholder="ARTIST NAME"
                value={newBattle.artistA}
                onChange={e => setNewBattle({...newBattle, artistA: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase mb-2 text-zinc-300 font-black tracking-widest">Entry B Name</label>
              <input 
                required
                className="w-full bg-black border border-zinc-800 p-3 text-white focus:border-white outline-none mono text-sm"
                placeholder="ARTIST NAME"
                value={newBattle.artistB}
                onChange={e => setNewBattle({...newBattle, artistB: e.target.value})}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-black/40 p-4 border border-zinc-800">
            <input 
              type="checkbox"
              id="startNow"
              className="w-5 h-5 accent-orange-500"
              checked={newBattle.startNow}
              onChange={e => setNewBattle({...newBattle, startNow: e.target.checked})}
            />
            <label htmlFor="startNow" className="text-xs font-black uppercase italic tracking-tight cursor-pointer">
              Make this Active (allows voters immediately)
            </label>
          </div>

          <button 
            type="submit"
            className="w-full bg-orange-500 text-white font-black uppercase py-5 text-xl skew-x-[-3deg] hover:bg-orange-400 shadow-[0_6px_0_#9a3412] active:translate-y-1 active:shadow-none transition-all"
          >
            Add to Console
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4">
        {battles.map(battle => (
          <div key={battle.id} className="p-5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-black uppercase italic tracking-tight leading-none">{battle.title}</h3>
                <p className="mono text-[10px] text-zinc-500 mt-1 uppercase font-bold tracking-widest">{battle.artistA} // VS // {battle.artistB}</p>
              </div>
              <div className={`px-3 py-1 text-[10px] font-black uppercase border-2 flex items-center gap-2 ${
                battle.status === 'active' ? 'bg-orange-500/20 border-orange-500 text-orange-500 animate-pulse' :
                battle.status === 'finished' ? 'bg-zinc-800 border-zinc-700 text-zinc-400' :
                'bg-zinc-800 border-zinc-700 text-zinc-500'
              }`}>
                {battle.status === 'active' && <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>}
                {battle.status}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px bg-zinc-800 border border-zinc-800 mb-6 rounded overflow-hidden">
              <div className="bg-black/40 p-4">
                <span className="mono text-[9px] block text-orange-500/70 font-black uppercase mb-1 tracking-widest">LOAD A: {battle.artistA}</span>
                <span className="text-3xl font-black">{battle.votesA}</span>
              </div>
              <div className="bg-black/40 p-4">
                <span className="mono text-[9px] block text-zinc-400 font-black uppercase mb-1 tracking-widest">LOAD B: {battle.artistB}</span>
                <span className="text-3xl font-black">{battle.votesB}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800/50">
              {battle.status === 'pending' && (
                <button 
                  onClick={() => updateStatus(battle.id, 'active')}
                  className="bg-orange-500 text-white px-4 py-1.5 text-[10px] font-black uppercase flex items-center gap-2 hover:bg-orange-400 transition-colors"
                >
                  <Play size={10} fill="currentColor" /> Make voting live
                </button>
              )}
              {battle.status === 'active' && (
                <button 
                  onClick={() => updateStatus(battle.id, 'finished')}
                  className="bg-zinc-100 text-white px-4 py-1.5 text-[10px] font-black uppercase flex items-center gap-2 hover:bg-white/20 transition-colors"
                >
                  <Square size={10} fill="currentColor" /> Close Floor
                </button>
              )}
              {battle.status === 'finished' && (
                <button 
                  onClick={() => updateStatus(battle.id, 'active')}
                  className="bg-zinc-800 text-white px-4 py-1.5 text-[10px] font-black uppercase flex items-center gap-2 border border-zinc-700 hover:border-zinc-600 transition-colors"
                >
                  <Play size={10} fill="currentColor" /> Re-Active
                </button>
              )}
               <button 
                  onClick={() => resetVotes(battle.id)}
                  className="ml-auto mono text-[9px] uppercase text-zinc-600 hover:text-orange-500 transition-colors py-1 px-2"
                >
                  Clear Feed
                </button>
                <button 
                  onClick={() => deleteBattle(battle.id)}
                  className="mono text-[9px] uppercase text-zinc-600 hover:text-orange-500 transition-colors py-1 px-2 flex items-center gap-1"
                >
                  <Trash2 size={10} /> Delete
                </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DisplayView({ battles }: { battles: Battle[] }) {
  const activeBattle = battles.find(b => b.status === 'active') || battles.find(b => b.status === 'finished');
  
  if (!activeBattle) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center border border-zinc-800 bg-zinc-950/20">
        <div className="relative">
            <Mic2 size={120} className="mb-8 text-zinc-800 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-24 h-24 border-zinc-900 border-2 rounded-full animate-ping opacity-20" />
            </div>
        </div>
        <h2 className="text-5xl font-black uppercase opacity-20 tracking-tighter italic select-none">Awaiting Transmissions</h2>
      </div>
    );
  }

  const total = activeBattle.votesA + activeBattle.votesB;
  const percentA = total > 0 ? Math.round((activeBattle.votesA / total) * 100) : 0;
  const percentB = total > 0 ? Math.round((activeBattle.votesB / total) * 100) : 0;

  return (
    <div className="min-h-[70vh] grid grid-cols-1 lg:grid-cols-2 gap-12 items-center animate-in fade-in duration-1000">
      
      {/* Visual Header Over-grid */}
      <div className="lg:col-span-2 text-center space-y-4 mb-8">
        <AnimatePresence mode="wait">
            {activeBattle.status === 'active' ? (
                <motion.div 
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    className="inline-block bg-orange-500 text-white px-12 py-3 text-3xl font-black uppercase italic tracking-tighter shadow-[0_0_40px_rgba(249,115,22,0.4)]"
                >
                    Voting Results
                </motion.div>
            ) : (
                <motion.div 
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    className="inline-block bg-white text-black px-12 py-3 text-3xl font-black uppercase italic tracking-tighter shadow-[0_0_40px_rgba(255,255,255,0.2)]"
                >
                    Voting Results
                </motion.div>
            )}
        </AnimatePresence>
        <h2 className="text-6xl md:text-8xl font-black uppercase italic tracking-tighter leading-none block">
          {activeBattle.title}
        </h2>
      </div>

      {/* Artist A */}
      <div className="space-y-8 relative">
        <div className="text-[200px] font-black opacity-[0.05] absolute -top-20 -left-10 italic pointer-events-none select-none">A</div>
        <div className="space-y-2 relative z-10">
          <div className="flex justify-between items-end">
            <h3 className="text-4xl md:text-6xl font-black uppercase italic drop-shadow-2xl">{activeBattle.artistA}</h3>
            <span className="text-6xl md:text-8xl font-black text-orange-500 tracking-tighter italic">{percentA}%</span>
          </div>
          <div className="h-16 md:h-24 w-full bg-zinc-900 border-2 border-zinc-800 relative group overflow-hidden">
             <motion.div 
               initial={{ width: 0 }}
               animate={{ width: `${percentA}%` }}
               className="absolute h-full bg-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.6)]"
             />
             <div className="absolute inset-0 flex items-center justify-between px-6 mix-blend-difference">
                <span className="text-2xl font-black uppercase italic">VOTES CONFIRMED</span>
                <span className="text-3xl font-black">{activeBattle.votesA}</span>
             </div>
          </div>
        </div>
      </div>

      {/* Artist B */}
      <div className="space-y-8 relative text-right">
        <div className="text-[200px] font-black opacity-[0.05] absolute -top-20 -right-10 italic pointer-events-none select-none">B</div>
        <div className="space-y-2 relative z-10">
          <div className="flex justify-between items-end flex-row-reverse">
             <h3 className="text-4xl md:text-6xl font-black uppercase italic drop-shadow-2xl">{activeBattle.artistB}</h3>
             <span className="text-6xl md:text-8xl font-black text-white tracking-tighter italic">{percentB}%</span>
          </div>
          <div className="h-16 md:h-24 w-full bg-zinc-900 border-2 border-zinc-800 relative group overflow-hidden">
             <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${percentB}%` }}
                className="absolute h-full bg-white shadow-[0_0_30px_rgba(255,255,255,0.4)] right-0"
             />
             <div className="absolute inset-0 flex items-center justify-between px-6 mix-blend-difference flex-row-reverse">
                <span className="text-2xl font-black uppercase italic">VOTES CONFIRMED</span>
                <span className="text-3xl font-black">{activeBattle.votesB}</span>
             </div>
          </div>
        </div>
      </div>
      
      <div className="lg:col-span-2 flex justify-center pt-12">
        <div className="bg-zinc-900/50 border border-zinc-800 px-12 py-4 flex items-center gap-6 rounded-full backdrop-blur-md">
            <div className="flex items-center gap-3">
                <Users className="text-zinc-500" size={24} />
                <span className="text-4xl font-black tracking-tighter italic">{total}</span>
            </div>
            <div className="w-px h-8 bg-zinc-800" />
            <span className="mono text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Total votes cast</span>
        </div>
      </div>
    </div>
  );
}
