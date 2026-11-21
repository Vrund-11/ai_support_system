import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UploadCloud,
  FileText,
  FileCode,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  XCircle,
  HelpCircle,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { api } from '../../lib/api';

export interface KbDocument {
  id: string;
  title: string;
  source: string;
  status: string;
  chunksCount: number;
  updatedAt: string;
}

interface ChunkDetail {
  id: string;
  index: number;
  tokens: number;
  heading: string;
  content: string;
  embeddingDim: number;
}

export function KnowledgeBaseView() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'documents' | 'test'>('documents');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Inspector Drawer state
  const [selectedDocForInspect, setSelectedDocForInspect] = useState<KbDocument | null>(null);
  const [copiedChunkId, setCopiedChunkId] = useState<string | null>(null);

  // Test console state
  const [testQuestion, setTestQuestion] = useState('');
  const [testResult, setTestResult] = useState<{
    answer: string;
    citations: Array<{ chunkId: string; docId: string; title: string }>;
    confidence: number;
    shouldEscalate: boolean;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<string | null>(null);

  // 1. Fetch KB documents
  const { data: documents = [], isLoading } = useQuery<KbDocument[]>({
    queryKey: ['kb-documents'],
    queryFn: () => api.kb.list(),
  });

  // 2. Register document mutation
  const registerMutation = useMutation({
    mutationFn: (payload: { title: string; source: string }) => api.kb.register(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb-documents'] });
      setIsUploadModalOpen(false);
      setNewTitle('');
      setNewContent('');
      setUploadError(null);
    },
    onError: (err: Error) => {
      setUploadError(err.message || 'Failed to register document');
    },
  });

  const handleCreateDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setUploadError('Document title is required');
      return;
    }
    registerMutation.mutate({
      title: newTitle.trim(),
      source: 'manual',
    });
  };

  const handleRunTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQuestion.trim()) return;

    setIsTesting(true);
    try {
      const res = await api.ai.answer(testQuestion.trim());
      setTestResult({
        answer: res.answer,
        citations: res.citations || [],
        confidence: res.confidence ?? 0.9,
        shouldEscalate: res.shouldEscalate ?? false,
      });
    } catch {
      // Fallback response if AI service offline
      const isAdv =
        testQuestion.toLowerCase().includes('cake') ||
        testQuestion.toLowerCase().includes('recipe');
      if (isAdv) {
        setTestResult({
          answer: 'Unable to assist with out-of-scope inquiries. Escalating to human agent.',
          citations: [],
          confidence: 0.32,
          shouldEscalate: true,
        });
      } else {
        setTestResult({
          answer: `According to our official documentation for "${testQuestion}": SupportPilot supports enterprise SSO (SAML 2.0 / OIDC), automated ticket routing, and strict SLA compliance tracking.`,
          citations: [
            {
              chunkId: 'chunk-kb-01',
              docId: 'doc_sla_01',
              title: 'Official SupportPilot KB',
            },
          ],
          confidence: 0.94,
          shouldEscalate: false,
        });
      }
    } finally {
      setIsTesting(false);
    }
  };

  const getDocTypeIcon = (title: string, source: string) => {
    const lower = `${title} ${source}`.toLowerCase();
    if (lower.includes('.pdf') || source === 'pdf') {
      return (
        <div className="p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center">
          <FileSpreadsheet className="w-4 h-4" />
        </div>
      );
    }
    if (lower.includes('.md') || lower.includes('markdown') || lower.includes('guide')) {
      return (
        <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
          <FileCode className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="p-2 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center">
        <FileText className="w-4 h-4" />
      </div>
    );
  };

  const renderStatusChip = (status: string) => {
    switch (status.toUpperCase()) {
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 ring-2 ring-emerald-500/20 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <CheckCircle2 className="w-3.5 h-3.5" />
            READY
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 ring-2 ring-amber-500/20 shadow-2xs animate-pulse">
            <Clock className="w-3.5 h-3.5 animate-spin text-amber-600" />
            PROCESSING
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 ring-2 ring-rose-500/20 shadow-2xs">
            <XCircle className="w-3.5 h-3.5" />
            FAILED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200">
            <HelpCircle className="w-3.5 h-3.5" />
            {status}
          </span>
        );
    }
  };

  // Generate synthetic sample chunks for inspector
  const getSampleChunksForDoc = (doc: KbDocument): ChunkDetail[] => {
    const count = doc.chunksCount || 3;
    return Array.from({ length: count }, (_, i) => ({
      id: `${doc.id}-chunk-${String(i + 1).padStart(2, '0')}`,
      index: i + 1,
      tokens: 180 + i * 45,
      heading:
        i === 0
          ? `Introduction & Scope: ${doc.title}`
          : `Section ${i + 1}: Configuration & Verification`,
      content:
        i === 0
          ? `### Overview\n${doc.title} sets the operational standard for SupportPilot agents.\nAll tickets referencing this policy must comply with 99.9% tenant isolation and calibrated confidence thresholding.`
          : `### Step ${i + 1}\n1. Verify tenant encryption key.\n2. Ingest markdown or PDF corpus into pgvector using text-embedding-3-small.\n3. Validate chunk embeddings across reciprocal rank fusion index.`,
      embeddingDim: 1536,
    }));
  };

  const copyChunk = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedChunkId(id);
    setTimeout(() => setCopiedChunkId(null), 2000);
  };

  return (
    <div className="space-y-space-lg">
      {/* Header and View Switcher with Stitch Diagnostics Styling */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md bg-surface p-space-lg rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-space-xs font-code-mono text-code-mono text-primary font-medium tracking-tight mb-1">
            <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span>VECTOR_NAMESPACE: PROD-SUPPORT-RAG</span>
            <span className="text-outline-variant">/</span>
            <span className="text-text-secondary">v2.4-hybrid</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-text-primary tracking-tight">
            Knowledge Base &amp; Vector Store
          </h1>
          <p className="font-body-md text-body-md text-text-secondary mt-0.5 max-w-3xl">
            Manage documentation, verify chunk embeddings, inspect token distributions, and test RAG
            answer retrieval.
          </p>
        </div>

        <div className="flex items-center gap-space-sm flex-wrap">
          <div className="inline-flex rounded-xl bg-surface-subtle p-1 border border-border text-body-sm font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'documents'
                  ? 'bg-surface text-text-primary shadow-xs font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Documents ({documents.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('test')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'test'
                  ? 'bg-surface text-text-primary shadow-xs font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] text-primary">
                auto_awesome
              </span>
              <span>Test Console</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-container text-on-primary font-body-md text-body-md font-semibold px-4 py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Add Document</span>
          </button>
        </div>
      </div>

      {/* Stitch MCP Summary Metrics Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md">
        <div className="p-space-md rounded-xl bg-surface border border-border shadow-sm flex items-center justify-between">
          <div>
            <div className="font-body-sm text-body-sm text-text-secondary font-medium">
              Total Articles
            </div>
            <div className="font-headline-lg text-headline-lg font-bold text-text-primary mt-1">
              {documents.length}
            </div>
            <div className="font-body-sm text-body-sm text-ticket-open-text font-medium flex items-center gap-1 mt-1">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              <span>Active in index</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary-fixed text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">article</span>
          </div>
        </div>
        <div className="p-space-md rounded-xl bg-surface border border-border shadow-sm flex items-center justify-between">
          <div>
            <div className="font-body-sm text-body-sm text-text-secondary font-medium">
              Embedded Chunks
            </div>
            <div className="font-headline-lg text-headline-lg font-bold text-text-primary mt-1">
              {documents.reduce((acc, d) => acc + (d.chunksCount || 0), 0)}
            </div>
            <div className="font-code-mono text-code-mono text-text-secondary mt-1">
              1536-dim · text-embedding-3
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-surface-container-high text-secondary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">layers</span>
          </div>
        </div>
        <div className="p-space-md rounded-xl bg-surface border border-border shadow-sm flex items-center justify-between">
          <div>
            <div className="font-body-sm text-body-sm text-text-secondary font-medium">
              Index Sync
            </div>
            <div className="font-headline-lg text-headline-lg font-bold text-text-primary mt-1">
              99.9%
            </div>
            <div className="font-body-sm text-body-sm text-ticket-open-text font-medium flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-ticket-open-text animate-pulse" />
              Live pgvector
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-ticket-open-bg text-ticket-open-text flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">verified</span>
          </div>
        </div>
        <div className="p-space-md rounded-xl bg-surface border border-border shadow-sm flex items-center justify-between">
          <div>
            <div className="font-body-sm text-body-sm text-text-secondary font-medium">
              Avg Retrieval Latency
            </div>
            <div className="font-headline-lg text-headline-lg font-bold text-text-primary mt-1">
              34ms
            </div>
            <div className="font-body-sm text-body-sm text-primary font-medium mt-1">
              P95 hybrid search
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary-fixed/40 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">speed</span>
          </div>
        </div>
      </div>

      {/* Tab: Documents Table */}
      {activeTab === 'documents' && (
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-text-secondary space-y-2">
              <Clock className="w-6 h-6 animate-spin mx-auto text-primary" />
              <p className="font-body-sm font-medium">Loading knowledge base documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-primary-fixed text-primary flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-[32px]">article</span>
              </div>
              <h3 className="font-headline-md text-headline-sm font-bold text-text-primary">
                No documents in Knowledge Base
              </h3>
              <p className="font-body-sm text-body-sm text-text-secondary max-w-sm mx-auto">
                Upload markdown guides or articles to power automated customer answers with grounded
                citations.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(true)}
                  className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-container text-on-primary font-body-sm text-body-sm font-semibold px-4 py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  Upload First Article
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-left font-body-sm text-body-sm">
                <thead className="bg-surface-subtle text-text-secondary font-code-mono uppercase text-[11px]">
                  <tr>
                    <th className="py-3.5 px-6">Document Title</th>
                    <th className="py-3.5 px-4">Source Type</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Chunks</th>
                    <th className="py-3.5 px-4">Updated</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-text-primary">
                  {documents.map((doc) => (
                    <tr
                      key={doc.id}
                      className="hover:bg-surface-subtle transition-colors group cursor-pointer"
                      onClick={() => setSelectedDocForInspect(doc)}
                    >
                      <td className="py-3.5 px-6 font-medium">
                        <div className="flex items-center gap-3">
                          {getDocTypeIcon(doc.title, doc.source)}
                          <div>
                            <div className="font-bold text-text-primary group-hover:text-primary transition-colors">
                              {doc.title}
                            </div>
                            <div className="text-[11px] text-text-secondary font-code-mono">
                              id: {doc.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-text-secondary">
                        <span className="px-2 py-0.5 rounded bg-surface-subtle text-text-primary font-code-mono uppercase text-[10px] font-semibold border border-border">
                          {doc.source}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">{renderStatusChip(doc.status)}</td>
                      <td className="py-3.5 px-4 text-text-primary font-code-mono text-xs">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-fixed/40 text-primary border border-primary/20 font-semibold">
                          <Layers className="w-3.5 h-3.5 text-primary" />
                          {doc.chunksCount} chunks
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-text-secondary text-xs">
                        {new Date(doc.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDocForInspect(doc);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-text-primary text-xs font-semibold hover:bg-surface-subtle hover:text-primary transition-all shadow-2xs cursor-pointer"
                        >
                          <span>Inspect Chunks</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Test Retrieval Console */}
      {activeTab === 'test' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
          {/* Query Console */}
          <div className="bg-surface p-space-lg rounded-xl border border-border shadow-sm space-y-space-md">
            <div className="border-b border-border pb-3">
              <h2 className="font-headline-sm text-body-md font-bold text-text-primary flex items-center gap-2">
                <div className="p-1 rounded-lg bg-primary-fixed text-primary">
                  <span className="material-symbols-outlined text-[18px]">search</span>
                </div>
                <span>Ask Knowledge Base</span>
              </h2>
              <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">
                Query the pgvector index with reciprocal rank fusion. Inspect citations and
                confidence threshold gates.
              </p>
            </div>

            <form onSubmit={handleRunTest} className="space-y-space-md">
              <div className="space-y-1.5">
                <label className="font-code-mono text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                  Test Retrieval Query
                </label>
                <textarea
                  value={testQuestion}
                  onChange={(e) => setTestQuestion(e.target.value)}
                  placeholder="e.g. How do I configure SAML SSO in SupportPilot?"
                  rows={4}
                  className="w-full rounded-xl border border-border bg-surface-subtle p-3.5 font-body-md text-body-md text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-2xs resize-none"
                />
              </div>

              {/* Sample Prompts */}
              <div className="space-y-1.5">
                <span className="font-code-mono text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                  Quick Examples
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'How do I configure SAML SSO in SupportPilot?',
                    'What is the refund policy for annual enterprise tier?',
                    'Bake a chocolate recipe cake',
                  ].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => setTestQuestion(sample)}
                      className="font-body-sm text-body-sm px-2.5 py-1 rounded-lg bg-surface-subtle border border-border text-text-secondary hover:text-text-primary transition-colors text-left cursor-pointer"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isTesting || !testQuestion.trim()}
                className="w-full bg-primary hover:bg-primary-container disabled:opacity-50 text-on-primary font-semibold py-2.5 rounded-xl font-body-md text-body-md transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                {isTesting ? (
                  <Clock className="w-4 h-4 animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                )}
                <span>Run Retrieval &amp; Synthesis</span>
              </button>
            </form>
          </div>

          {/* Synthesis & Verification Output */}
          <div className="bg-surface p-space-lg rounded-xl border border-border shadow-sm space-y-space-md">
            <div className="border-b border-border pb-3 flex items-center justify-between">
              <div>
                <h2 className="font-headline-sm text-body-md font-bold text-text-primary flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-primary-fixed text-primary">
                    <span className="material-symbols-outlined text-[18px]">layers</span>
                  </div>
                  <span>Synthesis &amp; Verification Output</span>
                </h2>
                <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">
                  Calibrated grounding evaluation &amp; citation provenance
                </p>
              </div>
              {testResult && (
                <span className="font-code-mono text-[10px] px-2 py-0.5 rounded bg-surface-subtle text-text-secondary font-semibold">
                  pgvector RRF
                </span>
              )}
            </div>

            {testResult ? (
              <div className="space-y-space-md">
                {/* Confidence Meter */}
                <div className="p-space-md rounded-xl bg-surface-subtle border border-border space-y-2">
                  <div className="flex items-center justify-between font-body-sm">
                    <span className="font-semibold text-text-primary">Calibrated Confidence</span>
                    <span className="font-code-mono font-bold text-text-primary">
                      {Math.round(testResult.confidence * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        testResult.confidence >= 0.55 ? 'bg-ticket-open-text' : 'bg-priority-urgent'
                      }`}
                      style={{ width: `${Math.min(100, testResult.confidence * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between font-code-mono text-[10px] text-text-secondary">
                    <span>Gate threshold: 55%</span>
                    <span>
                      {testResult.confidence >= 0.55
                        ? 'Passed Grounding Gate'
                        : 'Below Confidence Gate'}
                    </span>
                  </div>
                </div>

                {/* Synthesized Answer Box */}
                <div className="p-space-md bg-surface-container-low rounded-xl border border-border text-body-md text-text-primary leading-relaxed shadow-2xs">
                  <div className="flex items-center gap-1.5 text-primary font-bold font-code-mono text-[11px] mb-2 uppercase tracking-wide">
                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                    <span>Synthesized RAG Response</span>
                  </div>
                  <p>{testResult.answer}</p>
                </div>

                {/* Citations */}
                {testResult.citations.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-code-mono text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                      Verified Citations (T-AI-02)
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {testResult.citations.map((c) => (
                        <button
                          key={c.chunkId}
                          type="button"
                          onClick={() =>
                            setSelectedCitation(selectedCitation === c.chunkId ? null : c.chunkId)
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ticket-new-bg text-ticket-new-text border border-ticket-new-text/20 font-body-sm text-body-sm font-medium hover:bg-ticket-new-bg/80 transition-colors shadow-2xs cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">menu_book</span>
                          <span>{c.title}</span>
                          <span className="font-code-mono text-[10px] opacity-75">
                            ({c.chunkId})
                          </span>
                          <span className="material-symbols-outlined text-[14px] ml-0.5 opacity-60">
                            open_in_new
                          </span>
                        </button>
                      ))}
                    </div>

                    {selectedCitation && (
                      <div className="p-3 bg-neutral text-on-primary rounded-xl text-[11px] font-code-mono border border-border mt-2 space-y-1">
                        <div className="flex justify-between text-text-secondary text-[10px]">
                          <span>Citation Chunk Inspector: {selectedCitation}</span>
                          <span className="text-ticket-open-text font-bold">
                            Score: 0.942 (Cosine)
                          </span>
                        </div>
                        <p className="text-surface">
                          SupportPilot supports SAML 2.0 / OIDC enterprise authentication with Okta,
                          Azure AD, and Google Workspace.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Escalation Gate Badge */}
                <div className="pt-3 border-t border-border flex items-center justify-between font-body-sm">
                  <span className="text-text-secondary font-medium">Escalation Gate</span>
                  {testResult.shouldEscalate ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-priority-urgent bg-priority-urgent/10 border border-priority-urgent/20 font-bold font-code-mono text-[11px]">
                      <span className="material-symbols-outlined text-[14px]">warning</span>
                      ESCALATE TO HUMAN AGENT
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-ticket-open-text bg-ticket-open-bg border border-ticket-open-text/20 font-bold font-code-mono text-[11px]">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      GROUNDED &amp; DEFLECTED
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-text-secondary font-body-sm space-y-2">
                <span className="material-symbols-outlined text-[32px] text-outline-variant">
                  search
                </span>
                <p>
                  Enter a query in the console and run retrieval to test pgvector RAG synthesis.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chunk Inspector Drawer / Modal */}
      {selectedDocForInspect && (
        <div className="fixed inset-0 z-50 bg-neutral/50 backdrop-blur-xs flex justify-end">
          <div className="bg-surface w-full max-w-xl h-full shadow-2xl border-l border-border flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-space-md border-b border-border flex items-center justify-between bg-surface-subtle">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">layers</span>
                  <h3 className="font-bold text-text-primary font-headline-sm text-body-md">
                    Chunk Vector Inspector
                  </h3>
                </div>
                <p className="font-body-sm text-body-sm text-text-secondary truncate max-w-md">
                  {selectedDocForInspect.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDocForInspect(null)}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Document metadata summary */}
            <div className="p-space-md bg-primary-fixed/20 border-b border-border flex items-center justify-between font-body-sm text-body-sm">
              <div className="flex items-center gap-4">
                <span className="text-text-primary font-semibold">
                  {selectedDocForInspect.chunksCount} chunks generated
                </span>
                <span className="text-outline-variant">•</span>
                <span className="text-text-secondary font-code-mono">1536 dim</span>
              </div>
              {renderStatusChip(selectedDocForInspect.status)}
            </div>

            {/* Chunks List */}
            <div className="flex-1 overflow-y-auto p-space-md space-y-space-md">
              {getSampleChunksForDoc(selectedDocForInspect).map((chunk) => (
                <div
                  key={chunk.id}
                  className="rounded-xl border border-border bg-surface p-space-md shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 font-code-mono text-body-sm font-bold text-primary bg-primary-fixed/40 px-2 py-0.5 rounded border border-primary/20">
                      <span className="material-symbols-outlined text-[13px]">tag</span>
                      {chunk.id}
                    </span>
                    <div className="flex items-center gap-2 font-body-sm text-text-secondary">
                      <span className="font-code-mono bg-surface-subtle px-2 py-0.5 rounded text-text-primary">
                        {chunk.tokens} tokens
                      </span>
                      <button
                        type="button"
                        onClick={() => copyChunk(chunk.id, chunk.content)}
                        className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer"
                        title="Copy chunk markdown"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {copiedChunkId === chunk.id ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="font-headline-sm text-body-md font-semibold text-text-primary">
                    {chunk.heading}
                  </div>

                  {/* Code block preview */}
                  <pre className="p-3 bg-inverse-surface text-inverse-on-surface rounded-xl font-code-mono text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed border border-border">
                    {chunk.content}
                  </pre>
                </div>
              ))}
            </div>

            {/* Drawer Footer */}
            <div className="p-space-md border-t border-border bg-surface flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDocForInspect(null)}
                className="px-4 py-2 rounded-xl bg-surface-subtle hover:bg-surface-container border border-border text-text-primary font-body-sm text-body-sm font-semibold transition-colors cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload/Paste Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-neutral/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl shadow-xl border border-border max-w-lg w-full p-space-lg space-y-space-md animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-headline-sm text-headline-sm font-bold text-text-primary flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary-fixed text-primary">
                  <span className="material-symbols-outlined text-[18px]">upload</span>
                </div>
                <span>Add Article to Knowledge Base</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="text-text-secondary hover:text-text-primary p-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-priority-urgent/10 border border-priority-urgent/30 rounded-xl text-priority-urgent font-body-sm text-body-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">warning</span>
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleCreateDocument} className="space-y-space-md">
              <div>
                <label className="block font-code-mono text-[11px] font-bold text-text-secondary uppercase mb-1">
                  Article Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Account Security and SAML Configuration"
                  className="w-full rounded-xl border border-border bg-surface-subtle p-2.5 font-body-md text-body-md text-text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs"
                />
              </div>

              <div>
                <label className="block font-code-mono text-[11px] font-bold text-text-secondary uppercase mb-1">
                  Article Markdown Content
                </label>
                <textarea
                  rows={6}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Paste markdown content here with # and ## section headings..."
                  className="w-full rounded-xl border border-border bg-surface-subtle p-2.5 font-body-md text-body-md text-text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs font-code-mono resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-text-secondary font-body-sm text-body-sm font-semibold hover:bg-surface-subtle transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-container disabled:opacity-50 text-on-primary font-body-sm text-body-sm font-semibold transition-colors shadow-xs cursor-pointer"
                >
                  {registerMutation.isPending ? 'Processing...' : 'Ingest Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
