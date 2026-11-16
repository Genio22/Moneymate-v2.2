import { Link, useNavigate } from 'react-router-dom'
import {
  Wallet, ArrowRight, CheckCircle2, Camera, ShieldCheck, Boxes, HandCoins, Landmark,
  Users, ReceiptText, ChevronRight, Banknote, Package, Boxes as AssetIcon, Home,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const BENEFITS = [
  { icon: Wallet, title: 'Every taka traceable', text: 'See exactly how much came in, who holds it, what was spent and what remains — no accounting knowledge needed.' },
  { icon: ShieldCheck, title: 'Source-based verification', text: 'The person who provided the money confirms purchases made with it. Nothing is “confirmed” until the right person checks it.' },
  { icon: Camera, title: 'Receipts in seconds', text: 'Snap the receipt with your phone camera. It attaches to the transaction and stays there, secure and private.' },
  { icon: HandCoins, title: 'Restricted sponsorship', text: 'Sponsors can earmark funds for specific purposes. MoneyMate warns before anyone spends outside the agreed purpose.' },
  { icon: ReceiptText, title: 'Fair reimbursement', text: 'Members who spend their own money get a verified claim the project owes them — tracked until fully settled.' },
  { icon: Boxes, title: 'Materials & assets too', text: 'Contributions are not only cash. Track materials, equipment and facility access with owner and custody.' },
]

const STEPS = [
  { n: '1', title: 'Create your project', text: 'Set a budget, invite members with a link or email.' },
  { n: '2', title: 'Record contributions', text: 'Cash, sponsorships, materials, assets or facility access — with restrictions if any.' },
  { n: '3', title: 'Hand out advances', text: 'Senior gives junior ৳500? Record who gave it and who holds it.' },
  { n: '4', title: 'Spend & snap', text: 'Anyone records a ৳20 purchase in a few taps and attaches the receipt.' },
  { n: '5', title: 'Right person verifies', text: 'The money provider (or manager) confirms — everything is auditable.' },
  { n: '6', title: 'Reconcile', text: 'Live cash position, outstanding claims and restricted-fund balance, always current.' },
]

const CONTRIBS = [
  { icon: Banknote, title: 'Cash & sponsorship', text: '৳500,000 from Sponsor A? Earmark it: ৳300k equipment, ৳100k transport, ৳100k unrestricted.' },
  { icon: Package, title: 'Materials', text: 'Paint, decoration, components — valued and verified without inflating cash.' },
  { icon: AssetIcon, title: 'Assets', text: 'Cameras, laptops, vehicles. Owner keeps ownership; custody is tracked.' },
  { icon: Home, title: 'In-kind access', text: 'A house for filming, studio time — usage rights with start and end dates.' },
]

export default function LandingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const cta = user ? '/app' : '/auth/signup'

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-surface-50/90 backdrop-blur border-b border-surface-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-primary-600 text-white flex items-center justify-center">
              <Wallet size={18} />
            </span>
            <span className="text-[15px] font-bold text-surface-900">MoneyMate</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-surface-600">
            <a href="#benefits" className="hover:text-surface-900">Why MoneyMate</a>
            <a href="#how" className="hover:text-surface-900">How it works</a>
            <a href="#contributions" className="hover:text-surface-900">Contribution types</a>
            <a href="#verification" className="hover:text-surface-900">Verification</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/app" className="h-9 px-4 inline-flex items-center rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link to="/auth/login" className="h-9 px-4 inline-flex items-center rounded-lg text-sm font-medium text-surface-600 hover:bg-surface-100">
                  Log in
                </Link>
                <Link to="/auth/signup" className="h-9 px-4 inline-flex items-center rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,#eef4ff_0%,white_70%)] dark:bg-[radial-gradient(60%_50%_at_50%_0%,#172554_0%,#0f172a_70%)]" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-12 sm:pb-20 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-100 px-3 py-1 text-xs font-medium">
              From Contributions to Reconciliation
            </p>
            <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold tracking-tight text-surface-900 leading-[1.1]">
              Every Contribution Counts.
              <br />
              <span className="text-primary-600">Every Transaction Matters.</span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-surface-600 max-w-xl leading-relaxed">
              Manage project money, contributions, purchases and resources without complicated accounting.
              Members describe what happened — MoneyMate handles the tracking and reconciliation.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to={cta} className="h-12 px-6 inline-flex items-center gap-2 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 shadow-sm">
                {user ? 'Open dashboard' : 'Start free'} <ArrowRight size={17} />
              </Link>
              <a href="#how" className="h-12 px-6 inline-flex items-center rounded-xl bg-surface-50 border border-surface-200 font-semibold text-surface-700 hover:bg-surface-50">
                See how it works
              </a>
            </div>
            <p className="mt-4 text-xs text-surface-400">
              Built for teams, events, film crews, university clubs and community projects.
            </p>
          </div>

          {/* Dashboard preview (CSS mock) */}
          <div className="relative">
            <div className="rounded-2xl border border-surface-200 bg-surface-50 shadow-pop p-4 sm:p-5 rotate-1 hover:rotate-0 transition-transform duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">F</span>
                  <div>
                    <p className="text-sm font-semibold text-surface-900">Freshers' Fest 2026</p>
                    <p className="text-[10px] text-surface-400">Active · 8 members</p>
                  </div>
                </div>
                <span className="text-[10px] font-medium rounded-full bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-200 px-2 py-0.5">
                  Reconciled
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2.5 mb-4">
                {[
                  { label: 'Cash received', value: '৳8,00,000', tone: 'text-accent-700' },
                  { label: 'Spent (verified)', value: '৳2,54,650', tone: 'text-surface-900' },
                  { label: 'Remaining', value: '৳5,45,350', tone: 'text-primary-700' },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-surface-50 border border-surface-100 p-3">
                    <p className="text-[10px] text-surface-400 font-medium">{s.label}</p>
                    <p className={`text-sm font-bold tnum ${s.tone}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {[
                  { t: 'Decoration materials', a: '-৳450', who: 'Karim · from Rahim’s advance', badge: 'Verified', tone: 'bg-accent-50 text-accent-700' },
                  { t: 'Venue advance — Sponsor B', a: '+৳3,00,000', who: 'Restricted: venue only', badge: 'Verified', tone: 'bg-accent-50 text-accent-700' },
                  { t: 'Banner printing', a: '-৳1,200', who: 'Karim · personal funds', badge: 'Pending', tone: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
                ].map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-surface-100 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-surface-800 truncate">{r.t}</p>
                      <p className="text-[10px] text-surface-400 truncate">{r.who}</p>
                    </div>
                    <div className="text-right shrink-0 pl-2">
                      <p className={`text-xs font-bold tnum ${r.a.startsWith('+') ? 'text-accent-700' : 'text-surface-800'}`}>{r.a}</p>
                      <span className={`text-[9px] font-medium rounded-full px-1.5 py-0.5 ${r.tone}`}>{r.badge}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-[10px] text-surface-400">
                <Camera size={12} /> Receipt attached · <ShieldCheck size={12} /> Verified by Rahim · 12 Oct
              </div>
            </div>
            <div className="hidden sm:block absolute -bottom-5 -left-5 rounded-xl bg-slate-900 text-white p-3 shadow-pop -rotate-2">
              <p className="text-[10px] text-slate-300">Advance — Rahim → Karim</p>
              <p className="text-sm font-bold tnum">৳500 <span className="text-[10px] font-normal text-accent-300">· ৳50 left</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="py-14 sm:py-20 bg-surface-50/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-surface-900 tracking-tight">Money tools for real projects, not accountants</h2>
            <p className="mt-2 text-surface-600">
              A frontline member should be able to record a ৳20 purchase on a ৳5 crore project without learning debit and credit.
            </p>
          </div>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BENEFITS.map((b) => (
              <div key={b.title} className="rounded-2xl border border-surface-200 bg-surface-50 p-5 shadow-card">
                <span className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                  <b.icon size={19} />
                </span>
                <h3 className="mt-3 font-semibold text-surface-900">{b.title}</h3>
                <p className="mt-1 text-sm text-surface-600 leading-relaxed">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-surface-900 tracking-tight">How it works</h2>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {STEPS.map((s) => (
              <div key={s.n} className="flex gap-4 rounded-2xl border border-surface-200 bg-surface-50 p-5 shadow-card">
                <span className="w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-semibold text-surface-900">{s.title}</h3>
                  <p className="text-sm text-surface-600 mt-0.5">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contribution types */}
      <section id="contributions" className="py-14 sm:py-20 bg-surface-50/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-surface-900 tracking-tight">Contributions are more than cash</h2>
          <p className="mt-2 text-surface-600 max-w-2xl">
            MoneyMate records what a project actually receives — and keeps cash and non-cash value clearly separate.
            Non-cash contributions never inflate the available cash balance.
          </p>
          <div className="mt-8 grid sm:grid-cols-2 gap-4">
            {CONTRIBS.map((c) => (
              <div key={c.title} className="flex gap-4 rounded-2xl border border-surface-200 bg-surface-50 p-5 shadow-card">
                <span className="w-10 h-10 rounded-xl bg-accent-50 text-accent-700 flex items-center justify-center shrink-0">
                  <c.icon size={19} />
                </span>
                <div>
                  <h3 className="font-semibold text-surface-900">{c.title}</h3>
                  <p className="text-sm text-surface-600 mt-0.5 leading-relaxed">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Verification */}
      <section id="verification" className="py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-surface-900 tracking-tight">The right person verifies — not just anyone</h2>
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-surface-200 bg-surface-50 p-5 shadow-card">
                <p className="text-sm font-semibold text-surface-900 flex items-center gap-2">
                  <Users size={16} className="text-primary-600" /> Spent money someone gave you?
                </p>
                <p className="mt-1.5 text-sm text-surface-600">
                  The provider is asked: <em>“Did you give this money and authorize this purchase?”</em> Their answer,
                  timestamp and name are permanently recorded.
                </p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-surface-50 p-5 shadow-card">
                <p className="text-sm font-semibold text-surface-900 flex items-center gap-2">
                  <ReceiptText size={16} className="text-primary-600" /> Spent your own money?
                </p>
                <p className="mt-1.5 text-sm text-surface-600">
                  A manager verifies the claim and the project owes you the amount — tracked separately until it is
                  partially or fully reimbursed.
                </p>
              </div>
              <p className="text-xs text-surface-500">
                Nobody can verify their own submission. Verification history is immutable.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-surface-200 bg-slate-900 text-white p-6 shadow-pop">
            <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Live example</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center text-xs font-bold shrink-0">R</span>
                <p className="text-slate-300"><b className="text-white">Rahim</b> gives <b className="text-white">Karim</b> <b className="tnum text-white">৳500</b> for decoration.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-accent-600 flex items-center justify-center text-xs font-bold shrink-0">K</span>
                <p className="text-slate-300">Karim buys materials for <b className="tnum text-white">৳450</b>, snaps the receipt, submits.</p>
              </div>
              <div className="rounded-xl bg-[rgb(255_255_255_/_0.05)] ring-1 ring-inset ring-white/10 p-3.5">
                <p className="text-xs font-semibold text-amber-300">PENDING SOURCE VERIFICATION</p>
                <p className="text-xs text-slate-300 mt-1">Rahim confirms → advance reconciled, ৳50 remains with Karim.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-accent-600 flex items-center justify-center text-xs font-bold shrink-0">K</span>
                <p className="text-slate-300">Next week Karim spends <b className="tnum text-white">৳350</b> of <b>his own</b> money → manager verifies → project owes him ৳350.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-16 sm:pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="rounded-3xl bg-primary-700 text-white px-6 py-10 sm:px-12 text-center relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-primary-500/30 blur-3xl" />
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Ready to make every taka count?</h2>
            <p className="mt-2 text-primary-100 max-w-xl mx-auto">
              Set up your project in under two minutes. Invite your team. Start recording.
            </p>
            <Link
              to={cta}
              className="mt-6 inline-flex h-12 px-8 items-center gap-2 rounded-xl bg-surface-50 text-primary-800 font-semibold hover:bg-primary-50"
            >
              Get started free <ChevronRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-100 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center">
              <Wallet size={15} />
            </span>
            <div>
              <p className="text-sm font-bold text-surface-900">MoneyMate</p>
              <p className="text-[11px] text-surface-400">From Contributions to Reconciliation</p>
            </div>
          </div>
          <p className="text-xs text-surface-400 text-center">
            © {new Date().getFullYear()} MoneyMate · BDT · Asia/Dhaka ·
            <span className="mx-1 inline-flex items-center gap-1"><Landmark size={11} /> Settlements are recorded, not executed</span>
          </p>
        </div>
      </footer>
    </div>
  )
}
