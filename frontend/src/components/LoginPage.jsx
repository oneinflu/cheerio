import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, CheckCircle2, Zap, Users, MessageSquare, GitBranch } from 'lucide-react';
import { login, syncUser } from '../api';

/* ─── Radial glow ────────────────────────────────────────────────── */
function Orb({ color, size, style }) {
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

/* ─── Animated floating conversation card ───────────────────────── */
function ConvoCard({ style, name, msg, tag, tagColor, initColor, delay = 0 }) {
  return (
    <div
      className="absolute flex items-center gap-3 px-4 py-3 rounded-2xl border animate-float-med"
      style={{
        background: 'rgba(255,255,255,0.07)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        animationDelay: `${delay}s`,
        ...style,
      }}
    >
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
        style={{ background: initColor }}>
        {name[0]}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-white text-xs font-bold truncate">{name}</p>
          <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0" style={tagColor}>{tag}</span>
        </div>
        <p className="text-white/50 text-[10px] truncate max-w-[140px]">{msg}</p>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────── */
export default function LoginPage({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [focused, setFocused]   = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await login(email, password);
      if (res.success) {
        const externalUser = res.data.user;
        const accessToken  = res.data.accessToken;
        const decodeJwt = (tok) => {
          try {
            const parts = String(tok || '').split('.');
            if (parts.length < 2) return null;
            const b64    = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
            return JSON.parse(decodeURIComponent(atob(padded).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
          } catch { return null; }
        };
        const decoded = decodeJwt(accessToken);
        const inferredTeamId =
          externalUser.teamId || externalUser.team_id ||
          (externalUser.team && (externalUser.team.id || externalUser.team._id)) ||
          (decoded && (decoded.teamId || decoded.team_id)) ||
          (decoded && Array.isArray(decoded.team_ids) && decoded.team_ids[0]) || null;
        const roleMap = { super_admin:'super_admin', admin:'admin', team_lead:'supervisor', agent:'agent', quality_manager:'quality_manager' };
        const internalUser = {
          id: externalUser._id || externalUser.id,
          name: `${externalUser.firstname} ${externalUser.lastname}`,
          email: externalUser.email,
          role: roleMap[externalUser.role] || externalUser.role || 'agent',
          teamId: inferredTeamId || undefined,
          teamIds: inferredTeamId ? [inferredTeamId] : [],
        };
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('user', JSON.stringify(internalUser));
        try { await syncUser(externalUser); } catch (syncErr) { console.error('Sync failed:', syncErr); }
        onLogin(internalUser);
      } else {
        setError(res.message || 'Incorrect email or password. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex" style={{ background: '#080810' }}>

      {/* ── LEFT — dark brand panel ──────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col" style={{ background: '#080810' }}>

        {/* Glow orbs */}
        <Orb color="rgba(0,230,118,0.18)" size={600}
          style={{ top: '-15%', left: '-10%', filter: 'blur(70px)', animation: 'aurora 14s ease-in-out infinite' }} />
        <Orb color="rgba(59,130,246,0.14)" size={500}
          style={{ bottom: '5%', right: '-5%', filter: 'blur(80px)', animation: 'aurora2 18s ease-in-out infinite' }} />
        <Orb color="rgba(139,92,246,0.10)" size={350}
          style={{ top: '40%', left: '20%', filter: 'blur(60px)', animation: 'aurora 22s ease-in-out infinite', animationDelay: '-7s' }} />

        {/* Dot-grid overlay */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

        {/* Floating conversation cards */}
        <ConvoCard
          name="Priya Sharma" msg="Order #1042 shipped! 📦" tag="Campaign" delay={0}
          tagColor={{ background: 'rgba(139,92,246,0.3)', color: '#c4b5fd' }}
          initColor="#8b5cf6"
          style={{ top: '18%', left: '8%' }}
        />
        <ConvoCard
          name="Rohit M." msg="Deal confirmed ₹1.2L ✅" tag="Won" delay={-2}
          tagColor={{ background: 'rgba(0,230,118,0.2)', color: '#00E676' }}
          initColor="#00c864"
          style={{ top: '35%', right: '5%' }}
        />
        <ConvoCard
          name="Ananya K." msg="🤖 Auto-resolved by AI" tag="Bot" delay={-4}
          tagColor={{ background: 'rgba(59,130,246,0.25)', color: '#93c5fd' }}
          initColor="#3b82f6"
          style={{ bottom: '30%', left: '12%' }}
        />
        <ConvoCard
          name="Vikram N." msg="CSAT 5⭐ — Amazing support!" tag="5★" delay={-1.5}
          tagColor={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24' }}
          initColor="#f59e0b"
          style={{ bottom: '16%', right: '8%' }}
        />

        {/* Central content */}
        <div className="relative z-10 flex flex-col h-full p-16">
          {/* Logo */}
          <img src="/logo.svg" alt="Greeto"
            className="h-8 object-contain object-left"
            style={{ filter: 'brightness(0) invert(1)', opacity: 0.9 }} />

          {/* Hero text — pushed to center vertically */}
          <div className="flex-1 flex flex-col justify-center">
            <div
              className="inline-flex items-center gap-2 mb-8 w-fit"
              style={{ border: '1px solid rgba(0,230,118,0.25)', background: 'rgba(0,230,118,0.08)', borderRadius: 100, padding: '5px 14px' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-pulse" />
              <span className="text-[11px] font-bold" style={{ color: '#00E676' }}>500+ teams trust Greeto</span>
            </div>

            <h1 className="font-black text-white leading-[0.95] mb-5"
              style={{ fontSize: 'clamp(36px,4vw,52px)', letterSpacing: '-0.04em' }}>
              Every customer<br />conversation,
              <br />
              <span style={{
                background: 'linear-gradient(270deg, #4FC3FF 0%, #00E676 100%)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                on autopilot.
              </span>
            </h1>

            <p className="text-base font-medium mb-10 max-w-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Workflows, smart templates, AI replies and real-time analytics — built for teams that want to close more, faster.
            </p>

            {/* Feature rows */}
            <div className="space-y-3 mb-12">
              {[
                { icon: GitBranch,    text: 'No-code workflow builder — 20+ node types' },
                { icon: MessageSquare, text: 'Unified inbox for WhatsApp, Telegram & more' },
                { icon: Users,         text: 'Smart routing, team roles & SLA management' },
                { icon: Zap,           text: 'Automation rules that run 24/7, zero effort' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.2)' }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: '#00E676' }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>{text}</span>
                </div>
              ))}
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-5 pt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex -space-x-2">
                {['#60a5fa','#a78bfa','#34d399','#fb923c','#f472b6'].map((c, i) => (
                  <div key={i}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                    style={{ background: c, border: '2px solid #080810' }}>
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-white text-sm font-bold">500+ teams onboarded</p>
                <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>Across 30+ countries worldwide</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT — form panel ────────────────────────────────────────── */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-8 relative" style={{ background: '#0d0d18' }}>
        {/* Subtle glow behind form */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 60%, rgba(0,230,118,0.05) 0%, transparent 100%)' }} />

        <div className="w-full max-w-[400px] relative z-10">

          {/* Mobile logo */}
          <div className="lg:hidden mb-10 flex justify-center">
            <img src="/logo.svg" alt="Greeto" className="h-8 object-contain brightness-0 invert opacity-90" />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-black text-white mb-1" style={{ letterSpacing: '-0.03em' }}>
              Welcome back
            </h2>
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Sign in to your Greeto workspace
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="mb-6 flex items-start gap-3 p-4 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}
            >
              <div className="w-4 h-4 rounded-full bg-red-500 shrink-0 mt-0.5 flex items-center justify-center">
                <span className="text-white text-[9px] font-black">!</span>
              </div>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }} htmlFor="email">
                Email address
              </label>
              <div
                className="relative rounded-xl transition-all duration-200"
                style={{
                  background: focused === 'email' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
                  border: focused === 'email' ? '1px solid rgba(0,230,118,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: focused === 'email' ? '0 0 0 3px rgba(0,230,118,0.08)' : 'none',
                }}
              >
                <input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  required
                  className="w-full h-12 px-4 bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }} htmlFor="password">
                  Password
                </label>
                <a href="#" className="text-[11px] font-semibold transition-colors hover:opacity-80" style={{ color: '#00E676' }}>
                  Forgot password?
                </a>
              </div>
              <div
                className="relative rounded-xl transition-all duration-200"
                style={{
                  background: focused === 'password' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
                  border: focused === 'password' ? '1px solid rgba(0,230,118,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: focused === 'password' ? '0 0 0 3px rgba(0,230,118,0.08)' : 'none',
                }}
              >
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  required
                  className="w-full h-12 pl-4 pr-12 bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  {showPass
                    ? <EyeOff className="w-4 h-4 hover:text-white/60" />
                    : <Eye className="w-4 h-4 hover:text-white/60" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 font-black text-sm rounded-xl transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              style={{
                background: loading ? 'rgba(0,230,118,0.7)' : '#00E676',
                color: '#050505',
                boxShadow: '0 4px 24px rgba(0,230,118,0.25)',
              }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/20 border-t-black/70 rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-7">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.2)' }}>secured by</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'SOC2 Compliant',     sub: 'Security audited' },
              { label: '256-bit Encrypted',  sub: 'Bank-grade TLS' },
            ].map(b => (
              <div key={b.label}
                className="flex items-center gap-2.5 p-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#00E676' }} />
                <div>
                  <p className="text-[10px] font-bold text-white/70">{b.label}</p>
                  <p className="text-[9px] font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>{b.sub}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-xs mt-7 font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {"Don't have an account? "}
            <a href="#" className="font-bold transition-colors hover:opacity-80" style={{ color: '#00E676' }}>
              Start free trial
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
