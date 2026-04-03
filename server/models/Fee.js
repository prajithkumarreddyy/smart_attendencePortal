const mongoose = require('mongoose');

const FeeSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    totalAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    dueDate: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Fee', FeeSchema);
