const { Sequelize } = require('sequelize');
const logger = console;
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
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
    await sequelize.sync({ alter: false, force: false });



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
