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

        // Check if this face already exists under ANY other student
        const allRegisteredStudents = await Student.find({ registeredFace: true, _id: { $ne: req.user.id } });
        for (let student of allRegisteredStudents) {
            const distance = euclideanDistance(descriptor, student.faceDescriptor);
            if (distance < 0.55) {
                return res.status(400).json({ 
                    message: `This face is already registered under Roll No: ${student.rollNumber}. Each face can only be linked to one account.` 
                });
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

// Calculate distance between two points in meters (Haversine formula)
const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Radius of Earth in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
};

// Mark attendance securely utilizing dynamic QR Token
router.post('/mark', authMiddleware, async (req, res) => {
    try {
        const { descriptor, sessionToken, location } = req.body;
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

        // --- GEOFENCING VERIFICATION ---
        const collegeLat = parseFloat(process.env.COLLEGE_LAT);
        const collegeLng = parseFloat(process.env.COLLEGE_LNG);
        const radius = parseFloat(process.env.COLLEGE_RADIUS) || 200;

        if (!location || !location.lat || !location.lng) {
            return res.status(400).json({ message: 'GPS location required to verify you are on campus.' });
        }

        const distance = getDistance(location.lat, location.lng, collegeLat, collegeLng);
        if (distance > radius) {
            return res.status(403).json({ 
                message: `Location Access Denied: You are ${Math.round(distance)}m away from college. Attendance only allowed within ${radius}m of campus.`,
                distance
            });
        }
        // -------------------------------

        const student = await Student.findById(req.user.id);
        if (!student.registeredFace) {
            return res.status(400).json({ message: 'Face not registered yet' });
        }

        // Verify the face matches the logged-in student
        const distanceToSelf = euclideanDistance(descriptor, student.faceDescriptor);
        const threshold = 0.55;

        if (distanceToSelf > threshold) {
            return res.status(400).json({ message: 'Face does not match your registered profile. Proxy attendance is not allowed.', distance: distanceToSelf });
        }

        // Cross-check: ensure this face is not a closer match to ANY other student (anti-proxy)
        const otherStudents = await Student.find({ registeredFace: true, _id: { $ne: req.user.id } });
        for (let other of otherStudents) {
            const distanceToOther = euclideanDistance(descriptor, other.faceDescriptor);
            if (distanceToOther < distanceToSelf) {
                return res.status(400).json({ 
                    message: 'Biometric mismatch: This face more closely matches another registered student. Proxy attendance blocked.' 
                });
            }
        }

        // Check if attendance already marked for this specific session
        const existingAttendance = await Attendance.findOne({
            student: req.user.id,
            sessionToken: sessionToken
        });

        if (existingAttendance) {
            return res.status(400).json({ message: 'Attendance already marked for this session' });
        }

        const newAttendance = new Attendance({
            student: student._id,
            status: 'Present',
            sessionToken: sessionToken,
            date: new Date()
        });
        await newAttendance.save();
        res.json({ message: 'Attendance successfully marked', distance: distanceToSelf, locationDistance: distance });

    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Get user's attendance records with percentage
router.get('/my-records', authMiddleware, async (req, res) => {
    try {
        const records = await Attendance.find({ student: req.user.id }).sort({ date: -1 });
        
        // Calculate percentage: count total unique session tokens globally
        const allAttendance = await Attendance.find({ status: 'Present' });
        const uniqueSessions = new Set(allAttendance.filter(a => a.sessionToken).map(a => a.sessionToken));
        const totalSessions = uniqueSessions.size || 1;
        const presentCount = records.filter(r => r.status === 'Present').length;
        const percentage = Math.round((presentCount / totalSessions) * 100);

        res.json({ records, totalSessions, presentCount, percentage });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;
