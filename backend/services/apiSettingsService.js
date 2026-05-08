const ApiError = require('../utils/ApiError');
const { ApiSetting, sequelize } = require('../models');

const LLM_CATEGORY = 'llm';
const JUDGE0_CATEGORY = 'judge0';

const LLM_PROVIDERS = ['gemini', 'groq', 'ollama', 'local'];
const JUDGE0_PROVIDERS = ['rapidapi', 'local'];

function normalizeNonEmptyString(value) {
  const s = value === undefined || value === null ? '' : String(value);
  const trimmed = s.trim();
  return trimmed.length ? trimmed : '';
}

/**
 * Canonicalize provider names for adapter lookup:
 * - We keep llmServices adapter keys as: gemini, groq, local (where local == Ollama).
 */
function normalizeLLMProviderForAdapters(providerName) {
  const p = String(providerName || '').toLowerCase().trim();
  if (p === 'ollama' || p === 'local') return 'local';
  if (p === 'gemini') return 'gemini';
  if (p === 'groq') return 'groq';
  return '';
}

function normalizeJudge0ProviderForAdapters(providerName) {
  const p = String(providerName || '').toLowerCase().trim();
  if (p === 'local') return 'local';
  if (p === 'rapidapi') return 'rapidapi';
  return '';
}

function validateCategoryAndProvider({ category, provider_name }) {
  const c = String(category || '').toLowerCase().trim();
  const p = String(provider_name || '').toLowerCase().trim();

  if (c !== LLM_CATEGORY && c !== JUDGE0_CATEGORY) {
    throw new ApiError(400, `category must be one of: ${[LLM_CATEGORY, JUDGE0_CATEGORY].join(', ')}`);
  }

  if (c === LLM_CATEGORY) {
    if (!LLM_PROVIDERS.includes(p)) {
      throw new ApiError(400, `provider_name for LLM must be one of: gemini, groq, ollama`);
    }
    return { category: LLM_CATEGORY, provider_name: p };
  }

  if (c === JUDGE0_CATEGORY) {
    if (!JUDGE0_PROVIDERS.includes(p)) {
      throw new ApiError(400, `provider_name for Judge0 must be one of: rapidapi, local`);
    }
    return { category: JUDGE0_CATEGORY, provider_name: p };
  }
}

function validatePayloadByCategory({ category, provider_name, api_key, base_url }) {
  const normalized = validateCategoryAndProvider({ category, provider_name });
  const apiKey = normalizeNonEmptyString(api_key);
  const baseUrl = normalizeNonEmptyString(base_url);
  const c = normalized.category;
  const p = normalized.provider_name;

  if (c === LLM_CATEGORY) {
    if (p === 'gemini' || p === 'groq') {
      if (!apiKey) throw new ApiError(400, `api_key is required for LLM provider: ${p}`);
    }
    if (p === 'ollama') {
      if (!baseUrl) throw new ApiError(400, `base_url is required for LLM provider: ollama`);
    }
    // local alias treated like ollama
    if (p === 'local') {
      if (!baseUrl) throw new ApiError(400, `base_url is required for LLM provider: ollama/local`);
    }
    return { ...normalized, api_key: apiKey || null, base_url: baseUrl || null };
  }

  if (c === JUDGE0_CATEGORY) {
    if (p === 'rapidapi') {
      if (!apiKey) throw new ApiError(400, 'api_key is required for RapidAPI Judge0');
      if (!baseUrl) throw new ApiError(400, 'base_url is required for RapidAPI Judge0');
    }
    if (p === 'local') {
      if (!baseUrl) throw new ApiError(400, 'base_url is required for Local Judge0');
    }
    return { ...normalized, api_key: apiKey || null, base_url: baseUrl || null };
  }
}

function coerceIsActive(value) {
  if (value === undefined) return false;
  return Boolean(value);
}

async function activateApiSettingById(id, { transaction } = {}) {
  const runInTx = transaction || (await sequelize.transaction());
  let createdTx = Boolean(!transaction);
  try {
    const setting = await ApiSetting.findByPk(id, { transaction: runInTx });
    if (!setting) throw new ApiError(404, 'Settings entry not found');

    const { category } = setting;

    // Ensure only one active config per category.
    await ApiSetting.update(
      { is_active: false },
      { where: { category }, transaction: runInTx }
    );

    setting.is_active = true;
    await setting.save({ transaction: runInTx });

    if (createdTx) await runInTx.commit();
    return setting;
  } catch (err) {
    if (createdTx) await runInTx.rollback();
    throw err;
  }
}

async function getActiveLLMConfig() {
  const active = await ApiSetting.findOne({
    where: { category: LLM_CATEGORY, is_active: true },
  });
  if (!active) return null;

  const adapterProvider = normalizeLLMProviderForAdapters(active.provider_name);
  return {
    ...active.toJSON(),
    adapter_provider: adapterProvider,
  };
}

