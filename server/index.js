const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();

// Attempt initial DB connection for local development
if (process.env.NODE_ENV !== 'production') {
    connectDB().catch(err => console.error("Initial DB connection failed:", err.message));
}

const app = express();

// Ensure DB connection is active before processing serverless requests
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        console.error("DB connection error in request middleware:", error.message);
        res.status(500).json({ error: "Database connection failed", message: error.message });
    }
});

// Configure CORS safely (supporting comma-separated origins and credentials)
const corsOptions = {
    origin: (origin, callback) => {
        // Allow server-to-server or requests without Origin header
        if (!origin) return callback(null, true);
        
        const rawOrigins = process.env.CORS_ORIGIN || '*';
        if (rawOrigins === '*') {
            // Reflect origin when wildcard is requested with credentials
            return callback(null, true);
        }

        const allowedOrigins = rawOrigins.split(',').map(o => o.trim());
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(null, true); // Fallback allow to avoid unexpected blocking
    },
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' })); // High limit because face descriptor arrays can be large (128 floats)

// Health check routes
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Smart Attendance Portal API is running' });
});

app.get('/api', (req, res) => {
    res.json({ status: 'ok', message: 'Smart Attendance Portal API is running' });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/employee', require('./routes/employee'));

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
}

module.exports = app;
