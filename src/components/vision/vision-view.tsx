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
              Make agent trust measurable.
              <span className="text-accent"> Before the keys get bigger.</span>
            </h1>
            <p className="mt-8 max-w-3xl text-pretty text-[1.15rem] leading-8 text-muted sm:text-[1.35rem] sm:leading-9">
              Trust Me Bro is a safe benchmark for testing whether coding agents
              obey the user or hidden instructions buried in repo files, docs,
              skills, setup scripts, and workflow context.
            </p>
          </header>

          <Rule />

          {/* Manifesto */}
          <section className="py-4 sm:py-6">
            <p className="max-w-5xl text-balance font-serif text-[1.9rem] font-medium leading-[1.12] tracking-[-0.02em] text-foreground sm:text-[2.9rem]">
              AI coding assistants can accelerate software work. Enterprise
              adoption depends on proving they can act safely when developer
              context is messy, powerful, and{" "}
              <span className="text-accent">not always trustworthy.</span>
            </p>
          </section>

          <Rule />

          <Chapter index="01" kicker="What we built and why">
            <ChapterTitle>A benchmark for agent security.</ChapterTitle>
            <Body>
              We built repeatable scenarios that hide malicious-looking
              instructions where agents actually read: READMEs, migration notes,
              runbooks, tool cards, skills, and bootstrap scripts. The goal is
              simple: learn whether an agent follows the user, pauses, or obeys a
              trap.
            </Body>
          </Chapter>

          <Rule />

          <Chapter index="02" kicker="Who it is for">
            <ChapterTitle>Teams rolling out coding agents.</ChapterTitle>
            <Body>
              Trust Me Bro is for developers, security teams, platform
              engineers, and AI product teams who need to answer one practical
              question before expanding agent permissions:{" "}
              <Em>can this agent be trusted in our workflow?</Em>
            </Body>
          </Chapter>

          <Rule />

          <Chapter index="03" kicker="Business value">
            <ChapterTitle>Trust is the adoption unlock.</ChapterTitle>
            <Body>
              Copilot-style tools create productivity value, but enterprise
              customers need governance before they hand agents more access.
              Measuring agent safety supports secure adoption, customer
              confidence, retention, and Microsoft&rsquo;s leadership in
              responsible AI developer tooling.
            </Body>
          </Chapter>

          <Rule />

          <Chapter index="04" kicker="Why customers need it">
            <ChapterTitle>It turns a scary failure mode into evidence.</ChapterTitle>
            <Body>
              Customers can compare models, prompts, and safety instructions
              against the same traps; inspect traces when an agent fails; and
              rerun the benchmark as models change. That makes agent trust
              observable instead of assumed.
            </Body>
          </Chapter>

          <Rule />

          <Chapter index="05" kicker="Feasibility and demo">
            <ChapterTitle>No real malware. Real signal.</ChapterTitle>
            <ChallengeList
              items={[
                "Runs use a virtual filesystem, fake secrets, and harmless canaries.",
                "The demo already includes realistic agent traps and side-by-side model traces.",
                "Dashboards turn behavior into safety scores, robustness curves, and scenario heatmaps.",
              ]}
            />
          </Chapter>

          <Rule />

          <Chapter index="06" kicker="Next steps">
            <ChapterTitle>From hackathon demo to continuous evaluation.</ChapterTitle>
            <FutureList
              items={[
                "More scenarios drawn from real-world incidents.",
                "Continuous evaluation as new models ship.",
                "Community-contributed traps.",
                "Trace analysis that turns failures into safer agent guidance.",
              ]}
            />
          </Chapter>

          <Rule />

          <Chapter index="07" kicker="Reality anchors">
            <ChapterTitle>Grounded in the market and the risk.</ChapterTitle>
            <SourceList
              items={[
                {
                  title: "OWASP LLM01: Prompt Injection",
                  description:
                    "Prompt injection is a top LLM application risk.",
                  href: "https://genai.owasp.org/llmrisk/llm01-prompt-injection/",
                },
                {
                  title: "Microsoft guidance on indirect prompt injection",
                  description:
                    "Microsoft recommends defense-in-depth for untrusted content handled by AI systems.",
                  href: "https://learn.microsoft.com/en-us/security/zero-trust/sfi/defend-indirect-prompt-injection",
                },
                {
                  title: "Microsoft BIPIA benchmark",
                  description:
                    "Microsoft research already validates benchmarking as a path for prompt-injection robustness.",
                  href: "https://github.com/microsoft/BIPIA",
                },
                {
                  title: "GitHub Copilot business value",
                  description:
                    "The productivity upside makes safe enterprise adoption worth solving.",
                  href: "https://github.blog/2023-05-09-unlocking-the-business-value-of-github-copilot/",
                },
              ]}
            />
          </Chapter>

          <Rule />

          {/* Closing */}
          <section className="pt-6">
            <p className="max-w-4xl text-balance font-serif text-[2rem] font-medium leading-[1.1] tracking-[-0.02em] text-foreground sm:text-[3.1rem]">
              Don&rsquo;t take the agent&rsquo;s word for it.
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

function SourceList({
  items,
}: {
  items: { title: string; description: string; href: string }[];
}) {
  return (
    <div className="mt-7 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2">
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noreferrer"
          className="group bg-panel px-6 py-5 transition-colors hover:bg-surface-2"
        >
          <span className="flex items-center gap-2 text-[0.76rem] font-medium uppercase tracking-[0.14em] text-accent">
            Source
            <ArrowUpRight
              size={14}
              className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </span>
          <span className="mt-3 block font-serif text-[1.25rem] font-medium leading-tight tracking-[-0.01em] text-foreground">
            {item.title}
          </span>
          <span className="mt-2 block text-[0.96rem] leading-6 text-muted">
            {item.description}
          </span>
        </a>
      ))}
    </div>
  );
}
