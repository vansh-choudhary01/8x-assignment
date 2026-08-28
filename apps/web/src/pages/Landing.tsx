import {
  ArrowRight,
  BarChart3,
  Building2,
  Compass,
  Globe,
  IdCard,
  Link2,
  Sparkles,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";

const brandPoints = [
  { icon: Globe, text: "AI reads your real website and drafts company intelligence for you to confirm." },
  { icon: Sparkles, text: "Describe a goal in plain language — Naano drafts the campaign brief and requirements." },
  { icon: BarChart3, text: "Every post gets a tracking link, so clicks, leads, pipeline, and revenue stay attributed." },
];

const creatorPoints = [
  { icon: IdCard, text: "Your card is built from a real, public LinkedIn or X profile — no forms, no OAuth." },
  { icon: Compass, text: "Apply to open campaigns or accept invites that already fit your audience and topics." },
  { icon: Link2, text: "Get paid per post, with earnings and funnel performance tracked in one place." },
];

const steps = [
  {
    tag: "01",
    title: "Add a real source",
    body: "A company website for brands, a public LinkedIn or X profile for creators. Nothing is invented.",
  },
  {
    tag: "02",
    title: "Naano understands it",
    body: "AI turns that source into company intelligence or a Creator Card, explained and ready to confirm.",
  },
  {
    tag: "03",
    title: "Work, then measure it",
    body: "Match, brief, and message in one workspace. Every click, lead, and dollar traces back to a post.",
  },
];

export function LandingPage() {
  return (
    <AppShell>
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-sky via-sky to-surface">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-[-10rem] h-[32rem] w-[56rem] -translate-x-1/2 rounded-full bg-sky-deep opacity-60 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <span className="badge-pill mx-auto">
            <Sparkles className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
            Built on real LinkedIn &amp; X profiles
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-ink sm:text-6xl">
            Find the creator who already speaks to your buyer.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-ink-muted sm:text-base">
            Brands turn a real website into a campaign. Creators turn a real profile into a card. Every
            match comes with a reason, every post with a tracking link back to real pipeline.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Link to="/login">
              <Button size="lg" className="rounded-full px-7">
                Get started
              </Button>
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink transition-colors hover:text-primary"
            >
              See how it works
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Building2 className="h-5 w-5" strokeWidth={2} />
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-primary">For brands</p>
            <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-ink">
              Launch creator campaigns without the guesswork.
            </h2>
            <ul className="mt-5 space-y-3.5">
              {brandPoints.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2} />
                  <span className="text-sm leading-relaxed text-ink-muted">{text}</span>
                </li>
              ))}
            </ul>
            <Link to="/login" className="mt-6 inline-flex">
              <Button variant="outline" className="rounded-full">
                I&apos;m a brand
              </Button>
            </Link>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Users className="h-5 w-5" strokeWidth={2} />
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-primary">For creators</p>
            <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-ink">
              Turn your audience into paid collaborations.
            </h2>
            <ul className="mt-5 space-y-3.5">
              {creatorPoints.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2} />
                  <span className="text-sm leading-relaxed text-ink-muted">{text}</span>
                </li>
              ))}
            </ul>
            <Link to="/login" className="mt-6 inline-flex">
              <Button variant="outline" className="rounded-full">
                I&apos;m a creator
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-lg">
            <p className="page-kicker">How it works</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Three steps, grounded in real data.
            </h2>
          </div>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.tag} className="relative">
                <p className="text-3xl font-semibold tracking-tight text-primary/25">{step.tag}</p>
                <h3 className="mt-3 text-[15px] font-semibold tracking-tight text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.body}</p>
                {index < steps.length - 1 ? (
                  <div className="mt-6 hidden h-px w-full bg-border sm:block" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky to-sky-strong px-8 py-14 text-center sm:px-14">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Ready when you are</p>
          <h2 className="mx-auto mt-3 max-w-xl text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Sign in with Google and add your first real source.
          </h2>
          <div className="mt-7">
            <Link to="/login">
              <Button size="lg" className="rounded-full px-7">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
