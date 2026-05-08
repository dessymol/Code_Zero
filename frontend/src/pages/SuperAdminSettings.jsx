import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Plus, Edit, Trash2, Sparkles, Cpu, Server, ShieldCheck } from 'lucide-react';
import AdminLayout from './AdminLayout';
import apiClient from '../services/api';
import { useToast } from '../context/ToastContext';
import ProviderSettingsModal from '../components/ProviderSettingsModal';

const maskApiKey = (key) => {
  const s = typeof key === 'string' ? key : '';
  if (!s.trim()) return 'Not set';
  const last4 = s.trim().slice(-4);
  return `••••••••••${last4}`;
};

const LLM_OPTIONS = [
  { value: 'gemini', label: 'Gemini', icon: Sparkles },
  { value: 'groq', label: 'Groq', icon: Cpu },
  { value: 'ollama', label: 'Ollama (Local)', icon: Server },
];

const JUDGE0_OPTIONS = [
  { value: 'rapidapi', label: 'RapidAPI Judge0', icon: Cpu },
  { value: 'local', label: 'Local Judge0', icon: ShieldCheck },
];

function ProviderRowActions({ busy, isActive, onActivate, onEdit, onDelete }) {
  return (
    <div className="flex gap-2 justify-end">
      <button
        type="button"
        onClick={onActivate}
        disabled={busy || isActive}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
          isActive
            ? 'text-slate-500 border-slate-200 bg-slate-50'
            : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
        }`}
      >
        {isActive ? 'Active' : 'Activate'}
      </button>
      <button
        type="button"
        onClick={onEdit}
        disabled={busy}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
        title="Edit"
      >
        <Edit size={14} className="inline-block mr-2 -mt-0.5" />
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
        title="Delete"
      >
        <Trash2 size={14} className="inline-block mr-2 -mt-0.5" />
        Delete
      </button>
    </div>
  );
}

export default function SuperAdminSettings() {
  const toast = useToast();
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [operationBusy, setOperationBusy] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [modalCategory, setModalCategory] = useState('llm'); // 'llm' | 'judge0'
  const [modalInitialData, setModalInitialData] = useState(null);

  const llmSettings = useMemo(() => settings.filter((s) => s.category === 'llm'), [settings]);
  const judge0Settings = useMemo(() => settings.filter((s) => s.category === 'judge0'), [settings]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/settings');
      const rows = res.data?.data?.settings || res.data?.settings || [];
      setSettings(Array.isArray(rows) ? rows : []);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load settings');
      setSettings([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const openAddModal = (category) => {
    setModalMode('add');
    setModalCategory(category);
    setModalInitialData(null);
    setModalOpen(true);
  };

  const openEditModal = (category, row) => {
    setModalMode('edit');
    setModalCategory(category);
    setModalInitialData(row);
    setModalOpen(true);
  };

  const providerOptions = useMemo(() => {
    return modalCategory === 'llm' ? LLM_OPTIONS : JUDGE0_OPTIONS;
  }, [modalCategory]);

  const providerModalTitle = useMemo(() => {
    const categoryTitle = modalCategory === 'llm' ? 'LLM Provider' : 'Judge0 Provider';
    return modalMode === 'edit' ? `Edit ${categoryTitle}` : `Add ${categoryTitle}`;
  }, [modalCategory, modalMode]);

  const submitProvider = async (payload) => {
    try {
      setOperationBusy(true);
      if (modalMode === 'add') {
        await apiClient.post('/settings', payload);
        toast.success('Provider created successfully');
      } else {
        await apiClient.put(`/settings/${modalInitialData.id}`, payload);
        toast.success('Provider updated successfully');
      }
      setModalOpen(false);
      await loadSettings();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setOperationBusy(false);
    }
  };

  const activateProvider = async (row) => {
    if (!row?.id) return;
    try {
      setOperationBusy(true);
      await apiClient.patch(`/settings/${row.id}/activate`);
      toast.success('Provider activated');
      await loadSettings();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Activation failed');
    } finally {
      setOperationBusy(false);
    }
  };

  const deleteProvider = async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Delete provider "${row.provider_name}"?`)) return;
    try {
      setOperationBusy(true);
      await apiClient.delete(`/settings/${row.id}`);
      toast.success('Provider deleted');
      await loadSettings();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    } finally {
      setOperationBusy(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="lms-card overflow-hidden border-0 shadow-xl">
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-6 text-white">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-black tracking-tight">Super Admin Settings</h1>
                <p className="text-sm text-white/85">
                  Manage active AI providers and code execution providers.
                </p>
              </div>
              <button
                onClick={loadSettings}
                disabled={loading || operationBusy}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/15 disabled:opacity-70"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-500">
            <RefreshCw className="animate-spin" />
            <span className="ml-2 font-semibold">Loading settings…</span>
          </div>
        ) : (
          <>
            <section className="lms-card p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">LLM Providers</h2>
                  <p className="text-sm text-slate-500">Only one provider can be active at a time.</p>
                </div>
                <button
                  type="button"
                  onClick={() => openAddModal('llm')}
                  disabled={operationBusy}
                  className="lms-btn-primary"
                >
                  <Plus size={16} />
                  Add
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="lms-table">
                  <thead>
                    <tr>
                      <th>Provider Name</th>
                      <th>Base URL</th>
                      <th>Active</th>
                      <th>API Key</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {llmSettings.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-10 text-slate-400">
                          No LLM provider configs found.
                        </td>
                      </tr>
                    ) : (
                      llmSettings.map((row) => (
                        <tr key={row.id}>
                          <td className="font-semibold text-slate-800">{row.provider_name}</td>
                          <td className="text-slate-600">{row.base_url || '—'}</td>
                          <td>
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                row.is_active
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : 'bg-slate-50 text-slate-500 border-slate-200'
                              }`}
                            >
                              {row.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="text-slate-600 font-mono text-[12px]">
                            {maskApiKey(row.api_key)}
                          </td>
                          <td>
                            <ProviderRowActions
                              busy={operationBusy}
                              isActive={Boolean(row.is_active)}
                              onActivate={() => activateProvider(row)}
                              onEdit={() => openEditModal('llm', row)}
                              onDelete={() => deleteProvider(row)}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="lms-card p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Judge0 Providers</h2>
                  <p className="text-sm text-slate-500">Only one provider can be active at a time.</p>
                </div>
                <button
                  type="button"
                  onClick={() => openAddModal('judge0')}
                  disabled={operationBusy}
                  className="lms-btn-primary"
                >
                  <Plus size={16} />
                  Add
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="lms-table">
                  <thead>
                    <tr>
                      <th>Provider Name</th>
                      <th>Base URL</th>
                      <th>Active</th>
                      <th>API Key</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {judge0Settings.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-10 text-slate-400">
                          No Judge0 provider configs found.
                        </td>
                      </tr>
                    ) : (
                      judge0Settings.map((row) => (
                        <tr key={row.id}>
                          <td className="font-semibold text-slate-800">{row.provider_name}</td>
                          <td className="text-slate-600">{row.base_url || '—'}</td>
                          <td>
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                row.is_active
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : 'bg-slate-50 text-slate-500 border-slate-200'
                              }`}
                            >
                              {row.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="text-slate-600 font-mono text-[12px]">
                            {maskApiKey(row.api_key)}
                          </td>
                          <td>
                            <ProviderRowActions
                              busy={operationBusy}
                              isActive={Boolean(row.is_active)}
                              onActivate={() => activateProvider(row)}
                              onEdit={() => openEditModal('judge0', row)}
                              onDelete={() => deleteProvider(row)}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <ProviderSettingsModal
          isOpen={modalOpen}
          onClose={() => {
            if (operationBusy) return;
            setModalOpen(false);
          }}
          mode={modalMode}
          title={providerModalTitle}
          category={modalCategory}
          providerNameOptions={providerOptions}
          initialData={modalInitialData}
          isSubmitting={operationBusy}
          onSubmit={submitProvider}
        />
      </div>
    </AdminLayout>
  );
}

