import { motion } from 'framer-motion';
import { FileText, MapPin, User, Calendar, Building2 } from 'lucide-react';

const practiceAreaColors = {
  Securities: { color: '#4db8a4', bg: 'rgba(77,184,164,0.08)', border: 'rgba(77,184,164,0.18)' },
  'Securities & Capital Markets': { color: '#4db8a4', bg: 'rgba(77,184,164,0.08)', border: 'rgba(77,184,164,0.18)' },
  Finance: { color: '#6ba3e8', bg: 'rgba(107,163,232,0.08)', border: 'rgba(107,163,232,0.18)' },
  'Finance & Lending': { color: '#6ba3e8', bg: 'rgba(107,163,232,0.08)', border: 'rgba(107,163,232,0.18)' },
  'PD&F': { color: '#c8a44e', bg: 'rgba(200,164,78,0.08)', border: 'rgba(200,164,78,0.18)' },
  'Project Development & Finance': { color: '#c8a44e', bg: 'rgba(200,164,78,0.08)', border: 'rgba(200,164,78,0.18)' },
};

const defaultBadge = { color: '#9aa69f', bg: 'rgba(154,166,159,0.08)', border: 'rgba(154,166,159,0.18)' };

function formatDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return null;
  }
}

export default function ResultCard({ result, onClick, index = 0, isSelected = false }) {
  const props = result.entry?.properties || result.properties || {};
  const name = result.entry?.name || result.name || 'Untitled';

  const clientName = props['corpkmdcf:clientName'];
  const opinionTypes = props['corpkmdcf:opinionTypes']; // can be string or array
  const dateOfOpinion = formatDate(props['corpkmdcf:dateOfOpinion']);
  const opinionProvider = props['corpkmdcf:opinionProvider'];
  const usJurisdictions = props['corpkmdcf:usJurisdictions'];
  const signatory = props['corpkmdcf:covingtonLawyerSigningOpinion'];
  const pages = props['eci:pages'];

  // Normalize opinionTypes to array
  const typesList = Array.isArray(opinionTypes)
    ? opinionTypes
    : opinionTypes
      ? [opinionTypes]
      : [];

  // Normalize jurisdictions to display string
  const jurisdictionStr = Array.isArray(usJurisdictions)
    ? usJurisdictions.join(', ')
    : usJurisdictions || null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.3), duration: 0.3 }}
      onClick={onClick}
      className="group cursor-pointer transition-all duration-150"
      style={{
        padding: '16px 20px',
        borderRadius: 10,
        marginBottom: 6,
        background: isSelected ? 'var(--color-bg-elevated)' : 'var(--color-bg-secondary)',
        border: isSelected ? '1px solid var(--color-border-strong)' : '1px solid var(--color-border-mid)',
        boxShadow: 'var(--shadow-card)',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'var(--color-bg-elevated)';
          e.currentTarget.style.borderColor = 'var(--color-border-strong)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'var(--color-bg-secondary)';
          e.currentTarget.style.borderColor = 'var(--color-border-mid)';
        }
      }}
    >
      {/* Selected accent bar */}
      {isSelected && (
        <div style={{
          position: 'absolute', left: 0, top: 8, bottom: 8,
          width: 3, borderRadius: 2, background: 'var(--color-accent)',
        }} />
      )}

      {/* Row 1: Document name + page count */}
      <div className="flex items-start gap-3" style={{ marginBottom: 10 }}>
        <FileText
          size={15}
          className="shrink-0 mt-0.5"
          style={{ color: 'var(--color-accent)' }}
          strokeWidth={1.8}
        />
        <span
          className="flex-1 min-w-0"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            lineHeight: 1.35,
            wordBreak: 'break-word',
          }}
        >
          {name}
        </span>
        {pages != null && pages > 0 && (
          <span
            className="shrink-0"
            style={{
              fontSize: 11,
              color: 'var(--color-text-muted)',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {pages} pg
          </span>
        )}
      </div>

      {/* Row 2: Practice area badges */}
      {typesList.length > 0 && (
        <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 10, paddingLeft: 27 }}>
          {typesList.map((type) => {
            const badge = practiceAreaColors[type] || defaultBadge;
            return (
              <span
                key={type}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  padding: '3px 10px',
                  borderRadius: 4,
                  color: badge.color,
                  background: badge.bg,
                  border: `1px solid ${badge.border}`,
                }}
              >
                {type}
              </span>
            );
          })}
        </div>
      )}

      {/* Row 3: Metadata grid */}
      <div
        className="flex flex-wrap items-center gap-x-5 gap-y-2"
        style={{ paddingLeft: 27, fontSize: 12 }}
      >
        {clientName && (
          <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            <Building2 size={11} style={{ color: 'var(--color-text-muted)' }} strokeWidth={1.8} />
            <span>{clientName}</span>
          </div>
        )}

        {opinionProvider && (
          <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            <User size={11} style={{ color: 'var(--color-text-muted)' }} strokeWidth={1.8} />
            <span>{opinionProvider}</span>
          </div>
        )}

        {dateOfOpinion && (
          <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            <Calendar size={11} style={{ color: 'var(--color-text-muted)' }} strokeWidth={1.8} />
            <span>{dateOfOpinion}</span>
          </div>
        )}

        {jurisdictionStr && (
          <div
            className="flex items-center gap-1.5"
            style={{
              color: 'var(--color-text-secondary)',
              maxWidth: 280,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <MapPin size={11} className="shrink-0" style={{ color: 'var(--color-text-muted)' }} strokeWidth={1.8} />
            <span className="truncate">{jurisdictionStr}</span>
          </div>
        )}

        {signatory && (
          <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            <span>Signed by {signatory}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
