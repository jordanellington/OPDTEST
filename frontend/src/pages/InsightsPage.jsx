import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, PieChart as PieChartIcon, TrendingUp, Users, Globe, FileText,
  Download, Clock, Building2, Scale, Sparkles, Lock,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { getStats } from '../lib/api';

/* ── Colors ── */
const TEAL = '#4db8a4';
const TEAL_LIGHT = 'rgba(77,184,164,0.15)';
const GOLD = '#c8a44e';
const GOLD_BG = 'rgba(200,164,78,0.06)';
const GOLD_BORDER = 'rgba(200,164,78,0.3)';

const PIE_COLORS = [
  '#4db8a4', '#c8a44e', '#7ba4d9', '#d97bab', '#d9a57b',
  '#9b7bd9', '#6dd4be', '#e8c86e', '#5f9bd4', '#d4738b',
];

/* ── Animation variants ── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

/* ── Custom Recharts Tooltip ── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--color-bg-elevated)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 8,
        padding: '8px 12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
      }}
    >
      <p className="text-[11px] text-text-primary font-medium">{label || payload[0]?.name}</p>
      <p className="text-[11px]" style={{ color: TEAL }}>
        {payload[0]?.value} opinion{payload[0]?.value !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

/* ── Chart Section Wrapper ── */
function ChartCard({ title, icon: Icon, children }) {
  return (
    <motion.div
      variants={itemVariants}
      style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid rgba(255,255,255,0.04)',
        borderRadius: 14,
        padding: '24px',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-center gap-2 mb-5">
        <Icon size={16} style={{ color: TEAL }} />
        <h3
          className="text-[15px] font-medium"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
        >
          {title}
        </h3>
      </div>
      {children}
    </motion.div>
  );
}

