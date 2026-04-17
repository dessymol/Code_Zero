const { SystemConfig, User } = require('../models');

let isInitialized = false;

const loadInitState = async () => {
  try {
    const userCount = await User.count();
    let config = await SystemConfig.findByPk(1);

    if (!config) {
      const initialized = userCount > 0;
      config = await SystemConfig.create({ id: 1, initialized });
      isInitialized = initialized;
      return isInitialized;
    }

    if (userCount === 0 && config.initialized) {
      config.initialized = false;
      await config.save();
    }

    if (userCount > 0 && !config.initialized) {
      config.initialized = true;
      await config.save();
    }

    isInitialized = !!config.initialized;
    return isInitialized;
  } catch (err) {
    console.error('Init state load failed:', err?.message || err);
    isInitialized = false;
    return isInitialized;
  }
};

const getInitState = () => isInitialized;

const setInitialized = async (value) => {
  isInitialized = !!value;
  try {
    await SystemConfig.upsert({ id: 1, initialized: isInitialized });
  } catch (err) {
    console.error('Init state update failed:', err?.message || err);
  }
  return isInitialized;
};

module.exports = {
  loadInitState,
  getInitState,
  setInitialized
};
