const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    role: { type: String, required: true },
    department: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    salary: { type: Number, required: true },
    password: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Employee', EmployeeSchema);
