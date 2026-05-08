import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Key, Globe } from 'lucide-react';

const maskApiKey = (key) => {
  const s = typeof key === 'string' ? key : '';
  if (!s.trim()) return 'Not set';
  const last4 = s.trim().slice(-4);
  return `••••••••••${last4}`;
};

function getRequirementFlags(category, providerName) {
  const cat = String(category || '').toLowerCase();
  const p = String(providerName || '').toLowerCase();

  // LLM category
  // - gemini/groq: api_key required
  // - ollama: base_url required
  if (cat === 'llm') {
    return {
      apiKeyRequired: p === 'gemini' || p === 'groq',
      baseUrlRequired: p === 'ollama',
    };
  }

  // judge0 category
  // - rapidapi: api_key + base_url required
  // - local: base_url required
  if (cat === 'judge0') {
    return {
      apiKeyRequired: p === 'rapidapi',
      baseUrlRequired: p === 'rapidapi' || p === 'local',
    };
  }

  return { apiKeyRequired: false, baseUrlRequired: false };
}

export default function ProviderSettingsModal({
  isOpen,
  onClose,
  mode,
  title,
  category,
  providerNameOptions = [],
  initialData = null,
  isSubmitting = false,
  onSubmit,
}) {
  const editing = mode === 'edit';
  const initialProviderName = initialData?.provider_name || '';

  const [providerName, setProviderName] = useState(initialProviderName);
  const [baseUrl, setBaseUrl] = useState(initialData?.base_url || '');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setProviderName(initialProviderName);
    setBaseUrl(initialData?.base_url || '');
    setApiKey('');
  }, [isOpen, initialProviderName, initialData?.base_url]);

  const currentMaskedKey = useMemo(() => maskApiKey(initialData?.api_key), [initialData?.api_key]);

  const flags = useMemo(() => getRequirementFlags(category, providerName), [category, providerName]);

  const canSubmit = useMemo(() => {
    if (editing) {
      const baseOk = flags.baseUrlRequired ? String(baseUrl || '').trim().length > 0 : true;
      const apiKeyCanBeSkipped =
        String(apiKey || '').trim().length === 0; // "keep current" path

      if (flags.apiKeyRequired) {
        // If API key is required, it can be skipped only if current key exists.
        const hasExisting = Boolean(String(initialData?.api_key || '').trim());
        return baseOk && (apiKeyCanBeSkipped ? hasExisting : Boolean(String(apiKey || '').trim().length));
      }

      return baseOk;
    }

    // add mode
    const baseOk = flags.baseUrlRequired ? String(baseUrl || '').trim().length > 0 : true;
    const apiOk = flags.apiKeyRequired ? Boolean(String(apiKey || '').trim()) : true;
    const providerOk = Boolean(String(providerName || '').trim());
    return baseOk && apiOk && providerOk;
  }, [editing, flags.baseUrlRequired, flags.apiKeyRequired, baseUrl, apiKey, providerName, initialData?.api_key]);

  const submit = async () => {
    if (!canSubmit) return;

    const payload = {
      category,
      provider_name: providerName,
      base_url: baseUrl && String(baseUrl).trim().length ? String(baseUrl).trim() : null,
    };

    // For edit: empty apiKey means "keep existing", so we omit api_key in payload.
    const apiKeyTrimmed = String(apiKey || '').trim();
    if (!editing || apiKeyTrimmed) {
      payload.api_key = apiKeyTrimmed || null;
    }

    await onSubmit(payload);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="lms-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            className="lms-modal-box"
            initial={{ y: 16, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 16, scale: 0.98, opacity: 0 }}
          >
            <div className="lms-modal-header">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-600">
                  <Globe size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                  <p className="text-xs text-slate-500">{category === 'llm' ? 'AI provider' : 'Code execution provider'}</p>
                </div>
              </div>
              <button
                className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                onClick={onClose}
                type="button"
                disabled={isSubmitting}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="lms-modal-body">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    Provider Name
                  </label>
                  {editing ? (
                    <input className="lms-input" value={initialProviderName} disabled />
                  ) : (
                    <select
                      className="lms-select"
                      value={providerName}
                      onChange={(e) => setProviderName(e.target.value)}
                      disabled={isSubmitting}
                    >
                      <option value="" disabled>
                        Select provider...
                      </option>
                      {providerNameOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    Base URL
                  </label>
                  <input
                    className="lms-input"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder={flags.baseUrlRequired ? 'Required' : 'Optional'}
                    disabled={isSubmitting}
                  />
                  {flags.baseUrlRequired ? (
                    <p className="text-xs text-amber-600 mt-1">This provider requires a base URL.</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">Leave blank to use provider defaults (if supported).</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    API Key
                  </label>
                  {editing ? (
                    <div className="mb-2">
                      <p className="text-xs text-slate-500">
                        Current key: <span className="font-mono">{currentMaskedKey}</span>
                      </p>
                    </div>
                  ) : null}

                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Key size={16} />
                    </div>
                    <input
                      type="password"
                      className="lms-input pl-11"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={editing ? 'Leave blank to keep current' : flags.apiKeyRequired ? 'Required' : 'Optional'}
                      disabled={isSubmitting}
                    />
                  </div>
                  {flags.apiKeyRequired ? (
                    <p className="text-xs text-amber-600 mt-1">This provider requires an API key.</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">You can leave this blank for providers that don't require it.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="lms-modal-footer">
              <button
                type="button"
                className="lms-btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="lms-btn-primary"
                onClick={submit}
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? 'Saving…' : editing ? 'Save Changes' : 'Add Provider'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

