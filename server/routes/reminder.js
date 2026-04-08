const express = require('express');
const Reminder = require('../models/Reminder');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get all reminders for the authenticated student
router.get('/', authMiddleware, async (req, res) => {
    try {
        const reminders = await Reminder.find({ student: req.user.id }).sort({ createdAt: -1 });
        res.json(reminders);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Add a new reminder
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { text, dueDate } = req.body;
        if (!text) {
            return res.status(400).json({ message: 'Reminder text is required' });
        }

        const newReminder = new Reminder({
            student: req.user.id,
            text,
            dueDate
        });

        await newReminder.save();
        res.json(newReminder);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Toggle reminder completion status
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const reminder = await Reminder.findOne({ _id: req.params.id, student: req.user.id });
        if (!reminder) {
            return res.status(404).json({ message: 'Reminder not found' });
        }

        reminder.completed = !reminder.completed;
        await reminder.save();
        res.json(reminder);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete a reminder
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const reminder = await Reminder.findOneAndDelete({ _id: req.params.id, student: req.user.id });
        if (!reminder) {
            return res.status(404).json({ message: 'Reminder not found' });
        }
        res.json({ message: 'Reminder deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;
