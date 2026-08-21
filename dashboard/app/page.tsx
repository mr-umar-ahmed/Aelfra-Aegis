"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  ArrowRight,
  ArrowLeft,
  Search,
  Terminal,
  Zap,
  Flame,
  User,
  CheckCircle2,
  AlertTriangle,
  Play,
  Cpu,
  Layers,
  ChevronRight,
} from "lucide-react";

export default function OnboardingLanding() {
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const [agentName, setAgentName] = useState("");
  const [savedCallsign, setSavedCallsign] = useState("Agent Umar");

  useEffect(() => {
    const stored = localStorage.getItem("aegis_agent_name");
    if (stored) {
      setSavedCallsign(stored);
      setAgentName(stored);
    }
  }, []);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (agentName.trim()) {
      const name = agentName.trim().startsWith("Agent") ? agentName.trim() : `Agent ${agentName.trim()}`;
      setSavedCallsign(name);
      localStorage.setItem("aegis_agent_name", name);
    }
  };

  const nextSlide = () => {
    if (slide < 4) setSlide((prev) => prev + 1);
  };

  const prevSlide = () => {
    if (slide > 0) setSlide((prev) => prev - 1);
  };

  const slidesData = [
    { title: "FUTURE SECURITY, REDEFINED.", subtitle: "Kernel-Level eBPF Supply Chain Defense Platform" },
    { title: "THE INVISIBLE ATTACK SURFACE.", subtitle: "npm `postinstall` Lifecycle Hook Exploits & Credential Theft" },
    { title: "THE AEGIS SOLUTION.", subtitle: "0% Overhead Syscall Interception & Provenance Graph" },
    { title: "HYBRID DEPLOYMENT & TESTING.", subtitle: "Vercel Simulation Mode & Linux Kernel Integration" },
    { title: "AGENT CLEARANCE GRANTED.", subtitle: "Initialize Your eBPF Runtime Security Console" },
  ];

  return (
    <div className="w-screen h-screen bg-[#07090e] p-4 md:p-8 flex flex-col items-center justify-center font-sans overflow-hidden select-none relative">
      {/* Outer Wavy / Grid Dark Backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/20 via-[#07090e] to-[#030407] pointer-events-none" />

      {/* Main Glass Floating Window Frame (Matching Reference Image Layout) */}
      <div className="w-full max-w-6xl h-[720px] bg-[#0d1017] rounded-[2.5rem] border border-white/10 shadow-[0_0_90px_rgba(0,0,0,0.9)] relative overflow-hidden flex flex-col justify-between p-6 md:p-8 z-10 backdrop-blur-2xl">

        {/* ─── Top Pill Navigation Bar ─── */}
        <header className="flex items-center justify-between z-20 shrink-0">
          {/* Top Left Logo Pill */}
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md">
            <Shield className="w-5 h-5 text-cyan-400" />
            <span className="font-mono font-black text-sm tracking-wider text-slate-100 uppercase">
              AELFRA AEGIS
            </span>
          </div>

          {/* Top Center Pills (Quick Jump Navigation) */}
          <div className="hidden md:flex items-center gap-2 bg-black/40 border border-white/10 p-1.5 rounded-full backdrop-blur-md text-xs font-mono">
            {["OVERVIEW", "THE PROBLEM", "OUR SOLUTION", "TESTING", "CONSOLE"].map((label, idx) => (
              <button
                key={idx}
                onClick={() => setSlide(idx)}
                className={`px-4 py-1.5 rounded-full transition-all duration-300 font-bold ${
                  slide === idx
                    ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Top Right Action Pills */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="hidden sm:flex items-center gap-2 bg-white text-slate-950 font-black px-5 py-2.5 rounded-full text-xs hover:bg-cyan-400 transition-all duration-200 shadow-lg shadow-white/10 cursor-pointer font-mono"
            >
              <span>LAUNCH CONSOLE</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* ─── Main Slide Content Viewport ─── */}
        <main className="flex-1 my-4 relative overflow-hidden flex items-center">
          {/* SLIDE 0: HERO & CALLSIGN SETUP */}
          {slide === 0 && (
            <div className="w-full h-full flex flex-col md:flex-row items-center justify-between gap-8 animate-in fade-in duration-500">
              {/* Left Column Text & Name Input */}
              <div className="flex-1 space-y-6 z-10">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold tracking-wider">
                  <Zap className="w-3.5 h-3.5" />
                  <span>NEXT-GEN eBPF RUNTIME DEFENSE</span>
                </div>

                <h1 className="text-4xl md:text-5xl font-black text-slate-100 tracking-tight leading-tight uppercase font-mono">
                  FUTURE SECURITY, <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400">
                    REDEFINED.
                  </span>
                </h1>

                <p className="text-sm text-slate-400 max-w-md font-sans leading-relaxed">
                  Real-time kernel-level eBPF detection for npm supply chain attacks, `.env` exfiltration, and unauthorized process spawns — with a live React Flow provenance graph and 1-click kill switch.
                </p>

                {/* Agent Callsign Input Box */}
                <form onSubmit={handleSaveName} className="flex items-center gap-2 max-w-md pt-2">
                  <div className="relative flex-1">
                    <User className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="Enter your Callsign (e.g. Agent Umar)"
                      className="w-full bg-black/60 border border-slate-700 focus:border-cyan-400 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-100 font-mono focus:outline-none transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold px-4 py-2.5 rounded-2xl text-xs transition-all shadow-md shadow-cyan-500/20"
                  >
                    Save Callsign
                  </button>
                </form>
                <div className="text-[11px] text-slate-500 font-mono">
                  Current Clearance: <strong className="text-cyan-400">{savedCallsign}</strong>
                </div>
              </div>

              {/* Right Column Cyber Sentinel Hero Image (Matching Photo Style) */}
              <div className="relative w-full md:w-[480px] h-[380px] rounded-3xl overflow-hidden border border-white/10 shadow-2xl group">
                <Image
                  src="/hero.jpg"
                  alt="Cyber Sentinel Aegis"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                  priority
                />

                {/* Floating Annotation Callout Lines (Exact Style of Reference Image) */}
                <div className="absolute top-12 left-6 bg-black/70 backdrop-blur-md border border-cyan-500/40 px-3 py-1.5 rounded-xl text-[10px] font-mono text-cyan-300 shadow-xl flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>eBPF PROBE MK-I — $0 OVERHEAD</span>
                </div>

                <div className="absolute bottom-16 right-6 bg-black/70 backdrop-blur-md border border-red-500/40 px-3 py-1.5 rounded-xl text-[10px] font-mono text-red-300 shadow-xl flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span>REALTIME KILL SWITCH — ACTIVE</span>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 1: THE PROBLEM */}
          {slide === 1 && (
            <div className="w-full h-full flex flex-col md:flex-row items-center justify-between gap-8 animate-in fade-in duration-500">
              <div className="flex-1 space-y-5">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>THE THREAT MATRIX</span>
                </div>

                <h2 className="text-3xl md:text-4xl font-black text-slate-100 uppercase font-mono">
                  THE INVISIBLE <br />
                  <span className="text-red-500">ATTACK SURFACE.</span>
                </h2>

                <p className="text-xs md:text-sm text-slate-400 leading-relaxed font-sans">
                  Modern npm packages run automatic <code className="text-red-400 bg-red-950/50 px-1.5 py-0.5 rounded font-mono">postinstall</code> scripts during package installation. Attackers hijack popular or typosquatted packages to execute hidden code before developers notice.
                </p>

                <div className="space-y-2.5 font-mono text-xs pt-2">
                  <div className="p-3 rounded-2xl bg-red-950/20 border border-red-800/60 flex items-start gap-3">
                    <Flame className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-red-200 block">1. Silent Credential Theft</strong>
                      <span className="text-slate-400 text-[11px]">Traverses parent directories to open and read `.env` secrets & AWS API keys.</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-amber-950/20 border border-amber-800/60 flex items-start gap-3">
                    <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-amber-200 block">2. HTTP POST Data Exfiltration</strong>
                      <span className="text-slate-400 text-[11px]">POSTs stolen environment variables to external C2 endpoints.</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-cyan-950/20 border border-cyan-800/60 flex items-start gap-3">
                    <Terminal className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-cyan-200 block">3. Reverse Shell Execution</strong>
                      <span className="text-slate-400 text-[11px]">Spawns hidden child shell processes (<code className="text-cyan-300">bash -c "id"</code>) for reconnaissance.</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full md:w-[460px] h-[340px] glass-card p-6 rounded-3xl border border-red-500/30 flex flex-col justify-between font-mono text-xs relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl" />
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <span className="text-red-400 font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> TRADITIONAL SCANNERS FAIL
                  </span>
                  <span className="text-[10px] text-slate-500">Static AST Audit</span>
                </div>
                <div className="space-y-2 text-[11px] text-slate-400 leading-relaxed font-sans">
                  Traditional dependency scanners (like `npm audit` or static AST linters) inspect declared JSON manifests. They cannot detect dynamic zero-day obfuscated syscall payloads executing inside postinstall hooks at installation runtime.
                </div>
                <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-[11px]">
                  Result: Credentials leak before static security tools flag the package.
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 2: THE SOLUTION */}
          {slide === 2 && (
            <div className="w-full h-full flex flex-col md:flex-row items-center justify-between gap-8 animate-in fade-in duration-500">
              <div className="flex-1 space-y-5">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>KERNEL-LEVEL EBPF PROBES</span>
                </div>

                <h2 className="text-3xl md:text-4xl font-black text-slate-100 uppercase font-mono">
                  ZERO-OVERHEAD <br />
                  <span className="text-cyan-400">KERNEL INTERCEPTION.</span>
                </h2>

                <p className="text-xs md:text-sm text-slate-400 leading-relaxed font-sans">
                  Aelfra Aegis installs lightweight eBPF probes directly at kernel tracepoints (<code className="text-cyan-300 font-mono">openat</code>, <code className="text-cyan-300 font-mono">execve</code>, <code className="text-cyan-300 font-mono">connect</code>). It streams syscall events over a lockless BPF ring buffer with &lt;1% CPU overhead.
                </p>

                <div className="grid grid-cols-2 gap-3 font-mono text-xs pt-2">
                  <div className="p-3 rounded-2xl glass-card border border-cyan-500/30">
                    <strong className="text-cyan-400 block mb-1">Causal Provenance</strong>
                    <span className="text-slate-400 text-[11px]">Correlates parent process tree (`ppid` → `pid`) into temporal graph.</span>
                  </div>
                  <div className="p-3 rounded-2xl glass-card border border-red-500/30">
                    <strong className="text-red-400 block mb-1">1-Click Kill Switch</strong>
                    <span className="text-slate-400 text-[11px]">Transmits instant SIGKILL over WebSocket to terminate compromised PIDs.</span>
                  </div>
                </div>
              </div>

              <div className="relative w-full md:w-[460px] h-[340px] rounded-3xl overflow-hidden border border-cyan-500/30 shadow-2xl">
                <Image
                  src="/kernel.jpg"
                  alt="eBPF Kernel Probe Core"
                  fill
                  className="object-cover"
                />
                <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-md border border-cyan-500/40 p-3 rounded-2xl text-xs font-mono flex items-center justify-between text-cyan-300">
                  <span>BPF_RINGBUF_OUTPUT Active</span>
                  <span className="text-emerald-400 font-bold">0.12% CPU</span>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 3: TESTING & SETUP */}
          {slide === 3 && (
            <div className="w-full h-full flex flex-col justify-center space-y-6 animate-in fade-in duration-500">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold">
                  <Layers className="w-3.5 h-3.5" />
                  <span>HYBRID TESTING MODES</span>
                </div>
                <h2 className="text-3xl font-black text-slate-100 uppercase font-mono">
                  TEST AEGIS YOUR WAY.
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
                {/* Card 1: Vercel Simulation Mode */}
                <div className="glass-card p-6 rounded-3xl border border-cyan-500/40 space-y-3 relative overflow-hidden group hover:border-cyan-400 transition-all">
                  <div className="flex justify-between items-center">
                    <span className="text-cyan-400 font-bold text-sm flex items-center gap-2">
                      <Play className="w-4 h-4" /> 1. In-Browser Simulation
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                      Vercel Ready
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs font-sans leading-relaxed">
                    Test the complete provenance graph, threat alerts, and kill switch instantly right inside your browser without installing anything locally.
                  </p>
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold py-2.5 rounded-xl transition-all shadow-md shadow-cyan-500/20"
                  >
                    Launch Browser Simulator →
                  </button>
                </div>

                {/* Card 2: Local Linux Kernel eBPF Mode */}
                <div className="glass-card p-6 rounded-3xl border border-slate-700 space-y-3 relative overflow-hidden group hover:border-slate-500 transition-all">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-200 font-bold text-sm flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-cyan-400" /> 2. Local eBPF Linux Mode
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                      Full Pipeline
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs font-sans leading-relaxed">
                    Run the Python BCC daemon with kernel tracepoints attached locally on Ubuntu / WSL2 to capture real syscalls.
                  </p>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[10px] text-slate-300">
                    <code>sudo python3 ebpf/daemon.py</code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 4: CLEARANCE LAUNCH */}
          {slide === 4 && (
            <div className="w-full h-full flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in duration-500 font-mono">
              <div className="p-4 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-xl shadow-cyan-500/10">
                <CheckCircle2 className="w-12 h-12" />
              </div>

              <div className="space-y-2">
                <span className="text-xs text-cyan-400 font-bold tracking-widest uppercase">SECURITY CLEARANCE APPROVED</span>
                <h2 className="text-3xl md:text-5xl font-black text-slate-100 tracking-tight uppercase">
                  WELCOME, <span className="text-cyan-400">{savedCallsign}</span>
                </h2>
                <p className="text-xs text-slate-400 max-w-md mx-auto font-sans leading-relaxed">
                  Your eBPF runtime defense console is configured and ready. Access live provenance graphs, event streams, and kill controls.
                </p>
              </div>

              <div className="pt-4">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-3 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black px-8 py-4 rounded-2xl text-sm transition-all shadow-xl shadow-cyan-500/30 cursor-pointer tracking-wider"
                >
                  <span>ENTER LIVE CONSOLE</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
        </main>

        {/* ─── Bottom Footer Bar & Slide Pagination Controls (Matching Photo) ─── */}
        <footer className="flex items-center justify-between border-t border-white/10 pt-4 z-20 shrink-0 font-mono text-xs">
          {/* Left Slide Description Pill */}
          <div className="flex items-center gap-3">
            <span className="text-slate-500">PHASE 0{slide + 1} / 05</span>
            <span className="text-slate-300 font-bold truncate max-w-[200px] sm:max-w-none">
              {slidesData[slide].title}
            </span>
          </div>

          {/* Right Thumbnail & Slide Pagination Arrow Controls (Matching Reference Image) */}
          <div className="flex items-center gap-4">
            {/* Small Bottom Right Preview Thumbnail Pill */}
            <div className="hidden sm:flex items-center gap-3 bg-white/5 border border-white/10 px-3 py-1.5 rounded-2xl">
              <div className="w-8 h-8 rounded-lg overflow-hidden relative">
                <Image src="/hero.jpg" alt="Preview" fill className="object-cover" />
              </div>
              <div className="text-[10px]">
                <div className="text-slate-300 font-bold">NEXT FEATURE</div>
                <div className="text-slate-500">{slide < 4 ? slidesData[slide + 1].title.slice(0, 15) + "..." : "LAUNCH"}</div>
              </div>
            </div>

            {/* Slide Arrows */}
            <div className="flex items-center gap-2">
              <button
                onClick={prevSlide}
                disabled={slide === 0}
                className={`p-2.5 rounded-full border transition-all ${
                  slide === 0
                    ? "border-slate-800 text-slate-700 cursor-not-allowed"
                    : "border-white/20 text-slate-200 hover:bg-white/10 cursor-pointer"
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <button
                onClick={nextSlide}
                disabled={slide === 4}
                className={`p-2.5 rounded-full border transition-all ${
                  slide === 4
                    ? "border-slate-800 text-slate-700 cursor-not-allowed"
                    : "border-cyan-500/50 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-slate-950 cursor-pointer"
                }`}
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
