const { Sequelize } = require('sequelize');
const path = require('path');
const logger = console;
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { ensureApplicationSchema } = require('../services/schemaService');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    // Support both DB_PORT and MYSQL_PORT so existing local .env files work.
    port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
    dialect: 'mysql',
    // logging: (msg) => logger.debug(msg),
    logging: false,
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      paranoid: true
    },
    dialectOptions: {
      connectTimeout: 60000,
      ssl: process.env.DB_SSL ? { require: true } : false
    },
    benchmark: true
  }
);

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully.');

    // Create missing tables on first boot, but do not alter existing tables by default.
    // Repeated alter syncs can create duplicate MySQL indexes until the table hits
    // "Too many keys specified; max 64 keys allowed".
    const syncOptions = {
      alter: String(process.env.DB_SYNC_ALTER || '').toLowerCase() === 'true',
      force: false
    };

    try {
      await sequelize.sync(syncOptions);
      logger.info('Database schema synchronized successfully.');
      await ensureApplicationSchema(sequelize, logger);
    } catch (syncErr) {
      logger.warn('Database schema sync encountered an issue:', syncErr.message);
      logger.warn('Set DB_SYNC_ALTER=false and use targeted migrations if this is an index-limit error.');
      logger.warn('Continuing anyway - some operations may fail if expected columns are missing.');
      // Don't exit here - let the server start anyway
    }

    //These is for development only just to create the tables inside the database. After ctreation of tables once comment this line. At that time comment the above similar line also.
    // await sequelize.sync({ force: true });


  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

module.exports = {
  sequelize,
  testConnection
};
