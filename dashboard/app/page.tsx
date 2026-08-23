"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Search,
  Sun,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Zap,
  Terminal,
  Cpu,
  CheckCircle2,
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
    { label: "MISSION", idx: 0 },
    { label: "THREAT", idx: 1 },
    { label: "PROTOCOL", idx: 2 },
    { label: "ACCESS", idx: 3 },
    { label: "CLEARANCE", idx: 4 },
  ];

  return (
    <div className="w-screen h-screen bg-[#090c0a] text-[#e5ebe7] p-3 sm:p-6 flex items-center justify-center font-sans overflow-hidden select-none relative">
      {/* Background Subtle Grid Effect */}
      <div className="absolute inset-0 bg-[radial-gradient(#1c2520_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      {/* Main Container Window Frame matching screenshot */}
      <div className="w-full max-w-5xl h-[780px] max-h-[95vh] bg-[#0e1210] rounded-[2rem] border border-[#1f2923] shadow-[0_0_80px_rgba(0,0,0,0.8)] relative overflow-hidden flex flex-col justify-between p-6 md:p-8 z-10">

        {/* ─── Top Header Navigation Bar ─── */}
        <header className="flex items-center justify-between shrink-0 z-20">
          {/* Logo */}
          <div className="font-serif italic font-black text-2xl tracking-wider text-[#e5ebe7]">
            AEGIS
          </div>

          {/* Center Navigation Capsule */}
          <div className="flex items-center gap-1 bg-[#131916] border border-[#1f2923] p-1 rounded-full text-xs font-mono">
            {navTabs.map((tab) => (
              <button
                key={tab.idx}
                onClick={() => setSlide(tab.idx)}
                className={`px-4 py-1.5 rounded-full transition-all duration-300 font-bold uppercase tracking-wider ${
                  slide === tab.idx
                    ? "bg-[#3c4f45] text-[#e5ebe7] shadow-sm"
                    : "text-[#7a8e82] hover:text-[#b5c7bc]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Top Right Circular Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="w-9 h-9 rounded-full border border-[#1f2923] bg-[#131916] flex items-center justify-center text-[#7a8e82] hover:text-[#e5ebe7] transition-colors"
              title="Quick Search / Console"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-9 h-9 rounded-full border border-[#1f2923] bg-[#131916] flex items-center justify-center text-[#7a8e82] hover:text-[#e5ebe7] transition-colors"
              title="Launch Console"
            >
              <Sun className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ─── Main Viewport Area ─── */}
        <main className="flex-1 my-3 relative overflow-hidden flex flex-col justify-between">

          {/* SLIDE 0: MISSION (Exact Page 1 from Screenshot) */}
          {slide === 0 && (
            <div className="w-full h-full flex flex-col justify-between animate-in fade-in duration-300">
              {/* Hero Cyber Sentinel Image Card */}
              <div className="w-full h-[270px] sm:h-[300px] rounded-2xl relative overflow-hidden border border-[#1f2923] shrink-0 shadow-lg">
                <Image
                  src="/hero.jpg"
                  alt="Cyber Sentinel Agent"
                  fill
                  className="object-cover object-top"
                  priority
                />

                {/* Overlaid Tags Pill Bar */}
                <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2 font-mono text-[10px]">
                  <span className="px-3 py-1 rounded-md bg-black/70 border border-white/10 text-[#e5ebe7] backdrop-blur-md uppercase font-bold tracking-wider">
                    eBPF PROBE
                  </span>
                  <span className="px-3 py-1 rounded-md bg-black/70 border border-white/10 text-[#e5ebe7] backdrop-blur-md uppercase font-bold tracking-wider">
                    KILL SWITCH
                  </span>
                  <span className="px-3 py-1 rounded-md bg-black/70 border border-white/10 text-[#e5ebe7] backdrop-blur-md uppercase font-bold tracking-wider">
                    CLASSIFIER
                  </span>
                  <span className="px-3 py-1 rounded-md bg-black/70 border border-white/10 text-[#e5ebe7] backdrop-blur-md uppercase font-bold tracking-wider">
                    GRAPH ENGINE
                  </span>
                </div>
              </div>

              {/* Tag & Display Headline */}
              <div className="relative mt-3">
                <div className="inline-block px-2.5 py-1 rounded-md bg-[#131916] border border-[#1f2923] text-[10px] font-mono text-[#7a8e82] uppercase tracking-widest mb-2 font-semibold">
                  AELFRA AEGIS v1.0 — CLASSIFIED
                </div>

                <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-[#e5ebe7] font-mono tracking-tight leading-[0.92] uppercase">
                  KERNEL-LEVEL <br />
                  DEFENSE. <br />
                  REDEFINED.
                </h1>

                <p className="text-xs sm:text-sm text-[#8f9e95] max-w-xl font-sans mt-2 leading-relaxed">
                  The first eBPF-powered runtime supply chain attack detector. Silent. Zero overhead. Absolute.
                </p>

                {/* Left & Right Side Arrow Buttons */}
                <button
                  onClick={prevSlide}
                  disabled={slide === 0}
                  className="absolute -left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-[#1f2923] bg-[#131916]/80 backdrop-blur-md flex items-center justify-center text-[#7a8e82] disabled:opacity-20 disabled:cursor-not-allowed hover:text-[#e5ebe7] transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                  onClick={nextSlide}
                  className="absolute -right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-[#1f2923] bg-[#3c4f45] flex items-center justify-center text-[#e5ebe7] hover:bg-[#4a5f54] transition-all shadow-md"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Callsign Form Input & Initialize Button */}
              <form onSubmit={handleSaveNameAndProceed} className="space-y-2 mt-2">
                <div className="text-[10px] font-mono tracking-widest text-[#7a8e82] uppercase">
                  ENTER YOUR CALLSIGN, AGENT
                </div>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="CALLSIGN_"
                  className="w-full bg-transparent border-b border-[#28352e] focus:border-[#3c4f45] pb-1 text-sm font-mono text-[#e5ebe7] placeholder:text-[#3c4f45] focus:outline-none tracking-widest uppercase transition-colors"
                />

                <button
                  type="submit"
                  className="w-full bg-[#3c4f45] hover:bg-[#4a5f54] text-[#e5ebe7] font-mono font-bold text-xs py-3.5 px-6 rounded-xl tracking-widest uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md mt-2"
                >
                  <span>INITIALIZE SESSION →</span>
                </button>
              </form>
            </div>
          )}

          {/* SLIDE 1: THREAT */}
          {slide === 1 && (
            <div className="w-full h-full flex flex-col justify-between animate-in fade-in duration-300">
              <div className="w-full h-[270px] sm:h-[300px] rounded-2xl relative overflow-hidden border border-[#1f2923] shrink-0 shadow-lg">
                <Image
                  src="/kernel.jpg"
                  alt="Threat Vector"
                  fill
                  className="object-cover"
                />
                <div className="absolute bottom-4 left-4 px-3 py-1 rounded-md bg-black/80 border border-red-500/40 text-red-400 font-mono text-[10px] uppercase font-bold tracking-wider">
                  ⚠️ THREAT MATRIX — POSTINSTALL HIJACKING
                </div>
              </div>

              <div className="relative mt-3">
                <div className="inline-block px-2.5 py-1 rounded-md bg-[#131916] border border-[#1f2923] text-[10px] font-mono text-red-400 uppercase tracking-widest mb-2 font-semibold">
                  SUPPLY CHAIN VULNERABILITY
                </div>

                <h1 className="text-4xl sm:text-5xl font-black text-[#e5ebe7] font-mono tracking-tight leading-[0.92] uppercase">
                  THE INVISIBLE <br />
                  ATTACK SURFACE.
                </h1>

                <p className="text-xs sm:text-sm text-[#8f9e95] max-w-xl font-sans mt-2 leading-relaxed">
                  npm packages execute uncontrolled lifecycle scripts. Typosquatted packages read `.env` secrets and exfiltrate credentials before static scanners notice.
                </p>

                <button
                  onClick={prevSlide}
                  className="absolute -left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-[#1f2923] bg-[#131916]/80 flex items-center justify-center text-[#7a8e82] hover:text-[#e5ebe7] transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                  onClick={nextSlide}
                  className="absolute -right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-[#1f2923] bg-[#3c4f45] flex items-center justify-center text-[#e5ebe7] hover:bg-[#4a5f54] transition-all shadow-md"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="pt-2">
                <button
                  onClick={nextSlide}
                  className="w-full bg-[#3c4f45] hover:bg-[#4a5f54] text-[#e5ebe7] font-mono font-bold text-xs py-3.5 px-6 rounded-xl tracking-widest uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <span>SEE DEFENSE PROTOCOL →</span>
                </button>
              </div>
            </div>
          )}

          {/* SLIDE 2: PROTOCOL */}
          {slide === 2 && (
            <div className="w-full h-full flex flex-col justify-between animate-in fade-in duration-300">
              <div className="w-full h-[270px] sm:h-[300px] rounded-2xl relative overflow-hidden border border-[#1f2923] shrink-0 shadow-lg">
                <Image
                  src="/kernel.jpg"
                  alt="Protocol Architecture"
                  fill
                  className="object-cover"
                />
                <div className="absolute bottom-4 left-4 px-3 py-1 rounded-md bg-black/80 border border-emerald-500/40 text-emerald-400 font-mono text-[10px] uppercase font-bold tracking-wider">
                  ⚡ RING BUFFER TRACEPOINTS — openat, execve, connect
                </div>
              </div>

              <div className="relative mt-3">
                <div className="inline-block px-2.5 py-1 rounded-md bg-[#131916] border border-[#1f2923] text-[10px] font-mono text-[#7a8e82] uppercase tracking-widest mb-2 font-semibold">
                  KERNEL INTERCEPTION ENGINE
                </div>

                <h1 className="text-4xl sm:text-5xl font-black text-[#e5ebe7] font-mono tracking-tight leading-[0.92] uppercase">
                  ZERO OVERHEAD. <br />
                  KERNEL PROBES.
                </h1>

                <p className="text-xs sm:text-sm text-[#8f9e95] max-w-xl font-sans mt-2 leading-relaxed">
                  Attaches eBPF C probes directly to kernel tracepoints. Streams events over lockless BPF ring buffers with &lt;1% CPU overhead.
                </p>

                <button
                  onClick={prevSlide}
                  className="absolute -left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-[#1f2923] bg-[#131916]/80 flex items-center justify-center text-[#7a8e82] hover:text-[#e5ebe7] transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                  onClick={nextSlide}
                  className="absolute -right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-[#1f2923] bg-[#3c4f45] flex items-center justify-center text-[#e5ebe7] hover:bg-[#4a5f54] transition-all shadow-md"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="pt-2">
                <button
                  onClick={nextSlide}
                  className="w-full bg-[#3c4f45] hover:bg-[#4a5f54] text-[#e5ebe7] font-mono font-bold text-xs py-3.5 px-6 rounded-xl tracking-widest uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <span>SELECT ACCESS MODE →</span>
                </button>
              </div>
            </div>
          )}

          {/* SLIDE 3: ACCESS */}
          {slide === 3 && (
            <div className="w-full h-full flex flex-col justify-between animate-in fade-in duration-300 font-mono">
              <div className="space-y-2 mt-2">
                <div className="inline-block px-2.5 py-1 rounded-md bg-[#131916] border border-[#1f2923] text-[10px] text-[#7a8e82] uppercase tracking-widest font-semibold">
                  HYBRID ENVIRONMENT
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-[#e5ebe7] uppercase">
                  SELECT ACCESS MODE.
                </h1>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-2">
                <div
                  onClick={() => router.push("/dashboard")}
                  className="p-5 rounded-2xl bg-[#131916] border border-[#1f2923] hover:border-[#3c4f45] transition-all cursor-pointer space-y-2 group"
                >
                  <div className="text-[#e5ebe7] font-bold text-sm flex items-center justify-between">
                    <span>1. IN-BROWSER SIMULATION</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">VERCEL READY</span>
                  </div>
                  <p className="text-xs text-[#8f9e95] font-sans leading-relaxed">
                    Test the complete provenance graph, threat alerts, and 1-click kill switch directly in your browser.
                  </p>
                  <div className="text-xs text-[#3c4f45] group-hover:text-[#e5ebe7] font-bold transition-colors pt-1">
                    LAUNCH SIMULATOR →
                  </div>
                </div>

                <div
                  onClick={() => router.push("/dashboard")}
                  className="p-5 rounded-2xl bg-[#131916] border border-[#1f2923] hover:border-[#3c4f45] transition-all cursor-pointer space-y-2 group"
                >
                  <div className="text-[#e5ebe7] font-bold text-sm flex items-center justify-between">
                    <span>2. LOCAL LINUX DAEMON</span>
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">WS://8765</span>
                  </div>
                  <p className="text-xs text-[#8f9e95] font-sans leading-relaxed">
                    Connect to your local Python BCC daemon running kernel tracepoints on Linux/WSL2.
                  </p>
                  <div className="text-xs text-[#3c4f45] group-hover:text-[#e5ebe7] font-bold transition-colors pt-1">
                    CONNECT DAEMON →
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={nextSlide}
                  className="w-full bg-[#3c4f45] hover:bg-[#4a5f54] text-[#e5ebe7] font-mono font-bold text-xs py-3.5 px-6 rounded-xl tracking-widest uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <span>OBTAIN CLEARANCE →</span>
                </button>
              </div>
            </div>
          )}

          {/* SLIDE 4: CLEARANCE */}
          {slide === 4 && (
            <div className="w-full h-full flex flex-col items-center justify-center text-center space-y-5 animate-in fade-in duration-300 font-mono">
              <div className="w-14 h-14 rounded-full bg-[#131916] border border-[#3c4f45] flex items-center justify-center text-[#e5ebe7] shadow-xl">
                <CheckCircle2 className="w-7 h-7 text-[#e5ebe7]" />
              </div>

              <div className="space-y-2">
                <div className="text-[10px] text-[#7a8e82] uppercase tracking-widest">SECURITY CLEARANCE APPROVED</div>
                <h1 className="text-3xl sm:text-5xl font-black text-[#e5ebe7] uppercase tracking-tight">
                  WELCOME, {savedCallsign || "AGENT"}
                </h1>
                <p className="text-xs sm:text-sm text-[#8f9e95] max-w-md mx-auto font-sans leading-relaxed">
                  Your clearance token has been generated. Access the live eBPF runtime defense console.
                </p>
              </div>

              <div className="w-full max-w-md pt-2">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full bg-[#3c4f45] hover:bg-[#4a5f54] text-[#e5ebe7] font-mono font-bold text-xs py-4 px-6 rounded-xl tracking-widest uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                >
                  <span>ENTER LIVE CONSOLE →</span>
                </button>
              </div>
            </div>
          )}

        </main>

        {/* ─── Bottom Page Pagination Dots (Exact from Screenshot) ─── */}
        <footer className="flex items-center justify-center gap-2 pt-2 shrink-0 z-20">
          {[0, 1, 2, 3, 4].map((i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                slide === i ? "bg-[#e5ebe7] w-2.5 h-2.5" : "bg-[#28352e] hover:bg-[#3c4f45]"
              }`}
            />
          ))}
        </footer>

      </div>
    </div>
  );
}
