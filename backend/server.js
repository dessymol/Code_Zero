// server.js (updated)
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

const { testConnection } = require('./config/connection');
const ApiError = require('./utils/ApiError');

const courseRoutes = require('./routes/courseroutes');
const studentRoutes = require('./routes/studentRoutes');
const questionRoutes = require('./routes/questionRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const resultsRoutes = require('./routes/resultRoutes');
const userRoutes = require('./routes/userroutes');
const exportRoutes = require('./excelexports/routes/exportRoutes');
const setupRoutes = require('./routes/setupRoutes');
const { requireInitialized } = require('./Middleware/initMiddleware');
const { loadInitState } = require('./services/initState');

// new chat folder
const chatRoutes = require('./chat/routes');

// password reset routes
const passwordResetRoutes = require('./routes/passwordReset');

// Load all models (so Sequelize knows them)
const db = require('./models');


//Swagger operations
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");



dotenv.config();

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

app.use(express.json());
app.use(morgan('dev'));

//Swager implementation
const swaggerOptions = {
  definition: {
    openapi: '3.0.0', // OpenAPI version
    info: {
      title: 'Code Judge API',
      version: '1.0.0',
      description: 'API documentation for your final project submission.',
    },
    servers: [{
      url: `http://localhost:${process.env.PORT}/`,
      description: 'Development server',
    }],
  },
  apis: ['./routes/*.js'], // Path to your API routes
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => {
  res.send('Welcome to the Coding Platform API');
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'codezero-api' });
});

// create HTTP server and socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

// attach io to express app, so controllers can access it via req.app.get('io')
app.set('io', io);

// initialize the socket listeners (keeps server.js tidy)
try {
  require('./chat/socket')(io);
} catch (err) {
  console.warn('Chat socket init failed (file may not exist yet)', err.message || err);
}

// mount routes (chat route before 404)
app.use(setupRoutes);
app.use('/api', setupRoutes);
app.use('/api', requireInitialized);
app.use('/api/v1/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/export', exportRoutes);

// chat routes
app.use('/api/chats', chatRoutes);

// password reset routes
app.use('/api/password-reset', passwordResetRoutes);

//Excel
const exportRouter = require(path.join(__dirname, 'excelexports', 'index.js'));



// 404
app.use((req, res, next) => {
  next(new ApiError(404, 'Route not found'));
});

// Error handler
app.use((err, req, res, next) => {
  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';
  if (process.env.NODE_ENV !== 'test') {
    console.error('[API Error]', status, message);
  }
  res.status(status).json({
    status: 'error',
    message,
  });
});

const PORT = process.env.PORT || 3000;

testConnection().then(() => {
  loadInitState().then(() => {
    server.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  }).catch((err) => {
    console.error('Initialization state load failed:', err);
    process.exit(1);
  });
}).catch(err => {
  console.error('DB connection failed:', err);
  process.exit(1);
});