async function getActiveJudge0Config() {
  const active = await ApiSetting.findOne({
    where: { category: JUDGE0_CATEGORY, is_active: true },
  });
  if (!active) return null;

  const adapterProvider = normalizeJudge0ProviderForAdapters(active.provider_name);
  return {
    ...active.toJSON(),
    adapter_provider: adapterProvider,
  };
}

async function getAllLLMConfigs() {
  const rows = await ApiSetting.findAll({
    where: { category: LLM_CATEGORY },
    order: [['id', 'DESC']],
  });

  return rows.map((r) => {
    const adapterProvider = normalizeLLMProviderForAdapters(r.provider_name);
    return { ...r.toJSON(), adapter_provider: adapterProvider };
  });
}

async function getAllJudge0Configs() {
  const rows = await ApiSetting.findAll({
    where: { category: JUDGE0_CATEGORY },
    order: [['id', 'DESC']],
  });

  return rows.map((r) => {
    const adapterProvider = normalizeJudge0ProviderForAdapters(r.provider_name);
    return { ...r.toJSON(), adapter_provider: adapterProvider };
  });
}

async function getProviderRuntimeConfig() {
  /**
   * Used by the faculty provider selector UI to show “Configured / Needs backend key”.
   * Shape matches the legacy `llmServices.getProviderConfig()` usage:
   *   { selected: 'gemini', providers: [{name, configured}] }
   */
  const configs = await getAllLLMConfigs();
  const byAdapter = new Map();
  for (const cfg of configs) {
    if (!cfg.adapter_provider) continue;
    // last row wins; only presence matters
    byAdapter.set(cfg.adapter_provider, cfg);
  }

  return {
    providers: ['gemini', 'groq', 'local'].map((name) => {
      const cfg = byAdapter.get(name);
      const configured = Boolean(cfg) && (
        name === 'gemini' ? Boolean(cfg.api_key) :
        name === 'groq' ? Boolean(cfg.api_key) :
        // local == ollama
        Boolean(cfg.base_url)
      );
      return { name, configured };
    })
  };
}

async function listApiSettings() {
  return ApiSetting.findAll({ order: [['id', 'DESC']] });
}

async function createApiSetting(payload) {
  const validated = validatePayloadByCategory(payload);
  const is_active = coerceIsActive(payload.is_active);

  return sequelize.transaction(async (t) => {
    const created = await ApiSetting.create(
      {
        category: validated.category,
        provider_name: validated.provider_name,
        api_key: validated.api_key,
        base_url: validated.base_url,
        is_active: is_active ? true : false,
      },
      { transaction: t }
    );

    if (is_active) {
      await activateApiSettingById(created.id, { transaction: t });
    }

    return created;
  });
}

async function updateApiSetting(id, payload) {
  const setting = await ApiSetting.findByPk(id);
  if (!setting) throw new ApiError(404, 'Settings entry not found');

  // Allow partial updates but keep category/provider validation consistent.
  const nextCategory = payload.category !== undefined ? payload.category : setting.category;
  const nextProviderName = payload.provider_name !== undefined ? payload.provider_name : setting.provider_name;

  const validated = validatePayloadByCategory({
    category: nextCategory,
    provider_name: nextProviderName,
    api_key: payload.api_key !== undefined ? payload.api_key : setting.api_key,
    base_url: payload.base_url !== undefined ? payload.base_url : setting.base_url,
  });

  const nextIsActive = payload.is_active !== undefined ? coerceIsActive(payload.is_active) : setting.is_active;

  return sequelize.transaction(async (t) => {
    await ApiSetting.update(
      {
        category: validated.category,
        provider_name: validated.provider_name,
        api_key: validated.api_key,
        base_url: validated.base_url,
        is_active: nextIsActive,
      },
      { where: { id }, transaction: t }
    );

    if (nextIsActive) {
      // Activation must deactivate other configs in the same *resulting* category.
      await activateApiSettingById(id, { transaction: t });
    }

    return ApiSetting.findByPk(id, { transaction: t });
  });
}

async function deleteApiSetting(id) {
  const setting = await ApiSetting.findByPk(id);
  if (!setting) throw new ApiError(404, 'Settings entry not found');
  await ApiSetting.destroy({ where: { id } });
  return true;
}

module.exports = {
  LLM_CATEGORY,
  JUDGE0_CATEGORY,
  getActiveLLMConfig,
  getActiveJudge0Config,

  // Helpers used by controllers/services
  getAllLLMConfigs,
  getAllJudge0Configs,
  getProviderRuntimeConfig,

  listApiSettings,
  createApiSetting,
  updateApiSetting,
  deleteApiSetting,
  activateApiSettingById,
};

