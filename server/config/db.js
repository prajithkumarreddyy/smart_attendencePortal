const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) {
        return mongoose.connection;
    }

    if (!process.env.MONGODB_URI) {
        console.error("MONGODB_URI environment variable is missing.");
        return;
    }

    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        isConnected = true;
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        console.error("Please ensure your MONGODB_URI is set properly and Atlas IP whitelist (0.0.0.0/0) is configured.");
        throw error;
    }
};

module.exports = connectDB;
