const express = require('express');
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');

const router = express.Router();

const employeeAuth = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ message: 'No token' });
    try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        if (decoded.role !== 'employee') return res.status(403).json({ message: 'Access denied' });
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token invalid' });
    }
};

router.get('/students', employeeAuth, async (req, res) => {
    try {
        const [students, attendanceCounts, distinctSessions] = await Promise.all([
            Student.find().select('name rollNumber registeredFace').lean(),
            Attendance.aggregate([
                { $match: { status: 'Present' } },
                { $group: { _id: '$student', count: { $sum: 1 } } }
            ]),
            Attendance.distinct('sessionToken', { status: 'Present', sessionToken: { $ne: null } })
        ]);

        const countMap = new Map();
        for (const item of attendanceCounts) {
            countMap.set(String(item._id), item.count);
        }

        const totalSessions = distinctSessions.length || 1; // Avoid division by zero

        const studentsWithAttendance = students.map(student => {
            const count = countMap.get(String(student._id)) || 0;
            const percentage = Math.round((count / totalSessions) * 100);
            return {
                roll: student.rollNumber,
                name: student.name,
                presentCount: count,
                totalSessions,
                percentage,
                attendance: student.registeredFace 
                    ? `${count}/${totalSessions} (${percentage}%)` 
                    : 'Biometric Setup Pending'
            };
        });

        res.json(studentsWithAttendance);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Generate short-lived QR Attendance Session Token
router.post('/generate-session', employeeAuth, (req, res) => {
    try {
        const sessionToken = jwt.sign(
            { employeeId: req.user.id, type: 'attendance_session' },
            process.env.JWT_SECRET,
            { expiresIn: '2m' } // 2 minute validity window
        );
        res.json({ sessionToken });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get real-time attendance matrix for TODAY's session
router.get('/live-attendance', employeeAuth, async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) {
            const totalStudents = await Student.countDocuments();
            return res.json({ totalStudents, presentCount: 0, presentStudents: [] });
        }

        const [todaysAttendance, totalStudents] = await Promise.all([
            Attendance.find({ sessionToken: token, status: 'Present' })
                .populate('student', 'name rollNumber')
                .lean(),
            Student.countDocuments()
        ]);

        const presentStudents = todaysAttendance
            .filter(a => a.student)
            .map(a => ({ roll: a.student.rollNumber, name: a.student.name }));

        res.json({
            totalStudents,
            presentCount: presentStudents.length,
            presentStudents
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Manual attendance override for students without active phones
router.post('/mark-manual', employeeAuth, async (req, res) => {
    try {
        const { rollNumber, sessionToken } = req.body;
        if (!rollNumber || !sessionToken) return res.status(400).json({ message: 'Missing parameters' });

        const student = await Student.findOne({ rollNumber });
        if (!student) return res.status(404).json({ message: 'Invalid Roll Number' });

        const existing = await Attendance.findOne({ student: student._id, sessionToken });
        if (existing) return res.status(400).json({ message: 'Already marked' });

        const newAttendance = new Attendance({
            student: student._id,
            status: 'Present',
            sessionToken,
            date: new Date()
        });
        await newAttendance.save();
        res.json({ message: 'Successfully marked present manually' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
