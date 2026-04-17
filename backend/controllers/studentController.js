// controllers/studentController.js
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const xlsx = require('xlsx');
const { Op } = require('sequelize');
const db = require('../models');
const { sendMail } = require('../utils/mailer');
const { studentTemplate } = require('../utils/emailTemplates');

const {
  Student,
  Course,
  Batch,            // batches model
  BatchStudent,     // through table (batch_students)
  Submission,       // used in other functions
  StudentCourse,    // through table mapping student <> course (needed)
  QuestionBatch,   // question_batches table mapping question <> batch (needed)
  sequelize
} = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'secretkey';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEMPLATE_TYPES = {
  students: {
    key: 'students',
    defaultFileName: 'students_import_template.csv',
    defaultMimeType: 'text/csv',
    headers: ['Name', 'Email', 'Phone'],
    sampleRows: [
      ['John Doe', 'john@example.com', '9876543210'],
      ['Jane Smith', 'jane@example.com', '9876543211']
    ]
  }
};
const TEMPLATE_DIR = path.join(__dirname, '..', 'uploads', 'templates');
const TEMPLATE_INDEX_PATH = path.join(TEMPLATE_DIR, 'template-index.json');

// ------------------------------ helpers ------------------------------
const toInt = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};

const findBatchByIdOrCode = async ({ batchId, batch_code, courseId }) => {
  if (batchId) {
    const b = await Batch.findByPk(batchId);
    return b && (!courseId || b.course_id === courseId) ? b : null;
  }
  if (batch_code) {
    const where = { code: batch_code };
    if (courseId) where.course_id = courseId;
    return await Batch.findOne({ where });
  }
  return null;
};

const generatePassword = (email, phone) => {
  const base = (email || '').split('@')[0] || 'student';
  const tail = (phone || '').slice(-4) || '1234';
  return `${base}${tail}`;
};

const ensureTemplateStore = () => {
  if (!fs.existsSync(TEMPLATE_DIR)) {
    fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEMPLATE_INDEX_PATH)) {
    fs.writeFileSync(TEMPLATE_INDEX_PATH, JSON.stringify({}, null, 2), 'utf8');
  }
};

const readTemplateIndex = () => {
  ensureTemplateStore();
  try {
    return JSON.parse(fs.readFileSync(TEMPLATE_INDEX_PATH, 'utf8') || '{}');
  } catch {
    return {};
  }
};

const writeTemplateIndex = (value) => {
  ensureTemplateStore();
  fs.writeFileSync(TEMPLATE_INDEX_PATH, JSON.stringify(value || {}, null, 2), 'utf8');
};

const getTemplateTypeConfig = (templateType = '') => {
  const key = String(templateType).trim().toLowerCase();
  return TEMPLATE_TYPES[key] || null;
};

// ------------------------------ AUTH ------------------------------
exports.loginStudent = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    const student = await Student.findOne({ where: { email: normalizedEmail } });
    if (!student) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, student.password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: student.id, role: 'student' }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(200).json({
      token,
      user: {
        id: student.id,
        name: student.name,
        email: student.email,
        role: 'student'
      }
    });
  } catch (err) {
    next(err);
  }
};

// ------------------------------ READ: all / filtered ------------------------------
// GET /api/students/get-all-students?courseId=&batchId=&sort=name|email
// GET /api/students/get-all-students
// Returns every student and their assigned batches (id, name, code)
exports.getAllStudents = async (req, res, next) => {
  try {
    // optional: limit/offset or filtering if table is very large
    const students = await Student.findAll({
      attributes: ['id', 'name', 'email', 'phone'],
      include: [
        {
          model: Batch,
          through: { attributes: [] },   // hide junction columns
          attributes: ['id', 'name', 'code']
        }
      ],
      order: [['name', 'ASC']]
    });

    // normalize to plain objects and expose batches as `batches`
    const out = (students || []).map(s => {
      const plain = s.toJSON ? s.toJSON() : s;
      // Sequelize will usually place associated batches under 'Batches' or 'batches' depending on association config.
      const rawBatches = plain.Batches || plain.batches || [];
      plain.batches = Array.isArray(rawBatches) ? rawBatches.map(b => ({ id: b.id, name: b.name, code: b.code })) : [];
      return plain;
    });

    return res.status(200).json({ success: true, students: out });
  } catch (err) {
    console.error('getAllStudents error', err);
    return res.status(500).json({ success: false, message: 'Failed to load students', error: err.message });
  }
};

