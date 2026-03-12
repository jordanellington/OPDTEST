import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  X, Download, FileText, Calendar, Layers, ExternalLink, Loader2,
  ChevronDown, ChevronUp, Sparkles, Search, User, Building2,
  Briefcase, MapPin, Scale, Globe, Shield, Hash, Users, Gavel,
} from 'lucide-react';
import { getNode, getContentUrl, getRenditionUrl } from '../lib/api';

import { Worker, Viewer } from '@react-pdf-viewer/core';
import { toolbarPlugin } from '@react-pdf-viewer/toolbar';
import { searchPlugin } from '@react-pdf-viewer/search';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/toolbar/lib/styles/index.css';
import '@react-pdf-viewer/search/lib/styles/index.css';

const WORKER_URL = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url,
).toString();

/* ── Practice-area badge colors ── */
const PRACTICE_COLORS = {
  'Capital Markets':    { color: '#4db8a4', bg: 'rgba(77,184,164,0.10)',  border: 'rgba(77,184,164,0.20)' },
  'M&A':               { color: '#c8a44e', bg: 'rgba(200,164,78,0.10)',  border: 'rgba(200,164,78,0.20)' },
  'Banking & Finance':  { color: '#7ba4d9', bg: 'rgba(123,164,217,0.10)', border: 'rgba(123,164,217,0.20)' },
  'Real Estate':        { color: '#d97bab', bg: 'rgba(217,123,171,0.10)', border: 'rgba(217,123,171,0.20)' },
  'Tax':                { color: '#d9a57b', bg: 'rgba(217,165,123,0.10)', border: 'rgba(217,165,123,0.20)' },
  'Insurance':          { color: '#9b7bd9', bg: 'rgba(155,123,217,0.10)', border: 'rgba(155,123,217,0.20)' },
};
const DEFAULT_BADGE = { color: 'var(--color-text-secondary)', bg: 'rgba(154,166,159,0.10)', border: 'rgba(154,166,159,0.20)' };

function PracticeAreaBadge({ value }) {
  if (!value) return <span className="text-text-muted">—</span>;
  const label = Array.isArray(value) ? value[0] : value;
  const c = PRACTICE_COLORS[label] || DEFAULT_BADGE;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ color: c.color, background: c.bg, border: `1px solid ${c.border}` }}
    >
      {label}
    </span>
  );
}

/* ── Helpers ── */
function fmt(val) {
  if (val == null || val === '') return '—';
  return String(val);
}

function fmtDate(val) {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return val;
  }
}

function fmtArray(val) {
  if (!val) return '—';
  const arr = Array.isArray(val) ? val : [val];
  const filtered = arr.filter(v => v != null && v !== '');
  return filtered.length > 0 ? filtered.join(', ') : '—';
}

function fmtArrayFiltered(val) {
  if (!val) return '—';
  const arr = Array.isArray(val) ? val : [val];
  const filtered = arr.filter(v => v != null && String(v).trim() !== '');
  return filtered.length > 0 ? filtered.join(', ') : '—';
}

/* ── Metadata field definition ── */
function getMetadataFields(props) {
  return [
    { label: 'Client',              value: fmt(props['corpkmdcf:clientName']),                         icon: Building2 },
    { label: 'Practice Area',       value: props['corpkmdcf:opinionTypes'],                            icon: Briefcase, badge: true },
    { label: 'Opinion Provider',    value: fmt(props['corpkmdcf:opinionProvider']),                    icon: Scale },
    { label: 'Date of Opinion',     value: fmtDate(props['corpkmdcf:dateOfOpinion']),                  icon: Calendar },
    { label: 'Signatory',           value: fmt(props['corpkmdcf:covingtonLawyerSigningOpinion']),      icon: User },
    { label: 'Committee Member',    value: fmt(props['corpkmdcf:nameOpinionCommitteeMember']),         icon: User },
    { label: 'Lead Lawyers',        value: fmtArray(props['corpkmdcf:namesOfLawyers']),                icon: Users },
    { label: 'Covington Office',    value: fmt(props['corpkmdcf:covingtonOffice']),                    icon: MapPin },
    { label: 'Matter',              value: fmt(props['corpkmdcf:matterName']),                         icon: Briefcase },
    { label: 'Client Matter #',     value: fmt(props['corpkmdcf:clientMatterNumber']),                 icon: Hash },
    { label: 'US Jurisdictions',    value: fmtArrayFiltered(props['corpkmdcf:usJurisdictions']),       icon: Globe },
    { label: 'Non-US Jurisdictions',value: fmtArrayFiltered(props['corpkmdcf:nonUsJurisdictions']),    icon: Globe },
    { label: 'Offering Type',       value: fmt(props['corpkmdcf:typeOfOffering']),                     icon: Layers },
    { label: 'Security Type',       value: fmtArray(props['corpkmdcf:typeOfSecurity']),                icon: Shield },
    { label: 'SEC Filing',          value: fmt(props['corpkmdcf:opinionFilledWithSec']),               icon: Gavel },
    { label: 'Recipients',          value: fmtArray(props['corpkmdcf:recipientsAndRoles']),            icon: Users },
    { label: 'Other Firms',         value: fmtArray(props['corpkmdcf:firmsAndRoles']),                 icon: Building2 },
    { label: 'Pages',               value: (props['eci:pages'] != null && props['eci:pages'] > 0) ? String(props['eci:pages']) : '—', icon: Layers },
  ];
}

