const mongoose = require('mongoose');
const Student = require('./models/Student');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const student = await Student.findOne({ rollNumber: '2320030484' });
  console.log('Student found:', student ? 'YES' : 'NO');
  process.exit(0);
});
