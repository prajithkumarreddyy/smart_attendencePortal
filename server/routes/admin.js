const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Student = require('../models/Student');
const Employee = require('../models/Employee');
const Fee = require('../models/Fee');
const Attendance = require('../models/Attendance');

const router = express.Router();

// Middleware for admin routes
const adminAuth = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ message: 'No admin token' });

    try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token invalid' });
    }
};

// Admin metrics
router.get('/metrics', adminAuth, async (req, res) => {
    try {
        const studentCount = await Student.countDocuments();
        const employeeCount = await Employee.countDocuments();
        
        const fees = await Fee.find();
        const totalFeesExpected = fees.reduce((acc, f) => acc + f.totalAmount, 0);
        const totalFeesCollected = fees.reduce((acc, f) => acc + f.paidAmount, 0);

        res.json({
            students: studentCount,
            employees: employeeCount,
            totalFeesExpected,
            totalFeesCollected
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET all students
router.get('/students', adminAuth, async (req, res) => {
    try {
        const students = await Student.find().select('-password -faceDescriptor');
        res.json(students);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Reset student face ID
router.put('/students/:id/reset-face', adminAuth, async (req, res) => {
    try {
        await Student.findByIdAndUpdate(req.params.id, {
            registeredFace: false,
            faceDescriptor: []
        });
        res.json({ message: 'Student face ID reset successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET all active employees
router.get('/employees', adminAuth, async (req, res) => {
    try {
        const employees = await Employee.find();
        res.json(employees);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Create new employee
router.post('/employees', adminAuth, async (req, res) => {
    try {
        const { name, role, department, username, salary, password } = req.body;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password || 'employee123', salt);
        const emp = new Employee({ name, role, department, username, salary, password: hashedPassword });
        await emp.save();
        res.json(emp);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET all fees with student details attached
router.get('/fees', adminAuth, async (req, res) => {
    try {
        const fees = await Fee.find().populate('student', 'name rollNumber');
        res.json(fees);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Create new fee invoice
router.post('/fees', adminAuth, async (req, res) => {
    try {
        const fee = new Fee(req.body);
        await fee.save();
        await fee.populate('student', 'name rollNumber');
        res.json(fee);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Optional: GET global attendance
router.get('/attendance', adminAuth, async (req, res) => {
    try {
        const logs = await Attendance.find().populate('student', 'name rollNumber').sort({ date: -1 });
        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
