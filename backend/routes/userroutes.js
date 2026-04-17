const express = require('express');
const { User } = require('../models'); // Sequelize model
const { login , changePassword , getMe, updateMe } = require('../controllers/userController');
const facultyController = require('../controllers/facultyController');
const { facultyAuth } = require('../Middleware/authmiddleware');


//Faculty functionalities
const { addFaculty } = require('../controllers/facultyController');
const { getAllFaculties } = require('../controllers/facultyController');
const { updateFaculty } = require('../controllers/facultyController');
const { deleteFaculty } = require('../controllers/facultyController');



const { authMiddleware, roleMiddleware ,adminAuth } = require('../Middleware/authmiddleware');
const ApiError = require('../utils/ApiError');
const bcrypt = require('bcryptjs');

const router = express.Router();


// ✅ Public route to fetch all users (No auth, for testing/demo)
router.get('/all-users', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const users = await User.findAll();
    res.status(200).json({ status: 'success', data: users });
  } catch (err) {
    next(err);
  }
});


// ✅ Create admin route - using Sequelize + MySQL
router.post('/create-admin', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email ||!phone|| !password) {
      throw new ApiError(400, 'Name, email and password are required');
    }

    // ✅ Check if user already exists (Sequelize + MySQL)
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new ApiError(400, 'User already exists with this email');
    }

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Create admin user
    const newAdmin = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: 'admin'
    });

    res.status(201).json({
      status: 'success',
      message: 'Admin user created',
      data: {
        id: newAdmin.id,
        name: newAdmin.name,
        email: newAdmin.email,
        phone: newAdmin.phone,
        role: newAdmin.role
      }
    });
  } catch (err) {
    next(err);
  }
});

// ✅ Other routes (no change needed)
router.get('/', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const users = await User.findAll();
    res.status(200).json({ status: 'success', data: users });
  } catch (err) {
    next(err);
  }
});



router.delete('/:id', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) throw new ApiError(404, 'User not found');

    await user.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post('/login', login);


router.post('/add-faculty', authMiddleware, roleMiddleware('admin'), addFaculty);
router.get('/faculties', authMiddleware, roleMiddleware('admin'), getAllFaculties);
router.put('/faculties/update/:id', authMiddleware, roleMiddleware('admin'), updateFaculty);
router.delete('/faculties/delete/:id', authMiddleware, roleMiddleware('admin'), deleteFaculty);
router.get('/course/:courseId', facultyAuth, facultyController.getSubmissionsByCourse);
router.get('/faculties/course/:courseId', adminAuth, facultyController.getFacultiesByCourse);
// router.get('/courseforAdminSubmission/:courseId', facultyController.getSubmissionsByCourse);
router.post('/change-password', authMiddleware, changePassword);

// GET current user
router.get('/me', authMiddleware, getMe);

// UPDATE current user
router.put('/me', authMiddleware, updateMe);

module.exports = router;
