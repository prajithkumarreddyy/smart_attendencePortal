const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ['Present', 'Absent'], default: 'Present' },
    sessionToken: { type: String }
}, { timestamps: true });

// Ensure a student can only be marked once per unique session token
AttendanceSchema.index({ student: 1, sessionToken: 1 }, { unique: true });
AttendanceSchema.index({ sessionToken: 1, status: 1 });
AttendanceSchema.index({ status: 1 });
AttendanceSchema.index({ student: 1, status: 1 });

module.exports = mongoose.model('Attendance', AttendanceSchema);

