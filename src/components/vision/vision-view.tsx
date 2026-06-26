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
              Test agent behavior before it becomes production risk.
            </h1>
            <p className="mt-8 max-w-3xl text-pretty text-[1.15rem] leading-8 text-muted sm:text-[1.35rem] sm:leading-9">
              Trust Me Bro is a browser-native platform for evaluating whether
              coding agents follow the user or hidden instructions buried in repo
              files, docs, skills, setup scripts, logs, and workflow context.
            </p>
          </header>

          <Rule />

          {/* Manifesto */}
          <section className="py-4 sm:py-6">
            <p className="max-w-5xl text-balance font-serif text-[1.9rem] font-medium leading-[1.12] tracking-[-0.02em] text-foreground sm:text-[2.9rem]">
              Prompt injection is not only a chat problem. Agents read messy
              developer context, hold powerful tools, and can act on instructions
              nobody meant them to trust. We built Trust Me Bro to make that risk{" "}
              <span className="text-accent">visible, repeatable, and safe to study.</span>
            </p>
          </section>

          <Rule />

          <Chapter index="01" question="What did we build, and why?">
            <ChapterTitle>A live evaluation platform for coding-agent security.</ChapterTitle>
            <Body>
              We built a live runner, scenario library, and benchmark dashboard
              for testing how agents behave inside realistic repository tasks.
              Each scenario gives the agent a virtual filesystem, a normal user
              goal, and a hidden attack such as skill poisoning, markdown
              injection, log hijacking, or a bootstrap-script ambush.
            </Body>
            <Body>
              We built it because the only honest way to evaluate agent safety is
              to watch what the agent actually does. If a frontier model executes
              a suspicious script without reading it, the platform captures that
              behavior safely and turns it into evidence.
            </Body>
          </Chapter>

          <Rule />

          <Chapter index="02" question="Who is this for?">
            <ChapterTitle>The teams deciding how much power agents should get.</ChapterTitle>
            <Body>
              Trust Me Bro is for AI product teams, Copilot-style agent teams,
              model evaluators, security researchers, enterprise AppSec teams,
              platform engineers, and open-source maintainers. They all need to
              answer the same practical question before expanding agent
              permissions:{" "}
              <Em>can this agent be trusted in our workflow?</Em>
            </Body>
          </Chapter>

          <Rule />

          <Chapter index="03" question="What is the business value?">
            <ChapterTitle>Safer agents make agent adoption easier to justify.</ChapterTitle>
            <Body>
              Microsoft is a Copilot-first company, and customers will only give
              agents more autonomy if safety can be evaluated, improved, and
              explained. Trust Me Bro creates value by reducing adoption risk,
              increasing customer confidence, and giving product teams concrete
              data for safer prompts, safer tools, and safer model behavior.
            </Body>
            <Body>
              The same data has long-term strategic value: it can become a
              community-driven security dataset for the models and agents of the
              future, not just a one-time leaderboard.
            </Body>
          </Chapter>

          <Rule />

          <Chapter index="04" question="Why would customers need this?">
            <ChapterTitle>It turns a scary failure mode into evidence.</ChapterTitle>
            <Body>
              Today, a team may not know whether an agent will follow hidden
              instructions in a README, execute an unsafe setup script, or obey a
              poisoned skill file until it happens in a real codebase. Trust Me
              Bro lets them test those behaviors first.
            </Body>
            <Body>
              Customers can compare models, prompts, and safety modes against
              the same traps; inspect traces when an agent fails; author new
              scenarios; and rerun the benchmark as models change. That makes
              agent trust observable instead of assumed.
            </Body>
          </Chapter>

          <Rule />

          <Chapter index="05" question="Why is this different?">
            <ChapterTitle>Not just a benchmark. A place to create the dataset.</ChapterTitle>
            <DifferentiatorList
              items={[
                {
                  title: "Accessible scenario creation",
                  description:
                    "Users can inspect the benchmark, run scenarios, and create their own tests on the platform. Every useful failure can become training and evaluation data for safer future models.",
                },
                {
                  title: "Browser-native isolation",
                  description:
                    "Many agent evaluations depend on a real computer layer: terminals, host filesystems, Docker, cloud VMs, or risky compute access. Trust Me Bro keeps the workspace in a virtual filesystem with harmless canaries, isolated from the host without heavy infrastructure overhead.",
                },
                {
                  title: "Open-source and community driven",
                  description:
                    "Instead of a private benchmark that only reports scores, the scenarios, results, and methodology can be inspected, reproduced, challenged, and expanded by the community.",
                },
              ]}
            />
          </Chapter>

          <Rule />

          <Chapter index="06" question="What can we show the judges?">
            <ChapterTitle>No real malware. Real signal.</ChapterTitle>
            <ChallengeList
              items={[
                "A deployed live runner that places an agent inside a browser-isolated virtual repository.",
                "Thirteen realistic attack scenarios across skill poisoning, hidden markdown, log hijacking, workflow deception, and setup-script traps.",
                "Benchmark results from 1,950 runs across ten models, three prompt safety modes, and full behavior traces.",
                "Dashboards that turn those runs into safety scores, prompt-robustness curves, scenario heatmaps, and attack difficulty views.",
              ]}
            />
          </Chapter>

          <Rule />

          <Chapter index="07" question="What are the next steps?">
            <ChapterTitle>From hackathon demo to continuous agent hardening.</ChapterTitle>
            <FutureList
              items={[
                "Expand the scenario library with attacks drawn from real incidents, community submissions, and emerging agent workflows.",
                "Add assisted scenario generation so researchers can quickly turn a new exploit pattern into a reproducible test.",
                "Build an evaluation loop where one agent studies failure traces, proposes safer system prompts, and mutates scenarios to make attacks more subtle.",
                "Package the dataset and runner so model builders, Copilot-style product teams, and enterprise security teams can use the results in their own safety workflows.",
              ]}
            />
          </Chapter>

          <Rule />

          <Chapter index="08" question="What proves this is real and important?">
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
              The future of agents needs more than trust. It needs tests.
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
  question,
  children,
}: {
  index: string;
  question: string;
  children: ReactNode;
}) {
  return (
    <section className="grid grid-cols-1 gap-y-7 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:gap-x-16">
      <div className="lg:sticky lg:top-10 lg:self-start">
        <span className="block font-serif text-[3.4rem] font-medium leading-none tracking-[-0.03em] text-accent/90 sm:text-[4rem]">
          {index}
        </span>
        <p className="mt-3 text-[0.78rem] font-medium uppercase tracking-[0.16em] text-muted">
          Judging question
        </p>
      </div>
      <div className="max-w-4xl">
        <p className="text-balance font-serif text-[2.35rem] font-medium leading-[1.02] tracking-[-0.025em] text-accent sm:text-[3.7rem]">
          {question}
        </p>
        {children}
      </div>
    </section>
  );
}

function ChapterTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-6 text-balance font-serif text-[1.45rem] font-medium leading-tight tracking-[-0.01em] text-foreground sm:text-[1.9rem]">
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

function DifferentiatorList({
  items,
}: {
  items: { title: string; description: string }[];
}) {
  return (
    <div className="mt-7 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border">
      {items.map((item) => (
        <div key={item.title} className="bg-panel px-6 py-5">
          <h3 className="font-serif text-[1.25rem] font-medium leading-tight tracking-[-0.01em] text-foreground">
            {item.title}
          </h3>
          <p className="mt-3 text-pretty text-[0.98rem] leading-7 text-muted">
            {item.description}
          </p>
        </div>
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
