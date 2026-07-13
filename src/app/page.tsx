import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  FileSignature,
  Handshake,
  LineChart,
  Lock,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: Sparkles,
    title: "AI matching",
    body: "Compatibility scores based on audience, industry, geo, capacity, and trust — not vanity metrics.",
  },
  {
    icon: Handshake,
    title: "Structured proposals",
    body: "Negotiation, counter-offers, revision history, and acceptance that spins up a real deal room.",
  },
  {
    icon: Workflow,
    title: "Deal rooms",
    body: "Milestones, tasks, decisions, files, and activity — Linear-grade project ops for product launches.",
  },
  {
    icon: FileSignature,
    title: "Smart contracts",
    body: "Revenue share, IP, data ownership, and termination clauses with e-signature readiness.",
  },
  {
    icon: Lock,
    title: "Escrow payments",
    body: "Stripe Connect funded escrow with milestone unlocks, invoices, and payout history.",
  },
  {
    icon: ShieldCheck,
    title: "Trust & reputation",
    body: "Verification badges, deal health scores, and reputation that compounds after every partnership.",
  },
];

const steps = [
  "Build a verified creator or operator profile",
  "Discover partners with filters and AI match scores",
  "Negotiate a proposal with clear commercial terms",
  "Execute in a private deal room with escrow protection",
];

const roles = [
  "Creators",
  "Operators",
  "Manufacturers",
  "Designers",
  "Lawyers",
  "Marketers",
  "Photographers",
  "Warehouses",
  "Investors",
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.35_0.08_262/0.25),transparent_55%)]" />
          <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-20 md:pt-28">
            <Badge variant="secondary" className="mb-6">
              A Favverse product
            </Badge>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
              The operating system for creator-led brands
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground text-pretty">
              Replace Instagram DMs and handshake deals with verified partners, structured
              collaboration, escrow-backed payments, and AI-assisted decision making.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/sign-up">
                  Launch on Ceverse
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/sign-in">Sign in</Link>
              </Button>
            </div>
            <div className="mt-16 grid gap-4 sm:grid-cols-3">
              {[
                { label: "Partnership stack", value: "LinkedIn + DocuSign + Escrow" },
                { label: "Built for", value: "Physical product launches" },
                { label: "Trust layer", value: "Verification + reputation" },
              ].map((stat) => (
                <Card key={stat.label} className="bg-card/60">
                  <CardHeader className="pb-2">
                    <CardDescription>{stat.label}</CardDescription>
                    <CardTitle className="text-base font-medium">{stat.value}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="product" className="border-t border-border py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-12 max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight">Everything required to ship a product</h2>
              <p className="mt-3 text-muted-foreground">
                Marketplace, proposals, deal rooms, contracts, payments, messaging, analytics —
                one secure system of record.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Card key={feature.title} className="bg-card/50">
                  <CardHeader>
                    <feature.icon className="mb-2 h-5 w-5 text-primary" aria-hidden />
                    <CardTitle className="text-base">{feature.title}</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      {feature.body}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="border-t border-border py-20">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">How Ceverse works</h2>
              <p className="mt-3 text-muted-foreground">
                A single workflow from discovery to post-launch — with audit logs and payment
                protection at every step.
              </p>
              <ul className="mt-8 space-y-4">
                {steps.map((step, i) => (
                  <li key={step} className="flex gap-3 text-sm">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium">
                      {i + 1}
                    </span>
                    <span className="pt-1 text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Card className="bg-card/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <LineChart className="h-4 w-4 text-primary" />
                  Deal health, always on
                </CardTitle>
                <CardDescription>
                  Risk engines score timeline drift, escrow mismatch, missing clauses, disputes,
                  and partner reputation — with plain-language rationale.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span>Low risk</span>
                  <Badge variant="success">Healthy</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span>Medium risk</span>
                  <Badge variant="warning">Watch</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span>High risk</span>
                  <Badge variant="danger">Intervene</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="roles" className="border-t border-border py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl font-semibold tracking-tight">Built for every seat in the launch</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Creators discover capacity. Operators prove reliability. Specialists plug into deals
              without losing context.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {roles.map((role) => (
                <Badge key={role} variant="outline" className="px-3 py-1 text-sm">
                  {role}
                </Badge>
              ))}
            </div>
            <div className="mt-12 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card/40 p-8">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                  Enterprise-grade security
                </div>
                <h3 className="mt-2 text-xl font-semibold">
                  RBAC, audit logs, rate limits, CSP, signed uploads
                </h3>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  Designed for high-trust commercial activity — not another social inbox.
                </p>
              </div>
              <Button asChild size="lg">
                <Link href="/sign-up">
                  Create account
                  <MessagesSquare className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
