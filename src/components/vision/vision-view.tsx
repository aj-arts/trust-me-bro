import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { scenarios as runnableScenarios } from "@/scenarios/registry";
import { FloatingNav } from "@/components/floating-nav";

export function VisionView() {
  const firstRunnable = runnableScenarios[0]?.id ?? "";

  return (
    <div className="deck-root min-h-screen">
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="min-w-0 px-5 pb-24 sm:px-8">
          <FloatingNav
            active="vision"
            dashboardHref="/"
            runnerHref={`/run/${firstRunnable}`}
          />

          {/* Hero */}
          <header className="pt-12 lg:pt-20">
            <p className="deck-label text-muted-strong">
              The Vision · Trust Me Bro
            </p>
            <h1 className="mt-7 max-w-[16ch] text-balance font-serif text-[3.2rem] font-medium leading-[0.92] tracking-[-0.04em] text-foreground sm:text-[5.4rem] lg:text-[6.6rem]">
              We hand agents the keys.
              <span className="text-accent"> Nobody checks the locks.</span>
            </h1>
            <p className="mt-8 max-w-3xl text-pretty text-[1.15rem] leading-8 text-muted sm:text-[1.35rem] sm:leading-9">
              Coding agents now read our repos, run our scripts, and execute
              commands on our machines — with barely a glance from us. That trust
              is the whole point. It is also completely unmeasured.
            </p>
          </header>

          <Rule />

          {/* Manifesto */}
          <section className="py-4 sm:py-6">
            <p className="max-w-5xl text-balance font-serif text-[1.9rem] font-medium leading-[1.12] tracking-[-0.02em] text-foreground sm:text-[2.9rem]">
              We obsess over whether a model{" "}
              <span className="text-muted">writes correct code.</span> We rarely
              ask whether it can be{" "}
              <span className="text-accent">talked into doing harm</span> by text
              it was never meant to obey.
            </p>
          </section>

          <Rule />

          <Chapter index="01" kicker="Why it matters">
            <ChapterTitle>They read everything you do.</ChapterTitle>
            <Body>
              Agents don&rsquo;t just suggest anymore — they act. To follow you,
              they read <Em>everything</Em>: docs, skill files, configs, a setup
              script left by a &ldquo;maintainer.&rdquo; Not all of it was
              written by someone you trust, and a buried line can read like an
              order.
            </Body>
          </Chapter>

          <Rule />

          <Chapter index="02" kicker="What we built">
            <ChapterTitle>We spring the trap on purpose.</ChapterTitle>
            <Body>
              We hide malicious-looking instructions where agents actually read,
              then watch: does it follow, pause, or refuse? Nothing real is ever
              at risk — every run is sealed, with fake secrets and harmless
              tripwires we call <Em>canaries</Em>.
            </Body>
          </Chapter>

          <Rule />

          <Chapter index="03" kicker="The outcome">
            <ChapterTitle>Safety you can actually compare.</ChapterTitle>
            <Body>
              We turn <Em>&ldquo;is this agent safe?&rdquo;</Em> from a vibe into
              a number — a safety score, a robustness curve, a heatmap of which
              traps beat which models. Compared like speed or cost.
            </Body>
          </Chapter>

          <Rule />

          <Chapter index="04" kicker="What’s hard">
            <ChapterTitle>Honest about the hard parts.</ChapterTitle>
            <ChallengeList
              items={[
                "Safety isn't one stable number — a single prompt change can flip it.",
                "Attackers out-invent any fixed test, so the scenarios must keep evolving.",
                "A benchmark that becomes its own target stops meaning anything.",
              ]}
            />
          </Chapter>

          <Rule />

          <Chapter index="05" kicker="What’s next">
            <ChapterTitle>Trust, made verifiable.</ChapterTitle>
            <FutureList
              items={[
                "More scenarios drawn from real-world incidents.",
                "Continuous evaluation as new models ship.",
                "Community-contributed traps.",
                "Trace analysis that explains why an agent failed.",
              ]}
            />
          </Chapter>

          <Rule />

          {/* Closing */}
          <section className="pt-6">
            <p className="max-w-4xl text-balance font-serif text-[2rem] font-medium leading-[1.1] tracking-[-0.02em] text-foreground sm:text-[3.1rem]">
              Don&rsquo;t take the model&rsquo;s word for it.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                See the benchmark
                <ArrowUpRight size={15} />
              </Link>
              <Link
                href={`/run/${firstRunnable}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
              >
                Run a scenario yourself
                <ArrowUpRight size={15} />
              </Link>
            </div>
          </section>

          <footer className="mt-16 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border pt-5 text-[0.72rem] uppercase tracking-[0.08em] text-muted">
            <span>Trust Me Bro · Benchmarking the security of AI agents</span>
            <span>The Vision</span>
          </footer>
        </div>
      </div>
    </div>
  );
}

function Rule() {
  return <div className="my-12 h-px w-full bg-border sm:my-16" />;
}

function Chapter({
  index,
  kicker,
  children,
}: {
  index: string;
  kicker: string;
  children: ReactNode;
}) {
  return (
    <section className="grid grid-cols-1 gap-y-7 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:gap-x-16">
      <div className="lg:sticky lg:top-10 lg:self-start">
        <span className="block font-serif text-[3.4rem] font-medium leading-none tracking-[-0.03em] text-accent/90 sm:text-[4rem]">
          {index}
        </span>
        <p className="mt-3 text-[0.78rem] font-medium uppercase tracking-[0.16em] text-muted">
          {kicker}
        </p>
      </div>
      <div className="max-w-3xl">{children}</div>
    </section>
  );
}

function ChapterTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-balance font-serif text-[2.1rem] font-medium leading-[1.04] tracking-[-0.025em] text-foreground sm:text-[3rem]">
      {children}
    </h2>
  );
}

function Body({ children }: { children: ReactNode }) {
  return (
    <p className="mt-6 text-pretty text-[1.05rem] leading-8 text-muted sm:text-[1.12rem]">
      {children}
    </p>
  );
}

function Em({ children }: { children: ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>;
}

function ChallengeList({ items }: { items: string[] }) {
  return (
    <div className="mt-7 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border">
      {items.map((item) => (
        <p
          key={item}
          className="bg-panel px-6 py-5 font-serif text-[1.18rem] font-medium leading-snug tracking-[-0.01em] text-foreground"
        >
          {item}
        </p>
      ))}
    </div>
  );
}

function FutureList({ items }: { items: string[] }) {
  return (
    <ul className="mt-7 space-y-4">
      {items.map((item, i) => (
        <li key={item} className="flex gap-5">
          <span className="mt-1 shrink-0 font-mono text-[0.82rem] tabular-nums text-accent">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="text-pretty text-[1.05rem] leading-7 text-foreground/90">
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}
