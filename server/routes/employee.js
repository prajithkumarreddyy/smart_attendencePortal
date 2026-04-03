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
        // Fetch all enrolled students
        const students = await Student.find().select('name rollNumber registeredFace');
        const studentsWithAttendance = await Promise.all(students.map(async student => {
            const count = await Attendance.countDocuments({ student: student._id, status: 'Present' });
            return {
                roll: student.rollNumber,
                name: student.name,
                attendance: student.registeredFace ? `${count} Session${count === 1 ? '' : 's'} Present` : 'Biometric Setup Pending'
            };
        }));
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
            return res.json({ totalStudents: await Student.countDocuments(), presentCount: 0, presentStudents: [] });
        }

        // Find attendance records strictly linked to this specific QR cryptographic period
        const todaysAttendance = await Attendance.find({ sessionToken: token, status: 'Present' }).populate('student', 'name rollNumber');
        
        // Count all universally registered students in DB
        const totalStudents = await Student.countDocuments();

        res.json({
            totalStudents,
            presentCount: todaysAttendance.length,
            presentStudents: todaysAttendance.map(a => ({ roll: a.student.rollNumber, name: a.student.name }))
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
            sessionToken
        });
        await newAttendance.save();
        res.json({ message: 'Successfully marked present manually' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