/* ── Coming Soon Card ── */
function ComingSoonCard({ title, description, icon: Icon }) {
  return (
    <motion.div
      variants={itemVariants}
      style={{
        background: GOLD_BG,
        border: `1px solid ${GOLD_BORDER}`,
        borderRadius: 14,
        padding: '20px 24px',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 flex items-center justify-center rounded-lg"
          style={{
            width: 36,
            height: 36,
            background: 'rgba(200,164,78,0.10)',
            border: '1px solid rgba(200,164,78,0.15)',
          }}
        >
          <Icon size={16} style={{ color: GOLD }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-[13px] font-semibold text-text-primary">{title}</h4>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
              style={{
                background: 'rgba(200,164,78,0.15)',
                color: GOLD,
                border: `1px solid ${GOLD_BORDER}`,
              }}
            >
              <Lock size={8} />
              Coming Soon
            </span>
          </div>
          <p className="text-[12px] text-text-muted leading-relaxed">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Ranked List Component ── */
function RankedList({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-text-muted text-xs">No data available</p>;
  }
  const max = data[0]?.count || 1;
  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={item.label} className="flex items-center gap-3">
          <span
            className="shrink-0 w-5 text-right text-[10px] font-bold"
            style={{ color: i < 3 ? TEAL : 'var(--color-text-muted)' }}
          >
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-text-secondary truncate pr-2">{item.label}</span>
              <span className="text-[10px] text-text-muted shrink-0">{item.count}</span>
            </div>
            <div
              className="h-1 rounded-full"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: i < 3 ? TEAL : 'rgba(77,184,164,0.4)' }}
                initial={{ width: 0 }}
                animate={{ width: `${(item.count / max) * 100}%` }}
                transition={{ duration: 0.6, delay: i * 0.05 }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Helper: extract facet data ── */
function extractFacetData(facets, key, limit = 0) {
  if (!facets) return [];
  const facet = facets[key];
  if (!facet) return [];

  // Stats endpoint returns arrays of { value, count }, not { buckets }
  const items = Array.isArray(facet) ? facet : facet.buckets || [];

  let data = items
    .filter((b) => (b.label || b.value) && String(b.label || b.value).trim() !== '')
    .map((b) => ({
      label: b.label || b.value,
      name: b.label || b.value,
      count: b.count || 0,
      value: b.count || 0,
    }));

  if (limit > 0) {
    data = data.slice(0, limit);
  }

  return data;
}

/* ── Main Page ── */
export default function InsightsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getStats()
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load statistics');
        setLoading(false);
      });
  }, []);

  const facets = stats?.facets || {};

  /* Derive chart data from facets */
  const practiceAreaData = extractFacetData(facets, 'Practice Areas');
  const providerData = extractFacetData(facets, 'Opinion Providers');
  const clientData = extractFacetData(facets, 'Clients', 10);
  const officeData = extractFacetData(facets, 'Offices');

  /* Coming Soon reports */
  const comingSoonReports = [
    {
      title: 'Partner/Signatory Analytics',
      description: 'Which partners have signed the most opinions?',
      icon: Users,
    },
    {
      title: 'Jurisdiction Coverage Matrix',
      description: 'US Jurisdictions vs Practice Areas',
      icon: Globe,
    },
    {
      title: 'Client Opinion History Timeline',
      description: 'Chronological view per client',
      icon: Clock,
    },
    {
      title: 'Comparative Firm Analysis',
      description: 'How our opinions compare to other firms',
      icon: Building2,
    },
    {
      title: 'SEC Filing Coverage',
      description: 'Exhibit 5 vs Exhibit 8 breakdown',
      icon: Scale,
    },
    {
      title: 'Export Reports to PDF',
      description: 'Download any report for offline use',
      icon: Download,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto" />
          <p className="text-text-muted text-xs mt-3">Loading insights...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-status-red text-sm mb-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-accent text-xs hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 32px 60px' }}
      >
        {/* ── Header ── */}
        <motion.div variants={itemVariants} className="mb-10">
          <p
            className="text-[10px] font-bold tracking-[0.32em] uppercase mb-2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Covington & Burling LLP
          </p>
          <h1
            className="text-[36px] font-normal leading-tight mb-2"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
          >
            Insights & Analytics
          </h1>
          <p className="text-[14px] text-text-muted" style={{ maxWidth: 540 }}>
            Real-time analysis of your corporate opinion letter database. Explore practice areas,
            providers, clients, and office distributions.
          </p>
        </motion.div>

        {/* ── Live Reports Grid ── */}
        <motion.div variants={itemVariants} className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} style={{ color: TEAL }} />
            <h2
              className="text-[18px] font-normal"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
            >
              Live Reports
            </h2>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
              style={{ background: TEAL_LIGHT, color: TEAL }}
            >
              Live
            </span>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-12">
          {/* Practice Area Distribution — Horizontal Bar */}
          <ChartCard title="Practice Area Distribution" icon={BarChart3}>
            {practiceAreaData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(200, practiceAreaData.length * 36)}>
                <BarChart
                  data={practiceAreaData}
                  layout="vertical"
                  margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.04)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fill: '#5f706a', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.04)' }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={140}
                    tick={{ fill: '#9aa69f', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="count" fill={TEAL} radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-text-muted text-xs py-8 text-center">No practice area data available</p>
            )}
          </ChartCard>

          {/* Opinion Provider Breakdown — Donut/Pie */}
          <ChartCard title="Opinion Provider Breakdown" icon={PieChartIcon}>
            {providerData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={providerData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="count"
                    nameKey="label"
                    paddingAngle={2}
                    stroke="none"
                  >
                    {providerData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(value) => (
                      <span className="text-[10px] text-text-secondary">{value}</span>
                    )}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 10 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-text-muted text-xs py-8 text-center">No provider data available</p>
            )}
          </ChartCard>

          {/* Top 10 Clients — Ranked List */}
          <ChartCard title="Top 10 Clients by Opinion Count" icon={Building2}>
            <RankedList data={clientData} />
          </ChartCard>

          {/* Covington Office Distribution — Bar Chart */}
          <ChartCard title="Covington Office Distribution" icon={Building2}>
            {officeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(200, officeData.length * 36)}>
                <BarChart
                  data={officeData}
                  layout="vertical"
                  margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.04)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fill: '#5f706a', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.04)' }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={120}
                    tick={{ fill: '#9aa69f', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="count" fill={TEAL} radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-text-muted text-xs py-8 text-center">No office data available</p>
            )}
          </ChartCard>
        </div>

        {/* ── Coming Soon Reports ── */}
        <motion.div variants={itemVariants} className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={14} style={{ color: GOLD }} />
            <h2
              className="text-[18px] font-normal"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
            >
              Coming Soon
            </h2>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
              style={{
                background: 'rgba(200,164,78,0.15)',
                color: GOLD,
                border: `1px solid ${GOLD_BORDER}`,
              }}
            >
              Roadmap
            </span>
          </div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {comingSoonReports.map((report) => (
            <ComingSoonCard
              key={report.title}
              title={report.title}
              description={report.description}
              icon={report.icon}
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
