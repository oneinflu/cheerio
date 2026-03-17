import { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, CheckCircle2, Zap, GitBranch, FileText,
  MessageSquare, Users, BarChart3, ChevronRight,
  Sparkles, Tag, Send, Play, Star, Shield
} from 'lucide-react';

/* ─── Floating glass pill nav ─────────────────────────────────────── */
function Nav({ onLogin }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <nav className="fixed top-5 inset-x-0 z-50 flex justify-center px-4">
      <div
        className="flex items-center justify-between gap-8 px-5 py-3 rounded-full transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: scrolled ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.22)',
          boxShadow: scrolled ? '0 8px 32px rgba(0,0,0,0.12)' : 'none',
          maxWidth: 900,
          width: '100%',
        }}
      >
        <img src="/logo.svg" alt="Greeto" className={`h-7 object-contain transition-all ${scrolled ? '' : 'brightness-0 invert'}`} />

        <div className="hidden md:flex items-center gap-7 text-sm font-semibold">
          {['Features','Workflows','Integrations','Pricing'].map(l => (
            <a key={l} href={`#${l.toLowerCase()}`}
              className={`transition-colors hover:opacity-70 ${scrolled ? 'text-slate-700' : 'text-white/90'}`}>
              {l}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={onLogin}
            className={`text-sm font-semibold transition-colors hidden sm:block ${scrolled ? 'text-slate-600 hover:text-slate-900' : 'text-white/80 hover:text-white'}`}>
            Sign In
          </button>
          <button onClick={onLogin}
            className="text-sm font-bold px-5 py-2.5 rounded-full transition-all hover:-translate-y-0.5"
            style={{ background: '#00E676', color: '#0a0a0a' }}>
            Get Started
          </button>
        </div>
      </div>
    </nav>
  );
}

/* ─── Radial glow orb ─────────────────────────────────────────────── */
function GlowOrb({ color, size, style }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size, height: size,
        background: `radial-gradient(50% 50% at 50% 50%, ${color} 0%, transparent 100%)`,
        ...style,
      }}
    />
  );
}

