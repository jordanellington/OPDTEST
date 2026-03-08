import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { search } from '../lib/api';
import FacetGroups from '../components/FacetGroups';
import ResultCard from '../components/ResultCard';
import DocumentViewer from '../components/DocumentViewer';
import { Search, Loader2, X, ChevronUp, ChevronDown, SlidersHorizontal, Sparkles } from 'lucide-react';

const SORT_OPTIONS = [
  { key: 'relevance', label: 'Relevance', field: 'relevance' },
  { key: 'date', label: 'Date of Opinion', field: 'date' },
  { key: 'name', label: 'Name A–Z', field: 'name' },
];

const PAGE_SIZE = 25;

const popularSearches = [
  'securities opinion',
  'finance opinion New York',
  'registered offering',
  'private placement',
  'investment company',
  'SEC filing',
  'Delaware corporation',
  'indenture trustee',
];

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const [exactMatch, setExactMatch] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sortBy, setSortBy] = useState('relevance');
  const [sortAsc, setSortAsc] = useState(false);
  const [facets, setFacets] = useState(null);
  const [activeFilters, setActiveFilters] = useState({});
  const [showFilters, setShowFilters] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const sentinelRef = useRef(null);
  const scrollRef = useRef(null);
  const initializedRef = useRef(false);

  // Pick up query params from Dashboard navigation
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const q = searchParams.get('q');
    const exact = searchParams.get('exact') === 'true';
    if (q) {
      setQuery(q);
      setExactMatch(exact);
      setTimeout(() => handleSearch(q, exact), 0);
    } else {
      // Load all documents + facets on initial page load
      handleSearch('', false);
    }
  }, []);

  const handleSearch = async (q, exactOverride, filtersOverride) => {
    const searchQuery = q !== undefined ? q : query;
    setQuery(searchQuery);
    setLoading(true);
    try {
      const isExact = exactOverride !== undefined ? exactOverride : exactMatch;
      const currentFilters = filtersOverride !== undefined ? filtersOverride : activeFilters;
      const sortField = SORT_OPTIONS.find(s => s.key === sortBy)?.field || 'relevance';
      const data = await search(searchQuery, {
        maxItems: PAGE_SIZE,
        skipCount: 0,
        exact: isExact,
        sort: sortField,
        ascending: sortAsc,
        filters: currentFilters,
      });
      setResults(data.list?.entries || []);
      setTotalResults(data.list?.pagination?.totalItems || 0);
      setHasMore(data.list?.pagination?.hasMoreItems || false);

      // Extract facets from context (Alfresco 5.2 uses facetsFields)
      const ctx = data.list?.context;
      if (ctx?.facetsFields) {
        setFacets(ctx.facetsFields);
      } else if (ctx?.facetFields) {
        setFacets(ctx.facetFields);
      } else if (ctx?.facets) {
        setFacets(ctx.facets);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !results) return;
    setLoadingMore(true);
    try {
      const sortField = SORT_OPTIONS.find(s => s.key === sortBy)?.field || 'relevance';
      const data = await search(query, {
        maxItems: PAGE_SIZE,
        skipCount: results.length,
        exact: exactMatch,
        sort: sortField,
        ascending: sortAsc,
        filters: activeFilters,
      });
      const entries = data.list?.entries || [];
      setResults(prev => [...prev, ...entries]);
      setHasMore(data.list?.pagination?.hasMoreItems || false);
    } catch (err) {
      console.error('Load more error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [query, results?.length, loadingMore, hasMore, exactMatch, sortBy, sortAsc, activeFilters]);

  // Re-search when sort changes (only if we have results)
  useEffect(() => {
    if (results) handleSearch();
  }, [sortBy, sortAsc]);

  // Keep loadMore in a ref so the observer doesn't need to re-create on every results change
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  // Infinite scroll sentinel — only re-create observer when hasMore changes
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMoreRef.current(); },
      { root: scrollRef.current, rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore]);

  // Handle filter changes
  const handleFilterChange = (fieldName, value, checked) => {
    setActiveFilters(prev => {
      const current = prev[fieldName] || [];
      let next;
      if (checked) {
        next = { ...prev, [fieldName]: [...current, value] };
      } else {
        const filtered = current.filter(v => v !== value);
        if (filtered.length === 0) {
          const { [fieldName]: _, ...rest } = prev;
          next = rest;
        } else {
          next = { ...prev, [fieldName]: filtered };
        }
      }
      // Re-search with updated filters
      setTimeout(() => handleSearch(undefined, undefined, next), 0);
      return next;
    });
  };

  const removeFilter = (fieldName, value) => {
    handleFilterChange(fieldName, value, false);
  };

  const clearAllFilters = () => {
    setActiveFilters({});
    setTimeout(() => handleSearch(undefined, undefined, {}), 0);
  };

  // Count total active filters
  const activeFilterCount = Object.values(activeFilters).reduce((sum, arr) => sum + arr.length, 0);

  // Collect active filter pills for display
  const filterPills = [];
  Object.entries(activeFilters).forEach(([field, values]) => {
    values.forEach(val => {
      filterPills.push({ field, value: val });
    });
  });

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Left sidebar — Facet filters */}
      <AnimatePresence>
        {showFilters && facets && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="shrink-0 overflow-hidden border-r"
            style={{
              borderColor: 'var(--color-border-mid)',
              background: 'var(--color-bg-sidebar)',
            }}
          >
            <div
              className="h-full overflow-y-auto"
              style={{ width: 280, padding: '20px 16px' }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <h3
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                  }}
                >
                  Filters
                </h3>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    style={{
                      fontSize: 11,
                      color: 'var(--color-accent)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontWeight: 500,
                    }}
                  >
                    Clear all ({activeFilterCount})
                  </button>
                )}
              </div>
              <FacetGroups
                facets={facets}
                activeFilters={activeFilters}
                onFilterChange={handleFilterChange}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-w-0 min-h-0">
        <div>
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            style={{
              padding: results ? '24px 28px 0' : '44px 56px 0',
              marginBottom: results ? 16 : 32,
              transition: 'all 0.3s ease',
            }}
          >
            <h1
              className="page-title text-white leading-[1.1] tracking-[-0.02em]"
              style={{
                fontSize: results ? 20 : 36,
                fontFamily: results ? 'var(--font-body)' : 'var(--font-display)',
                fontWeight: results ? 600 : 300,
                marginBottom: results ? 6 : 10,
                transition: 'all 0.3s ease',
              }}
            >
              Search
            </h1>
            {!results && (
              <p className="text-text-muted text-[14px]">
                Search across Covington's corporate opinion letter library
              </p>
            )}
          </motion.div>

          {/* Search Input */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.45 }}
            style={{ padding: results ? '0 28px 20px' : '0 56px 40px' }}
          >
            <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
              <div
                className="flex items-center cursor-text transition-all duration-200"
                style={{
                  gap: 14,
                  padding: '14px 16px 14px 20px',
                  borderRadius: 10,
                  background: searchFocused ? 'var(--color-bg-secondary)' : 'var(--color-bg-input)',
                  border: `1px solid ${searchFocused ? 'var(--color-border-accent)' : 'var(--color-border-mid)'}`,
                  boxShadow: searchFocused
                    ? '0 0 0 3px var(--color-accent-light), var(--shadow-md)'
                    : 'var(--shadow-card)',
                }}
                onClick={() => document.getElementById('opd-search-input')?.focus()}
              >
                <Search
                  size={18}
                  className="shrink-0 transition-colors duration-200"
                  style={{ color: searchFocused ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
                  strokeWidth={2}
                />

                {/* Exact chip — inline filter, shown when active */}
                {exactMatch && (
                  <div
                    className="flex items-center shrink-0"
                    style={{
                      gap: 5,
                      padding: '3px 9px 3px 7px',
                      borderRadius: 5,
                      background: 'rgba(77,184,164,0.10)',
                      border: '1px solid rgba(77,184,164,0.20)',
                      animation: 'chipIn 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-accent)', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                      Exact
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setExactMatch(false); }}
                      className="flex items-center justify-center p-0 transition-colors duration-100"
                      style={{
                        width: 14, height: 14, borderRadius: 3,
                        background: 'rgba(77,184,164,0.15)',
                        border: 'none', cursor: 'pointer', color: 'var(--color-accent)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(77,184,164,0.25)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(77,184,164,0.15)'; }}
                      title="Remove exact match filter"
                    >
                      <X size={8} strokeWidth={3} />
                    </button>
                  </div>
                )}

                <input
                  id="opd-search-input"
                  type="text"
                  autoComplete="off"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Search opinion letters by keyword, client, jurisdiction..."
                  className="flex-1 outline-none"
                  style={{
                    fontFamily: 'inherit',
                    fontSize: 15,
                    fontWeight: 400,
                    color: 'var(--color-text-primary)',
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

                {/* Clear query button */}
                {query && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuery('');
                      document.getElementById('opd-search-input')?.focus();
                    }}
                    className="shrink-0 flex items-center justify-center transition-colors duration-150"
                    style={{
                      width: 20, height: 20, borderRadius: 4,
                      background: 'var(--color-overlay-muted)',
                      border: 'none', cursor: 'pointer',
                      color: 'var(--color-text-muted)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-overlay-hover)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-overlay-muted)'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                    title="Clear search"
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                )}

                {/* Right controls */}
                <div className="flex items-center shrink-0" style={{ gap: 8 }}>
                  {/* Exact toggle button */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setExactMatch(prev => !prev); }}
                    className="flex items-center transition-all duration-150"
                    style={{
                      gap: 5,
                      padding: '5px 10px',
                      borderRadius: 5,
                      background: exactMatch ? 'rgba(77,184,164,0.10)' : 'var(--color-overlay-subtle)',
                      border: `1px solid ${exactMatch ? 'rgba(77,184,164,0.20)' : 'var(--color-border-mid)'}`,
                      cursor: 'pointer',
                    }}
                    title="Toggle exact phrase matching"
                  >
                    <svg
                      width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ color: exactMatch ? '#4db8a4' : '#5f706a', transition: 'color 0.15s ease' }}
                    >
                      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z" />
                      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z" />
                    </svg>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: exactMatch ? '#4db8a4' : '#5f706a',
                      transition: 'color 0.15s ease', letterSpacing: '0.01em',
                    }}>
                      Exact
                    </span>
                  </button>

                  {/* Divider */}
                  <div style={{ width: 1, height: 20, background: 'var(--color-border-mid)' }} />

                  {/* Search button */}
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      padding: '7px 18px', borderRadius: 6,
                      background: 'var(--color-accent)', border: 'none', cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                      color: 'var(--color-text-on-dark)', letterSpacing: '0.01em',
                      transition: 'all 0.15s ease',
                      opacity: loading ? 0.5 : 1,
                    }}
                  >
                    {loading ? <Loader2 size={15} className="animate-spin" /> : 'Search'}
                  </button>
                </div>
              </div>

              {/* Hint text — hidden once results are showing */}
              {!results && (
                <div style={{ marginTop: 10, padding: '0 20px', fontSize: 11, minHeight: 18 }}>
                  {exactMatch ? (
                    <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>
                      Searching for exact phrase: &ldquo;{query || '...'}&rdquo;
                    </span>
                  ) : query.trim().includes(' ') ? (
                    <span style={{ color: 'var(--color-text-dim)' }}>
                      Results will match all words in any order
                    </span>
                  ) : null}
                </div>
              )}
            </form>
          </motion.div>

          {/* Active filter pills */}
          {filterPills.length > 0 && (
            <div
              className="flex flex-wrap items-center gap-2"
              style={{ padding: '0 28px 16px' }}
            >
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 }}>
                Active filters:
              </span>
              {filterPills.map(({ field, value }) => (
                <span
                  key={`${field}-${value}`}
                  className="inline-flex items-center"
                  style={{
                    gap: 5,
                    padding: '3px 8px 3px 10px',
                    borderRadius: 5,
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--color-accent)',
                    background: 'rgba(77,184,164,0.08)',
                    border: '1px solid rgba(77,184,164,0.18)',
                  }}
                >
                  {value}
                  <button
                    onClick={() => removeFilter(field, value)}
                    className="flex items-center justify-center"
                    style={{
                      width: 14, height: 14, borderRadius: 3,
                      background: 'rgba(77,184,164,0.12)',
                      border: 'none', cursor: 'pointer', color: 'var(--color-accent)',
                      padding: 0,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(77,184,164,0.25)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(77,184,164,0.12)'; }}
                  >
                    <X size={8} strokeWidth={3} />
                  </button>
                </span>
              ))}
              <button
                onClick={clearAllFilters}
                style={{
                  fontSize: 11,
                  color: 'var(--color-text-muted)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontWeight: 500,
                  textDecoration: 'underline',
                  textUnderlineOffset: 2,
                }}
              >
                Clear all
              </button>
            </div>
          )}

          {/* Pre-search state — only shown before initial load */}
          {!results && !loading && !facets && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.45 }}
              className="page-section"
              style={{ padding: '0 56px 56px' }}
            >
              <p
                className="text-[10px] text-text-muted uppercase tracking-wider font-semibold"
                style={{ marginBottom: 16 }}
              >
                Popular Searches
              </p>
              <div className="flex flex-wrap gap-2" style={{ marginBottom: 40 }}>
                {popularSearches.map(term => (
                  <button
                    key={term}
                    onClick={() => handleSearch(term)}
                    className="px-3.5 py-2 rounded-lg text-[13px] text-text-secondary hover:text-white hover:border-white/10 transition-all duration-200 cursor-pointer"
                    style={{
                      background: 'var(--color-overlay-subtle)',
                      border: '1px solid var(--color-border-mid)',
                    }}
                  >
                    {term}
                  </button>
                ))}
              </div>

              {/* AI Teaser */}
              <div
                className="flex items-center gap-6 rounded-xl py-5 px-7 relative overflow-hidden"
                style={{
                  background: 'rgba(200,164,78,0.04)',
                  border: '1px solid rgba(200,164,78,0.12)',
                  borderLeftWidth: 3,
                  borderLeftColor: 'var(--color-accent-gold)',
                }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1.5">
                    <Sparkles size={15} style={{ color: 'var(--color-accent-gold)' }} />
                    <h3 className="text-[15px] font-semibold text-white">
                      AI-Powered Search
                    </h3>
                  </div>
                  <p className="text-text-secondary text-[13px] leading-relaxed">
                    Ask questions in plain English:
                    <span className="italic" style={{ color: 'var(--color-accent-gold)' }}>
                      {' '}"Find all securities opinions for Delaware corporations with SEC filings"
                    </span>
                    &mdash; and get a synthesized answer with citations.
                  </p>
                </div>
                <span
                  className="text-[9px] font-bold tracking-[0.12em] uppercase px-3 py-1 rounded shrink-0"
                  style={{
                    color: 'var(--color-accent-gold)',
                    background: 'rgba(200,164,78,0.12)',
                    border: '1px solid rgba(200,164,78,0.25)',
                  }}
                >
                  Coming Soon
                </span>
              </div>
            </motion.div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-7 h-7 border-2 border-accent/20 border-t-accent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-text-muted text-sm">Searching opinion letters...</p>
              </div>
            </div>
          )}

          {/* Results */}
          {results && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              style={{ padding: '0 28px 40px' }}
            >
              {/* Results summary bar */}
              <div
                className="results-summary-bar flex items-center justify-between"
                style={{ marginBottom: 12, padding: '0 4px' }}
              >
                <div className="flex items-center" style={{ gap: 10 }}>
                  {/* Filter toggle */}
                  {facets && (
                    <button
                      onClick={() => setShowFilters(prev => !prev)}
                      className="flex items-center transition-all duration-150"
                      style={{
                        gap: 5,
                        padding: '5px 10px',
                        borderRadius: 5,
                        background: showFilters ? 'rgba(77,184,164,0.08)' : 'var(--color-overlay-subtle)',
                        border: `1px solid ${showFilters ? 'rgba(77,184,164,0.15)' : 'var(--color-border-mid)'}`,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: 'inherit',
                        color: showFilters ? 'var(--color-accent)' : 'var(--color-text-muted)',
                      }}
                    >
                      <SlidersHorizontal size={12} strokeWidth={2} />
                      Filters
                      {activeFilterCount > 0 && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: 'var(--color-text-on-dark)',
                            background: 'var(--color-accent)',
                            borderRadius: 10,
                            padding: '1px 5px',
                            lineHeight: '14px',
                          }}
                        >
                          {activeFilterCount}
                        </span>
                      )}
                    </button>
                  )}

                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    Showing{' '}
                    <em style={{ fontStyle: 'normal', color: 'var(--color-accent)', fontWeight: 600 }}>
                      {results.length.toLocaleString()}
                    </em>{' '}
                    of{' '}
                    <strong style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {totalResults.toLocaleString()}
                    </strong>{' '}
                    {query.trim() ? 'results' : 'opinion letters'}
                  </span>
                  {exactMatch && query && (
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      for &ldquo;{query}&rdquo;
                    </span>
                  )}
                </div>

                {/* Sort controls */}
                <div className="flex items-center" style={{ gap: 4 }}>
                  {SORT_OPTIONS.map(s => {
                    const isActive = sortBy === s.key;
                    return (
                      <button
                        key={s.key}
                        onClick={() => {
                          if (isActive) {
                            setSortAsc(prev => !prev);
                          } else {
                            setSortBy(s.key);
                            setSortAsc(false);
                          }
                        }}
                        className="flex items-center"
                        style={{
                          gap: 3,
                          padding: '4px 10px',
                          borderRadius: 4,
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 10,
                          fontWeight: 500,
                          fontFamily: 'inherit',
                          background: isActive ? 'var(--color-bg-elevated)' : 'transparent',
                          color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                          transition: 'all 0.1s',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {s.label}
                        {isActive && s.key !== 'relevance' && (
                          sortAsc
                            ? <ChevronUp size={10} strokeWidth={2.5} />
                            : <ChevronDown size={10} strokeWidth={2.5} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {results.length > 0 ? (
                <>
                  <div>
                    {results.map((result, i) => (
                      <ResultCard
                        key={(result.entry?.id || result.id || i) + '-' + i}
                        result={result}
                        index={i}
                        onClick={() => {
                          const nodeId = result.entry?.id || result.id;
                          if (nodeId) setSelectedNodeId(nodeId);
                        }}
                      />
                    ))}
                  </div>
                  {hasMore && (
                    <div ref={sentinelRef} className="flex items-center justify-center py-6">
                      {loadingMore && (
                        <div className="flex items-center gap-2 text-text-muted text-xs">
                          <div className="w-4 h-4 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
                          Loading more results...
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-20">
                  <Search size={40} className="text-text-muted mx-auto mb-3" strokeWidth={1} />
                  <p className="text-text-secondary">No opinion letters found</p>
                  <p className="text-text-muted text-[13px] mt-1">
                    Try adjusting your search terms or removing filters
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Document Viewer side panel */}
      <AnimatePresence>
        {selectedNodeId && (
          <DocumentViewer nodeId={selectedNodeId} onClose={() => setSelectedNodeId(null)} searchQuery={query} />
        )}
      </AnimatePresence>
    </div>
  );
}