// ------------------------------ CREATE: single ------------------------------
// POST /api/students/add
// Body: { name, email, phone, course_code, [batchId], [batch_code] }
exports.addStudent = async (req, res, next) => {
  try {
    const { name, email, phone, course_code, batchId, batch_code } = req.body;
    if (!name || !email || !course_code) {
      return res.status(400).json({ success: false, message: 'Name, email and course_code are required' });
    }

    const course = await Course.findOne({ where: { course_code } });
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const existing = await Student.findOne({ where: { email } });
    if (existing) {
      // If a student exists, optionally assign to batch if provided
      if (batchId || batch_code) {
        const batch = await findBatchByIdOrCode({ batchId: Number(batchId), batch_code, courseId: course.id });
        if (batch) {
          await existing.addBatch(batch).catch(() => { });
        }
      }
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }

    // create a random/default password for the student
    // if you prefer a fixed default, replace with that value (not recommended)
    // const rawPassword = generatePassword(email, phone); // uses helper in file
    const rawPassword = "ict1234!";
    const hashed = await bcrypt.hash(rawPassword, 10);

    // create student record
    const student = await Student.create({ name, email, phone, password: hashed });

    // add to course (student-course relationship)
    if (typeof student.addCourse === 'function') {
      await student.addCourse(course);
    } else {
      // fallback: if you use a join table, create entry there as necessary
    }

    // add batch if provided
    const batch = await findBatchByIdOrCode({ batchId: Number(batchId), batch_code, courseId: course.id });
    if (batch) {
      try { await student.addBatch(batch); } catch (e) { /* ignore duplicate error */ }
    }

    // Send welcome email (non-blocking behavior: we attempt and continue even if mail fails)
    try {
      const html = studentTemplate({ name: student.name || '', email: student.email, password: rawPassword });
      await sendMail({ to: student.email, subject: 'Welcome to ICT Portal — Student', html });
    } catch (mailErr) {
      console.error('Failed to send student welcome email', mailErr);
      // do not fail the request because of email issues
    }

    return res.status(201).json({ success: true, student });
  } catch (err) {
    next(err);
  }
};

