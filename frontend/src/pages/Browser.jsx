import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getChildren, getNode } from '../lib/api';
import DocumentViewer from '../components/DocumentViewer';
import { Folder, FileText, ChevronRight, Home, ArrowLeft } from 'lucide-react';

function Breadcrumbs({ path, onNavigate }) {
  if (!path) return null;
  const elements = path.elements || [];
  const dlIndex = elements.findIndex(e => e.name === 'documentlibrary');
  const visible = dlIndex >= 0 ? elements.slice(dlIndex + 1) : elements;

  return (
    <div className="flex items-center gap-1.5 text-[13px] flex-wrap">
      <button onClick={() => onNavigate('root')} className="text-text-muted hover:text-accent transition-colors flex items-center gap-1">
        <Home size={12} />
        Library
      </button>
      {visible.map((el, i) => (
        <span key={el.id} className="flex items-center gap-1.5">
          <ChevronRight size={11} className="text-text-dim" />
          {i === visible.length - 1 ? (
            <span className="text-white font-semibold text-[15px]">{el.name}</span>
          ) : (
            <button onClick={() => onNavigate(el.id)} className="text-text-muted hover:text-accent transition-colors">{el.name}</button>
          )}
        </span>
      ))}
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

function formatSize(bytes) {
  if (!bytes) return '—';
  return bytes >= 1048576
    ? (bytes / 1048576).toFixed(2) + ' MB'
    : (bytes / 1024).toFixed(0) + ' KB';
}

export default function Browser() {
  const { nodeId } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [currentNode, setCurrentNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [pagination, setPagination] = useState(null);
  const currentId = nodeId || 'root';
  const isRoot = currentId === 'root';

  useEffect(() => {
    async function load() {
      setLoading(true);
      setSelectedNodeId(null);
      try {
        const [childrenData, nodeData] = await Promise.all([
          getChildren(currentId, { maxItems: 100 }),
          currentId !== 'root' ? getNode(currentId) : Promise.resolve(null),
        ]);
        setItems(childrenData.list?.entries?.map(e => e.entry) || []);
        setPagination(childrenData.list?.pagination);
        setCurrentNode(nodeData);
      } catch (err) {
        console.error('Browser load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentId]);

  const folders = items.filter(i => i.isFolder);
  const files = items.filter(i => i.isFile);

  const handleNavigate = (id) => {
    if (id === 'root') navigate('/browse');
    else navigate(`/browse/${id}`);
  };

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="max-w-[1100px]">
          {/* Header */}
          {isRoot ? (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="page-section-hero"
              style={{ padding: '44px 56px 0', marginBottom: 32 }}
            >
              <h1 className="page-title font-display text-[42px] font-light text-white leading-[1.08] tracking-[-0.02em]" style={{ marginBottom: 10 }}>
                Browse Library
              </h1>
              <p className="text-text-muted text-[14px]">Browse the opinion letters document library</p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="page-section flex items-center gap-3"
              style={{ padding: '20px 56px 0', marginBottom: 20 }}
            >
              <button
                onClick={() => {
                  if (currentNode?.parentId) handleNavigate(currentNode.parentId);
                  else handleNavigate('root');
                }}
                className="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-bg-elevated transition-colors shrink-0"
              >
                <ArrowLeft size={15} />
              </button>
              <Breadcrumbs path={currentNode?.path} onNavigate={handleNavigate} />
            </motion.div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-7 h-7 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="page-section" style={{ padding: '0 56px 56px' }}>
              {/* Folders */}
              {folders.length > 0 && (
                <div className="mb-10">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold" style={{ marginBottom: 20 }}>
                    Folders ({folders.length})
                  </p>
                  <div className="subject-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {folders.map((folder, i) => (
                      <motion.div
                        key={folder.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.015 }}
                        onClick={() => handleNavigate(folder.id)}
                        className="subject-card flex items-center cursor-pointer transition-all duration-200"
                        style={{
                          gap: 10,
                          padding: '14px 16px',
                          borderRadius: 8,
                          background: '#151c19',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
                          border: '1px solid rgba(255,255,255,0.04)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#222e2a';
                          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.2)';
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.11)';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#151c19';
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)';
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
                          e.currentTarget.style.transform = 'none';
                        }}
                      >
                        <Folder size={14} className="text-accent/50 shrink-0" strokeWidth={1.5} />
                        <span className="text-[13px] font-medium leading-snug text-text-primary truncate">
                          {folder.name}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files */}
              {files.length > 0 && (
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold" style={{ marginBottom: 16 }}>
                    Documents ({files.length})
                  </p>
                  <div>
                    {files.map((file, i) => {
                      const props = file.properties || {};
                      const pages = props['eci:pages'] || '—';
                      const size = formatSize(file.content?.sizeInBytes);
                      const modified = formatDate(file.modifiedAt);
                      const practiceArea = props['corpkmdcf:opinionTypes'];
                      const clientName = props['corpkmdcf:clientName'];
                      const isSelected = selectedNodeId === file.id;

                      return (
                        <motion.div
                          key={file.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.01 }}
                          onClick={() => setSelectedNodeId(file.id)}
                          style={{
                            padding: '12px 16px',
                            borderRadius: 8,
                            marginBottom: 4,
                            cursor: 'pointer',
                            border: isSelected ? '1px solid rgba(255,255,255,0.07)' : '1px solid transparent',
                            background: isSelected ? 'var(--color-bg-elevated)' : 'transparent',
                            transition: 'all 0.12s ease',
                            position: 'relative',
                          }}
                          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--color-bg-secondary)'; }}
                          onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                        >
                          {isSelected && (
                            <div style={{
                              position: 'absolute', left: 0, top: 8, bottom: 8,
                              width: 3, borderRadius: 2, background: 'var(--color-accent)',
                            }} />
                          )}

                          <div className="flex items-center" style={{ gap: 10, marginBottom: 5 }}>
                            <FileText
                              size={13}
                              className="shrink-0"
                              style={{ color: isSelected ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
                              strokeWidth={1.5}
                            />
                            <span style={{
                              fontSize: 13, fontWeight: 600,
                              color: isSelected ? '#fff' : 'var(--color-text-secondary)',
                            }}>
                              {file.name}
                            </span>
                            <div style={{ flex: 1 }} />
                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{pages} pg</span>
                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', minWidth: 54, textAlign: 'right' }}>{size}</span>
                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', minWidth: 60, textAlign: 'right' }}>{modified}</span>
                          </div>

                          <div className="flex items-center" style={{ paddingLeft: 23, gap: 10 }}>
                            <span style={{
                              fontSize: 11,
                              color: isSelected ? 'var(--color-text-secondary)' : 'var(--color-text-muted)',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              minWidth: 0, flex: 1,
                            }}>
                              {clientName || '—'}
                            </span>
                            {practiceArea && (
                              <span
                                style={{
                                  fontSize: 9, fontWeight: 700,
                                  letterSpacing: '0.06em', textTransform: 'uppercase',
                                  padding: '3px 10px', borderRadius: 4,
                                  color: '#4db8a4', background: 'rgba(77,184,164,0.07)',
                                  flexShrink: 0, marginLeft: 'auto',
                                }}
                              >
                                {Array.isArray(practiceArea) ? practiceArea[0] : practiceArea}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {folders.length === 0 && files.length === 0 && (
                <div className="text-center py-20">
                  <Folder size={40} className="text-text-muted mx-auto mb-3" strokeWidth={1} />
                  <p className="text-text-secondary">This folder is empty</p>
                </div>
              )}

              {pagination && (
                <p className="mt-4 text-xs text-text-muted text-center">
                  Showing {items.length} of {pagination.totalItems} items
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedNodeId && (
          <DocumentViewer nodeId={selectedNodeId} onClose={() => setSelectedNodeId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
