import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getStats } from '../lib/api';
import { Search, Loader2, Sparkles, Map, GitCompareArrows, Bell } from 'lucide-react';

/* ───── Animated counter (eased with cubic out) ───── */
function Counter({ target, duration = 1400 }) {
  const [count, setCount] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !target) return;
    started.current = true;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      setCount(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return <>{count.toLocaleString()}</>;
}

/* ───── Coming Soon card (reusable) ───── */
function ComingSoonCard({ icon: Icon, title, description, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45 }}
      className="relative overflow-hidden"
      style={{
        padding: '24px 24px 22px',
        background: '#151c19',
        borderRadius: 12,
        border: '1px solid rgba(200,164,78,0.3)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
      }}
    >
      {/* Subtle gold gradient wash */}
      <div
        className="absolute left-0 top-0 bottom-0 pointer-events-none"
        style={{ width: 100, background: 'linear-gradient(90deg, rgba(200,164,78,0.04), transparent)' }}
      />
      <div className="relative">
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <Icon size={20} style={{ color: '#c8a44e', opacity: 0.7 }} strokeWidth={1.6} />
          <span
            className="text-[10px] font-bold tracking-[0.12em] uppercase shrink-0"
            style={{
              color: '#c8a44e',
              padding: '4px 10px',
              borderRadius: 5,
              background: 'rgba(200,164,78,0.12)',
              border: '1px solid rgba(200,164,78,0.25)',
            }}
          >
            Coming Soon
          </span>
        </div>
        <h3
          className="text-[15px] font-semibold text-white"
          style={{ marginBottom: 6 }}
        >
          {title}
        </h3>
        <p className="text-text-secondary text-[13px] leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

/* ───── Stagger helpers ───── */
const sectionVariant = (delay) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.45 },
});

/* ═════════════════════════════════════════════════
   Dashboard
   ═════════════════════════════════════════════════ */
