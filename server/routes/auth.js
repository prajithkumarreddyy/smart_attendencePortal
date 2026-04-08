const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const Employee = require('../models/Employee');

const router = express.Router();

// Register a new student
router.post('/register', async (req, res) => {
    try {
        const { name, rollNumber, email, password } = req.body;
        
        let student = await Student.findOne({ $or: [{ email }, { rollNumber }] });
        if (student) return res.status(400).json({ message: 'Student already exists' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        student = new Student({ name, rollNumber, email, password: hashedPassword });
        await student.save();

        const payload = { id: student._id, rollNumber: student.rollNumber };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.json({ token, student: { id: student._id, name, rollNumber, email, registeredFace: false } });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Unified Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Check Admin
        if (username === 'admin' && password === 'ppp') {
            const token = jwt.sign({ id: 'admin', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
            return res.json({ token, user: { role: 'admin', name: 'Administrator', username: 'admin' } });
        }

        // Check Student
        let student = await Student.findOne({ rollNumber: username });
        if (student) {
            const isMatch = await bcrypt.compare(password, student.password);
            if (isMatch) {
                const token = jwt.sign({ id: student._id, role: 'student' }, process.env.JWT_SECRET, { expiresIn: '1d' });
                return res.json({ token, user: { id: student._id, role: 'student', name: student.name, rollNumber: student.rollNumber, email: student.email, registeredFace: student.registeredFace } });
            }
        }

        // Check Employee
        let employee = await Employee.findOne({ username: username });
        if (employee) {
            const isMatch = await bcrypt.compare(password, employee.password);
            if (isMatch) {
                const token = jwt.sign({ id: employee._id, role: 'employee' }, process.env.JWT_SECRET, { expiresIn: '1d' });
                return res.json({ token, user: { id: employee._id, role: 'employee', name: employee.name, department: employee.department, username: employee.username } });
            }
        }

        res.status(400).json({ message: 'Invalid Credentials' });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ message: err.message || 'Server error' });
    }
});

// Get current profile unified
router.get('/me', async (req, res) => {
    try {
         const token = req.header('Authorization');
         if (!token) return res.status(401).json({ message: 'No token, auth denied' });
         
         const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
         
         if (decoded.role === 'admin') {
             return res.json({ role: 'admin', name: 'Administrator', username: 'admin' });
         } else if (decoded.role === 'employee') {
             const employee = await Employee.findById(decoded.id).select('-password');
             return res.json({ ...employee.toObject(), role: 'employee' });
         } else {
             // Fallback to student
             const student = await Student.findById(decoded.id).select('-password');
             return res.json({ ...student.toObject(), role: 'student' });
         }
    } catch (err) {
         res.status(401).json({ message: 'Token is not valid' });
    }
});

module.exports = router;
