import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

/**
 * Facet field definitions grouped by category.
 * Keys are the corpkmdcf: field names used by the search API.
 * Labels are the human-readable display names.
 */
const FACET_GROUPS = [
  {
    label: 'Quick Filters',
    facets: [
      { field: 'corpkmdcf:opinionProvider', label: 'Opinion Provider' },
      { field: 'corpkmdcf:opinionTypes', label: 'Practice Area' },
      { field: 'corpkmdcf:covingtonOffice', label: 'Covington Office' },
    ],
  },
  {
    label: 'Client & Matter',
    facets: [
      { field: 'corpkmdcf:clientName', label: 'Client Name' },
    ],
  },
  {
    label: 'Jurisdiction',
    facets: [
      { field: 'corpkmdcf:usJurisdictions', label: 'US Jurisdictions' },
      { field: 'corpkmdcf:nonUsJurisdictions', label: 'Non-US Jurisdictions' },
    ],
  },
  {
    label: 'Securities',
    facets: [
      { field: 'corpkmdcf:typeOfOffering', label: 'Offering Type' },
      { field: 'corpkmdcf:typeOfSecurity', label: 'Type of Security' },
      { field: 'corpkmdcf:opinionFilledWithSec', label: 'Filed with SEC' },
      { field: 'corpkmdcf:registeredOfferingType', label: 'Registered Offering Type' },
    ],
  },
  {
    label: 'Transaction',
    facets: [
      { field: 'corpkmdcf:otherLawFirmClientNames', label: 'Other Law Firms' },
      { field: 'corpkmdcf:typeOfFinancing', label: 'Type of Financing' },
      { field: 'corpkmdcf:typeOfTransaction', label: 'Type of Transaction' },
    ],
  },
];

function FacetSection({ field, label, buckets, activeValues, onFilterChange }) {
  const [expanded, setExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  if (!buckets || buckets.length === 0) return null;

  const sortedBuckets = [...buckets].sort((a, b) => {
    // Active items first, then by count descending
    const aActive = activeValues.includes(a.label) ? 1 : 0;
    const bActive = activeValues.includes(b.label) ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    return (b.count || 0) - (a.count || 0);
  });

  const filtered = searchTerm
    ? sortedBuckets.filter(b => b.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : sortedBuckets;

  const VISIBLE_LIMIT = 6;
  const showAll = expanded || filtered.length <= VISIBLE_LIMIT;
  const visible = showAll ? filtered : filtered.slice(0, VISIBLE_LIMIT);
  const remaining = filtered.length - VISIBLE_LIMIT;
  const showSearch = buckets.length > 10;

  return (
    <div style={{ marginBottom: 2 }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          letterSpacing: '0.02em',
          marginBottom: 8,
        }}
      >
        {label}
        {activeValues.length > 0 && (
          <span
            style={{
              marginLeft: 6,
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--color-accent)',
              background: 'rgba(77,184,164,0.10)',
              padding: '1px 6px',
              borderRadius: 3,
            }}
          >
            {activeValues.length}
          </span>
        )}
      </p>

      {showSearch && (
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={`Filter ${label.toLowerCase()}...`}
          style={{
            width: '100%',
            padding: '5px 8px',
            marginBottom: 6,
            fontSize: 11,
            borderRadius: 4,
            border: '1px solid var(--color-border-mid)',
            background: 'var(--color-bg-input)',
            color: 'var(--color-text-primary)',
            outline: 'none',
            fontFamily: 'inherit',
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--color-border-accent)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--color-border-mid)'; }}
        />
      )}

      <div>
        {visible.map((bucket) => {
          const isActive = activeValues.includes(bucket.label);
          return (
            <label
              key={bucket.label}
              className="flex items-center gap-2 cursor-pointer transition-colors duration-100"
              style={{
                padding: '4px 0',
                fontSize: 12,
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
            >
              {/* Custom checkbox */}
              <span
                className="shrink-0 flex items-center justify-center transition-all duration-100"
                style={{
                  width: 15,
                  height: 15,
                  borderRadius: 3,
                  border: isActive
                    ? '1.5px solid var(--color-accent)'
                    : '1.5px solid var(--color-border-strong)',
                  background: isActive ? 'rgba(77,184,164,0.15)' : 'transparent',
                }}
              >
                {isActive && <Check size={10} strokeWidth={3} style={{ color: 'var(--color-accent)' }} />}
              </span>

              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => onFilterChange(field, bucket.label, e.target.checked)}
                className="sr-only"
              />

              <span className="flex-1 min-w-0 truncate" style={{ lineHeight: 1.3 }}>
                {bucket.label}
              </span>
              <span
                className="shrink-0"
                style={{
                  fontSize: 10,
                  color: 'var(--color-text-dim)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {bucket.count?.toLocaleString()}
              </span>
            </label>
          );
        })}
      </div>

      {!showAll && remaining > 0 && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            fontSize: 11,
            color: 'var(--color-accent)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 0',
            fontFamily: 'inherit',
            fontWeight: 500,
          }}
        >
          + {remaining} more
        </button>
      )}
      {expanded && filtered.length > VISIBLE_LIMIT && (
        <button
          onClick={() => setExpanded(false)}
          style={{
            fontSize: 11,
            color: 'var(--color-text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 0',
            fontFamily: 'inherit',
            fontWeight: 500,
          }}
        >
          Show less
        </button>
      )}
    </div>
  );
}

function CollapsibleGroup({ label, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        background: 'var(--color-bg-secondary)',
        borderRadius: 8,
        border: '1px solid var(--color-border-mid)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center w-full text-left transition-colors duration-100"
        style={{
          padding: '10px 14px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-elevated)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <span
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            letterSpacing: '0.01em',
          }}
        >
          {label}
        </span>
        <ChevronDown
          size={14}
          style={{
            color: 'var(--color-text-muted)',
            transition: 'transform 0.2s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
          strokeWidth={2}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                padding: '4px 14px 14px',
                borderTop: '1px solid var(--color-border)',
              }}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FacetGroups({ facets, activeFilters, onFilterChange }) {
  if (!facets) return null;

  // Build a lookup: field -> buckets
  const facetMap = {};
  if (Array.isArray(facets)) {
    facets.forEach((f) => {
      if (f.label && f.buckets) {
        facetMap[f.label] = f.buckets;
      }
    });
  } else if (typeof facets === 'object') {
    Object.entries(facets).forEach(([key, val]) => {
      facetMap[key] = Array.isArray(val) ? val : val?.buckets || [];
    });
  }

  // Lookup helper: try field name first, then label (Alfresco returns labels)
  const getBuckets = (f) => facetMap[f.field] || facetMap[f.label] || [];

  // Check if a group has any non-empty facets
  const groupHasData = (group) =>
    group.facets.some((f) => getBuckets(f).length > 0);

  const visibleGroups = FACET_GROUPS.filter(groupHasData);

  if (visibleGroups.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {visibleGroups.map((group, gi) => (
        <CollapsibleGroup
          key={group.label}
          label={group.label}
          defaultOpen={gi === 0} // Quick Filters open by default
        >
          <div className="flex flex-col gap-4" style={{ marginTop: 6 }}>
            {group.facets.map((facet) => {
              const buckets = getBuckets(facet);
              if (!buckets || buckets.length === 0) return null;
              return (
                <FacetSection
                  key={facet.field}
                  field={facet.field}
                  label={facet.label}
                  buckets={buckets}
                  activeValues={activeFilters[facet.field] || []}
                  onFilterChange={onFilterChange}
                />
              );
            })}
          </div>
        </CollapsibleGroup>
      ))}
    </div>
  );
}
