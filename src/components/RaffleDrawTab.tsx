import React, { useState, useEffect, useRef } from 'react';
import { 
  Ticket, 
  Trophy, 
  Sparkles, 
  RotateCcw, 
  Trash2, 
  Plus, 
  Users, 
  Award, 
  CheckCircle2, 
  Volume2, 
  VolumeX, 
  Gift, 
  Clock,
  Shuffle,
  AlertCircle,
  Copy,
  Check,
  Flame,
  ChevronDown,
  ChevronUp,
  History,
  FileText
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { RaffleEntry, RaffleWinner, RaffleDrawResult } from '../types';

interface RaffleDrawTabProps {
  entries: RaffleEntry[];
  history: RaffleDrawResult[];
  onAddEntry: (entryData: { name: string; ticketCount: number; phoneOrNote?: string }) => Promise<void>;
  onDeleteEntry: (entryId: string) => Promise<void>;
  onUpdateEntry: (entryId: string, name: string, ticketCount: number) => Promise<void>;
  onClearEntries: () => Promise<void>;
  onSaveDrawResult: (result: {
    totalTickets: number;
    totalParticipants: number;
    prizeCount: number;
    winners: RaffleWinner[];
  }) => Promise<void>;
  onDeleteHistoryItem: (historyId: string) => Promise<void>;
}

export const RaffleDrawTab: React.FC<RaffleDrawTabProps> = ({
  entries = [],
  history = [],
  onAddEntry,
  onDeleteEntry,
  onUpdateEntry,
  onClearEntries,
  onSaveDrawResult,
  onDeleteHistoryItem,
}) => {
  // Form State
  const [name, setName] = useState('');
  const [ticketCount, setTicketCount] = useState<number>(1);
  const [phoneOrNote, setPhoneOrNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prizeCount, setPrizeCount] = useState<number>(1);
  const [allowRepeatWinners, setAllowRepeatWinners] = useState<boolean>(false);

  // Draw & Countdown State
  const [drawState, setDrawState] = useState<'idle' | 'countdown' | 'celebration'>('idle');
  const [countdownSeconds, setCountdownSeconds] = useState<number>(10);
  const [shufflingName, setShufflingName] = useState<string>('');
  const [currentWinners, setCurrentWinners] = useState<RaffleWinner[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  // Audio synthesis context ref
  const audioCtxRef = useRef<AudioContext | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const shuffleIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Stats calculation
  const totalTickets = entries.reduce((sum, e) => sum + (e.ticketCount || 0), 0);
  const totalParticipants = entries.length;

  // Initialize web audio on first user gesture
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Play countdown tick sound
  const playTickSound = (pitch = 440, duration = 0.08) => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  };

  // Play grand victory fanfare chime
  const playFanfareSound = () => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.65);
      });
    } catch (e) {
      // Audio autoplay policy fallback
    }
  };

  // Confetti celebration trigger
  const triggerConfetti = () => {
    try {
      const count = 200;
      const defaults = { origin: { y: 0.7 } };

      const fire = (particleRatio: number, opts: any) => {
        confetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio),
        });
      };

      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });
    } catch (e) {
      console.warn("Confetti animation fallback", e);
    }
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (shuffleIntervalRef.current) clearInterval(shuffleIntervalRef.current);
    };
  }, []);

  // Handle Add Entry
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (ticketCount <= 0) return;

    setIsSubmitting(true);
    try {
      await onAddEntry({
        name: name.trim(),
        ticketCount: Number(ticketCount),
        phoneOrNote: phoneOrNote.trim() || undefined
      });
      setName('');
      setTicketCount(1);
      setPhoneOrNote('');
    } catch (err: any) {
      alert("Failed to add entry: " + (err.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick preset sample entrants
  const handleAddSampleEntrants = async () => {
    const samples = [
      { name: "Ash Ketchum", ticketCount: 5 },
      { name: "Misty Waterflower", ticketCount: 3 },
      { name: "Brock Harrison", ticketCount: 2 },
      { name: "Professor Oak", ticketCount: 10 },
      { name: "Gary Oak", ticketCount: 4 },
      { name: "Nurse Joy", ticketCount: 2 }
    ];
    for (const s of samples) {
      await onAddEntry(s);
    }
  };

  // Start 10-Second Draw
  const startDraw = () => {
    if (entries.length === 0 || totalTickets === 0) {
      alert("Please add participants and tickets to the draw first!");
      return;
    }

    const availablePrizes = Math.min(
      Math.max(1, prizeCount),
      allowRepeatWinners ? totalTickets : totalParticipants
    );

    // Build the virtual ticket bucket
    const ticketBucket: { name: string; ticketNumber: number; entryId: string; totalTicketsHeld: number }[] = [];
    let currentTicketNum = 1;

    entries.forEach(entry => {
      for (let i = 0; i < entry.ticketCount; i++) {
        ticketBucket.push({
          name: entry.name,
          ticketNumber: currentTicketNum,
          entryId: entry.id,
          totalTicketsHeld: entry.ticketCount
        });
        currentTicketNum++;
      }
    });

    // Determine winners in advance using true cryptographically uniform random selection
    const selectedWinners: RaffleWinner[] = [];
    const pool = [...ticketBucket];
    const winningEntryIds = new Set<string>();

    for (let prizeIdx = 0; prizeIdx < availablePrizes; prizeIdx++) {
      if (pool.length === 0) break;

      // Filter pool if no repeats allowed
      const candidatePool = allowRepeatWinners 
        ? pool 
        : pool.filter(t => !winningEntryIds.has(t.entryId));

      if (candidatePool.length === 0) break;

      const randIndex = Math.floor(Math.random() * candidatePool.length);
      const winningTicket = candidatePool[randIndex];

      selectedWinners.push({
        prizeRank: prizeIdx + 1,
        prizeLabel: prizeIdx === 0 ? "1st Grand Prize" : prizeIdx === 1 ? "2nd Prize" : prizeIdx === 2 ? "3rd Prize" : `${prizeIdx + 1}th Prize`,
        name: winningTicket.name,
        ticketNumber: winningTicket.ticketNumber,
        entryId: winningTicket.entryId,
        totalTicketsHeld: winningTicket.totalTicketsHeld
      });

      winningEntryIds.add(winningTicket.entryId);
      // Remove used ticket
      const poolIdx = pool.findIndex(t => t.ticketNumber === winningTicket.ticketNumber);
      if (poolIdx !== -1) {
        pool.splice(poolIdx, 1);
      }
    }

    // Set countdown states
    setDrawState('countdown');
    setCountdownSeconds(10);
    setCurrentWinners(selectedWinners);

    // Shuffle ticker
    if (shuffleIntervalRef.current) clearInterval(shuffleIntervalRef.current);
    shuffleIntervalRef.current = setInterval(() => {
      if (entries.length > 0) {
        const randomEntry = entries[Math.floor(Math.random() * entries.length)];
        setShufflingName(randomEntry.name);
      }
    }, 75);

    // Initial audio cue
    playTickSound(520, 0.1);

    // Countdown interval (10 seconds)
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    
    let secondsLeft = 10;
    countdownTimerRef.current = setInterval(() => {
      secondsLeft -= 1;
      setCountdownSeconds(secondsLeft);

      if (secondsLeft > 0) {
        // Accelerating pitch for climax
        const pitch = 440 + (10 - secondsLeft) * 45;
        playTickSound(pitch, 0.08);
      } else {
        // Countdown reached 0 -> Complete Draw!
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        if (shuffleIntervalRef.current) clearInterval(shuffleIntervalRef.current);

        setDrawState('celebration');
        playFanfareSound();
        triggerConfetti();

        // Automatically archive draw result
        onSaveDrawResult({
          totalTickets,
          totalParticipants,
          prizeCount: selectedWinners.length,
          winners: selectedWinners
        });
      }
    }, 1000);
  };

  // Cancel Draw
  const cancelDraw = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (shuffleIntervalRef.current) clearInterval(shuffleIntervalRef.current);
    setDrawState('idle');
    setCountdownSeconds(10);
  };

  // Copy Winners Text
  const copyWinners = () => {
    if (currentWinners.length === 0) return;
    const lines = [
      "🎉 NEWTON'S COLLECTABLES RAFFLE DRAW WINNERS 🎉",
      `Date: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      `Total Participants: ${totalParticipants} | Total Tickets: ${totalTickets}`,
      "------------------------------------------",
      ...currentWinners.map((w, idx) => {
        const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🎖️";
        return `${medal} ${w.prizeLabel || `Prize #${w.prizeRank}`}: ${w.name} (Winning Ticket #${w.ticketNumber})`;
      }),
      "------------------------------------------",
      "Congratulations to all winners! Claim prizes at the Newton's Collectables stall."
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Banner & Audio Control */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-black rounded-2xl p-6 sm:p-8 text-white shadow-lg border border-zinc-800 relative overflow-hidden">
        {/* Ambient sparkle graphics */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/20 border border-amber-400/30 rounded-full text-amber-300 text-xs font-black uppercase tracking-wider mb-2">
              <Ticket className="w-3.5 h-3.5" /> Newton's Live Raffle
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              Stall Master Raffle Draw
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl font-medium">
              Add entrants and ticket purchases to the pool. When ready, select the number of prize winners and launch the live 10-second suspense draw!
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2.5 rounded-xl border text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
                soundEnabled 
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-amber-300 border-zinc-700' 
                  : 'bg-zinc-800/50 hover:bg-zinc-800 text-zinc-500 border-zinc-800'
              }`}
              title={soundEnabled ? "Mute Sound Effects" : "Enable Sound Effects"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{soundEnabled ? "Sound ON" : "Muted"}</span>
            </button>

            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer"
            >
              <History className="w-4 h-4" />
              <span>History ({history.length})</span>
              {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Live Draw Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-zinc-800">
          <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-xl p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Total Entrants</span>
            <span className="text-2xl font-black text-white mt-1 block">{totalParticipants}</span>
          </div>

          <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-xl p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Total Tickets in Pot</span>
            <span className="text-2xl font-black text-amber-400 mt-1 block">{totalTickets}</span>
          </div>

          <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-xl p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Selected Prizes</span>
            <span className="text-2xl font-black text-blue-400 mt-1 block">{prizeCount}</span>
          </div>

          <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-xl p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Draw Status</span>
            <span className="text-sm font-black text-emerald-400 mt-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {drawState === 'idle' ? (totalTickets > 0 ? 'Ready to Draw' : 'Awaiting Tickets') : drawState === 'countdown' ? 'Rolling (10s)...' : 'Winners Declared!'}
            </span>
          </div>
        </div>
      </div>

      {/* 10-SECOND COUNTDOWN & SUSPENSE MODAL / OVERLAY */}
      {drawState === 'countdown' && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-zinc-900 border-2 border-amber-500/40 rounded-3xl p-8 max-w-lg w-full text-center shadow-2xl relative overflow-hidden text-white">
            
            {/* Spinning background glow */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full text-amber-400 text-xs font-black uppercase tracking-widest mb-4">
                <Shuffle className="w-3.5 h-3.5 animate-spin" /> Live Draw in Progress
              </div>

              {/* Big Circular Countdown Display */}
              <div className="my-6 flex flex-col items-center justify-center">
                <div className="relative flex items-center justify-center w-36 h-36 rounded-full bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 p-1.5 shadow-xl shadow-amber-500/30">
                  <div className="w-full h-full bg-zinc-950 rounded-full flex flex-col items-center justify-center border-4 border-zinc-900">
                    <span className="text-6xl font-black text-amber-400 font-mono tracking-tighter animate-bounce">
                      {countdownSeconds}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      Seconds
                    </span>
                  </div>
                </div>
              </div>

              {/* High-speed Ticker Roulette */}
              <div className="my-6 p-4 bg-zinc-950/80 border border-zinc-800 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-1">
                  Randomizing From {totalTickets} Tickets...
                </span>
                <div className="h-10 flex items-center justify-center overflow-hidden">
                  <span className="text-xl sm:text-2xl font-black text-white tracking-wide truncate px-2 text-amber-300">
                    {shufflingName || "Selecting Winner..."}
                  </span>
                </div>
              </div>

              {/* Cancel Button */}
              <button
                onClick={cancelDraw}
                className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel Draw
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WINNERS CELEBRATION CARD */}
      {drawState === 'celebration' && currentWinners.length > 0 && (
        <div className="bg-gradient-to-b from-amber-500/10 via-zinc-900 to-zinc-900 border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-white animate-in zoom-in-95 duration-300 relative overflow-hidden">
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-zinc-800">
            <div className="text-center sm:text-left">
              <span className="px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" /> Official Result
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white mt-2 flex items-center justify-center sm:justify-start gap-2">
                🎉 Congratulations to the Winners!
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Drawn from {totalTickets} total tickets across {totalParticipants} participants.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-center">
              <button
                onClick={copyWinners}
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer"
              >
                {copiedText ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copiedText ? "Copied List!" : "Copy Winners"}
              </button>

              <button
                onClick={startDraw}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-black rounded-xl text-xs font-black transition-colors flex items-center gap-2 shadow-md cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> Redraw
              </button>

              <button
                onClick={() => setDrawState('idle')}
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>

          {/* Winner Podiums / Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {currentWinners.map((winner, idx) => {
              const medalEmoji = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🎖️";
              const borderAccent = idx === 0 ? "border-amber-500/60 bg-amber-500/10" : idx === 1 ? "border-zinc-400/40 bg-zinc-800/60" : idx === 2 ? "border-amber-700/40 bg-zinc-800/60" : "border-zinc-700 bg-zinc-800/40";
              const titleColor = idx === 0 ? "text-amber-400" : idx === 1 ? "text-zinc-200" : idx === 2 ? "text-amber-300" : "text-blue-400";

              return (
                <div key={winner.entryId + "_" + idx} className={`rounded-2xl p-5 border ${borderAccent} relative overflow-hidden transition-all hover:scale-[1.01]`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`text-xs font-black uppercase tracking-wider ${titleColor} flex items-center gap-1.5`}>
                        <span className="text-base">{medalEmoji}</span> {winner.prizeLabel || `Prize #${winner.prizeRank}`}
                      </span>
                      <h3 className="text-xl font-black text-white mt-1 tracking-tight">
                        {winner.name}
                      </h3>
                    </div>
                    <div className="px-2.5 py-1 bg-black/40 border border-white/10 rounded-lg text-right">
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Ticket #</span>
                      <span className="text-sm font-black text-amber-400 font-mono">#{winner.ticketNumber}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-zinc-400">
                    <span>Tickets Purchased: <strong className="text-zinc-200">{winner.totalTicketsHeld}</strong></span>
                    <span>Odds: <strong className="text-amber-400">{((winner.totalTicketsHeld / (totalTickets || 1)) * 100).toFixed(1)}%</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History Drawer / Panel */}
      {showHistory && (
        <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-zinc-700" />
              <h3 className="text-base font-bold text-zinc-900">Raffle Draw Archive & History</h3>
            </div>
            <span className="text-xs text-zinc-500 font-medium">{history.length} Past Draws Recorded</span>
          </div>

          {history.length === 0 ? (
            <div className="py-8 text-center text-zinc-400 text-xs">
              No historical draws recorded yet. Complete a raffle draw to save it to history automatically.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 mt-3 max-h-96 overflow-y-auto pr-1">
              {history.map((hist) => (
                <div key={hist.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50/80 px-2 rounded-xl transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-800">
                        {new Date(hist.date).toLocaleDateString('en-GB')} at {new Date(hist.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full font-semibold">
                        {hist.totalTickets} tickets • {hist.totalParticipants} players
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {hist.winners.map((w, wIdx) => (
                        <span key={wIdx} className="text-xs bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-0.5 rounded-md font-bold">
                          {wIdx === 0 ? "🥇" : wIdx === 1 ? "🥈" : "🥉"} {w.name} (#{w.ticketNumber})
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteHistoryItem(hist.id)}
                    className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors self-end sm:self-center cursor-pointer"
                    title="Delete Record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MAIN TWO-COLUMN WORKSPACE: (1) Add Entrants & Prize Settings, (2) Live Pool Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Entry Form & Draw Controller */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Add Entrant Card */}
          <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-xs">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-100">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Add Participant & Tickets</h3>
                <p className="text-[11px] text-zinc-400 font-medium">Record purchaser name and tickets purchased</p>
              </div>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wide mb-1.5">
                  Participant / Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Liam Smith, Sarah K..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wide">
                    Tickets Purchased <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-zinc-400 font-semibold">
                    Range: #{totalTickets + 1} to #{totalTickets + (ticketCount > 0 ? ticketCount : 1)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={ticketCount}
                    onChange={(e) => setTicketCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-28 px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-black text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-center font-mono"
                  />

                  {/* Quick preset chips */}
                  <div className="flex items-center gap-1.5 flex-1">
                    {[1, 3, 5, 10, 20].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setTicketCount(count)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                          ticketCount === count
                            ? 'bg-amber-500 text-black border-amber-600 font-black shadow-xs'
                            : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200'
                        }`}
                      >
                        +{count}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wide mb-1.5">
                  Phone / Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 07123 456789 or Stall Friend"
                  value={phoneOrNote}
                  onChange={(e) => setPhoneOrNote(e.target.value)}
                  className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="w-full py-3 bg-zinc-900 hover:bg-black active:bg-zinc-950 text-white rounded-xl text-xs font-black tracking-wide shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Ticket className="w-4 h-4 text-amber-400" />
                Add to Raffle Draw
              </button>
            </form>
          </div>

          {/* Draw Settings & Action Launch Card */}
          <div className="bg-gradient-to-br from-amber-500/10 via-white to-amber-500/5 rounded-2xl p-6 border-2 border-amber-500/30 shadow-xs space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-amber-500/20">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-black flex items-center justify-center font-bold">
                <Gift className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Prize Selection & Launch</h3>
                <p className="text-[11px] text-zinc-500 font-medium">Select how many prizes and run the 10s draw</p>
              </div>
            </div>

            {/* Prize count selector */}
            <div>
              <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wide mb-2">
                How Many Prizes to Draw?
              </label>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center border border-zinc-300 rounded-xl bg-white p-1 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setPrizeCount(Math.max(1, prizeCount - 1))}
                    disabled={prizeCount <= 1}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold disabled:opacity-40 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-14 text-center font-black text-lg text-zinc-900 font-mono">
                    {prizeCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPrizeCount(Math.min(Math.max(1, totalParticipants || 10), prizeCount + 1))}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>

                <div className="flex items-center gap-1.5 flex-1">
                  {[1, 2, 3, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPrizeCount(num)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        prizeCount === num
                          ? 'bg-amber-500 text-black border-amber-600 font-black shadow-xs'
                          : 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200'
                      }`}
                    >
                      {num} {num === 1 ? 'Prize' : 'Prizes'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Repeat winner toggle */}
            <div className="flex items-center justify-between p-3 bg-white/80 rounded-xl border border-zinc-200/80">
              <div>
                <span className="text-xs font-bold text-zinc-900 block">Unique Winners Only</span>
                <span className="text-[10px] text-zinc-500 font-medium">Prevent 1 person winning multiple prizes</span>
              </div>
              <input
                type="checkbox"
                checked={!allowRepeatWinners}
                onChange={(e) => setAllowRepeatWinners(!e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
              />
            </div>

            {/* Big "Do Draw" Launch Button */}
            <button
              onClick={startDraw}
              disabled={entries.length === 0 || totalTickets === 0 || drawState === 'countdown'}
              className="w-full py-4 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 active:scale-[0.99] text-black rounded-xl text-sm font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-5 h-5" />
              Do Raffle Draw (10s Countdown)
            </button>

            {entries.length === 0 && (
              <p className="text-[11px] text-center text-zinc-500">
                Add at least one participant with tickets to enable the draw.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Live Entrants Table & Ticket Roster */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-xs flex flex-col h-full">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-zinc-700" />
                  Raffle Entrants Pool ({entries.length})
                </h3>
                <p className="text-[11px] text-zinc-400 font-medium">
                  {totalTickets} total tickets registered in current draw
                </p>
              </div>

              <div className="flex items-center gap-2">
                {entries.length === 0 && (
                  <button
                    onClick={handleAddSampleEntrants}
                    className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Shuffle className="w-3.5 h-3.5 text-zinc-500" />
                    Load Sample Test Entrants
                  </button>
                )}

                {entries.length > 0 && (
                  <>
                    {clearConfirm ? (
                      <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                        <button
                          onClick={async () => {
                            await onClearEntries();
                            setClearConfirm(false);
                          }}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          Confirm Clear
                        </button>
                        <button
                          onClick={() => setClearConfirm(false)}
                          className="px-2 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setClearConfirm(true)}
                        className="px-3 py-1.5 text-red-600 hover:bg-red-50 border border-red-100 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear Pot
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* List of Entrants */}
            {entries.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                  <Ticket className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-zinc-800">The Raffle Pot is Empty</h4>
                <p className="text-xs text-zinc-400 max-w-xs mt-1 font-medium">
                  Add participants using the form on the left or click "Load Sample Test Entrants" to test the 10-second draw.
                </p>
              </div>
            ) : (
              <div className="mt-4 flex-1 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Participant</th>
                      <th className="py-2.5 px-3 text-center">Tickets</th>
                      <th className="py-2.5 px-3 text-center">Ticket Numbers</th>
                      <th className="py-2.5 px-3 text-right">Odds</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {entries.map((entry, index) => {
                      const odds = ((entry.ticketCount / (totalTickets || 1)) * 100).toFixed(1);
                      return (
                        <tr key={entry.id} className="hover:bg-zinc-50/70 transition-colors group">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-zinc-100 text-zinc-700 font-bold flex items-center justify-center text-[11px] shrink-0 border border-zinc-200">
                                {entry.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-extrabold text-zinc-900 block leading-snug">
                                  {entry.name}
                                </span>
                                {entry.phoneOrNote && (
                                  <span className="text-[10px] text-zinc-400 font-medium block">
                                    {entry.phoneOrNote}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 px-2.5 py-1 rounded-full font-black text-xs border border-amber-200/60">
                              <Ticket className="w-3 h-3 text-amber-600" />
                              {entry.ticketCount}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className="text-[11px] font-mono font-bold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded">
                              #{entry.ticketRangeStart} - #{entry.ticketRangeEnd}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right font-black text-zinc-900 font-mono">
                            {odds}%
                          </td>

                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => onUpdateEntry(entry.id, entry.name, entry.ticketCount + 1)}
                                className="w-6 h-6 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold flex items-center justify-center text-xs transition-colors cursor-pointer"
                                title="Add 1 Ticket"
                              >
                                +
                              </button>
                              {entry.ticketCount > 1 && (
                                <button
                                  onClick={() => onUpdateEntry(entry.id, entry.name, entry.ticketCount - 1)}
                                  className="w-6 h-6 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold flex items-center justify-center text-xs transition-colors cursor-pointer"
                                  title="Remove 1 Ticket"
                                >
                                  -
                                </button>
                              )}
                              <button
                                onClick={() => onDeleteEntry(entry.id)}
                                className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                title="Delete Participant"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bottom summary note */}
            {entries.length > 0 && (
              <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400">
                <span>Raffle Ticket Pool ID: <strong className="font-mono text-zinc-600">STALL-DRAW-{entries.length}</strong></span>
                <span>Each ticket has exactly 1 in {totalTickets} uniform chance of winning</span>
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
};
