const { User ,Batch ,  Course } = require('../models');



// Create course
exports.createCourse = async (req, res) => {
  try {
    const { name, course_code, description, is_active, allowed_violations } = req.body;

    if (!name || !course_code) {
      return res.status(400).json({ message: 'Name and course_code are required' });
    }

    const existing = await Course.findOne({ where: { course_code } });
    if (existing) return res.status(400).json({ message: 'Course code already exists' });

    // Use provided allowed_violations or default (model default will apply if undefined)
    const course = await Course.create({
      name,
      course_code,
      description,
      is_active,
      allowed_violations: typeof allowed_violations !== 'undefined' ? Number(allowed_violations) : undefined
    });
    res.status(201).json({ message: 'Course created', course });
  } catch (error) {
    console.error('Course creation error:', error);
    res.status(500).json({ message: 'Error creating course', error: error.message });
  }
};

// Get all courses
// exports.getAllCourses = async (req, res) => {
//   try {
//     const courses = await Course.findAll();
//     res.status(200).json(courses);
//   } catch (error) {
//     res.status(500).json({ message: 'Error fetching courses', error });
//   }
// };

exports.getAllActiveCourses = async (req, res) => {
  try {
    const courses = await Course.findAll({
      where: { is_active: true },
      attributes: ['id', 'name', 'course_code', 'description', 'is_active', 'allowed_violations'],
      include: [
        {
          model: User,
          as: 'Faculties',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ],
      order: [['name', 'ASC']]
    });

    // respond with the same shape your frontend expects
    return res.json({ courses });
  } catch (error) {
    console.error('getAllCourses error:', error);
    return res.status(500).json({ message: 'Failed to fetch courses' });
  }
};

exports.getAllCourses = async (req, res) => {
  try {
    // If you want to restrict to admins server-side, you can check req.user here:
    // if (!req.user || !req.user.isAdmin) return res.status(403).json({ message: 'Forbidden' });

    const courses = await Course.findAll({
      // no where -> returns all rows
      attributes: ['id', 'name', 'course_code', 'description', 'is_active', 'allowed_violations'],
      include: [
        {
          model: User,
          as: 'Faculties',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ],
      order: [['name', 'ASC']]
    });

    return res.json({ courses });
  } catch (error) {
    console.error('getAllCoursesAll error:', error);
    return res.status(500).json({ message: 'Failed to fetch all courses' });
  }
};



// ✅ Update a course
exports.updateCourse = async (req, res) => {
  try {
    const { name, description, is_active, course_code, allowed_violations } = req.body;

    const course = await Course.findByPk(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    // If course_code is being updated, check for duplicates
    if (course_code && course_code !== course.course_code) {
      const existing = await Course.findOne({ where: { course_code } });
      if (existing) {
        return res.status(400).json({ message: 'Course code already in use' });
      }
      course.course_code = course_code;
    }

    course.name = name || course.name;
    course.description = description || course.description;
    course.is_active = typeof is_active === 'boolean' ? is_active : course.is_active;

    // Update allowed_violations if provided
    if (typeof allowed_violations !== 'undefined') {
      course.allowed_violations = Number(allowed_violations);
    }

    await course.save();

    res.status(200).json({ message: 'Course updated', course });
  } catch (error) {
    res.status(500).json({ message: 'Error updating course', error });
  }
};


// ✅ Delete a course
exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    await course.destroy();
    res.status(200).json({ message: 'Course deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting course', error });
  }
};


// Assign faculties to a course
// ============ NEW: assign multiple faculties to a course ============
exports.assignFacultiesToCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    let { facultyIds } = req.body; // expects an array of user ids

    if (!Array.isArray(facultyIds)) {
      return res.status(400).json({ success: false, message: 'facultyIds must be an array' });
    }

    const course = await Course.findByPk(courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    // Filter to valid faculty users
    const faculties = await User.findAll({
      where: { id: facultyIds, role: 'faculty' }
    });

    // Replace previous assignments with the new list (use addFaculties if you want to append)
    await course.setFaculties(faculties);

    // Return the updated list
    const updated = await Course.findByPk(courseId, {
      include: [{ model: User, as: 'Faculties', attributes: ['id', 'name', 'email', 'phone'] }]
    });

    return res.status(200).json({ success: true, course: updated });
  } catch (err) {
    console.error('assignFacultiesToCourse error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ============ NEW: get one course with its assigned faculties ============
exports.getCourseWithFaculties = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findByPk(id, {
      include: [{ model: User, as: 'Faculties', attributes: ['id', 'name', 'email', 'phone'] }]
    });
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    return res.status(200).json({ success: true, course });
  } catch (err) {
    console.error('getCourseWithFaculties error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};




// Get all courses for logged-in faculty
exports.getCoursesForFaculty = async (req, res) => {
  try {
    const facultyId = req.user.id;
    if (!facultyId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }


    const facultyWithCourses = await User.findByPk(facultyId, {
      include: [
        {
          model: Course,
          as: 'FacultyCourses',
          through: { attributes: [] }, // exclude junction table details
          where: { is_active: true },  // <<< only active courses
          required: false
        }
      ]
    });

    if (!facultyWithCourses) {
      return res.status(404).json({ message: 'Faculty not found' });
    }

    res.status(200).json({
      message: 'Courses fetched successfully',
      courses: facultyWithCourses.FacultyCourses || []
    });
  } catch (error) {
    console.error('Error fetching courses for faculty:', error);
    res.status(500).json({ message: 'Error fetching courses', error: error.message });
  }
};


// Get a single course by ID for admin
exports.getCourseByIdForAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findByPk(id);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    res.status(200).json({ success: true, course });
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ Get single course by ID
exports.getCourseById = async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.status(200).json(course);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching course', error });
  }
};


exports.getBatchesForFaculty = async (req, res) => {
  try {
    const facultyId = req.user && req.user.id;
    if (!facultyId) return res.status(401).json({ message: 'Unauthorized' });

    // find courses assigned to faculty
    const courses = await Course.findAll({
      include: [{ model: User, as: 'Faculties', where: { id: facultyId }, attributes: ['id'] }],
      attributes: ['id', 'name', 'course_code'],
      where: { is_active: true }
    });

    const courseIds = courses.map(c => c.id);
    if (courseIds.length === 0) return res.status(200).json({ success: true, batches: [] });

    const batches = await Batch.findAll({
      where: { course_id: courseIds },
      include: [{ model: Course, as: 'Course', attributes: ['id', 'name', 'course_code'] }],
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({ success: true, batches });
  } catch (err) {
    console.error('getBatchesForFaculty:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get faculties for a specific course
exports.getFacultiesForCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    // ensure course exists and is active (unless admin)
    const requester = req.user || null;
    const allowAll = requester && (requester.role === 'admin' || requester.isAdmin);

    const course = await Course.findByPk(courseId);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    if (!allowAll && !course.is_active) return res.status(404).json({ message: 'Course not found' });

    const courseWithFaculties = await Course.findByPk(courseId, {
      include: [{ model: User, as: 'Faculties', attributes: ['id','name','email','phone'] }]
    });

    res.json({ faculties: courseWithFaculties.Faculties || [] });
  } catch (e) {
    console.error('getFacultiesForCourse', e);
    res.status(500).json({ message: 'Failed to load faculties' });
  }
};
