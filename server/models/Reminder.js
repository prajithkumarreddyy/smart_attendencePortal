const mongoose = require('mongoose');

const ReminderSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    text: {
        type: String,
        required: true
    },
    completed: {
        type: Boolean,
        default: false
    },
    dueDate: {
        type: Date
    }
}, { timestamps: true });

module.exports = mongoose.model('Reminder', ReminderSchema);