/* ── PDF Viewer with unified bottom bar ── */
function PdfViewer({ fileUrl, searchQuery, actionButtons }) {
  const toolbarPluginInstance = toolbarPlugin();
  const searchPluginInstance = searchPlugin(searchQuery ? { keyword: searchQuery } : undefined);
  const { Toolbar } = toolbarPluginInstance;
  const { ShowSearchPopover } = searchPluginInstance;

  const searchPluginRef = useRef(searchPluginInstance);
  searchPluginRef.current = searchPluginInstance;
  const highlightDone = useRef(false);

  useEffect(() => {
    highlightDone.current = false;
  }, [fileUrl]);

  useEffect(() => {
    if (!searchQuery || highlightDone.current) return;
    const timer = setTimeout(() => {
      highlightDone.current = true;
      searchPluginRef.current.highlight(searchQuery).then((matches) => {
        if (matches.length > 0) {
          searchPluginRef.current.jumpToMatch(1);
        }
      }).catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toolBtnStyle = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--color-text-muted)', padding: '3px 5px', borderRadius: 4,
    display: 'flex', alignItems: 'center',
  };

  return (
    <Worker workerUrl={WORKER_URL}>
      <div className="h-full flex flex-col rpv-dark-theme" style={{ backgroundColor: 'var(--color-bg-elevated)' }}>
        {/* PDF pages */}
        <div className="flex-1 min-h-0" style={{ background: 'var(--color-bg-elevated)' }}>
          <Viewer
            fileUrl={fileUrl}
            plugins={[toolbarPluginInstance, searchPluginInstance]}
            theme="dark"
          />
        </div>

        {/* Unified bottom bar: page nav + zoom + action buttons */}
        <div
          className="shrink-0"
          style={{
            background: 'var(--color-bg-elevated)',
            borderTop: '1px solid var(--color-border)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <Toolbar>
            {(props) => {
              const { CurrentPageInput, GoToNextPage, GoToPreviousPage, NumberOfPages, ZoomIn, ZoomOut, Zoom } = props;
              return (
                <div className="flex items-center justify-between" style={{ padding: '6px 14px', fontSize: 11 }}>
                  {/* Left: page nav + zoom + search in capsules */}
                  <div className="flex items-center" style={{ gap: 4 }}>
                    {/* Page nav group */}
                    <div
                      className="flex items-center"
                      style={{
                        background: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 7,
                        padding: '2px 3px',
                        gap: 1,
                      }}
                    >
                      <GoToPreviousPage>
                        {(p) => (
                          <button onClick={p.onClick} disabled={p.isDisabled}
                            style={{ ...toolBtnStyle, cursor: p.isDisabled ? 'default' : 'pointer', opacity: p.isDisabled ? 0.3 : 1 }}>
                            ‹
                          </button>
                        )}
                      </GoToPreviousPage>
                      <div className="flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                        <CurrentPageInput />
                        <span style={{ opacity: 0.5 }}>/</span>
                        <NumberOfPages />
                      </div>
                      <GoToNextPage>
                        {(p) => (
                          <button onClick={p.onClick} disabled={p.isDisabled}
                            style={{ ...toolBtnStyle, cursor: p.isDisabled ? 'default' : 'pointer', opacity: p.isDisabled ? 0.3 : 1 }}>
                            ›
                          </button>
                        )}
                      </GoToNextPage>
                    </div>

                    {/* Zoom group */}
                    <div
                      className="flex items-center"
                      style={{
                        background: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 7,
                        padding: '2px 3px',
                        gap: 1,
                      }}
                    >
                      <ZoomOut>
                        {(p) => <button onClick={p.onClick} style={{ ...toolBtnStyle, fontSize: 13, padding: '3px 5px' }}>−</button>}
                      </ZoomOut>
                      <Zoom>
                        {(p) => <span style={{ color: 'var(--color-text-muted)', fontSize: 10, minWidth: 32, textAlign: 'center' }}>{Math.round(p.scale * 100)}%</span>}
                      </Zoom>
                      <ZoomIn>
                        {(p) => <button onClick={p.onClick} style={{ ...toolBtnStyle, fontSize: 13, padding: '3px 5px' }}>+</button>}
                      </ZoomIn>
                    </div>

                    {/* Search button */}
                    <ShowSearchPopover>
                      {(p) => <button onClick={p.onClick} style={{ ...toolBtnStyle, padding: '4px 7px' }}><Search size={13} /></button>}
                    </ShowSearchPopover>
                  </div>

                  {/* Right: action buttons */}
                  <div className="flex items-center" style={{ gap: 8 }}>
                    {actionButtons}
                  </div>
                </div>
              );
            }}
          </Toolbar>
        </div>
      </div>
    </Worker>
  );
}

/* ── Rendition Viewer — tries PDF rendition for non-PDF files ── */
function RenditionViewer({ nodeId, contentUrl, mimeType, searchQuery, actionButtons }) {
  const [status, setStatus] = useState('loading'); // loading | ready | unavailable
  const renditionUrl = getRenditionUrl(nodeId);

  useEffect(() => {
    setStatus('loading');
    let cancelled = false;
    fetch(renditionUrl).then((resp) => {
      if (cancelled) return;
      if (resp.status === 200) {
        setStatus('ready');
      } else if (resp.status === 202 || resp.status === 404) {
        // Rendition requested or not yet created — poll a few times
        let retries = 0;
        const poll = setInterval(async () => {
          retries++;
          if (retries > 8 || cancelled) { clearInterval(poll); if (!cancelled) setStatus('unavailable'); return; }
          const r = await fetch(renditionUrl);
          if (r.status === 200 && !cancelled) { clearInterval(poll); setStatus('ready'); }
        }, 3000);
      } else {
        setStatus('unavailable');
      }
    }).catch(() => { if (!cancelled) setStatus('unavailable'); });
    return () => { cancelled = true; };
  }, [nodeId, renditionUrl]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: 'var(--color-bg-elevated)' }}>
        <div className="text-center">
          <Loader2 size={24} className="text-accent animate-spin mx-auto mb-3" />
          <p className="text-text-muted text-xs">Generating PDF preview...</p>
        </div>
      </div>
    );
  }

  if (status === 'ready') {
    return <PdfViewer fileUrl={renditionUrl} searchQuery={searchQuery} actionButtons={actionButtons} />;
  }

  // Fallback — no rendition available
  return (
    <div className="flex items-center justify-center h-full p-6" style={{ background: 'var(--color-bg-elevated)' }}>
      <div className="text-center">
        <FileText size={40} className="text-text-muted mx-auto mb-4" strokeWidth={1} />
        <p className="text-text-muted text-sm mb-4">{mimeType || 'Document'}</p>
        <a
          href={contentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-text-on-dark rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          <ExternalLink size={14} />
          Open File
        </a>
      </div>
    </div>
  );
}

/* ── Main DocumentViewer ── */
export default function DocumentViewer({ nodeId, onClose, searchQuery }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (!nodeId) return;
    setLoading(true);
    setError(null);
    getNode(nodeId)
      .then((data) => {
        setDoc(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load document');
        setLoading(false);
      });
  }, [nodeId]);

  if (!nodeId) return null;

  if (loading) {
    return (
      <motion.div
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="document-viewer-panel flex flex-col h-full items-center justify-center"
        style={{
          width: 728,
          maxWidth: '50%',
          minWidth: 340,
          flex: '0 1 auto',
          background: 'var(--color-bg-secondary)',
          borderLeft: 'none',
        }}
      >
        <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        <p className="text-text-muted text-xs mt-3">Loading document...</p>
      </motion.div>
    );
  }

  if (error || !doc) {
    return (
      <motion.div
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="document-viewer-panel flex flex-col h-full items-center justify-center"
        style={{
          width: 728,
          maxWidth: '50%',
          minWidth: 340,
          flex: '0 1 auto',
          background: 'var(--color-bg-secondary)',
          borderLeft: 'none',
        }}
      >
        <p className="text-status-red text-sm">{error || 'Document not found'}</p>
        <button onClick={onClose} className="mt-3 text-accent text-xs hover:underline">Close</button>
      </motion.div>
    );
  }

  const node = doc.entry || doc;
  const props = node.properties || {};
  const name = node.name || 'Untitled';
  const contentUrl = getContentUrl(node.id || nodeId);
  const isPdf = name.toLowerCase().endsWith('.pdf');
  const rawPages = props['eci:pages'];
  const pages = (rawPages != null && rawPages > 0) ? rawPages : '—';
  const size = node.content?.sizeInBytes
    ? (node.content.sizeInBytes / 1024 / 1024).toFixed(2) + ' MB'
    : '—';
  const metadataFields = getMetadataFields(props);

  /* Action buttons passed into the unified bottom bar */
  const actionButtons = (
    <>
      {/* Compact metadata chips */}
      <span className="flex items-center gap-1 text-[10px] text-text-muted">
        <Layers size={10} />
        {pages} pg
      </span>
      <span className="text-[10px] text-text-muted">{size}</span>

      {/* Download */}
      <a
        href={getContentUrl(node.id || nodeId, true)}
        download={name}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors"
        style={{
          padding: '7px 16px', borderRadius: 999, color: 'var(--color-text-secondary)',
          border: '1px solid var(--color-border)', background: 'transparent',
          boxShadow: '0 1px 2px rgba(0,0,0,0.06)', textDecoration: 'none',
        }}
      >
        <Download size={13} />
        Download
      </a>

      {/* Expand details */}
      <button
        onClick={() => setDetailsOpen(!detailsOpen)}
        className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        title={detailsOpen ? 'Hide details' : 'Show details'}
      >
        {detailsOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
      </button>

      {/* Ask AI — Coming Soon */}
      {isPdf && (
        <button
          disabled
          title="AI chat coming soon"
          className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold cursor-not-allowed"
          style={{
            padding: '7px 16px', borderRadius: 999,
            background: 'var(--color-overlay-subtle)',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border-mid)',
            opacity: 0.7,
          }}
        >
          <Sparkles size={13} />
          Ask AI
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider"
            style={{
              background: 'rgba(200,164,78,0.15)',
              color: 'var(--color-accent-gold)',
              border: '1px solid var(--color-border-gold)',
            }}
          >
            Soon
          </span>
        </button>
      )}
    </>
  );

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="document-viewer-panel flex flex-col h-full"
      style={{
        width: 728,
        maxWidth: '50%',
        minWidth: 340,
        flex: '0 1 auto',
        background: 'var(--color-bg-secondary)',
        borderLeft: 'none',
      }}
    >
      {/* ── Header ── */}
      <div
        className="viewer-header flex items-center justify-between gap-3 shrink-0"
        style={{
          padding: '12px 16px',
          background: 'var(--color-bg-elevated)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <FileText size={15} style={{ color: 'var(--color-accent)' }} className="shrink-0" strokeWidth={1.5} />
          <h2 className="text-[14px] font-semibold truncate">
            {name}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <PracticeAreaBadge value={props['corpkmdcf:opinionTypes']} />
          <button
            onClick={onClose}
            className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Document Preview ── */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="min-h-0 overflow-hidden" style={{ flex: '1 1 0%' }}>
          {isPdf ? (
            <PdfViewer fileUrl={contentUrl} searchQuery={searchQuery} actionButtons={actionButtons} />
          ) : (
            <RenditionViewer nodeId={node.id || nodeId} contentUrl={contentUrl} mimeType={node.content?.mimeType} searchQuery={searchQuery} actionButtons={actionButtons} />
          )}
        </div>
      </div>

      {/* ── Expandable Details Grid ── */}
      {detailsOpen && (
        <div
          style={{
            background: 'var(--color-bg-elevated)',
            borderTop: '1px solid var(--color-border)',
          }}
          className="shrink-0"
        >
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ padding: '4px 16px 14px', overflow: 'hidden' }}
          >
            <div className="details-grid grid grid-cols-3 gap-x-6 gap-y-3">
              {metadataFields.map((field) => {
                const Icon = field.icon;
                return (
                  <div key={field.label}>
                    <p className="flex items-center gap-1 text-[9px] text-text-muted uppercase tracking-wider mb-1">
                      <Icon size={9} />
                      {field.label}
                    </p>
                    {field.badge ? (
                      <PracticeAreaBadge value={field.value} />
                    ) : (
                      <p className="text-[11px] text-text-secondary leading-relaxed">{field.value}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
