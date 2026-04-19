import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ThemeToggle } from '../components/ThemeToggle'

// ── Logo mark (exact from design) ──────────────────────────────────────────
function LogoMark({ size = 32, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={`flex-shrink-0 ${className}`}>
      <rect width="32" height="32" rx="9" fill="#20D4B8" />
      <path d="M8 9 L12 6 L12 24 L8 24 Z" fill="#0D1B1A" />
      <path d="M20 6 L24 9 L24 24 L20 24 Z" fill="#0D1B1A" />
      <rect x="12" y="14" width="8" height="4" fill="#0D1B1A" />
    </svg>
  )
}

function Logo({ white = false }) {
  return (
    <span className={`inline-flex items-center gap-[9px] font-extrabold text-xl ${white ? 'text-white' : 'text-[var(--text-900)]'}`}
      style={{ letterSpacing: '-0.035em' }}>
      <LogoMark />
      HomeFix
    </span>
  )
}

// ── Check icon ──────────────────────────────────────────────────────────────
function Check({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

// ── Arrow icon ──────────────────────────────────────────────────────────────
function Arrow({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  )
}

export function LandingPage() {
  const { profile, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && profile) {
      if (profile.is_admin) navigate('/admin', { replace: true })
      else navigate(profile.tipo === 'prestador' ? '/dashboard' : '/mapa', { replace: true })
    }
  }, [profile, loading, navigate])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text-900)', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* ── HEADER ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'color-mix(in srgb, var(--bg) 82%, transparent)',
        backdropFilter: 'saturate(180%) blur(16px)',
        WebkitBackdropFilter: 'saturate(180%) blur(16px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div className="max-w-[1240px] mx-auto px-6 md:px-8 h-[76px] flex items-center justify-between">
          <Link to="/"><Logo /></Link>

          {/* Nav — hidden on mobile */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {['Serviços', 'Agendar', 'Seja Parceiro', 'Empresas', 'Ajuda'].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(' ', '-')}`}
                style={{ padding: '8px 14px', borderRadius: 999, color: 'var(--text-700)', fontWeight: 500, fontSize: 14.5, transition: 'all .18s' }}
                className="hover:bg-[var(--surface-2)] hover:text-[var(--text-900)]">
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={() => navigate('/login')}
              className="hidden md:inline-flex items-center justify-center font-semibold text-[14.5px] transition-all"
              style={{ padding: '11px 18px', borderRadius: 10, color: 'var(--text-800)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              Entrar
            </button>
            <button onClick={() => navigate('/entrar')}
              className="inline-flex items-center justify-center font-bold text-[14.5px] transition-all"
              style={{ padding: '11px 18px', borderRadius: 10, background: '#20D4B8', color: '#0D1B1A', boxShadow: '0 12px 28px rgba(32,212,184,0.32)' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#10B89C'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#20D4B8'; e.currentTarget.style.transform = 'translateY(0)' }}>
              Criar conta
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* ── HERO ── */}
        <section style={{
          position: 'relative', padding: '80px 0 120px', overflow: 'hidden',
          background: 'var(--bg-sand)', transition: 'background .3s',
        }}>
          {/* Teal radial glows */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(900px 420px at 92% -10%, rgba(32,212,184,0.28), transparent 60%), radial-gradient(640px 380px at -10% 110%, rgba(32,212,184,0.10), transparent 60%)',
          }} className="dark:opacity-60" />

          <div className="max-w-[1240px] mx-auto px-6 md:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-[72px] items-center">

              {/* Left */}
              <div>
                {/* Eyebrow */}
                <div className="inline-flex items-center gap-2 mb-6"
                  style={{ padding: '6px 14px 6px 8px', borderRadius: 999, background: 'var(--surface)', boxShadow: '0 0 0 1px var(--border), 0 1px 2px rgba(13,27,26,0.03)', fontSize: 13, fontWeight: 500, color: 'var(--text-700)' }}>
                  <span style={{ width: 20, height: 20, borderRadius: 999, background: '#20D4B8', display: 'grid', placeItems: 'center', color: '#0D1B1A' }}>
                    <Check />
                  </span>
                  +12.000 profissionais verificados no Brasil
                </div>

                <h1 style={{ fontWeight: 800, fontSize: 'clamp(40px, 5.8vw, 68px)', lineHeight: 1.02, letterSpacing: '-0.035em', color: 'var(--text-900)', marginBottom: 20, textWrap: 'balance' }}>
                  Tudo que sua casa precisa,{' '}
                  <span style={{ color: 'var(--teal-600)' }} className="dark:!text-[var(--teal-300)]">em um clique.</span>
                </h1>

                <p style={{ fontSize: 'clamp(16.5px, 1.4vw, 18.5px)', color: 'var(--text-600)', marginBottom: 32, maxWidth: 520, lineHeight: 1.55 }}>
                  Encontre, agende e pague profissionais verificados para limpeza, reparos, instalações e muito mais — sem telefonemas, sem surpresas.
                </p>

                {/* Search box */}
                <form onSubmit={e => { e.preventDefault(); navigate('/entrar') }}
                  style={{ background: 'var(--surface)', borderRadius: 18, padding: 10, boxShadow: 'var(--shadow-lg), 0 0 0 1px var(--border)', maxWidth: 580 }}>
                  <div className="flex flex-col sm:flex-row gap-1">
                    {/* Service field */}
                    <div className="flex items-center gap-3 flex-1 rounded-xl px-4 py-3 transition-colors cursor-text"
                      style={{ borderRadius: 12 }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--teal-50)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--teal-600)', flexShrink: 0 }}>
                        <circle cx="11" cy="11" r="7" strokeLinecap="round" /><path d="m20 20-3.5-3.5" strokeLinecap="round" />
                      </svg>
                      <div className="flex flex-col gap-px flex-1 min-w-0">
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-700)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Serviço</label>
                        <input type="text" placeholder="Ex: diarista, eletricista"
                          style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: 'var(--text-900)', width: '100%' }} />
                      </div>
                    </div>

                    {/* Separator */}
                    <div className="hidden sm:block w-px self-stretch" style={{ background: 'var(--border)' }} />

                    {/* Location field */}
                    <div className="flex items-center gap-3 flex-1 rounded-xl px-4 py-3 transition-colors cursor-text"
                      style={{ borderRadius: 12 }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--teal-50)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--teal-600)', flexShrink: 0 }}>
                        <path d="M12 21s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12z" strokeLinejoin="round" /><circle cx="12" cy="9" r="2.5" />
                      </svg>
                      <div className="flex flex-col gap-px flex-1 min-w-0">
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-700)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Onde</label>
                        <input type="text" placeholder="CEP ou endereço"
                          style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: 'var(--text-900)', width: '100%' }} />
                      </div>
                    </div>

                    {/* Search btn */}
                    <button type="submit"
                      className="flex items-center justify-center gap-2 font-bold text-[15px] transition-all"
                      style={{ background: '#20D4B8', color: '#0D1B1A', borderRadius: 12, padding: '0 24px', minHeight: 52 }}
                      onMouseEnter={e => e.currentTarget.style.background = '#10B89C'}
                      onMouseLeave={e => e.currentTarget.style.background = '#20D4B8'}>
                      Buscar <Arrow size={16} />
                    </button>
                  </div>
                </form>

                {/* Trust chips */}
                <div className="flex flex-wrap gap-x-5 gap-y-2 mt-6">
                  {[
                    { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2 4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5l-8-3z" strokeLinejoin="round" /><path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>, label: 'Profissionais verificados' },
                    { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" strokeLinecap="round" /></svg>, label: 'Pagamento seguro' },
                    { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" /></svg>, label: 'Agendamento em 2 min' },
                  ].map(({ icon, label }) => (
                    <span key={label} className="inline-flex items-center gap-2" style={{ fontSize: 13.5, color: 'var(--text-600)', fontWeight: 500 }}>
                      <span style={{ color: 'var(--teal-600)' }}>{icon}</span>
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right — hero photo */}
              <div style={{ position: 'relative', aspectRatio: '4/5', maxWidth: 520, margin: '0 auto', width: '100%' }}>
                {/* Teal rotated bg */}
                <div style={{
                  position: 'absolute', top: -14, left: -14, width: '100%', height: '100%',
                  borderRadius: 24, background: '#20D4B8', zIndex: 0, transform: 'rotate(-2deg)', opacity: 0.9,
                }} />
                {/* Photo */}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 24, zIndex: 1,
                  backgroundImage: "url('https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80')",
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  boxShadow: 'var(--shadow-lg)', backgroundColor: 'var(--teal-100)',
                }} />
                {/* Float card 1 */}
                <div style={{
                  position: 'absolute', top: '6%', left: '-8%', zIndex: 2,
                  background: 'var(--surface)', borderRadius: 14, padding: '12px 14px',
                  boxShadow: 'var(--shadow-md), 0 0 0 1px var(--border)',
                  display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 500, color: 'var(--text-800)',
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 999, background: '#4EDFC0', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13, color: '#0D1B1A', flexShrink: 0 }}>MR</div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>Marcos — Eletricista</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, color: 'var(--text-900)' }}>
                      <span style={{ color: '#FFB648' }}>★</span><span>4,9</span>
                      <span style={{ color: 'var(--text-500)', fontWeight: 500, fontSize: 12.5 }}>· 214 avaliações</span>
                    </div>
                  </div>
                </div>
                {/* Float card 2 */}
                <div style={{
                  position: 'absolute', bottom: '8%', right: '-6%', zIndex: 2, maxWidth: 230,
                  background: 'var(--surface)', borderRadius: 14, padding: '12px 14px',
                  boxShadow: 'var(--shadow-md), 0 0 0 1px var(--border)',
                  display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 500, color: 'var(--text-800)',
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: '#20D4B8', display: 'grid', placeItems: 'center', flexShrink: 0, color: '#0D1B1A' }}>
                    <Check size={16} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>Serviço agendado</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-500)', fontWeight: 500 }}>Hoje, 14h30 · Instalação</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PROOF ── */}
        <section style={{ padding: '32px 0', borderBottom: '1px solid var(--border)' }}>
          <div className="max-w-[1240px] mx-auto px-6 md:px-8">
            <div className="grid grid-cols-2 md:grid-cols-[auto_1fr_1fr_1fr_1fr] gap-6 md:gap-10 items-center">
              <p style={{ fontSize: 13, color: 'var(--text-600)', fontWeight: 500 }}>A confiança de quem usa:</p>
              {[
                { num: '12k+', label: 'profissionais ativos' },
                { num: '280k', label: 'serviços concluídos' },
                { num: <><span>4,9</span><span style={{ color: '#FFB648' }}>★</span></>, label: 'avaliação média' },
                { num: '180', label: 'cidades atendidas' },
              ].map((s, i) => (
                <div key={i}>
                  <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-900)', lineHeight: 1, letterSpacing: '-0.03em' }}>{s.num}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-600)', marginTop: 6, fontWeight: 500 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CATEGORIAS ── */}
        <section id="serviços" style={{ padding: '104px 0' }}>
          <div className="max-w-[1240px] mx-auto px-6 md:px-8">
            <div style={{ maxWidth: 680, marginBottom: 56 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--teal-700)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 14 }}
                className="dark:!text-[var(--teal-300)]">Categorias</span>
              <h2 style={{ fontWeight: 800, fontSize: 'clamp(30px, 3.8vw, 46px)', lineHeight: 1.05, letterSpacing: '-0.03em', color: 'var(--text-900)', marginBottom: 18, textWrap: 'balance' }}>
                Para cada canto da casa, <span style={{ color: 'var(--teal-600)' }} className="dark:!text-[var(--teal-300)]">o profissional certo.</span>
              </h2>
              <p style={{ fontSize: 17.5, color: 'var(--text-600)', lineHeight: 1.55 }}>
                De uma diária completa a um pequeno reparo — encontre quem resolve, sempre verificado pela HomeFix.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                {
                  icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 19V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12" /><path d="M4 19h16" /><path d="M10 10h4M10 14h4" /></svg>,
                  title: 'Limpeza e Organização', desc: 'Diaristas, passadeiras e organizadores.',
                },
                {
                  icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-7.3 7.3 2 2 7.3-7.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2-2 2.4-2.4Z" /><path d="m19 19-3-3" /></svg>,
                  title: 'Reparos e Manutenção', desc: 'Elétrica, hidráulica e consertos.',
                },
                {
                  icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 4v16M16 4v16M3 10h18M3 14h18" /></svg>,
                  title: 'Instalação e Montagem', desc: 'Móveis, ar-condicionado e eletros.',
                },
                {
                  icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v6" /><path d="M8 6c0 3 2 5 4 5s4-2 4-5" /><path d="M6 22c0-6 2-10 6-10s6 4 6 10" /><path d="M3 22h18" /></svg>,
                  title: 'Área Externa', desc: 'Jardins, piscinas e controle de pragas.',
                },
                {
                  icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="14" height="12" rx="2" /><path d="m17 10 4-2v8l-4-2" /><circle cx="10" cy="12" r="2" /></svg>,
                  title: 'Tecnologia e Segurança', desc: 'Câmeras, Wi-Fi e casa inteligente.',
                },
              ].map(({ icon, title, desc }) => (
                <button key={title} onClick={() => navigate('/entrar')}
                  className="group text-left flex flex-col transition-all duration-[250ms]"
                  style={{ padding: 26, borderRadius: 18, background: 'var(--surface)', boxShadow: '0 0 0 1px var(--border)', minHeight: 220, cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md), 0 0 0 1px #4EDFC0' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--border)' }}>
                  {/* Icon */}
                  <div className="group-hover:!bg-[#20D4B8] group-hover:!text-[#0D1B1A] transition-all duration-[250ms]"
                    style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--teal-100)', color: 'var(--teal-700)', display: 'grid', placeItems: 'center', marginBottom: 20 }}>
                    {icon}
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-900)', marginBottom: 8, letterSpacing: '-0.01em' }}>{title}</h3>
                  <p style={{ fontSize: 13.5, color: 'var(--text-600)', lineHeight: 1.5, flex: 1 }}>{desc}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--teal-700)' }}>
                    Ver profissionais <Arrow size={14} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── AGENDAMENTO ── */}
        <section id="agendar" style={{ paddingBottom: 104 }}>
          <div className="max-w-[1240px] mx-auto px-6 md:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--teal-700)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 14 }}
                  className="dark:!text-[var(--teal-300)]">Agendamento</span>
                <h2 style={{ fontWeight: 800, fontSize: 'clamp(30px, 3.8vw, 46px)', lineHeight: 1.05, letterSpacing: '-0.03em', color: 'var(--text-900)', marginBottom: 18 }}>
                  No horário que <span style={{ color: 'var(--teal-600)' }} className="dark:!text-[var(--teal-300)]">cabe na sua rotina.</span>
                </h2>
                <p style={{ fontSize: 17.5, color: 'var(--text-600)', lineHeight: 1.55, marginBottom: 40 }}>
                  Escolha data, horário e profissional em poucos cliques. Sem telefonemas, sem dor de cabeça.
                </p>
                <div className="flex flex-col gap-6">
                  {[
                    {
                      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>,
                      title: 'Agendamento flexível', desc: 'Escolha data e horário com até 30 dias de antecedência.',
                    },
                    {
                      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5l-8-3z" /><path d="m9 12 2 2 4-4" /></svg>,
                      title: 'Segurança e confiança', desc: 'Profissionais verificados e serviços com seguro contra danos.',
                    },
                    {
                      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></svg>,
                      title: 'Cancelamento gratuito', desc: 'Sem custo com até 2 horas de antecedência.',
                    },
                  ].map(({ icon, title, desc }) => (
                    <div key={title} className="flex gap-4">
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--teal-100)', color: 'var(--teal-700)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        {icon}
                      </div>
                      <div>
                        <h3 style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text-900)', marginBottom: 4 }}>{title}</h3>
                        <p style={{ fontSize: 14.5, color: 'var(--text-600)', lineHeight: 1.5 }}>{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Calendar widget */}
              <div style={{ background: 'var(--surface)', borderRadius: 24, padding: 28, boxShadow: 'var(--shadow-md), 0 0 0 1px var(--border)' }}>
                <div className="flex items-center justify-between mb-5">
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-900)' }}>Maio 2026</span>
                  <div className="flex gap-1">
                    {['<', '>'].map(ch => (
                      <button key={ch} style={{ width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', color: 'var(--text-600)', fontSize: 16 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>{ch}</button>
                    ))}
                  </div>
                </div>
                {/* Days of week */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                    <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-500)', padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>
                  ))}
                </div>
                {/* Calendar grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 20 }}>
                  {[
                    { d: '27', muted: true }, { d: '28', muted: true }, { d: '29', muted: true }, { d: '30', muted: true },
                    { d: '1' }, { d: '2' }, { d: '3' },
                    { d: '4' }, { d: '5', dot: true }, { d: '6' }, { d: '7' }, { d: '8' }, { d: '9', dot: true }, { d: '10' },
                    { d: '11' }, { d: '12' }, { d: '13', active: true }, { d: '14', dot: true }, { d: '15' }, { d: '16' }, { d: '17' },
                    { d: '18' }, { d: '19' }, { d: '20' }, { d: '21' }, { d: '22', dot: true }, { d: '23' }, { d: '24' },
                    { d: '25' }, { d: '26' }, { d: '27' }, { d: '28' }, { d: '29' }, { d: '30' }, { d: '31' },
                  ].map(({ d, muted, active, dot }, i) => (
                    <div key={i} style={{
                      aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 8, position: 'relative',
                      fontSize: 13, fontWeight: active ? 700 : 500,
                      background: active ? '#20D4B8' : 'transparent',
                      color: active ? '#0D1B1A' : muted ? 'var(--text-400)' : 'var(--text-800)',
                      cursor: 'pointer',
                    }}>
                      {d}
                      {dot && !active && <span style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: '50%', background: '#20D4B8' }} />}
                    </div>
                  ))}
                </div>
                {/* Time slots */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { t: '09:00' }, { t: '10:30' }, { t: '14:30', selected: true }, { t: '16:00' }, { t: '18:00' },
                  ].map(({ t, selected }) => (
                    <span key={t} style={{
                      padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                      background: selected ? '#20D4B8' : 'var(--surface-2)',
                      color: selected ? '#0D1B1A' : 'var(--text-700)',
                      boxShadow: selected ? '0 0 0 1.5px #20D4B8' : '0 0 0 1px var(--border)',
                    }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SEJA PARCEIRO ── */}
        <section id="seja-parceiro" style={{ paddingBottom: 104 }}>
          <div className="max-w-[1240px] mx-auto px-6 md:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--teal-700)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 14 }}
                  className="dark:!text-[var(--teal-300)]">Seja parceiro</span>
                <h2 style={{ fontWeight: 800, fontSize: 'clamp(30px, 3.8vw, 46px)', lineHeight: 1.05, letterSpacing: '-0.03em', color: 'var(--text-900)', marginBottom: 18, textWrap: 'balance' }}>
                  Transforme suas habilidades <span style={{ color: 'var(--teal-600)' }} className="dark:!text-[var(--teal-300)]">em renda real.</span>
                </h2>
                <p style={{ fontSize: 17.5, color: 'var(--text-600)', lineHeight: 1.55, marginBottom: 32 }}>
                  Ganhe dinheiro nos horários que você definir, com acesso a uma base crescente de clientes. A HomeFix cuida do pagamento, da reputação e da logística — você foca no que sabe fazer.
                </p>
                <ul className="flex flex-col gap-3 mb-8">
                  {[
                    'Sem mensalidades. Você só paga por serviço realizado.',
                    'Receba direto no PIX em até 24h após o serviço.',
                    'Suporte 24/7 e seguro contra imprevistos.',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-3" style={{ fontSize: 15, color: 'var(--text-700)' }}>
                      <span style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--teal-100)', color: 'var(--teal-700)', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1 }}>
                        <Check size={12} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => navigate('/cadastro/prestador')}
                    style={{ padding: '15px 24px', borderRadius: 12, background: '#20D4B8', color: '#0D1B1A', fontWeight: 700, fontSize: 15.5, boxShadow: '0 12px 28px rgba(32,212,184,0.32)' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#10B89C'}
                    onMouseLeave={e => e.currentTarget.style.background = '#20D4B8'}>
                    Começar a ganhar
                  </button>
                  <button style={{ padding: '15px 24px', borderRadius: 12, fontWeight: 600, fontSize: 15.5, color: 'var(--text-900)', boxShadow: 'inset 0 0 0 1.5px var(--border-strong)' }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = 'inset 0 0 0 1.5px var(--text-900)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'inset 0 0 0 1.5px var(--border-strong)'}>
                    Como funciona
                  </button>
                </div>
              </div>

              {/* Partner photo */}
              <div style={{
                position: 'relative', borderRadius: 24, overflow: 'hidden', aspectRatio: '4/5', maxWidth: 480, margin: '0 auto', width: '100%',
                backgroundImage: "url('https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80')",
                backgroundSize: 'cover', backgroundPosition: 'center',
                boxShadow: 'var(--shadow-lg)',
              }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(13,27,26,0.7) 0%, transparent 60%)' }} />
                {/* Earn chip */}
                <div style={{
                  position: 'absolute', bottom: 24, left: 24, right: 24,
                  background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
                  borderRadius: 14, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 999, background: '#4EDFC0', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14, color: '#0D1B1A', flexShrink: 0 }}>RB</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0D1B1A' }}>Renato B.</div>
                    <div style={{ fontSize: 12, color: '#4A6862' }}>Eletricista · São Paulo</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 17, color: '#0A9A82', letterSpacing: '-0.02em' }}>R$ 4.820</div>
                    <div style={{ fontSize: 11, color: '#6E8984' }}>esta semana</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── EMPRESAS ── */}
        <section id="empresas" style={{ paddingBottom: 104 }}>
          <div className="max-w-[1240px] mx-auto px-6 md:px-8">
            <div style={{ background: 'var(--bg-inverted)', borderRadius: 28, padding: 'clamp(40px, 5vw, 72px)', overflow: 'hidden' }}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#20D4B8', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 14 }}>
                    HomeFix para Empresas
                  </span>
                  <h2 style={{ fontWeight: 800, fontSize: 'clamp(28px, 3.2vw, 42px)', lineHeight: 1.05, letterSpacing: '-0.03em', color: 'white', marginBottom: 18, textWrap: 'balance' }}>
                    A plataforma de serviços que <span style={{ color: '#20D4B8' }}>sua empresa precisa.</span>
                  </h2>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 17.5, lineHeight: 1.55, marginBottom: 32, maxWidth: 480 }}>
                    Manutenção e limpeza recorrente para condomínios, escritórios e pequenos negócios — com gestão centralizada e faturamento simplificado.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button style={{ padding: '15px 24px', borderRadius: 12, background: '#20D4B8', color: '#08141A', fontWeight: 700, fontSize: 15.5 }}
                      onMouseEnter={e => e.currentTarget.style.background = 'white'}
                      onMouseLeave={e => e.currentTarget.style.background = '#20D4B8'}>
                      Conheça as soluções
                    </button>
                    <button style={{ padding: '15px 24px', borderRadius: 12, color: 'white', fontWeight: 600, fontSize: 15.5, background: 'rgba(255,255,255,0.08)', boxShadow: '0 0 0 1px rgba(255,255,255,0.22)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}>
                      Falar com vendas
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M8 15h3" /></svg>, title: 'Faturamento único', desc: 'Notas fiscais e pagamentos centralizados.' },
                    { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5l-8-3z" /></svg>, title: 'Equipes auditadas', desc: 'Profissionais com documentação e seguro.' },
                    { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M8 4v16" /></svg>, title: 'Gestão centralizada', desc: 'Dashboard único para todos os locais.' },
                    { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m7 14 4-4 4 4 5-6" /></svg>, title: 'SLAs garantidos', desc: 'Prazos e tempos de resposta acordados.' },
                  ].map(({ icon, title, desc }) => (
                    <div key={title} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 22, backdropFilter: 'blur(8px)' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: '#20D4B8', color: '#08141A', display: 'grid', placeItems: 'center', marginBottom: 14 }}>{icon}</div>
                      <h4 style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4, color: 'white', letterSpacing: '-0.01em' }}>{title}</h4>
                      <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── APP ── */}
        <section style={{ paddingBottom: 104 }}>
          <div className="max-w-[1240px] mx-auto px-6 md:px-8">
            <div style={{ maxWidth: 680, margin: '0 auto 56px', textAlign: 'center' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--teal-700)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 14 }}
                className="dark:!text-[var(--teal-300)]">Aplicativos</span>
              <h2 style={{ fontWeight: 800, fontSize: 'clamp(30px, 3.8vw, 46px)', lineHeight: 1.05, letterSpacing: '-0.03em', color: 'var(--text-900)', marginBottom: 18 }}>
                Leve a HomeFix <span style={{ color: 'var(--teal-600)' }} className="dark:!text-[var(--teal-300)]">no bolso.</span>
              </h2>
              <p style={{ fontSize: 17.5, color: 'var(--text-600)', lineHeight: 1.55 }}>Dois aplicativos, um ecossistema. Escolha o seu e comece agora mesmo.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  tag: 'Cliente', title: 'Para sua casa', desc: 'Encontre, agende e acompanhe serviços em segundos, direto no celular.',
                  pro: false,
                  screen: (
                    <div style={{ padding: '30px 10px 10px', height: '100%', background: 'white' }}>
                      <div style={{ fontSize: 9, color: '#6E8984', fontWeight: 500 }}>Olá, Ana</div>
                      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.02em', color: '#0D1B1A', marginBottom: 10 }}>O que você precisa?</div>
                      <div style={{ background: '#F7F9F8', borderRadius: 8, padding: '6px 8px', fontSize: 8, color: '#6E8984', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, border: '1px solid #E5ECEA' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0A9A82" strokeWidth="2.5"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                        Buscar serviço
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                        {['Limpeza', 'Reparos', 'Instalação', 'Segurança'].map(s => (
                          <div key={s} style={{ background: 'white', borderRadius: 6, padding: 6, border: '1px solid #E5ECEA' }}>
                            <div style={{ width: 16, height: 16, background: '#BDF3E6', borderRadius: 4, marginBottom: 4 }} />
                            <div style={{ fontSize: 7, fontWeight: 700, color: '#0D1B1A' }}>{s}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                },
                {
                  tag: 'Profissional', title: 'Para sua renda', desc: 'Receba serviços compatíveis com sua agenda e cresça com a HomeFix.',
                  pro: true,
                  screen: (
                    <div style={{ padding: '30px 10px 10px', height: '100%', background: 'white' }}>
                      <div style={{ fontSize: 9, color: '#6E8984', fontWeight: 500 }}>Hoje</div>
                      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.02em', color: '#0D1B1A' }}>3 serviços</div>
                      <div style={{ fontSize: 8, color: '#6E8984', marginBottom: 10 }}>Próximo em 40 min</div>
                      <div style={{ background: 'white', borderRadius: 8, padding: 8, border: '1px solid #E5ECEA', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <div style={{ fontSize: 8, fontWeight: 700, color: '#0D1B1A' }}>14:30 — Instalação</div>
                          <div style={{ fontSize: 7, color: '#0A5A4F', background: '#BDF3E6', padding: '1px 5px', borderRadius: 999, fontWeight: 700 }}>NOVO</div>
                        </div>
                        <div style={{ fontSize: 7, color: '#6E8984' }}>R. Augusta, 1200 · 2,4km</div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#0A9A82', marginTop: 4 }}>R$ 180,00</div>
                      </div>
                      <div style={{ background: 'white', borderRadius: 8, padding: 8, border: '1px solid #E5ECEA' }}>
                        <div style={{ fontSize: 8, fontWeight: 700, color: '#0D1B1A' }}>16:00 — Reparo elétrico</div>
                        <div style={{ fontSize: 7, color: '#6E8984' }}>Av. Paulista, 900 · 4,1km</div>
                      </div>
                    </div>
                  ),
                },
              ].map(({ tag, title, desc, pro, screen }) => (
                <div key={tag}
                  className="grid grid-cols-[1.1fr_1fr] overflow-hidden transition-all duration-[250ms]"
                  style={{ borderRadius: 24, background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 340, boxShadow: 'var(--shadow-xs)' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg), 0 0 0 1px #4EDFC0' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-xs)' }}>
                  {/* Copy */}
                  <div style={{ padding: 32, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 24 }}>
                    <div>
                      <span style={{
                        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                        padding: '5px 12px', borderRadius: 999, display: 'inline-block', marginBottom: 16,
                        color: pro ? '#0D1B1A' : 'var(--teal-800)',
                        background: pro ? 'var(--teal-200)' : 'var(--teal-100)',
                      }}>{tag}</span>
                      <h3 style={{ fontWeight: 800, fontSize: 26, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-0.025em', color: 'var(--text-900)' }}>{title}</h3>
                      <p style={{ fontSize: 14.5, color: 'var(--text-600)', lineHeight: 1.5 }}>{desc}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {[{ small: 'Baixe no', big: 'App Store' }, { small: 'Disponível no', big: 'Google Play' }].map(({ small, big }) => (
                        <a key={big} href="#"
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: 'var(--text-900)', color: 'var(--bg)', fontSize: 12.5, textDecoration: 'none' }}>
                          <span style={{ fontSize: 18 }}>{big.includes('App') ? '🍎' : '▶'}</span>
                          <div><div style={{ fontSize: 10, opacity: 0.7 }}>{small}</div><div style={{ fontSize: 14, fontWeight: 700 }}>{big}</div></div>
                        </a>
                      ))}
                    </div>
                  </div>
                  {/* Phone visual */}
                  <div style={{
                    background: pro
                      ? 'linear-gradient(160deg, var(--teal-200), var(--teal-100))'
                      : 'linear-gradient(160deg, var(--teal-100), var(--teal-50))',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute', width: 190, height: 360, bottom: -50,
                      right: '50%', transform: 'translateX(50%) rotate(-5deg)',
                      background: '#0D1B1A', borderRadius: 30, padding: 6,
                      boxShadow: '0 20px 40px rgba(13,27,26,0.25), 0 0 0 1.5px rgba(255,255,255,0.08)',
                    }}>
                      <div style={{ width: '100%', height: '100%', background: 'white', borderRadius: 24, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 60, height: 16, background: '#0D1B1A', borderRadius: 12, zIndex: 5 }} />
                        {screen}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer style={{ background: 'var(--bg-inverted)', color: 'rgba(255,255,255,0.65)', padding: '80px 0 32px' }}>
        <div className="max-w-[1240px] mx-auto px-6 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] gap-10 mb-12">
            <div style={{ maxWidth: 320 }}>
              <Logo white />
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.55, margin: '16px 0 20px' }}>
                A plataforma que conecta profissionais verificados a quem precisa resolver a casa, em todo o Brasil.
              </p>
              <div className="flex gap-2">
                {[
                  { label: 'Instagram', path: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></> },
                  { label: 'Facebook', path: <path fill="currentColor" d="M13 22V12h3l1-4h-4V6c0-1 .5-2 2-2h2V0h-3c-3 0-5 2-5 5v3H6v4h3v10h4z" /> },
                  { label: 'LinkedIn', path: <path fill="currentColor" d="M6.5 8H2v14h4.5V8zm-2.25-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM22 22v-7.7c0-4-2.2-5.8-5-5.8-2.3 0-3.3 1.3-3.9 2.2V8H8.5v14H13v-7.5c0-1.6.7-3 2.5-3s2.5 1.3 2.5 3V22H22z" /> },
                  { label: 'YouTube', path: <path fill="currentColor" d="M23 7a2.5 2.5 0 0 0-1.8-1.8C19.6 4.8 12 4.8 12 4.8s-7.6 0-9.2.4A2.5 2.5 0 0 0 1 7c-.4 1.6-.4 5-.4 5s0 3.4.4 5a2.5 2.5 0 0 0 1.8 1.8c1.6.4 9.2.4 9.2.4s7.6 0 9.2-.4A2.5 2.5 0 0 0 23 17c.4-1.6.4-5 .4-5s0-3.4-.4-5zM10 15.2V8.8l5.3 3.2-5.3 3.2z" /> },
                ].map(({ label, path }) => (
                  <a key={label} href="#" aria-label={label}
                    style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.06)', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.8)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#20D4B8'; e.currentTarget.style.color = '#08141A' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{path}</svg>
                  </a>
                ))}
              </div>
            </div>
            {[
              { title: 'Produto', links: ['Serviços', 'Agendamento', 'Segurança', 'App Cliente', 'App Profissional'] },
              { title: 'Empresa', links: ['Quem somos', 'Carreira', 'Blog', 'Imprensa'] },
              { title: 'Ajuda', links: ['Central de ajuda', 'Fale conosco', 'Termos de uso', 'Privacidade'] },
              { title: 'Para empresas', links: ['Soluções B2B', 'Condomínios', 'Escritórios', 'Falar com vendas'] },
            ].map(({ title, links }) => (
              <div key={title}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 16, letterSpacing: '0.02em' }}>{title}</h4>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {links.map(link => (
                    <li key={link}>
                      <a href="#" style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'white'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}>
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            <div>© 2026 HomeFix Tecnologia. Todos os direitos reservados.</div>
            <div style={{ display: 'flex', gap: 20 }}>
              {['Termos', 'Privacidade', 'Cookies'].map(t => (
                <a key={t} href="#" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'white'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}>
                  {t}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
