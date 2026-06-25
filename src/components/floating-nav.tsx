import Link from "next/link";

type FloatingNavProps = {
  active: "dashboard" | "runner" | "vision";
  runnerHref: string;
  dashboardHref?: string;
  visionHref?: string;
  variant?: "floating" | "rail" | "inline";
  className?: string;
};

export function FloatingNav({
  active,
  runnerHref,
  dashboardHref = "/",
  visionHref = "/vision",
  variant = "floating",
  className,
}: FloatingNavProps) {
  const itemClass = (isActive: boolean) =>
    variant === "inline"
      ? isActive
        ? "rounded-full bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent shadow-[0_0_0_1px_var(--accent-soft)]"
        : "rounded-full px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
      : variant === "rail"
      ? isActive
        ? "rounded-full bg-accent-soft px-4 py-2 text-sm font-medium text-accent shadow-[0_0_0_1px_var(--accent-soft)]"
        : "rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
      : isActive
        ? "rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-[0_0_18px_-8px_var(--foreground)]"
        : "rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground";

  const innerClassName =
    variant === "inline"
      ? "inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 p-0.5"
      : variant === "rail"
      ? "inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 p-1"
      : "inline-flex items-center gap-1 rounded-full border border-border-strong bg-background/85 p-1 shadow-[0_18px_45px_-28px_rgba(0,0,0,0.85)] backdrop-blur";

  if (variant === "inline") {
    return (
      <div className={`${innerClassName} ${className ?? ""}`}>
        <NavLinks
          active={active}
          dashboardHref={dashboardHref}
          runnerHref={runnerHref}
          visionHref={visionHref}
          itemClass={itemClass}
        />
      </div>
    );
  }

  if (variant === "rail") {
    return (
      <nav className={`relative z-30 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur ${className ?? ""}`}>
        <div className="mx-auto flex max-w-[1500px] justify-center">
          <div className={innerClassName}>
            <NavLinks
              active={active}
              dashboardHref={dashboardHref}
              runnerHref={runnerHref}
              visionHref={visionHref}
              itemClass={itemClass}
            />
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className={`relative z-30 flex justify-center pt-5 ${className ?? ""}`}>
      <div className={innerClassName}>
        <NavLinks
          active={active}
          dashboardHref={dashboardHref}
          runnerHref={runnerHref}
          visionHref={visionHref}
          itemClass={itemClass}
        />
      </div>
    </nav>
  );
}

type NavLinksProps = {
  active: "dashboard" | "runner" | "vision";
  dashboardHref: string;
  runnerHref: string;
  visionHref: string;
  itemClass: (isActive: boolean) => string;
};

function NavLinks({
  active,
  dashboardHref,
  runnerHref,
  visionHref,
  itemClass,
}: NavLinksProps) {
  return (
    <>
      <Link
        href={dashboardHref}
        aria-current={active === "dashboard" ? "page" : undefined}
        className={itemClass(active === "dashboard")}
      >
        Dashboard
      </Link>
      <Link
        href={runnerHref}
        aria-current={active === "runner" ? "page" : undefined}
        className={itemClass(active === "runner")}
      >
        Live Runner
      </Link>
      <Link
        href={visionHref}
        aria-current={active === "vision" ? "page" : undefined}
        className={itemClass(active === "vision")}
      >
        The Vision
      </Link>
    </>
  );
}
