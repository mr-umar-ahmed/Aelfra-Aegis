"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Search,
  Sun,
  ChevronLeft,
  ChevronRight,
  Shield,
  Zap,
  Terminal,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Play,
  ArrowRight,
} from "lucide-react";

export default function OnboardingLanding() {
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const [agentName, setAgentName] = useState("");
  const [savedCallsign, setSavedCallsign] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("aegis_agent_name");
    if (stored) {
      setSavedCallsign(stored);
      setAgentName(stored);
    }
  }, []);

  const handleSaveNameAndProceed = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = agentName.trim()
      ? agentName.trim().toUpperCase().startsWith("AGENT")
        ? agentName.trim().toUpperCase()
        : `AGENT ${agentName.trim().toUpperCase()}`
      : "AGENT UMAR";

    setSavedCallsign(finalName);
    localStorage.setItem("aegis_agent_name", finalName);

    if (slide < 4) {
      setSlide((prev) => prev + 1);
    } else {
      router.push("/dashboard");
    }
  };

  const nextSlide = () => {
    if (slide < 4) setSlide((prev) => prev + 1);
  };

  const prevSlide = () => {
    if (slide > 0) setSlide((prev) => prev - 1);
  };

  const navTabs = [
    { label: "OVERVIEW", idx: 0 },
    { label: "THREAT", idx: 1 },
    { label: "PROTOCOL", idx: 2 },
    { label: "ACCESS", idx: 3 },
    { label: "CLEARANCE", idx: 4 },
  ];

  return (
    <div className="w-screen h-screen bg-[#0b0c0f] text-white p-3 sm:p-6 flex items-center justify-center font-sans overflow-hidden select-none relative">
      {/* Dark Wavy / Topo Backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/20 via-[#0b0c0f] to-[#050507] pointer-events-none" />

      {/* Main Outer Frame with Thick Rounded White Container (Matching Image 1 & 2) */}
      <div className="p-2.5 sm:p-3 bg-[#e5e7eb] rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.95)] max-w-6xl w-full h-[760px] max-h-[95vh] relative overflow-hidden flex flex-col justify-between z-10">
        
        {/* Inner Jet Black Panel */}
        <div className="bg-[#09090b] rounded-[2.4rem] p-5 sm:p-7 flex flex-col justify-between w-full h-full relative overflow-hidden text-white border border-white/10">

          {/* ─── Top Header Navigation Bar (Image 1 Style White Pills) ─── */}
          <header className="flex items-center justify-between shrink-0 z-20">
            {/* Top Left Logo Pill */}
            <div className="flex items-center gap-2 bg-white text-black font-cyber font-black text-sm px-6 py-2.5 rounded-full tracking-wider shadow-lg">
              <Shield className="w-4 h-4 text-black fill-current" />
              <span>AEGIS</span>
            </div>

            {/* Top Center Capsule Navigation */}
            <div className="hidden md:flex items-center gap-1 bg-white/10 border border-white/20 p-1.5 rounded-full backdrop-blur-md text-xs font-mono">
              {navTabs.map((tab) => (
                <button
                  key={tab.idx}
                  onClick={() => setSlide(tab.idx)}
                  className={`px-5 py-2 rounded-full transition-all duration-300 font-cyber font-extrabold uppercase text-[11px] tracking-wider ${
                    slide === tab.idx
                      ? "bg-white text-black shadow-md"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Top Right Action Pills */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/dashboard")}
                className="w-10 h-10 rounded-full bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white hover:text-black transition-all"
                title="Search"
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="w-10 h-10 rounded-full bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white hover:text-black transition-all"
                title="Theme"
              >
                <Sun className="w-4 h-4" />
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="hidden sm:flex items-center gap-2 bg-white hover:bg-orange-500 hover:text-white text-black font-cyber font-black px-5 py-2.5 rounded-full text-xs transition-all shadow-lg"
              >
                <span>LAUNCH CONSOLE</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </header>

          {/* ─── Main Content Viewport ─── */}
          <main className="flex-1 my-3 relative overflow-hidden flex flex-col justify-between">

            {/* SLIDE 0: MISSION / OVERVIEW (Matching Image 1 & 2 Font/Layout) */}
            {slide === 0 && (
              <div className="w-full h-full flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in duration-300">
                {/* Left Column Text & Callsign Form */}
                <div className="flex-1 space-y-4 z-10">
                  <div className="inline-block px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white font-mono text-[10px] uppercase tracking-widest font-bold">
                    AELFRA AEGIS v1.0 — CLASSIFIED
                  </div>

                  {/* Massive Bold Headline in Image 2 Orbitron Font */}
                  <h1 className="text-4xl sm:text-5xl md:text-6xl font-cyber font-black text-white tracking-tight leading-[0.92] uppercase">
                    FUTURE DEFENSE, <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-orange-400">
                      REDEFINED.
                    </span>
                  </h1>

                  <p className="text-xs sm:text-sm text-slate-300 max-w-md font-sans leading-relaxed">
                    The first eBPF-powered runtime supply chain attack detector. Silent kernel-level tracepoint interception with zero CPU overhead.
                  </p>

                  {/* Callsign Form Input Box */}
                  <form onSubmit={handleSaveNameAndProceed} className="space-y-2 pt-1 max-w-md">
                    <div className="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-bold">
                      ENTER YOUR CALLSIGN, AGENT
                    </div>
                    <input
                      type="text"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="CALLSIGN_"
                      className="w-full bg-white/5 border border-white/20 focus:border-white rounded-2xl px-4 py-3 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none tracking-widest uppercase transition-all"
                    />

                    <button
                      type="submit"
                      className="w-full bg-white hover:bg-orange-500 hover:text-white text-black font-cyber font-black text-xs py-3.5 px-6 rounded-2xl tracking-widest uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl"
                    >
                      <span>INITIALIZE SESSION →</span>
                    </button>
                  </form>
                </div>

                {/* Right Column Cyber Sentinel Hero Card (Image 1 Style) */}
                <div className="relative w-full md:w-[480px] h-[320px] sm:h-[350px] rounded-[2rem] overflow-hidden border border-white/15 shadow-2xl group shrink-0">
                  <Image
                    src="/hero.jpg"
                    alt="Cyber Sentinel Aegis"
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                    priority
                  />

                  {/* Floating Callout Annotation Pins (Exact Image 1 Style) */}
                  <div className="absolute top-10 left-6 bg-black/80 backdrop-blur-md border border-white/30 px-3 py-1.5 rounded-xl text-[10px] font-mono text-white shadow-xl flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                    <span>eBPF PROBE MK-I — $0 OVERHEAD</span>
                  </div>

                  <div className="absolute bottom-12 right-6 bg-black/80 backdrop-blur-md border border-red-500/40 px-3 py-1.5 rounded-xl text-[10px] font-mono text-red-300 shadow-xl flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span>REALTIME KILL SWITCH — ACTIVE</span>
                  </div>
                </div>
              </div>
            )}

            {/* SLIDE 1: THREAT */}
            {slide === 1 && (
              <div className="w-full h-full flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in duration-300">
                <div className="flex-1 space-y-4">
                  <div className="inline-block px-3 py-1 rounded-full bg-red-950/80 border border-red-800 text-red-300 font-mono text-[10px] uppercase tracking-widest font-bold">
                    SUPPLY CHAIN ATTACK SURFACE
                  </div>

                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-cyber font-black text-white uppercase tracking-tight leading-[0.95]">
                    THE INVISIBLE <br />
                    <span className="text-red-500">ATTACK VECTOR.</span>
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans max-w-md">
                    npm packages run automatic <code className="text-red-400 bg-red-950/60 px-1.5 py-0.5 rounded font-mono">postinstall</code> scripts during package installation. Attackers steal `.env` keys and open HTTP POST exfiltration channels.
                  </p>

                  <div className="space-y-2 font-mono text-xs pt-1">
                    <div className="p-3 rounded-2xl bg-red-950/30 border border-red-800/60 flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-red-200 block">1. Silent Credential Theft</strong>
                        <span className="text-slate-400 text-[11px]">Traverses parent directories to read `.env` secrets.</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-800/60 flex items-start gap-3">
                      <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-amber-200 block">2. HTTP POST Exfiltration</strong>
                        <span className="text-slate-400 text-[11px]">Transmits credentials to external C2 listeners.</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative w-full md:w-[460px] h-[320px] rounded-[2rem] overflow-hidden border border-red-500/30 shadow-2xl">
                  <Image src="/kernel.jpg" alt="Threat Core" fill className="object-cover" />
                </div>
              </div>
            )}

            {/* SLIDE 2: PROTOCOL */}
            {slide === 2 && (
              <div className="w-full h-full flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in duration-300">
                <div className="flex-1 space-y-4">
                  <div className="inline-block px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white font-mono text-[10px] uppercase tracking-widest font-bold">
                    KERNEL INTERCEPTION ENGINE
                  </div>

                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-cyber font-black text-white uppercase tracking-tight leading-[0.95]">
                    ZERO OVERHEAD. <br />
                    <span className="text-orange-400">KERNEL PROBES.</span>
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans max-w-md">
                    Attaches eBPF C probes directly to kernel tracepoints (<code className="text-white font-mono">openat</code>, <code className="text-white font-mono">execve</code>, <code className="text-white font-mono">connect</code>). Streams events over lockless BPF ring buffers.
                  </p>

                  <div className="grid grid-cols-2 gap-3 font-mono text-xs pt-1">
                    <div className="p-3 rounded-2xl glass-card border border-white/20">
                      <strong className="text-white block mb-1">Causal Provenance</strong>
                      <span className="text-slate-400 text-[11px]">Correlates process tree into temporal graph.</span>
                    </div>
                    <div className="p-3 rounded-2xl glass-card border border-red-500/30">
                      <strong className="text-red-400 block mb-1">1-Click Kill Switch</strong>
                      <span className="text-slate-400 text-[11px]">Sends SIGKILL to terminate malicious PIDs.</span>
                    </div>
                  </div>
                </div>

                <div className="relative w-full md:w-[460px] h-[320px] rounded-[2rem] overflow-hidden border border-white/20 shadow-2xl">
                  <Image src="/kernel.jpg" alt="Kernel Core" fill className="object-cover" />
                </div>
              </div>
            )}

            {/* SLIDE 3: ACCESS */}
            {slide === 3 && (
              <div className="w-full h-full flex flex-col justify-between animate-in fade-in duration-300 font-mono">
                <div className="space-y-2 mt-1">
                  <div className="inline-block px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-[10px] uppercase tracking-widest font-bold">
                    HYBRID ENVIRONMENT
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-cyber font-black text-white uppercase">
                    SELECT ACCESS MODE.
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-2">
                  <div
                    onClick={() => router.push("/dashboard")}
                    className="p-5 rounded-3xl bg-white/5 border border-white/20 hover:border-white transition-all cursor-pointer space-y-2 group"
                  >
                    <div className="text-white font-bold text-sm flex items-center justify-between font-cyber">
                      <span>1. IN-BROWSER SIMULATOR</span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">VERCEL READY</span>
                    </div>
                    <p className="text-xs text-slate-300 font-sans leading-relaxed">
                      Test the complete provenance graph, threat alerts, and 1-click kill switch directly in your browser.
                    </p>
                    <div className="text-xs text-white group-hover:text-orange-400 font-bold transition-colors pt-1">
                      LAUNCH SIMULATOR →
                    </div>
                  </div>

                  <div
                    onClick={() => router.push("/dashboard")}
                    className="p-5 rounded-3xl bg-white/5 border border-white/20 hover:border-white transition-all cursor-pointer space-y-2 group"
                  >
                    <div className="text-white font-bold text-sm flex items-center justify-between font-cyber">
                      <span>2. LOCAL LINUX DAEMON</span>
                      <span className="text-[10px] text-slate-300 bg-slate-800 px-2 py-0.5 rounded-full">WS://8765</span>
                    </div>
                    <p className="text-xs text-slate-300 font-sans leading-relaxed">
                      Connect to your local Python BCC daemon running kernel tracepoints on Linux/WSL2.
                    </p>
                    <div className="text-xs text-white group-hover:text-orange-400 font-bold transition-colors pt-1">
                      CONNECT DAEMON →
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    onClick={nextSlide}
                    className="w-full bg-white hover:bg-orange-500 hover:text-white text-black font-cyber font-black text-xs py-3.5 px-6 rounded-2xl tracking-widest uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl"
                  >
                    <span>OBTAIN CLEARANCE →</span>
                  </button>
                </div>
              </div>
            )}

            {/* SLIDE 4: CLEARANCE */}
            {slide === 4 && (
              <div className="w-full h-full flex flex-col items-center justify-center text-center space-y-5 animate-in fade-in duration-300 font-mono">
                <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">SECURITY CLEARANCE APPROVED</div>
                  <h2 className="text-3xl sm:text-5xl font-cyber font-black text-white uppercase tracking-tight">
                    WELCOME, {savedCallsign || "AGENT"}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto font-sans leading-relaxed">
                    Your clearance token has been generated. Access the live eBPF runtime defense console.
                  </p>
                </div>

                <div className="w-full max-w-md pt-2">
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="w-full bg-white hover:bg-orange-500 hover:text-white text-black font-cyber font-black text-xs py-4 px-6 rounded-2xl tracking-widest uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl"
                  >
                    <span>ENTER LIVE CONSOLE →</span>
                  </button>
                </div>
              </div>
            )}

          </main>

          {/* ─── Bottom Footer: Thumbnail Card & Pagination Arrows (Image 1 Style) ─── */}
          <footer className="flex items-center justify-between border-t border-white/10 pt-3 shrink-0 z-20 font-mono text-xs">
            {/* Left Slide Counter Pill */}
            <div className="flex items-center gap-3">
              <span className="text-slate-400 font-bold">PHASE 0{slide + 1} / 05</span>
            </div>

            {/* Bottom Center Pagination Dots */}
            <div className="flex items-center gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    slide === i ? "bg-white w-3 h-3" : "bg-slate-700 hover:bg-slate-500"
                  }`}
                />
              ))}
            </div>

            {/* Right Thumbnail & Slide Pagination Control Arrows (Image 1 Style) */}
            <div className="flex items-center gap-3">
              {/* Bottom Right Thumbnail Card in White Pill Container */}
              <div className="hidden sm:flex items-center gap-3 bg-white text-black px-3 py-1.5 rounded-2xl shadow-lg">
                <div className="w-7 h-7 rounded-lg overflow-hidden relative">
                  <Image src="/hero.jpg" alt="Preview" fill className="object-cover" />
                </div>
                <div className="text-[10px] font-cyber font-bold">
                  <div>AEGIS MK-I</div>
                  <div className="text-slate-600 font-sans font-semibold">$0 OVERHEAD</div>
                </div>
              </div>

              {/* Slide Arrows */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={prevSlide}
                  disabled={slide === 0}
                  className="w-9 h-9 rounded-full bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center text-white disabled:opacity-20 disabled:cursor-not-allowed hover:bg-white hover:text-black transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={nextSlide}
                  disabled={slide === 4}
                  className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed hover:bg-orange-500 hover:text-white transition-all shadow-md"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </footer>

        </div>
      </div>
    </div>
  );
}