// ------------------------------ BULK TEMPLATE MANAGEMENT ------------------------------
// GET /api/students/templates/:templateType
exports.getUploadTemplateMeta = async (req, res) => {
  try {
    const templateType = req.params.templateType;
    const config = getTemplateTypeConfig(templateType);
    if (!config) return res.status(400).json({ success: false, message: 'Unsupported template type' });

    const index = readTemplateIndex();
    const meta = index[config.key] || null;
    return res.status(200).json({
      success: true,
      templateType: config.key,
      hasCustomTemplate: !!meta,
      template: meta
        ? {
            fileName: meta.fileName,
            mimeType: meta.mimeType,
            uploadedAt: meta.uploadedAt,
            uploadedBy: meta.uploadedBy
          }
        : null
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to load template metadata', error: err.message });
  }
};

// POST /api/students/templates/:templateType
exports.uploadTemplateFile = async (req, res) => {
  try {
    const templateType = req.params.templateType;
    const config = getTemplateTypeConfig(templateType);
    if (!config) return res.status(400).json({ success: false, message: 'Unsupported template type' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No template file uploaded' });

    const ext = path.extname(req.file.originalname || '').toLowerCase();
    const allowedExt = new Set(['.csv', '.xls', '.xlsx']);
    if (!allowedExt.has(ext)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(400).json({ success: false, message: 'Template must be .csv, .xls, or .xlsx' });
    }

    ensureTemplateStore();
    const savedName = `${config.key}_${Date.now()}${ext}`;
    const savedPath = path.join(TEMPLATE_DIR, savedName);
    fs.renameSync(req.file.path, savedPath);

    const index = readTemplateIndex();
    const previous = index[config.key];
    if (previous?.path) {
      const oldPath = path.join(TEMPLATE_DIR, previous.path);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch (e) {}
      }
    }

    index[config.key] = {
      fileName: req.file.originalname,
      mimeType: req.file.mimetype || 'application/octet-stream',
      path: savedName,
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.user?.id || null
    };
    writeTemplateIndex(index);

    return res.status(200).json({
      success: true,
      message: 'Template uploaded successfully',
      template: {
        fileName: index[config.key].fileName,
        mimeType: index[config.key].mimeType,
        uploadedAt: index[config.key].uploadedAt,
        uploadedBy: index[config.key].uploadedBy
      }
    });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    return res.status(500).json({ success: false, message: 'Failed to upload template', error: err.message });
  }
};

// GET /api/students/templates/:templateType/download
exports.downloadUploadTemplate = async (req, res) => {
  try {
    const templateType = req.params.templateType;
    const config = getTemplateTypeConfig(templateType);
    if (!config) return res.status(400).json({ success: false, message: 'Unsupported template type' });

    const index = readTemplateIndex();
    const meta = index[config.key];
    if (meta?.path) {
      const fullPath = path.join(TEMPLATE_DIR, meta.path);
      if (fs.existsSync(fullPath)) {
        return res.download(fullPath, meta.fileName || config.defaultFileName);
      }
    }

    const csvContent = [
      config.headers.join(','),
      ...config.sampleRows.map((r) => r.join(','))
    ].join('\n');
    res.setHeader('Content-Type', config.defaultMimeType);
    res.setHeader('Content-Disposition', `attachment; filename=\"${config.defaultFileName}\"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to download template', error: err.message });
  }
};

// ------------------------------ BULK UPLOAD ------------------------------
// POST /api/students/upload (multer: file, fields: course_code, [batchId],[batch_code])
exports.uploadStudents = async (req, res, next) => {
  let unlinkPath = null;
  try {
    const { course_code, batchId, batch_code } = req.body;

    const course = await Course.findOne({ where: { course_code } });
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const filePath = req.file.path;
    unlinkPath = filePath;

    const xlsx = require('xlsx');
    const wb = xlsx.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws); // expected columns: Name, Email, Phone
    console.log(`[BulkUpload] Parsed ${rows.length} rows from file.`);
    console.log(`[BulkUpload] First row sample:`, rows[0]);

    // find target batch (if any) once up front
    const batch = await findBatchByIdOrCode({ batchId: Number(batchId), batch_code, courseId: course.id });

    const created = [];
    const assignedExisting = []; // track existing students that were assigned to the batch
    const failures = [];

    for (const [index, r] of rows.entries()) {
      try {
        console.log(`[BulkUpload] Processing row ${index + 1}:`, r);
        const name = String(r.Name || r.name || '').trim();
        const email = String(r.Email || r.email || '').trim().toLowerCase();
        const phone = String(r.Phone || r.phone || '').trim();
        if (!name || !email) continue;

        const exists = await Student.findOne({ where: { email } });
        if (exists) {
          // ensure they belong to course (or batch)
          if (batch) {
            try { await exists.addBatch(batch); assignedExisting.push(exists); } catch (e) { }
          } else {
            try { await exists.addCourse(course); assignedExisting.push(exists); } catch (e) { }
          }
          continue;
        }

        // create a password for this student
        const rawPassword = generatePassword(email, phone);
        const password = await bcrypt.hash(rawPassword, 10);

        const st = await Student.create({ name, email, phone, password });

        // Prefer adding to the specific batch (if provided & valid), otherwise add to the course
        if (batch) {
          await st.addBatch(batch);
        } else {
          await st.addCourse(course);
        }

        created.push({ st, rawPassword });
      } catch (innerErr) {
        console.error('row create error', innerErr);
        failures.push({ row: r, error: String(innerErr.message || innerErr) });
      }
    }

    // Send emails for newly created students (do not fail overall if email fails)
    try {
      const sendTasks = created.map(({ st, rawPassword }) =>
        sendMail({
          to: st.email,
          subject: 'Your student account — ICT Portal',
          html: studentTemplate({ name: st.name, email: st.email, password: rawPassword })
        }).catch(err => {
          console.warn('Failed to send email to', st.email, err && err.message ? err.message : err);
          return null;
        })
      );
      // run in parallel but wait for completion to log errors
      await Promise.all(sendTasks);
    } catch (e) {
      console.warn('bulk email sending encountered errors', e);
    }

    const totalAssigned = created.length + assignedExisting.length;
    return res.status(200).json({
      success: true,
      message: `Uploaded ${created.length} new students` + (assignedExisting.length ? `, assigned ${assignedExisting.length} existing students to batch` : ''),
      count: created.length,
      assignedExisting: assignedExisting.length,
      totalAssigned,
      failures
    });
  } catch (err) {
    next(err);
  } finally {
    if (unlinkPath) {
      try { require('fs').unlinkSync(unlinkPath); } catch (e) { }
    }
  }
};


// ------------------------------ UPDATE student (+ optional batch op) ------------------------------
// PUT /api/students/update/:id
// Body: { name?, email?, phone?, batchOp?: 'add'|'remove', batchId?, batch_code? }
exports.updateStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, phone, batchOp, batchId, batch_code } = req.body;

    const student = await Student.findByPk(id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    if (name != null) student.name = name;
    if (email != null) student.email = email;
    if (phone != null) student.phone = phone;
    await student.save();

    if (batchOp === 'add' || batchOp === 'remove') {
      const batch = await findBatchByIdOrCode({ batchId: toInt(batchId), batch_code });
      if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
      if (batchOp === 'add') await student.addBatch(batch);
      if (batchOp === 'remove') await student.removeBatch(batch);
    }

    return res.status(200).json({ success: true, student });
  } catch (err) {
    next(err);
  }
};

// ------------------------------ DELETE: remove from course (or a batch) ------------------------------
// DELETE /api/students/remove/:studentId/:courseId
// Optional query: ?batchId= -> only remove from that batch
exports.removeStudentFromCourse = async (req, res, next) => {
  // try to use a transaction if sequelize is available, otherwise proceed without one
  const useTx = !!(sequelize && typeof sequelize.transaction === 'function');
  const tx = useTx ? await sequelize.transaction() : null;

  try {
    const { studentId, courseId } = req.params;
    const { batchId } = req.query || {};

    const [student, course] = await Promise.all([
      Student.findByPk(studentId, { transaction: tx }),
      Course.findByPk(courseId, { transaction: tx }),
    ]);

    if (!student) {
      if (tx) await tx.rollback();
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    if (!course) {
      if (tx) await tx.rollback();
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    if (batchId) {
      // remove student from a specific batch only
      const batch = await Batch.findByPk(Number(batchId), { transaction: tx });
      if (!batch) {
        if (tx) await tx.rollback();
        return res.status(404).json({ success: false, message: 'Batch not found' });
      }

      await batch.removeStudent(student, { transaction: tx });
      if (tx) await tx.commit();
      return res.status(200).json({ success: true, message: 'Student removed from batch' });
    }

    // Remove association between student and course first
    // (uses magic association method created by Sequelize)
    if (typeof student.removeCourse === 'function') {
      await student.removeCourse(course, { transaction: tx });
    } else {
      // fallback: remove from join table if you have one (optional)
      // no-op if association method missing
    }

    // Remove batch-student rows for all batches that belong to this course
    const courseBatches = await Batch.findAll({
      where: { course_id: course.id },
      attributes: ['id'],
      transaction: tx,
    });

    if (courseBatches && courseBatches.length > 0) {
      const batchIds = courseBatches.map(b => b.id);
      await BatchStudent.destroy({
        where: { student_id: student.id, batch_id: { [Op.in]: batchIds } },
        transaction: tx,
      });
    }

    // Finally delete the student record from DB
    await Student.destroy({ where: { id: student.id }, transaction: tx });

    if (tx) await tx.commit();
    return res.status(200).json({ success: true, message: 'Student deleted from course and removed from database' });
  } catch (err) {
    if (tx) {
      try { await tx.rollback(); } catch (e) { /* ignore rollback error */ }
    }
    next(err);
  }
};

// ------------------------------ Student’s courses + exam status -----------------------------
exports.coursesWithExams = async (req, res) => {
  try {
    console.log('[coursesWithExams] Request received:', {
      user: req.user,
      studentId: req.user?.id,
      hasUser: !!req.user
    });

    const studentId = req.user?.id;
    if (!studentId) {
      console.error('[coursesWithExams] No studentId found in req.user:', req.user);
      return res.status(401).json({ message: 'Student not authenticated' });
    }

    console.log('[coursesWithExams] Processing for student:', studentId);

    // use model instances from db
    const BatchStudent = db.BatchStudent || db.batchstudents || db.BatchStudents;
    const Batch = db.Batch || db.batches;
    const QuestionBatch = db.QuestionBatch || db.questionbatches || db.QuestionBatches;
    const Course = db.Course || db.courses;

    if (!BatchStudent || !Batch || !QuestionBatch || !Course) {
      console.error('coursesWithExams: missing model exports', {
        BatchStudent: !!BatchStudent,
        Batch: !!Batch,
        QuestionBatch: !!QuestionBatch,
        Course: !!Course
      });
      return res.status(500).json({ message: 'Server misconfigured: models not found' });
    }

    // 1) find batch IDs the student belongs to
    const bsRows = await BatchStudent.findAll({
      where: { student_id: studentId },
      attributes: ['batch_id']
    });
    const batchIds = Array.from(new Set((bsRows || []).map(r => r.batch_id ?? r.batchId).filter(Boolean)));
    if (!batchIds.length) {
      return res.json({ courses: [] });
    }

    // 2) load batches to get course_ids
    const batches = await Batch.findAll({
      where: { id: batchIds },
      attributes: ['id', 'course_id']
    });
    const courseIds = Array.from(new Set((batches || []).map(b => b.course_id ?? b.courseId).filter(Boolean)));
    if (!courseIds.length) return res.json({ courses: [] });

    // 3) find enabled/toggled question_batches for student's batches
    const toggledQBs = await QuestionBatch.findAll({
      where: {
        batch_id: batchIds,
        enabled: true
      },
      attributes: ['batch_id']
    });
    const batchesWithEnabled = new Set((toggledQBs || []).map(q => q.batch_id ?? q.batchId).filter(Boolean));

    // 4) build course list with hasExam true if any student's batch in that course is in batchesWithEnabled
    const courses = await Course.findAll({
      where: { id: courseIds },
      attributes: ['id', 'name', 'course_code']
    });

    const courseMap = {};
    courses.forEach(c => {
      const cid = c.id ?? c.course_id;
      courseMap[cid] = {
        course_id: cid,
        course_name: c.name ?? c.course_name ?? '',
        course_code: c.course_code ?? c.courseCode ?? '',
        hasExam: false
      };
    });

    batches.forEach(b => {
      const bid = b.id ?? b.batch_id;
      const cid = b.course_id ?? b.courseId;
      if (!cid) return;
      if (batchesWithEnabled.has(bid)) {
        if (!courseMap[cid]) {
          courseMap[cid] = { course_id: cid, course_name: '', course_code: '', hasExam: true };
        } else {
          courseMap[cid].hasExam = true;
        }
      }
    });

    const out = Object.values(courseMap);
    console.log('[coursesWithExams] Success - returning courses:', out.length);
    return res.json({ courses: out });
  } catch (err) {
    console.error('[coursesWithExams] Error:', err.message);
    console.error('[coursesWithExams] Stack:', err.stack);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/* ======================= HELPERS / BATCH APIs ======================= */

// GET /api/students/by-course/:courseId
// Returns students for the course and includes their batches (id, name, code)
exports.getStudentsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const sort = req.query.sort === 'email' ? 'email' : 'name';

    const course = await Course.findByPk(courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    // Use Course.getStudents with include to attach batch info via the junction table.
    // If your Sequelize associations use different names, adjust 'Batch' to the model as exported.
    const students = await course.getStudents({
      attributes: ['id', 'name', 'email', 'phone'],
      include: [
        {
          model: Batch,
          through: { attributes: [] },          // hide join table columns
          attributes: ['id', 'name', 'code']   // only return these batch fields
        }
      ]
    });

    // Optional: sort client-side by name/email (keep consistent with other endpoints)
    const key = sort || 'name';
    const sorted = (students || []).sort((a, b) =>
      String(a[key] || '').localeCompare(String(b[key] || ''), undefined, { sensitivity: 'base' })
    );

    // Normalize Sequelize instances into plain objects (so frontend receives .batches array)
    const out = sorted.map(s => {
      const plain = s.toJSON ? s.toJSON() : s;
      // ensure batches property exists and is an array
      plain.batches = Array.isArray(plain.Batches) ? plain.Batches.map(b => ({ id: b.id, name: b.name, code: b.code })) : (plain.batches || []);
      // Also keep backwards compatible "batches" field if the association name is different
      if (!plain.batches.length && Array.isArray(plain.batches)) { /* no-op */ }
      return plain;
    });

    return res.status(200).json({ success: true, students: out });
  } catch (e) {
    console.error('getStudentsByCourse', e);
    return res.status(500).json({ message: 'Failed to load students', error: e.message });
  }
};


// POST /api/students/batches/:courseId
// POST /api/students/batches/:courseId
// POST /api/students/batches/:courseId
exports.createBatch = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { name, code, start_date, end_date, is_active } = req.body;

    // name is mandatory
    if (!name || !name.toString().trim()) {
      return res.status(400).json({ success: false, message: 'Batch name is required' });
    }
    const nameTrim = name.toString().trim();

    // Normalize code: treat empty/whitespace as null (meaning "no code")
    const codeTrim = code && typeof code === 'string' && code.toString().trim() ? code.toString().trim() : null;

    // Ensure course exists
    const course = await Course.findByPk(courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    // SERVER-SIDE DUPLICATE CHECK (only when a code is provided)
    // Only block when course_id, name and code ALL match an existing row
    if (codeTrim !== null) {
      const existing = await Batch.findOne({
        where: {
          course_id: courseId,
          name: nameTrim,
          code: codeTrim
        }
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'A batch with the same name and code already exists for this course'
        });
      }
    }

    // Create (code will be null if not provided)
    const batch = await Batch.create({
      course_id: courseId,
      name: nameTrim,
      code: codeTrim,
      start_date: start_date || null,
      end_date: end_date || null,
      is_active: is_active !== false
    });

    return res.status(201).json({ success: true, batch });
  } catch (err) {
    // Friendly handling for unique constraint errors that might still come from DB
    if (err && err.name && (err.name === 'SequelizeUniqueConstraintError' || err.name === 'UniqueConstraintError')) {
      return res.status(400).json({
        success: false,
        message: 'Batch already exists (unique constraint). Try a different code or name.'
      });
    }
    next(err);
  }
};


// GET /api/students/batches/:courseId
// (note: routes file calls this; return attributes expected by frontend)
exports.getBatchesForCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const batches = await Batch.findAll({
      where: {
        course_id: courseId,
        is_active: true           // <-- only return active sub-batches
      },
      order: [['created_at', 'DESC']],
      attributes: ['id', 'name', 'code', 'is_active', 'start_date', 'end_date', 'course_id']
    });
    res.status(200).json({ success: true, batches });
  } catch (e) { next(e); }
};



//Get batches for batch details page
exports.getBatchesForBatchManagement = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    // Return ALL batches (active + inactive) for the given course
    const batches = await Batch.findAll({
      where: { course_id: courseId },
      order: [['created_at', 'DESC']],
      attributes: ['id', 'name', 'code', 'is_active', 'start_date', 'end_date', 'course_id']
    });

    res.status(200).json({ success: true, batches });
  } catch (e) {
    next(e);
  }
};


// GET /api/students/batch/:batchId
exports.getStudentsInBatch = async (req, res, next) => {
  try {
    const { batchId } = req.params;
    const sort = req.query.sort === 'email' ? 'email' : 'name';
    const batch = await Batch.findByPk(batchId, {
      include: [{ model: Student, through: { attributes: [] }, attributes: ['id', 'name', 'email', 'phone'] }]
    });
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
    const students = (batch.Students || []).sort((a, b) =>
      String(a[sort] || '').localeCompare(String(b[sort] || ''), undefined, { sensitivity: 'base' })
    );
    res.status(200).json({ success: true, students });
  } catch (e) { next(e); }
};

// POST /api/students/:studentId/assign-batch/:batchId
exports.assignStudentToBatch = async (req, res, next) => {
  try {
    const { studentId, batchId } = req.params;
    const [student, batch] = await Promise.all([
      Student.findByPk(studentId),
      Batch.findByPk(batchId)
    ]);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
    await batch.addStudent(student);
    res.status(200).json({ success: true, message: 'Student assigned to batch' });
  } catch (e) { next(e); }
};

// DELETE /api/students/:studentId/batch/:batchId
exports.removeStudentFromBatch = async (req, res, next) => {
  try {
    const { studentId, batchId } = req.params;
    const [student, batch] = await Promise.all([
      Student.findByPk(studentId),
      Batch.findByPk(batchId)
    ]);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
    await batch.removeStudent(student);
    res.status(200).json({ success: true, message: 'Student removed from batch' });
  } catch (e) { next(e); }
};

/* ========== NEW: Update batch (name/code/dates/is_active) ========== */
// PUT /api/students/batches/:batchId
exports.updateBatch = async (req, res, next) => {
  try {
    const { batchId } = req.params;
    const { name, code, start_date, end_date, is_active } = req.body;

    const batch = await Batch.findByPk(batchId);
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

    // If name/code provided and conflict might occur, check uniqueness for same course
    if ((name && name !== batch.name) || (code && code !== batch.code)) {
      const conflict = await Batch.findOne({
        where: {
          course_id: batch.course_id,
          name: name != null ? name : batch.name,
          code: code != null ? code : batch.code,
          id: { [Op.ne]: batch.id }
        }
      });
      if (conflict) {
        return res.status(400).json({ success: false, message: 'Another batch with same name & code exists for this course' });
      }
    }

    if (name != null) batch.name = name;
    if (code != null) batch.code = code;
    if (start_date !== undefined) batch.start_date = start_date || null;
    if (end_date !== undefined) batch.end_date = end_date || null;
    if (is_active !== undefined) batch.is_active = !!is_active;

    await batch.save();
    return res.status(200).json({ success: true, batch });
  } catch (err) {
    if (err && err.name && (err.name === 'SequelizeUniqueConstraintError' || err.name === 'UniqueConstraintError')) {
      return res.status(400).json({ success: false, message: 'Batch update would violate unique constraint' });
    }
    next(err);
  }
};


// DELETE /api/students/batches/:batchId
exports.deleteBatch = async (req, res, next) => {
  // use transaction if available
  const useTx = !!(sequelize && typeof sequelize.transaction === 'function');
  const tx = useTx ? await sequelize.transaction() : null;

  try {
    const { batchId } = req.params;
    const batch = await Batch.findByPk(batchId, { transaction: tx });
    if (!batch) {
      if (tx) await tx.rollback();
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    // remove any associations in join tables (BatchStudent, QuestionBatch) to avoid FK issues
    // adjust column names if your models use camelCase vs snake_case
    try {
      if (typeof BatchStudent !== 'undefined' && BatchStudent.destroy) {
        await BatchStudent.destroy({ where: { batch_id: batch.id }, transaction: tx });
      }
    } catch (err) {
      // ignore if model/table doesn't exist or other minor issue; we'll still try to delete batch
    }

    try {
      if (typeof QuestionBatch !== 'undefined' && QuestionBatch.destroy) {
        await QuestionBatch.destroy({ where: { batch_id: batch.id }, transaction: tx });
      }
    } catch (err) {
      // ignore
    }

    // Finally delete the batch row
    await Batch.destroy({ where: { id: batch.id }, transaction: tx });

    if (tx) await tx.commit();
    return res.status(200).json({ success: true, message: 'Batch deleted' });
  } catch (err) {
    if (tx) {
      try { await tx.rollback(); } catch (e) { /* ignore rollback error */ }
    }
    next(err);
  }
};


// ================== GET/UPDATE Student Profile ==================
// GET /api/students/me
exports.getStudentMe = async (req, res) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const student = await Student.findByPk(studentId, {
      attributes: { exclude: ['password'] }
    });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    return res.json({ success: true, data: student });
  } catch (err) {
    console.error('getStudentMe error', err);
    return res.status(500).json({ success: false, message: 'Failed to load profile' });
  }
};

// PUT /api/students/me
exports.updateStudentMe = async (req, res) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const { name, email, phone } = req.body;
    const student = await Student.findByPk(studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    if (name !== undefined) student.name = name;
    if (email !== undefined) student.email = email;
    if (phone !== undefined) student.phone = phone;

    await student.save();
    return res.json({ success: true, data: student });
  } catch (err) {
    console.error('updateStudentMe error', err);
    return res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

// POST /api/students/change-password
exports.changeStudentPassword = async (req, res) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both current and new password are required' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }

    const student = await Student.findByPk(studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const ok = await bcrypt.compare(currentPassword, student.password);
    if (!ok) return res.status(400).json({ success: false, message: 'Current password is incorrect' });

    student.password = await bcrypt.hash(newPassword, 10);
    await student.save();

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('changeStudentPassword error', err);
    return res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};

// DELETE /api/students/me
exports.deleteStudentMe = async (req, res) => {
  const useTx = !!(sequelize && typeof sequelize.transaction === 'function');
  const tx = useTx ? await sequelize.transaction() : null;
  try {
    const studentId = req.user?.id;
    if (!studentId) {
      if (tx) await tx.rollback();
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const student = await Student.findByPk(studentId, { transaction: tx });
    if (!student) {
      if (tx) await tx.rollback();
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    await BatchStudent.destroy({ where: { student_id: studentId }, transaction: tx });
    await StudentCourse.destroy({ where: { student_id: studentId }, transaction: tx });
    await Submission.destroy({ where: { student_id: studentId }, transaction: tx });
    await Student.destroy({ where: { id: studentId }, transaction: tx });

    if (tx) await tx.commit();
    return res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (err) {
    if (tx) {
      try { await tx.rollback(); } catch (e) { }
    }
    console.error('deleteStudentMe error', err);
    return res.status(500).json({ success: false, message: 'Failed to delete account' });
  }
};


