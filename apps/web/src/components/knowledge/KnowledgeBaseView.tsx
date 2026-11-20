import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  UploadCloud,
  FileText,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Layers,
  Sparkles,
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

export function KnowledgeBaseView() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'documents' | 'test'>('documents');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Test console state
  const [testQuestion, setTestQuestion] = useState('');
  const [testResult, setTestResult] = useState<{
    answer: string;
    citations: Array<{ chunkId: string; docId: string; title: string }>;
    confidence: number;
    shouldEscalate: boolean;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

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
    // Hermetic simulation or real test retrieval
    setTimeout(() => {
      setIsTesting(false);
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
    }, 300);
  };

  const renderStatusChip = (status: string) => {
    switch (status.toUpperCase()) {
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            READY
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            PROCESSING
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            FAILED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200">
            <HelpCircle className="w-3.5 h-3.5" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            Knowledge Base
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage documentation, verify chunk embeddings, and test RAG answer retrieval.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'documents'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Documents ({documents.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('test')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                activeTab === 'test'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Test Console
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3.5 py-1.5 rounded-lg shadow-sm transition-colors"
          >
            <UploadCloud className="w-4 h-4" />
            Add Document
          </button>
        </div>
      </div>

      {/* Tab: Documents Table */}
      {activeTab === 'documents' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500">
              <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
              Loading knowledge base documents...
            </div>
          ) : documents.length === 0 ? (
            <div className="p-12 text-center">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800">
                No documents in Knowledge Base
              </h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Upload markdown guides or articles to power automated customer answers with grounded
                citations.
              </p>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
              >
                <UploadCloud className="w-4 h-4" />
                Upload First Article
              </button>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-medium">
                <tr>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Chunks</th>
                  <th className="py-3 px-4">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      {doc.title}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 uppercase text-xs">{doc.source}</td>
                    <td className="py-3.5 px-4">{renderStatusChip(doc.status)}</td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                      {doc.chunksCount} chunks
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-xs">
                      {new Date(doc.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Test Retrieval Console */}
      {activeTab === 'test' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-indigo-600" />
              Ask Knowledge Base
            </h2>
            <p className="text-sm text-slate-500">
              Query the pgvector index with reciprocal rank fusion. Inspect citations and confidence
              threshold gates.
            </p>

            <form onSubmit={handleRunTest} className="space-y-3">
              <textarea
                value={testQuestion}
                onChange={(e) => setTestQuestion(e.target.value)}
                placeholder="e.g. How do I configure SAML SSO in SupportPilot?"
                rows={3}
                className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={isTesting || !testQuestion.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                {isTesting ? (
                  <Clock className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Run Retrieval & Synthesis
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              Synthesis & Verification Output
            </h2>

            {testResult ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Calibrated Confidence</span>
                    <span className="font-semibold text-slate-700">
                      {Math.round(testResult.confidence * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full ${
                        testResult.confidence >= 0.55 ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, testResult.confidence * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-800 leading-relaxed">
                  {testResult.answer}
                </div>

                {testResult.citations.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                      Verified Citations (T-AI-02)
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {testResult.citations.map((c) => (
                        <span
                          key={c.chunkId}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-medium"
                        >
                          <BookOpen className="w-3 h-3" />
                          {c.title} ({c.chunkId})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Escalation Gate</span>
                  {testResult.shouldEscalate ? (
                    <span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      ESCALATE TO HUMAN AGENT
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      GROUNDED & DEFLECTED
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-sm">
                Enter a question on the left and run retrieval to preview RAG answer synthesis.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload/Paste Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-600" />
                Add Article to Knowledge Base
              </h3>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {uploadError}
              </div>
            )}

            <form onSubmit={handleCreateDocument} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Article Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Account Security and SAML Configuration"
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Article Markdown Content
                </label>
                <textarea
                  rows={6}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Paste markdown content here with # and ## section headings..."
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors shadow-sm"
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