/* ─── Inbox mock UI ───────────────────────────────────────────────── */
function InboxMock({ tab }) {
  const conversations = {
    marketing: [
      { name: 'Priya Sharma',     msg: '🛍️ Your order is shipped!',                       tag: 'Campaign', time: '2m',  unread: true },
      { name: 'Rohit Mehta',      msg: "Thanks for the 20% coupon 🎉",                    tag: 'Replied',  time: '5m',  unread: false },
      { name: 'Ananya Singh',     msg: 'Can I use this code tomorrow?',                   tag: 'Open',     time: '8m',  unread: true },
      { name: 'Vikram Nair',      msg: "Just placed the order. Love the sale!",           tag: 'Closed',   time: '12m', unread: false },
    ],
    sales: [
      { name: 'Deepak Joshi',     msg: 'I need 50 units, can you quote?',                 tag: 'Hot Lead', time: '1m',  unread: true },
      { name: 'Sakshi Gupta',     msg: '✅ Deal confirmed for ₹1.2L',                    tag: 'Won',      time: '3m',  unread: false },
      { name: 'Arjun Verma',      msg: "Following up on yesterday's demo",               tag: 'Follow-up',time: '7m',  unread: true },
      { name: 'Kavya Reddy',      msg: 'Proposal looks good, sending approval',          tag: 'Pipeline', time: '15m', unread: false },
    ],
    support: [
      { name: 'Meera Pillai',     msg: '🤖 Auto-resolved: Refund processed',             tag: 'Bot',      time: '0m',  unread: false },
      { name: 'Suresh Kumar',     msg: "My account isn't loading since morning",         tag: 'Urgent',   time: '2m',  unread: true },
      { name: 'Fatima Shaikh',    msg: 'Issue resolved, thank you so much!',             tag: 'Closed',   time: '6m',  unread: false },
      { name: 'Rahul Choudhary',  msg: "CSAT 5⭐ — Excellent support team!",            tag: '5★',       time: '9m',  unread: false },
    ],
  };

  const items = conversations[tab] || conversations.marketing;
  const tagColors = {
    'Campaign': 'bg-violet-100 text-violet-700',
    'Replied':  'bg-emerald-100 text-emerald-700',
    'Open':     'bg-blue-100 text-blue-700',
    'Closed':   'bg-slate-100 text-slate-500',
    'Hot Lead': 'bg-red-100 text-red-700',
    'Won':      'bg-emerald-100 text-emerald-700',
    'Follow-up':'bg-amber-100 text-amber-700',
    'Pipeline': 'bg-blue-100 text-blue-700',
    'Bot':      'bg-violet-100 text-violet-700',
    'Urgent':   'bg-red-100 text-red-700',
    '5★':       'bg-amber-100 text-amber-700',
  };
  const initials = n => n.split(' ').map(w => w[0]).join('');
  const avatarColors = ['#60a5fa','#a78bfa','#34d399','#fb923c','#f472b6','#38bdf8'];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden" style={{ minHeight: 320 }}>
      {/* Window bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <span className="ml-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Greeto Inbox</span>
        <div className="ml-auto flex items-center gap-1 bg-[#00E676]/20 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-full">
          <span className="w-1 h-1 rounded-full bg-emerald-500" /> Live
        </div>
      </div>

      {/* Conversation list */}
      <div>
        {items.map((c, i) => (
          <div key={i}
            className={`flex items-center gap-3 px-4 py-3 border-b border-slate-50 hover:bg-blue-50/50 cursor-pointer transition-colors ${i === 0 ? 'bg-blue-50/30' : ''}`}
          >
            {/* Avatar */}
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
              style={{ background: avatarColors[i % avatarColors.length] }}
            >
              {initials(c.name)}
            </div>
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={`text-xs font-bold truncate ${c.unread ? 'text-slate-900' : 'text-slate-600'}`}>{c.name}</p>
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${tagColors[c.tag] || 'bg-slate-100 text-slate-500'}`}>{c.tag}</span>
              </div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">{c.msg}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-[9px] text-slate-300 font-medium">{c.time} ago</span>
              {c.unread && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Feature tab showcase (WATI-style) ────────────────────────────── */
const FEATURE_TABS = [
  {
    key: 'marketing',
    label: 'Marketing',
    emoji: '📣',
    headline: 'Turn broadcasts into revenue',
    sub: 'Send personalised WhatsApp campaigns to thousands of contacts. Track delivery, reads and replies in real time. A/B test templates and auto-follow-up the ones that converted.',
    points: ['Bulk WhatsApp broadcasts', 'Dynamic template variables', 'Click-tracking & reply analytics', 'Auto follow-up sequences'],
    metric: { value: '3.5×', label: 'Higher open rate vs email' },
  },
  {
    key: 'sales',
    label: 'Sales',
    emoji: '💼',
    headline: 'Close deals before they go cold',
    sub: 'Capture leads from every channel, qualify with AI chatbots, route to the right agent and log everything to HubSpot or Zoho automatically — without lifting a finger.',
    points: ['Lead capture from WhatsApp & web', 'AI qualification & scoring', 'CRM auto-sync (HubSpot, Zoho)', 'Pipeline stage automation'],
    metric: { value: '60%', label: 'Reduction in response time' },
  },
  {
    key: 'support',
    label: 'Support',
    emoji: '🎧',
    headline: 'Resolve faster. Scale without hiring.',
    sub: 'AI handles 40% of tickets automatically. Smart assignment routes the rest to the best agent. SLA timers, CSAT collection and resolution analytics keep your team accountable.',
    points: ['AI auto-resolution (40% of tickets)', 'SLA timers & breach alerts', 'CSAT & NPS collection', 'Resolution & FRT analytics'],
    metric: { value: '4.9★', label: 'Average CSAT score' },
  },
];

/* ─── Animated counter ─────────────────────────────────────────────── */
function AnimatedNumber({ value, suffix }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);
  useEffect(() => {
    const ob = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const steps = 50;
        let i = 0;
        const t = setInterval(() => {
          i++;
          setDisplay(Math.round((value * i) / steps));
          if (i >= steps) clearInterval(t);
        }, 25);
      }
    }, { threshold: 0.5 });
    if (ref.current) ob.observe(ref.current);
    return () => ob.disconnect();
  }, [value]);
  return <span ref={ref}>{display}{suffix}</span>;
}

/* ─── Marquee logos ─────────────────────────────────────────────────── */
const INTG_LOGOS = [
  { name: 'WhatsApp',   src: 'https://cdn.simpleicons.org/whatsapp/25D366' },
  { name: 'HubSpot',    src: 'https://cdn.simpleicons.org/hubspot/FF7A59' },
  { name: 'Stripe',     src: 'https://cdn.simpleicons.org/stripe/635BFF' },
  { name: 'Zoho',       src: 'https://cdn.simpleicons.org/zoho/E42527' },
  { name: 'Notion',     src: 'https://cdn.simpleicons.org/notion/000000' },
  { name: 'Salesforce', src: 'https://cdn.simpleicons.org/salesforce/00A1E0' },
  { name: 'Telegram',   src: 'https://cdn.simpleicons.org/telegram/26A5E4' },
  { name: 'Linear',     src: 'https://cdn.simpleicons.org/linear/5E6AD2' },
  { name: 'Razorpay',   src: 'https://cdn.simpleicons.org/razorpay/02042B' },
  { name: 'Slack',      src: 'https://cdn.simpleicons.org/slack/4A154B' },
];

function LogoStrip() {
  const doubled = [...INTG_LOGOS, ...INTG_LOGOS];
  return (
    <div className="relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to right, #f5f3ee, transparent)' }} />
      <div className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to left, #f5f3ee, transparent)' }} />
      <div className="flex gap-8 animate-marquee w-max py-4">
        {doubled.map((l, i) => (
          <div key={i} className="flex items-center gap-2.5 shrink-0 opacity-50 hover:opacity-90 transition-opacity">
            <img src={l.src} alt={l.name} className="w-7 h-7 object-contain grayscale" />
            <span className="text-sm font-semibold text-slate-500 whitespace-nowrap">{l.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Workflow node diagram ─────────────────────────────────────────── */
function WorkflowDiagram() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive(n => (n + 1) % 4), 2000);
    return () => clearInterval(t);
  }, []);

  const nodes = [
    { icon: MessageSquare, label: 'Message received',  color: '#00E676', bg: '#e6faf0' },
    { icon: GitBranch,     label: 'Check condition',   color: '#3b82f6', bg: '#eff6ff' },
    { icon: Tag,           label: 'Apply label',       color: '#8b5cf6', bg: '#f5f3ff' },
    { icon: Send,          label: 'Send template',     color: '#f59e0b', bg: '#fffbeb' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <span className="ml-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Workflow Canvas</span>
      </div>

      {/* Node chain */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {nodes.map((n, i) => {
          const NIcon = n.icon;
          const isActive = active >= i;
          return (
            <div key={i} className="flex items-center shrink-0">
              <div
                className="relative flex flex-col items-center gap-1.5 cursor-pointer"
                onClick={() => setActive(i)}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500"
                  style={{
                    background: isActive ? n.bg : '#f8fafc',
                    border: `2px solid ${isActive ? n.color : '#e2e8f0'}`,
                    transform: isActive && active === i ? 'scale(1.15)' : 'scale(1)',
                    boxShadow: active === i ? `0 0 0 4px ${n.color}22` : 'none',
                  }}
                >
                  <NIcon style={{ color: isActive ? n.color : '#94a3b8' }} className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-bold text-center whitespace-nowrap"
                  style={{ color: isActive ? n.color : '#94a3b8' }}>{n.label}</span>
              </div>
              {i < nodes.length - 1 && (
                <div className="flex items-center mx-1.5 shrink-0 mt-[-14px]">
                  <div className="h-px w-6 transition-all duration-700"
                    style={{ background: active > i ? '#00E676' : '#e2e8f0' }} />
                  <ChevronRight className="w-3 h-3 transition-colors duration-700"
                    style={{ color: active > i ? '#00E676' : '#e2e8f0' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status bar */}
      <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between border border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-slate-600">3 workflows running</span>
        </div>
        <div className="flex gap-1.5">
          {['Trigger','Condition','Action','Action'].map((t, i) => (
            <span key={i} className="text-[8px] font-black px-1.5 py-0.5 rounded"
              style={{
                background: active >= i ? nodes[i]?.bg : '#f1f5f9',
                color: active >= i ? nodes[i]?.color : '#94a3b8',
              }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Main landing page ─────────────────────────────────────────────── */
export default function LandingPage({ onLoginClick }) {
  const [activeTab, setActiveTab] = useState('marketing');

  const currentTab = FEATURE_TABS.find(t => t.key === activeTab);

  return (
    <div className="min-h-screen font-sans text-slate-900 antialiased overflow-x-hidden">
      <Nav onLogin={onLoginClick} />

      {/* ══ HERO — dark full bleed (Intercom style) ══════════════════ */}
      <section
        className="relative min-h-screen flex flex-col items-center justify-center text-center pt-28 pb-20 px-6 overflow-hidden"
        style={{ background: '#080810' }}
      >
        {/* Radial glow orbs (Cheerio AI style) */}
        <GlowOrb color="rgba(0,230,118,0.18)"  size={700} style={{ top: '-10%',  left: '-5%',  filter: 'blur(60px)', animation: 'aurora 14s ease-in-out infinite' }} />
        <GlowOrb color="rgba(59,130,246,0.15)" size={600} style={{ top: '20%',   right: '-8%', filter: 'blur(70px)', animation: 'aurora2 18s ease-in-out infinite' }} />
        <GlowOrb color="rgba(139,92,246,0.12)" size={400} style={{ bottom: '0%', left: '30%',  filter: 'blur(80px)', animationDelay: '-8s', animation: 'aurora 20s ease-in-out infinite' }} />

        {/* Dot pattern overlay */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 mb-8 animate-fade-up"
          style={{ border: '1px solid rgba(0,230,118,0.3)', background: 'rgba(0,230,118,0.08)', borderRadius: 100, padding: '6px 16px', opacity: 0, animationFillMode: 'forwards' }}
        >
          <Sparkles className="w-3.5 h-3.5 text-[#00E676]" />
          <span className="text-[12px] font-bold text-[#00E676]">Greeto AI — Conversational intelligence is live</span>
        </div>

        {/* Headline (Intercom tight tracking) */}
        <h1
          className="text-5xl sm:text-6xl lg:text-[80px] font-black text-white animate-fade-up delay-100 leading-[0.95] mb-6"
          style={{ letterSpacing: '-0.04em', opacity: 0, animationFillMode: 'forwards' }}
        >
          Customer conversations,<br />
          <span style={{
            background: 'linear-gradient(270deg, #4FC3FF 0%, #00E676 100%)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            on autopilot.
          </span>
        </h1>

        {/* Sub */}
        <p
          className="max-w-xl text-lg text-white/50 font-medium leading-relaxed mb-10 animate-fade-up delay-200"
          style={{ opacity: 0, animationFillMode: 'forwards' }}
        >
          Greeto unifies WhatsApp, Telegram and CRM into one AI-powered workspace — with
          no-code workflows, smart templates and real-time analytics your whole team will love.
        </p>

        {/* CTAs */}
        <div
          className="flex flex-col sm:flex-row items-center gap-4 mb-14 animate-fade-up delay-300"
          style={{ opacity: 0, animationFillMode: 'forwards' }}
        >
          <button
            onClick={onLoginClick}
            className="inline-flex items-center gap-2 font-black text-base px-8 py-4 rounded-full transition-all hover:-translate-y-0.5"
            style={{ background: '#00E676', color: '#050505', boxShadow: '0 8px 32px rgba(0,230,118,0.35)' }}
          >
            Start for free <ArrowRight className="w-5 h-5" />
          </button>
          <button
            className="inline-flex items-center gap-2 text-white/70 hover:text-white font-semibold text-base px-6 py-4 rounded-full border transition-all hover:border-white/30"
            style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}
          >
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
              <Play className="w-3 h-3 text-white fill-white translate-x-0.5" />
            </div>
            Watch 2-min demo
          </button>
        </div>

        {/* Trust strip */}
        <div
          className="flex flex-wrap items-center justify-center gap-5 animate-fade-up delay-400"
          style={{ opacity: 0, animationFillMode: 'forwards' }}
        >
          {[
            { icon: Shield,       text: 'SOC2 Compliant' },
            { icon: CheckCircle2, text: 'GDPR Ready' },
            { icon: Users,        text: '500+ Teams' },
            { icon: Star,         text: '4.9/5 Rating' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 text-white/40 text-sm font-medium">
              <Icon className="w-4 h-4 text-[#00E676]" />
              {text}
            </div>
          ))}
        </div>

        {/* Hero product mockup */}
        <div
          className="relative w-full max-w-4xl mt-20 animate-fade-up delay-500"
          style={{ opacity: 0, animationFillMode: 'forwards' }}
        >
          {/* Glow under card */}
          <div className="absolute inset-x-20 bottom-0 h-20 rounded-full"
            style={{ background: 'rgba(0,230,118,0.15)', filter: 'blur(30px)' }} />

          {/* Three floating pills above */}
          <div className="absolute -top-5 left-8 flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/15 rounded-full px-3 py-1.5 animate-float-med">
            <Zap className="w-3.5 h-3.5 text-[#00E676]" />
            <span className="text-[10px] font-bold text-white">Auto-resolved 12 tickets</span>
          </div>
          <div className="absolute -top-5 right-8 flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/15 rounded-full px-3 py-1.5 animate-float-med" style={{ animationDelay: '-1.5s' }}>
            <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] font-bold text-white">CSAT 4.9★ this week</span>
          </div>

          <InboxMock tab="support" />
        </div>
      </section>

      {/* ══ LOGO MARQUEE — warm cream (Intercom style) ══════════════ */}
      <section style={{ background: '#f5f3ee' }} className="py-10 border-y border-black/[0.06]">
        <p className="text-center text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">
          Connect with your favourite tools
        </p>
        <LogoStrip />
      </section>

      {/* ══ TAB SHOWCASE — (WATI-style) ═════════════════════════════ */}
      <section id="features" style={{ background: '#f5f3ee' }} className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">One platform, every team</p>
            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight mb-4" style={{ letterSpacing: '-0.03em' }}>
              Built for Marketing,<br />Sales <span className="text-slate-400">&</span> Support
            </h2>
          </div>

          {/* Tabs */}
          <div className="flex justify-center gap-2 mb-10">
            {FEATURE_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all"
                style={activeTab === tab.key
                  ? { background: '#080810', color: '#fff', boxShadow: '0 4px 20px rgba(8,8,16,0.2)' }
                  : { background: '#fff', color: '#64748b', border: '1px solid #e2e8f0' }}
              >
                <span>{tab.emoji}</span> {tab.label}
              </button>
            ))}
          </div>

          {/* Tab panel */}
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            {/* Left — copy */}
            <div>
              <div
                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border mb-5"
                style={{ background: '#00E67615', color: '#059669', borderColor: '#00E67630' }}
              >
                <Sparkles className="w-3 h-3" /> {currentTab.label}
              </div>
              <h3 className="text-3xl lg:text-4xl font-black text-slate-900 mb-4 leading-tight" style={{ letterSpacing: '-0.03em' }}>
                {currentTab.headline}
              </h3>
              <p className="text-slate-500 leading-relaxed mb-7 text-base">{currentTab.sub}</p>

              <ul className="space-y-3 mb-8">
                {currentTab.points.map(p => (
                  <li key={p} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: '#00E67620' }}>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <span className="text-sm text-slate-700 font-medium">{p}</span>
                  </li>
                ))}
              </ul>

              {/* Metric callout */}
              <div
                className="inline-flex items-center gap-4 px-6 py-4 rounded-2xl border"
                style={{ background: '#fff', borderColor: '#e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
              >
                <div>
                  <p className="text-3xl font-black" style={{ color: '#00c864' }}>{currentTab.metric.value}</p>
                  <p className="text-xs text-slate-500 font-medium">{currentTab.metric.label}</p>
                </div>
                <div className="w-px h-10 bg-slate-200" />
                <p className="text-xs text-slate-500 max-w-[140px] leading-snug font-medium">
                  Based on avg. team results in the first 30 days
                </p>
              </div>
            </div>

            {/* Right — product preview */}
            <div>
              <InboxMock tab={activeTab} />
            </div>
          </div>
        </div>
      </section>

      {/* ══ ALTERNATING FEATURES (Intercom style) ════════════════════ */}
      <section id="workflows" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto space-y-24">

          {/* Row 1 — Workflow builder */}
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full mb-5">
                <GitBranch className="w-3 h-3" /> Workflow Builder
              </span>
              <h2 className="text-3xl lg:text-4xl font-black text-slate-900 mb-5 leading-tight" style={{ letterSpacing: '-0.03em' }}>
                Automate entire journeys.<br />Zero code required.
              </h2>
              <p className="text-slate-500 leading-relaxed mb-7">
                Drag-and-drop nodes onto a visual canvas — triggers, conditions, and actions. Build flows that fire across WhatsApp, Telegram and email 24/7 without any developer involvement.
              </p>
              {[
                { color: '#00E676', bg: '#e6faf0', label: 'Trigger nodes',    desc: 'Inbound message, form, tag, time delay, webhook' },
                { color: '#3b82f6', bg: '#eff6ff', label: 'Condition nodes',  desc: 'Keyword, label, business hours, agent status' },
                { color: '#8b5cf6', bg: '#f5f3ff', label: 'Action nodes',     desc: 'Send template, assign, add label, call API, post to Slack' },
              ].map(n => (
                <div key={n.label} className="flex items-start gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: n.bg }}>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: n.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{n.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{n.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <WorkflowDiagram />
          </div>

          {/* Row 2 — Templates */}
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div className="order-2 lg:order-1">
              {/* Template library mock */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Template Library</span>
                  <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">14 approved</span>
                </div>
                {[
                  { name: 'Welcome Onboarding', tag: 'Onboarding',    preview: "Hi {{name}}, welcome! Your account is ready 🎉", tagC: '#dcfce7|#15803d' },
                  { name: 'Order Confirmed',    tag: 'Transactional', preview: "Order #{{id}} confirmed. Ships by {{date}}.",       tagC: '#dbeafe|#1d4ed8' },
                  { name: 'Payment Reminder',   tag: 'Transactional', preview: "Your invoice of ₹{{amount}} is due on {{date}}.",   tagC: '#dbeafe|#1d4ed8' },
                  { name: 'Flash Sale Blast',   tag: 'Marketing',     preview: "🛍️ {{pct}}% off today only! Use code {{code}}.",   tagC: '#fce7f3|#be185d' },
                ].map((t, i) => {
                  const [bg, color] = t.tagC.split('|');
                  return (
                    <div key={i} className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-slate-900">{t.name}</span>
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background: bg, color }}>{t.tag}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">{t.preview}</p>
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-violet-600 bg-violet-50 border border-violet-200 px-3 py-1 rounded-full mb-5">
                <FileText className="w-3 h-3" /> Templates
              </span>
              <h2 className="text-3xl lg:text-4xl font-black text-slate-900 mb-5 leading-tight" style={{ letterSpacing: '-0.03em' }}>
                Your message library.<br />Always approved.
              </h2>
              <p className="text-slate-500 leading-relaxed mb-7">
                Build a reusable library of WhatsApp-approved templates. Drop in dynamic variables, assign category tags and use them across broadcasts, workflows and manual replies — all from one place.
              </p>
              {['Meta-approved template management', 'Dynamic variables: name, order, amount', 'Category tagging and search', 'One-click use in campaigns & automations'].map(p => (
                <div key={p} className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-sm text-slate-700 font-medium">{p}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Row 3 — Automation rules */}
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full mb-5">
                <Zap className="w-3 h-3" /> Automation Rules
              </span>
              <h2 className="text-3xl lg:text-4xl font-black text-slate-900 mb-5 leading-tight" style={{ letterSpacing: '-0.03em' }}>
                Set rules once.<br />Let Greeto run them.
              </h2>
              <p className="text-slate-500 leading-relaxed mb-7">
                Create lightweight if-then rules without building a full workflow. Perfect for SLA alerts, auto-tagging, smart routing and canned first-replies — business-hours aware.
              </p>
              {['Auto-assign based on team & skill', 'SLA breach alerts to supervisors', 'Label conversations by intent', 'Business-hours aware execution'].map(p => (
                <div key={p} className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-sm text-slate-700 font-medium">{p}</span>
                </div>
              ))}
            </div>
            {/* Rule builder mock */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Active Rules</span>
                <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">3 running</span>
              </div>
              {[
                { when: 'Unassigned > 5 min',   then: ['Auto-assign to team', 'Alert supervisor'], on: true },
                { when: 'Label = "urgent"',      then: ['Notify on-call agent', 'Escalate SLA'],   on: true },
                { when: 'No reply > 24 hrs',     then: ['Send follow-up template'],                 on: false },
              ].map((r, i) => (
                <div key={i} className="px-5 py-4 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">IF</span>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full truncate">{r.when}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {r.then.map(a => (
                          <span key={a} className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <ChevronRight className="w-2.5 h-2.5" />{a}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className={`w-9 h-5 rounded-full flex items-center shrink-0 transition-colors cursor-pointer ${r.on ? 'bg-emerald-500 justify-end' : 'bg-slate-200 justify-start'}`}>
                      <div className="w-4 h-4 bg-white rounded-full mx-0.5 shadow-sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ══ METRICS SECTION (Gallabox style) ════════════════════════ */}
      <section style={{ background: '#f5f3ee' }} className="py-24 px-6 border-y border-black/[0.05]">
        <div className="max-w-5xl mx-auto text-center mb-14">
          <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-4" style={{ letterSpacing: '-0.03em' }}>
            Numbers that speak for themselves
          </h2>
          <p className="text-slate-500 text-base font-medium">Real results from teams using Greeto in their first 30 days.</p>
        </div>
        <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { n: 40, s: '%', label: 'Tickets auto-resolved by AI', color: '#00c864' },
            { n: 60, s: '%', label: 'Reduction in first response time', color: '#3b82f6' },
            { n: 3,  s: '×', label: 'More conversations handled per agent', color: '#8b5cf6' },
            { n: 99, s: '.9%', label: 'Platform uptime SLA', color: '#f59e0b' },
          ].map(({ n, s, label, color }) => (
            <div key={label}
              className="bg-white rounded-2xl border border-black/[0.06] p-6 text-center hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
              style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
            >
              <p className="text-4xl lg:text-5xl font-black mb-2 tabular-nums" style={{ color }}>
                <AnimatedNumber value={n} suffix={s} />
              </p>
              <p className="text-xs text-slate-500 font-medium leading-snug">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ INTEGRATIONS (dark, Intercom bento asymmetry) ═══════════ */}
      <section id="integrations" className="py-24 px-6" style={{ background: '#080810' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[11px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">Integrations</p>
            <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tight mb-4" style={{ letterSpacing: '-0.03em' }}>
              Your whole stack.<br />
              <span style={{ background: 'linear-gradient(270deg,#4FC3FF,#00E676)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Natively connected.
              </span>
            </h2>
            <p className="text-white/40 text-base font-medium max-w-lg mx-auto">
              Native connectors, webhooks and MCP protocol so Greeto fits your existing workflow from day one.
            </p>
          </div>

          {/* Bento grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Wide card — Channels */}
            <div className="md:col-span-7 rounded-3xl p-6 border" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">Channels</p>
              <h3 className="text-xl font-black text-white mb-4">Every messaging channel in one inbox</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { src: 'https://cdn.simpleicons.org/whatsapp/25D366',  name: 'WhatsApp Business', status: 'Live',  color: '#25D366' },
                  { src: 'https://cdn.simpleicons.org/telegram/26A5E4',  name: 'Telegram Bots',    status: 'Live',  color: '#26A5E4' },
                  { src: 'https://cdn.simpleicons.org/instagram/E4405F', name: 'Instagram DMs',    status: 'Soon',  color: '#E4405F' },
                  { src: 'https://cdn.simpleicons.org/gmail/EA4335',     name: 'Business Email',   status: 'Soon',  color: '#EA4335' },
                ].map(c => (
                  <div key={c.name}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 border cursor-pointer hover:border-white/20 transition-colors"
                    style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}
                  >
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center p-1.5 shrink-0">
                      <img src={c.src} className="w-full h-full object-contain" alt={c.name} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{c.name}</p>
                    </div>
                    <span
                      className="text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ background: c.status === 'Live' ? '#00E67620' : '#ffffff10', color: c.status === 'Live' ? '#00E676' : '#ffffff50' }}
                    >
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Narrow card — MCP */}
            <div className="md:col-span-5 rounded-3xl p-6 border" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">MCP Connectors</p>
              <h3 className="text-xl font-black text-white mb-1">AI context bridging</h3>
              <p className="text-xs text-white/40 mb-4">Model Context Protocol — let AI read your CRM & tools in real time.</p>
              <div className="space-y-2">
                {[
                  { src: 'https://cdn.simpleicons.org/zoho/E42527',       name: 'Zoho MCP' },
                  { src: 'https://cdn.simpleicons.org/salesforce/00A1E0', name: 'Salesforce MCP' },
                  { src: 'https://cdn.simpleicons.org/notion/ffffff',     name: 'Notion MCP' },
                  { src: 'https://cdn.simpleicons.org/hubspot/FF7A59',    name: 'HubSpot MCP' },
                ].map(m => (
                  <div key={m.name} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
                    <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center p-1 shrink-0">
                      <img src={m.src} className="w-full h-full object-contain" alt={m.name} onError={e => e.target.style.display='none'} />
                    </div>
                    <span className="text-xs font-bold text-white/70">{m.name}</span>
                    <span className="ml-auto text-[8px] font-black text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">Soon</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom row — Payments & CRM side by side */}
            <div className="md:col-span-5 rounded-3xl p-6 border" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">Payments</p>
              <h3 className="text-base font-black text-white mb-3">Collect payments inside conversations</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { src: 'https://cdn.simpleicons.org/razorpay/02042B',  name: 'Razorpay' },
                  { src: 'https://cdn.simpleicons.org/stripe/635BFF',    name: 'Stripe' },
                  { src: 'https://logo.clearbit.com/cashfree.com',       name: 'Cashfree' },
                ].map(p => (
                  <div key={p.name} className="flex items-center gap-2 rounded-xl px-3 py-2 border" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}>
                    <div className="w-5 h-5 bg-white rounded flex items-center justify-center p-0.5">
                      <img src={p.src} className="w-full h-full object-contain" alt={p.name} onError={e => e.target.style.display='none'} />
                    </div>
                    <span className="text-xs font-bold text-white/70">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="md:col-span-7 rounded-3xl p-6 border" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">CRM & Productivity</p>
              <h3 className="text-base font-black text-white mb-3">Auto-sync everything to your CRM</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { src: 'https://cdn.simpleicons.org/hubspot/FF7A59',        name: 'HubSpot' },
                  { src: 'https://cdn.simpleicons.org/zoho/E42527',           name: 'Zoho CRM' },
                  { src: 'https://cdn.simpleicons.org/salesforce/00A1E0',     name: 'Salesforce' },
                  { src: 'https://cdn.simpleicons.org/googlesheets/34A853',   name: 'Google Sheets' },
                  { src: 'https://cdn.simpleicons.org/notion/ffffff',         name: 'Notion' },
                ].map(c => (
                  <div key={c.name} className="flex items-center gap-2 rounded-xl px-3 py-2 border" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}>
                    <div className="w-5 h-5 bg-white/10 rounded flex items-center justify-center p-0.5">
                      <img src={c.src} className="w-full h-full object-contain" alt={c.name} onError={e => e.target.style.display='none'} />
                    </div>
                    <span className="text-xs font-bold text-white/70">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIALS (Gallabox social proof style) ═══════════════ */}
      <section style={{ background: '#f5f3ee' }} className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl lg:text-5xl font-black tracking-tight" style={{ letterSpacing: '-0.03em' }}>
              Teams that never looked back
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { q: "Greeto's workflows cut our onboarding time from 2 days to 4 hours. The moment a customer messages us, they're automatically welcomed, tagged and assigned. Zero manual work.", name: 'Priya M.', role: 'Head of CX · Fintech', avatar: '#60a5fa', metric: '77%', mlabel: 'faster onboarding' },
              { q: "Template library + quick-replies slashed our FRT by 60%. Our CSAT went from 3.4 to 4.9 in 6 weeks. Customers literally comment on how fast we respond now.", name: 'Rohan K.', role: 'Support Lead · D2C Brand', avatar: '#a78bfa', metric: '60%', mlabel: 'reduction in FRT' },
              { q: "We handle 3× more conversations per agent now. The automation rules handle routine queries so our team focuses purely on revenue-generating conversations.", name: 'Aditya S.', role: 'Operations · SaaS startup', avatar: '#34d399', metric: '3×', mlabel: 'agent productivity' },
            ].map(t => (
              <div key={t.name}
                className="bg-white rounded-2xl border border-black/[0.06] p-6 hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
                style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
              >
                <div className="flex gap-0.5 mb-4">
                  {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed mb-6">"{t.q}"</p>
                {/* Metric pill */}
                <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 mb-4">
                  <span className="text-lg font-black" style={{ color: '#00c864' }}>{t.metric}</span>
                  <span className="text-xs text-slate-500 font-medium">{t.mlabel}</span>
                </div>
                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black" style={{ background: t.avatar }}>
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{t.name}</p>
                    <p className="text-[11px] text-slate-400 font-medium">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA — dark (Intercom style) ══════════════════════ */}
      <section className="py-28 px-6 relative overflow-hidden" style={{ background: '#080810' }}>
        <GlowOrb color="rgba(0,230,118,0.12)"  size={600} style={{ top: '-20%', left: '-10%', filter: 'blur(80px)' }} />
        <GlowOrb color="rgba(59,130,246,0.10)" size={500} style={{ bottom: '-10%', right: '-5%', filter: 'blur(80px)' }} />

        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <h2 className="text-5xl lg:text-6xl font-black text-white mb-6 leading-tight" style={{ letterSpacing: '-0.04em' }}>
            Ready to put support<br />
            <span style={{ background: 'linear-gradient(270deg,#4FC3FF,#00E676)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              on autopilot?
            </span>
          </h2>
          <p className="text-white/40 text-lg font-medium mb-10">Set up in minutes. First 14 days free. No card required.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onLoginClick}
              className="inline-flex items-center gap-2 font-black text-base px-10 py-4 rounded-full transition-all hover:-translate-y-0.5"
              style={{ background: '#00E676', color: '#050505', boxShadow: '0 8px 40px rgba(0,230,118,0.30)' }}
            >
              Get started free <ArrowRight className="w-5 h-5" />
            </button>
            <button
              className="inline-flex items-center gap-2 text-white/60 hover:text-white font-semibold text-base px-8 py-4 rounded-full border transition-all"
              style={{ border: '1px solid rgba(255,255,255,0.12)' }}
            >
              Book a demo
            </button>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════════════ */}
      <footer style={{ background: '#050508' }} className="py-10 px-6 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
          <img src="/logo.svg" alt="Greeto" className="h-7 object-contain brightness-0 invert opacity-40" />
          <p className="text-[11px] text-white/20 font-medium">© 2026 Greeto Technologies · All rights reserved.</p>
          <div className="flex items-center gap-5 text-[11px] text-white/25 font-medium">
            {['Privacy','Terms','Help','Status'].map(l => (
              <a key={l} href="#" className="hover:text-white/60 transition-colors">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
