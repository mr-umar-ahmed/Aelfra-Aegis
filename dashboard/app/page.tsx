"use client";

import Link from "next/link";
import { ArrowUpRight, Crosshair, LockKeyhole, ShieldCheck, Terminal } from "lucide-react";

const telemetry = [
  ["TRACEPOINTS", "openat · execve · connect"],
  ["LATENCY", "0.84ms median"],
  ["POLICY", "enforce / quarantine"],
];

export default function OnboardingLanding() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="aegis-grid absolute inset-0 opacity-70" aria-hidden="true" />
      <header className="relative z-10 mx-auto flex w-full max-w-[1440px] items-center justify-between px-6 py-6 lg:px-12">
        <div className="flex items-center gap-3 font-mono text-sm font-bold tracking-[0.22em]">
          <span className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-primary"><ShieldCheck /></span>
          AELFRA / AEGIS
        </div>
        <div className="hidden items-center gap-8 font-mono text-[10px] tracking-[0.2em] text-muted-foreground md:flex">
          <span>RUNTIME DEFENSE SYSTEM</span><span>BUILD 1.0.7</span>
        </div>
        <Link href="/dashboard" className="group flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 font-mono text-[10px] font-bold tracking-[0.16em] transition-colors hover:border-primary hover:text-primary">
          OPEN CONSOLE <ArrowUpRight className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-96px)] w-full max-w-[1440px] items-center gap-12 px-6 pb-12 pt-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-12 lg:pt-0">
        <div className="max-w-2xl">
          <div className="mb-8 flex items-center gap-3 font-mono text-[10px] font-bold tracking-[0.24em] text-primary"><span className="size-2 rounded-full bg-primary shadow-[0_0_16px_hsl(var(--primary))]" /> LIVE KERNEL OBSERVABILITY</div>
          <h1 className="text-balance font-mono text-[clamp(3.5rem,8vw,8.4rem)] font-bold leading-[0.85] tracking-[-0.08em]">DEFENSE<br /><span className="text-primary">BEYOND</span><br />THE BUILD.</h1>
          <p className="mt-8 max-w-lg text-pretty text-base leading-7 text-muted-foreground">Aelfra Aegis observes the runtime layer your scanners never see. Detect supply-chain attacks at the kernel boundary, then stop them before secrets leave the process.</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/dashboard" className="flex items-center gap-3 rounded-lg bg-primary px-5 py-3 font-mono text-xs font-bold tracking-[0.12em] text-primary-foreground transition-transform hover:-translate-y-0.5">INITIALIZE MONITOR <ArrowUpRight /></Link>
            <Link href="/dashboard" className="flex items-center gap-3 rounded-lg border border-border bg-card px-5 py-3 font-mono text-xs font-bold tracking-[0.12em] transition-colors hover:border-primary hover:text-primary"><Terminal /> VIEW TELEMETRY</Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-2xl lg:translate-y-4">
          <div className="relative overflow-hidden rounded-[2rem] border-[3px] border-foreground/80 bg-card p-3 shadow-[0_30px_100px_hsl(var(--primary)/0.12)]">
            <div className="relative min-h-[420px] overflow-hidden rounded-[1.4rem] border border-border bg-background p-6 sm:min-h-[520px] sm:p-9">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_38%,hsl(var(--primary)/0.14),transparent_31%),linear-gradient(135deg,transparent_40%,hsl(var(--accent)/0.08))]" />
              <div className="relative flex items-center justify-between font-mono text-[10px] tracking-[0.18em] text-muted-foreground"><span>AEGIS / SENTINEL NODE</span><span className="text-primary">● ARMED</span></div>
              <div className="relative flex min-h-[310px] items-center justify-center sm:min-h-[380px]">
                <div className="sentinel-ring flex size-56 items-center justify-center rounded-full border border-primary/50 sm:size-72"><div className="flex size-36 items-center justify-center rounded-full border-2 border-primary bg-primary/10 shadow-[0_0_70px_hsl(var(--primary)/0.3)] sm:size-48"><Crosshair className="size-20 text-primary sm:size-28" /></div></div>
                <div className="absolute left-0 top-1/4 hidden rounded border border-border bg-card/90 px-3 py-2 font-mono text-[9px] tracking-wider sm:block"><span className="text-primary">●</span> RING BUFFER<br /><span className="text-muted-foreground">12,884 events / sec</span></div>
                <div className="absolute right-0 top-1/3 rounded border border-border bg-card/90 px-3 py-2 font-mono text-[9px] tracking-wider"><span className="text-accent">●</span> POLICY ENGINE<br /><span className="text-muted-foreground">QUARANTINE READY</span></div>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded border border-primary/40 bg-primary/10 px-4 py-2 font-mono text-[9px] tracking-[0.18em] text-primary">KERNEL INTEGRITY: NOMINAL</div>
              </div>
              <div className="relative grid grid-cols-3 gap-3 border-t border-border pt-5">{telemetry.map(([label, value]) => <div key={label}><div className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground">{label}</div><div className="mt-1 text-[11px] font-semibold text-foreground">{value}</div></div>)}</div>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-center gap-2 font-mono text-[10px] tracking-[0.18em] text-muted-foreground"><LockKeyhole /> ZERO TRUST / ZERO DRAMA</div>
        </div>
      </section>
    </main>
  );
}
