const apiSettingsService = require('../services/apiSettingsService');
const ApiError = require('../utils/ApiError');

function sendSuccess(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

exports.getAllSettings = async (req, res, next) => {
  try {
    const rows = await apiSettingsService.listApiSettings();
    return sendSuccess(res, { settings: rows });
  } catch (err) {
    next(err);
  }
};

exports.createSetting = async (req, res, next) => {
  try {
    const created = await apiSettingsService.createApiSetting(req.body || {});
    return sendSuccess(res, { setting: created }, 201);
  } catch (err) {
    next(err);
  }
};

exports.updateSetting = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Valid id is required');

    const updated = await apiSettingsService.updateApiSetting(id, req.body || {});
    return sendSuccess(res, { setting: updated });
  } catch (err) {
    next(err);
  }
};

exports.deleteSetting = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Valid id is required');

    await apiSettingsService.deleteApiSetting(id);
    return sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
};

exports.activateSetting = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Valid id is required');

    const activated = await apiSettingsService.activateApiSettingById(id);
    return sendSuccess(res, { setting: activated });
  } catch (err) {
    next(err);
  }
};

