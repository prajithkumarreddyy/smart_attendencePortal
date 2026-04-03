const express = require('express');
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');

const router = express.Router();

// Middleware to verify token
const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

    try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

// Calculate Euclidean distance between two descriptors
const euclideanDistance = (desc1, desc2) => {
    return Math.sqrt(desc1.reduce((sum, val, i) => sum + Math.pow(val - desc2[i], 2), 0));
};

// Register face descriptor
router.post('/register-face', authMiddleware, async (req, res) => {
    try {
        const { descriptor } = req.body;
        if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
            return res.status(400).json({ message: 'Invalid face descriptor' });
        }

        const allRegisteredStudents = await Student.find({ registeredFace: true });
        for (let student of allRegisteredStudents) {
            const distance = euclideanDistance(descriptor, student.faceDescriptor);
            if (distance < 0.55) {
                return res.status(400).json({ message: 'Face is already saved' });
            }
        }

        await Student.findByIdAndUpdate(req.user.id, { 
            faceDescriptor: descriptor,
            registeredFace: true
        });

        res.json({ message: 'Face registered successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Mark attendance securely utilizing dynamic QR Token
router.post('/mark', authMiddleware, async (req, res) => {
    try {
        const { descriptor, sessionToken } = req.body;
        if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
            return res.status(400).json({ message: 'Invalid face descriptor' });
        }
        if (!sessionToken) {
            return res.status(403).json({ message: 'Terminal Security: Missing Class QR Token. You must scan the live room QR code.' });
        }
        
        try {
            const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET);
            if (decoded.type !== 'attendance_session') throw new Error('Invalid token type');
        } catch (err) {
            return res.status(403).json({ message: 'QR Code is expired or invalid. Ask the professor to generate a new live session.' });
        }

        const student = await Student.findById(req.user.id);
        if (!student.registeredFace) {
            return res.status(400).json({ message: 'Face not registered yet' });
        }

        const distance = euclideanDistance(descriptor, student.faceDescriptor);
        const threshold = 0.55; // 0.6 is typical, 0.55 is slightly stricter

        if (distance > threshold) {
            return res.status(400).json({ message: 'Face does not match the registered user', distance });
        }

        // Check if attendance already marked today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        
        const existingAttendance = await Attendance.findOne({
            student: req.user.id,
            date: { $gte: startOfDay, $lte: endOfDay }
        });

        if (existingAttendance) {
            return res.status(400).json({ message: 'Attendance already marked for today' });
        }

        const newAttendance = new Attendance({
            student: student._id,
            status: 'Present',
            sessionToken: sessionToken
        });
        await newAttendance.save();
        res.json({ message: 'Attendance successfully marked', distance });

    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Get user's attendance records
router.get('/my-records', authMiddleware, async (req, res) => {
    try {
        const records = await Attendance.find({ student: req.user.id }).sort({ date: -1 });
        res.json(records);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;
