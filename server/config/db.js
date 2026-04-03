const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        console.error("Please ensure your MONGODB_URI in the .env file is a valid MongoDB Atlas connection string.");
        // We aren't exiting the process here so that the server still boots and shows error gracefully
    }
};

module.exports = connectDB;