export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const s = await getStats();
        setStats(s);
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-7 h-7 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <p className="text-text-muted text-sm">Loading opinions database...</p>
        </div>
      </div>
    );
  }

  /* ── Derived data ── */
  const totalDocs = stats?.totalDocuments || 0;
  const facets = stats?.facets || {};

  const practiceAreas = facets['Practice Areas'] || [];
  const opinionProviders = facets['Opinion Providers'] || [];

  // Count jurisdictions from any jurisdiction-related facets
  const usJurisdictions = facets['US Jurisdictions'] || facets['Jurisdictions (US)'] || [];
  const nonUsJurisdictions = facets['Non-US Jurisdictions'] || facets['Jurisdictions (Non-US)'] || [];
  const allJurisdictions = [...usJurisdictions, ...nonUsJurisdictions];
  // Deduplicate by value
  const jurisdictionCount = new Set(allJurisdictions.map(j => j.value)).size;

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      navigate('/search');
      return;
    }
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <div>
      {/* ═══ Hero Section ═══ */}
      <motion.div
        {...sectionVariant(0)}
        className="page-section-hero"
        style={{ padding: '44px 56px 0' }}
      >
        <h1
          className="page-title font-display text-[36px] font-light text-white leading-[1.1] tracking-[-0.02em]"
          style={{ marginBottom: 10 }}
        >
          Corporate Opinion Letters
        </h1>
        <p
          className="page-subtitle text-text-muted text-[13px]"
          style={{ marginBottom: 28 }}
        >
          Covington &amp; Burling LLP &mdash; Securities Practice Opinions Database
        </p>

        {/* ── Stats ticker ── */}
        <div
          className="stats-row flex flex-wrap items-baseline"
          style={{
            gap: 48,
            paddingBottom: 28,
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <div className="flex items-baseline" style={{ gap: 10 }}>
            <span className="stats-number font-display text-[28px] font-light text-accent-bright leading-none">
              <Counter target={totalDocs} />
            </span>
            <span className="text-[10px] font-semibold tracking-[0.1em] text-text-muted">
              TOTAL OPINIONS
            </span>
          </div>
          <div className="flex items-baseline" style={{ gap: 10 }}>
            <span className="stats-number font-display text-[28px] font-light text-accent-bright leading-none">
              <Counter target={practiceAreas.length} duration={1000} />
            </span>
            <span className="text-[10px] font-semibold tracking-[0.1em] text-text-muted">
              PRACTICE AREAS
            </span>
          </div>
          <div className="flex items-baseline" style={{ gap: 10 }}>
            <span className="stats-number font-display text-[28px] font-light text-accent-bright leading-none">
              <Counter target={opinionProviders.length} duration={1100} />
            </span>
            <span className="text-[10px] font-semibold tracking-[0.1em] text-text-muted">
              LAW FIRMS
            </span>
          </div>
          <div className="flex items-baseline" style={{ gap: 10 }}>
            <span className="stats-number font-display text-[28px] font-light text-accent-bright leading-none">
              <Counter target={jurisdictionCount} duration={1200} />
            </span>
            <span className="text-[10px] font-semibold tracking-[0.1em] text-text-muted">
              JURISDICTIONS
            </span>
          </div>
        </div>
      </motion.div>

      {/* ═══ Search Bar ═══ */}
      <motion.div
        {...sectionVariant(0.1)}
        className="page-section"
        style={{ padding: '36px 56px 40px' }}
      >
        <form onSubmit={handleSearch}>
          <div
            className="flex items-center cursor-text transition-all duration-200"
            style={{
              gap: 14,
              padding: '14px 16px 14px 20px',
              borderRadius: 10,
              background: searchFocused ? '#151c19' : '#121816',
              border: `1px solid ${searchFocused ? 'rgba(77,184,164,0.25)' : 'rgba(255,255,255,0.06)'}`,
              boxShadow: searchFocused
                ? '0 0 0 3px rgba(77,184,164,0.06), 0 4px 20px rgba(0,0,0,0.3)'
                : '0 2px 8px rgba(0,0,0,0.2)',
            }}
            onClick={() => document.getElementById('dashboard-search-input')?.focus()}
          >
            <Search
              size={18}
              className="shrink-0 transition-colors duration-200"
              style={{ color: searchFocused ? '#4db8a4' : '#4a5955' }}
              strokeWidth={2}
            />
            <input
              id="dashboard-search-input"
              type="text"
              autoComplete="off"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={`Search across ${totalDocs.toLocaleString()} opinion letters by keyword, practice area, or jurisdiction...`}
              className="flex-1 outline-none"
              style={{
                fontFamily: 'inherit',
                fontSize: 15,
                fontWeight: 400,
                color: '#e6eae8',
                letterSpacing: '-0.01em',
                minWidth: 0,
                background: 'none',
                backgroundColor: 'transparent',
                border: 'none',
                colorScheme: 'dark',
                WebkitAppearance: 'none',
                padding: 0,
              }}
            />
            <div className="flex items-center shrink-0" style={{ gap: 8 }}>
              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.06)' }} />
              <button
                type="submit"
                style={{
                  padding: '7px 18px',
                  borderRadius: 6,
                  background: '#4db8a4',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#0b0e0d',
                  letterSpacing: '0.01em',
                  transition: 'all 0.15s ease',
                }}
              >
                Search
              </button>
            </div>
          </div>
        </form>
      </motion.div>

      {/* ═══ Practice Area Distribution ═══ */}
      {practiceAreas.length > 0 && (
        <motion.div
          {...sectionVariant(0.15)}
          className="page-section"
          style={{ padding: '0 56px 48px' }}
        >
          <div className="flex items-baseline justify-between" style={{ marginBottom: 20 }}>
            <h2 className="section-heading text-[20px] font-semibold text-white tracking-[-0.01em]">
              Practice Areas
            </h2>
            <span className="text-[11px] font-medium text-text-muted">
              {practiceAreas.length} areas
            </span>
          </div>

          <div
            className="subject-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}
          >
            {practiceAreas.map((area) => (
              <div
                key={area.value}
                onClick={() => {
                  const params = new URLSearchParams({
                    q: '',
                    'f.Practice Areas': area.value,
                  });
                  navigate(`/search?${params.toString()}`);
                }}
                className="subject-card flex items-center justify-between cursor-pointer transition-all duration-200"
                style={{
                  gap: 12,
                  padding: '14px 16px',
                  borderRadius: 8,
                  background: '#151c19',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#222e2a';
                  e.currentTarget.style.boxShadow =
                    '0 4px 16px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.2)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.11)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#151c19';
                  e.currentTarget.style.boxShadow =
                    '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <span
                  className="text-[13px] font-medium leading-snug transition-colors duration-150"
                  style={{ color: '#e6eae8' }}
                >
                  {area.value}
                </span>
                <span
                  className="text-[12px] font-semibold shrink-0 transition-colors duration-150"
                  style={{
                    color: '#4db8a4',
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'rgba(77,184,164,0.08)',
                  }}
                >
                  {area.count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ═══ Coming Soon Cards ═══ */}
      <motion.div
        {...sectionVariant(0.2)}
        className="page-section"
        style={{ padding: '0 56px 48px' }}
      >
        <div style={{ marginBottom: 20 }}>
          <h2 className="section-heading text-[20px] font-semibold text-white tracking-[-0.01em]">
            Coming Soon
          </h2>
        </div>

        <div
          className="subject-grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}
        >
          <ComingSoonCard
            icon={Sparkles}
            title="AI Opinion Analysis"
            description="Ask questions about any opinion letter using AI"
            delay={0.25}
          />
          <ComingSoonCard
            icon={Map}
            title="Jurisdiction Coverage Map"
            description="Visual heat map of opinion coverage by jurisdiction"
            delay={0.3}
          />
          <ComingSoonCard
            icon={GitCompareArrows}
            title="Opinion Comparison"
            description="Side-by-side comparison of opinion scope and conditions"
            delay={0.35}
          />
          <ComingSoonCard
            icon={Bell}
            title="Email Alerts"
            description="Get notified when new opinions match your criteria"
            delay={0.4}
          />
        </div>
      </motion.div>

      {/* ═══ Footer ═══ */}
      <motion.div
        {...sectionVariant(0.35)}
        className="page-section"
        style={{
          padding: '24px 56px 40px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <p className="text-text-dim text-[12px] text-center">
          &copy; 2014&ndash;2026 Covington &amp; Burling LLP.
        </p>
      </motion.div>
    </div>
  );
}
