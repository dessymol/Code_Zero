/**
 * Main API server entrypoint.
 * Configures Express app middleware, CORS, route wiring, socket.io, Swagger docs,
 * database connectivity and server startup.
 */
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
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

// audit log routes
const auditRoutes = require('./routes/auditRoutes');

// Load all models (so Sequelize knows them)
const db = require('./models');


//Swagger operations
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");


const app = express();

// Configure allowed CORS origins from environment or default local frontend URL.
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

// Parse JSON request bodies and log incoming requests in development.
app.use(express.json());
app.use(morgan('dev'));

// Swagger implementation
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

// Mount application routes. setupRoutes is mounted before authenticated routes to allow initialization workflows.
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

// Chat, password reset, and audit log route groups
app.use('/api/chats', chatRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/audit-logs', auditRoutes);

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

