// backend/excelexports/controllers/exportController.js
const ExcelJS = require('exceljs');
const db = require('../../models'); // adjust if your project uses a different path
const { Op } = require('sequelize');

const Course = db.Course;
const Batch = db.Batch;
const Submission = db.Submission;
const Student = db.Student;
const Question = db.Question;

// support different join-table model names
const BatchStudent = db.BatchStudent || db.batchstudents || db.batch_students || db.BatchStudents;

// helper
function safeVal(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }
  return String(v);
}

/**
 * listCourses (unchanged)
 */
exports.listCourses = async (req, res) => {
  try {
    const courses = await Course.findAll({
      attributes: ['id', 'name', 'course_code', 'description'],
      order: [['id', 'ASC']],
    });
    return res.status(200).json({ success: true, courses });
  } catch (err) {
    console.error('listCourses error', err);
    return res.status(500).json({ success: false, message: 'Could not list courses', error: err.message });
  }
};

/**
 * getBatchesForCourse
 * Returns batches with submissionCount for each batch (counts only submissions from students actually assigned to that batch)
 */
exports.getBatchesForCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    if (!courseId) return res.status(400).json({ success: false, message: 'courseId required' });

    const batches = await Batch.findAll({
      where: { course_id: courseId },
      attributes: ['id', 'name', 'code'],
      order: [['id', 'ASC']],
    });

    // If join model missing, return batches with submissionCount undefined (so frontend keeps behavior)
    if (!BatchStudent) {
      console.warn('BatchStudent join model not found on db. submissionCount will be undefined.');
      const result = batches.map(b => ({ ...b.get({ plain: true }), submissionCount: undefined }));
      return res.status(200).json({ success: true, batches: result });
    }

    // compute submissionCount per batch reliably
    const result = [];
    for (const b of batches) {
      const bp = b.get ? b.get({ plain: true }) : b;

      // 1) student ids in this batch
      const rows = await BatchStudent.findAll({
        where: { batch_id: bp.id },
        attributes: ['student_id'],
        raw: true,
      });
      const studentIds = Array.from(new Set(rows.map(r => r.student_id))).filter(Boolean);

      let count = 0;
      if (studentIds.length > 0) {
        // 2) count submissions that belong to those students
        count = await Submission.count({
          where: { student_id: { [Op.in]: studentIds } },
        });
      }

      result.push({ ...bp, submissionCount: count });
    }

    return res.status(200).json({ success: true, batches: result });
  } catch (err) {
    console.error('getBatchesForCourse error', err);
    return res.status(500).json({ success: false, message: 'Could not fetch batches', error: err.message });
  }
};

/**
 * exportBatchSubmissions
 * Exports submissions for a single batch. Only students assigned to the batch (via join table) are considered.
 */
exports.exportBatchSubmissions = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { courseId } = req.query;
    if (!batchId) return res.status(400).json({ success: false, message: 'batchId required' });

    // fetch batch with course info
    const batch = await Batch.findByPk(batchId, {
      include: [{ model: Course, attributes: ['id', 'name', 'course_code'] }],
      attributes: ['id', 'name', 'code', 'course_id']
    });
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

    if (!BatchStudent) {
      console.warn('BatchStudent join model not found on db. Falling back to fetching submissions by students who have any batch relation. This may include extra students.');
    }

    // get student ids for this batch
    let studentIds = [];
    if (BatchStudent) {
      const rows = await BatchStudent.findAll({
        where: { batch_id: batchId },
        attributes: ['student_id'],
        raw: true,
      });
      studentIds = Array.from(new Set(rows.map(r => r.student_id))).filter(Boolean);
    }

    if (!studentIds.length) {
      // no students in batch -> nothing to export
      return res.status(404).json({ success: false, message: 'No students found for this batch' });
    }

    // include question conditional on courseId
    const includeQuestion = courseId
      ? [{ model: Question, attributes: ['id', 'title', 'course_id'], where: { course_id: courseId }, required: true }]
      : [{ model: Question, attributes: ['id', 'title', 'course_id'], required: false }];

    const subs = await Submission.findAll({
      where: { student_id: { [Op.in]: studentIds } },
      include: [
        { model: Student, attributes: ['id', 'name', 'email'], required: false },
        ...includeQuestion
      ],
      order: [['createdAt', 'ASC']],
      distinct: true
    });

    if (!subs || subs.length === 0) {
      return res.status(404).json({ success: false, message: 'No submissions found for this batch' });
    }

    // Build workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(String(batch.name || `batch_${batchId}`).substring(0, 31));

    sheet.addRow([
      'Submission ID','Student ID','Student Name','Student Email',
      'Batch ID','Batch Name','Batch Code','Question ID','Question Title','Language ID',
      'Status','Score','Execution Time','Created At','Output'
    ]);

    for (const s of subs) {
      const student = s.Student || {};
      const q = s.Question || {};
      sheet.addRow([
        safeVal(s.id),
        safeVal(student.id || s.student_id),
        safeVal(student.name || ''),
        safeVal(student.email || ''),
        safeVal(batch.id),
        safeVal(batch.name || ''),
        safeVal(batch.code || ''),
        safeVal(q.id || s.question_id),
        safeVal(q.title || ''),
        safeVal(s.language_id),
        safeVal(s.status),
        safeVal(s.score),
        safeVal(s.execution_time),
        s.createdAt ? new Date(s.createdAt).toISOString() : '',
        typeof s.output === 'string' ? s.output : safeVal(s.output)
      ]);
    }

    // sanitize for filename
    const clean = (str) => String(str || '').replace(/[^a-z0-9\-_]/gi, '_');
    const course = batch.Course || {};
    const filename = `${clean(course.name)}-${clean(batch.name)}.xlsx`;

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('exportBatchSubmissions error', err);
    return res.status(500).json({ success: false, message: 'Could not export batch submissions', error: err.message });
  }
};


/**
 * exportSubBatchSubmissions
 * Uses Student->Batch include to restrict to students who have that specific subbatch assigned.
 */
exports.exportSubBatchSubmissions = async (req, res) => {
  try {
    const { subbatchId } = req.params;
    const { courseId } = req.query;
    if (!subbatchId) return res.status(400).json({ success: false, message: 'subbatchId required' });

    // fetch batch + course details for filename
    const batch = await Batch.findByPk(subbatchId, {
      include: [{ model: Course, attributes: ['id', 'name', 'course_code'] }],
      attributes: ['id', 'name', 'code', 'course_id']
    });
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Sub-batch not found' });
    }

    const includeQuestion = courseId
      ? [{ model: Question, attributes: ['id', 'title', 'course_id'], where: { course_id: courseId }, required: true }]
      : [{ model: Question, attributes: ['id', 'title', 'course_id'], required: false }];

    // This include will only return submissions where the Student has the given batch (subbatchId)
    const subs = await Submission.findAll({
      include: [
        {
          model: Student,
          attributes: ['id', 'name', 'email'],
          required: true,
          include: [{
            model: Batch,
            attributes: ['id', 'name', 'code'],
            where: { id: subbatchId },
            through: { attributes: [] },
            required: true
          }]
        },
        ...includeQuestion
      ],
      where: {
        ['$Student.Batches.id$']: subbatchId
      },
      order: [['createdAt', 'ASC']],
      distinct: true
    });

    if (!subs || subs.length === 0) {
      return res.status(404).json({ success: false, message: 'No submissions found for this sub-batch' });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`subbatch_${subbatchId}`.substring(0, 31));
    sheet.addRow([
      'Submission ID','Student ID','Student Name','Student Email',
      'Batch ID','Batch Name','Batch Code','Question ID','Question Title','Language ID',
      'Status','Score','Execution Time','Created At','Output'
    ]);

    for (const s of subs) {
      const student = s.Student || {};
      const matched = (student.Batches || []).find(bb => String(bb.id) === String(subbatchId)) || {};
      const q = s.Question || {};
      sheet.addRow([
        safeVal(s.id),
        safeVal(student.id || s.student_id),
        safeVal(student.name || ''),
        safeVal(student.email || ''),
        safeVal(matched.id || ''),
        safeVal(matched.name || ''),
        safeVal(matched.code || ''),
        safeVal(q.id || s.question_id),
        safeVal(q.title),
        safeVal(s.language_id),
        safeVal(s.status),
        safeVal(s.score),
        safeVal(s.execution_time),
        s.createdAt ? new Date(s.createdAt).toISOString() : '',
        typeof s.output === 'string' ? s.output : safeVal(s.output)
      ]);
    }

    // sanitize for filename
    const clean = (str) => String(str || '').replace(/[^a-z0-9\-_]/gi, '_');
    const course = batch.Course || {};
    const filename = `${clean(course.name)}-${clean(batch.name)}-${clean(batch.code)}.xlsx`;

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('exportSubBatchSubmissions error', err);
    return res.status(500).json({ success: false, message: 'Could not export sub-batch submissions', error: err.message });
  }
};


/**
 * exportCourseBatchesCombinedByName
 * Groups batches by exact name and exports submissions for students assigned to those batches.
 */
exports.exportCourseBatchesCombinedByName = async (req, res) => {
  try {
    const { courseId } = req.params;
    let { name = '', sort } = req.query;
    if (!courseId) return res.status(400).json({ success: false, message: 'courseId required' });
    if (!name || String(name).trim() === '') return res.status(400).json({ success: false, message: 'name query param is required' });

    name = String(name).trim();

    const batches = await Batch.findAll({
      where: { course_id: courseId, name },
      attributes: ['id', 'name', 'code'],
      order: [['id', 'ASC']],
    });

    if (!batches || batches.length === 0) return res.status(404).json({ success: false, message: `No batches found with name "${name}" for this course` });

    if (!BatchStudent) {
      console.warn('BatchStudent join model not found; attempting safer includes (may produce extra students).');
    }

    // get studentIds via join table
    const batchIds = batches.map(b => b.id);
    let studentIds = [];
    if (BatchStudent) {
      const rows = await BatchStudent.findAll({
        where: { batch_id: { [Op.in]: batchIds } },
        attributes: ['student_id'],
        raw: true
      });
      studentIds = Array.from(new Set(rows.map(r => r.student_id))).filter(Boolean);
    }

    if (!studentIds.length) return res.status(404).json({ success: false, message: `No students assigned to batches named "${name}"` });

    const subs = await Submission.findAll({
      where: { student_id: { [Op.in]: studentIds } },
      include: [
        { model: Student, attributes: ['id', 'name', 'email'], include: [{ model: Batch, attributes: ['id','name','code'], through: { attributes: [] } }] },
        { model: Question, attributes: ['id','title','course_id'], required: false }
      ],
      distinct: true
    });

    if (!subs || subs.length === 0) return res.status(404).json({ success: false, message: `No submissions found for batches named "${name}"` });

    // optional sort
    if (sort === 'batchCode') {
      subs.sort((a,b) => {
        const aB = (a.Student && a.Student.Batches && a.Student.Batches.find(bb => batchIds.includes(bb.id))) || {};
        const bB = (b.Student && b.Student.Batches && b.Student.Batches.find(bb => batchIds.includes(bb.id))) || {};
        return String(aB.code || '').localeCompare(String(bB.code || ''));
      });
    }

    const sanitizeSheetName = (n) => {
      const cleaned = String(n || '').replace(/[:\\\/\?\*\[\]]/g, '').trim();
      return (cleaned || 'Sheet').substring(0, 31);
    };
    const sheetName = sanitizeSheetName(name);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);

    sheet.addRow([
      'Submission ID','Student ID','Student Name','Student Email',
      'Batch ID','Batch Name','Batch Code','Question ID','Question Title','Language ID',
      'Status','Score','Execution Time','Created At','Output'
    ]);

    for (const s of subs) {
      const student = s.Student || {};
      const matched = (student.Batches || []).find(bb => batchIds.includes(bb.id)) || {};
      const q = s.Question || {};
      sheet.addRow([
        safeVal(s.id),
        safeVal(student.id || s.student_id),
        safeVal(student.name),
        safeVal(student.email),
        safeVal(matched.id || ''),
        safeVal(matched.name || ''),
        safeVal(matched.code || ''),
        safeVal(q.id || s.question_id),
        safeVal(q.title),
        safeVal(s.language_id),
        safeVal(s.status),
        safeVal(s.score),
        safeVal(s.execution_time),
        s.createdAt ? new Date(s.createdAt).toISOString() : '',
        typeof s.output === 'string' ? s.output : safeVal(s.output)
      ]);
    }

    const filename = `course_${courseId}_batches_${sheetName}_combined.xlsx`;
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('exportCourseBatchesCombinedByName error', err);
    return res.status(500).json({ success: false, message: 'Could not export combined batches by name', error: err.message });
  }
};

/**
 * exportCourseSubbatchesCombined
 * One sheet per distinct batch name; for each group we get studentIds from join table and fetch submissions only for them.
 */
exports.exportCourseSubbatchesCombined = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { sort } = req.query;
    if (!courseId) return res.status(400).json({ success: false, message: 'courseId required' });

    const batches = await Batch.findAll({
      where: { course_id: courseId },
      attributes: ['id','name','code'],
      order: [['id','ASC']]
    });

    if (!batches || batches.length === 0) return res.status(404).json({ success: false, message: 'No batches found for this course' });

    // group by name
    const groups = {};
    for (const b of batches) {
      const plain = b.get ? b.get({ plain: true }) : b;
      const key = (plain.name || '').toString().trim() || `__unnamed_batch_group__${plain.id}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(plain);
    }

    const workbook = new ExcelJS.Workbook();
    let wroteAnySheet = false;

    for (const groupName of Object.keys(groups).sort((a,b) => a.localeCompare(b))) {
      const batchesInGroup = groups[groupName];
      const batchIds = batchesInGroup.map(x => x.id);

      // get student IDs via join table
      let studentIds = [];
      if (BatchStudent) {
        const rows = await BatchStudent.findAll({
          where: { batch_id: { [Op.in]: batchIds } },
          attributes: ['student_id'],
          raw: true
        });
        studentIds = Array.from(new Set(rows.map(r => r.student_id))).filter(Boolean);
      }

      if (!studentIds.length) continue; // no students -> skip

      const subs = await Submission.findAll({
        where: { student_id: { [Op.in]: studentIds } },
        include: [
          { model: Student, attributes: ['id','name','email'], include: [{ model: Batch, attributes: ['id','name','code'], through: { attributes: [] } }] },
          { model: Question, attributes: ['id','title'], required: false }
        ],
        distinct: true
      });

      if (!subs || subs.length === 0) continue;

      // sorting
      if (sort === 'batchCode') {
        subs.sort((a,b) => {
          const aB = (a.Student && a.Student.Batches && a.Student.Batches.find(bb => batchIds.includes(bb.id))) || {};
          const bB = (b.Student && b.Student.Batches && b.Student.Batches.find(bb => batchIds.includes(bb.id))) || {};
          return String(aB.code || '').localeCompare(String(bB.code || ''));
        });
      } else if (sort === 'batchName') {
        subs.sort((a,b) => {
          const aB = (a.Student && a.Student.Batches && a.Student.Batches.find(bb => batchIds.includes(bb.id))) || {};
          const bB = (b.Student && b.Student.Batches && b.Student.Batches.find(bb => batchIds.includes(bb.id))) || {};
          return String(aB.name || '').localeCompare(String(bB.name || ''));
        });
      } else {
        subs.sort((a,b) => ((a.createdAt? new Date(a.createdAt).getTime():0) - (b.createdAt? new Date(b.createdAt).getTime():0)));
      }

      // create sheet
      const rawSheetName = groupName.startsWith('__unnamed_batch_group__') ? `Unnamed_${batchIds.join('_')}` : groupName;
      const sheetName = String(rawSheetName || 'Sheet').replace(/[:\\\/\?\*\[\]]/g, '').substring(0,31);

      let finalSheetName = sheetName;
      let idx = 1;
      while (workbook.getWorksheet(finalSheetName)) {
        finalSheetName = sheetName.substring(0, Math.max(0,31 - (`_${idx}`).length)) + `_${idx}`;
        idx++;
      }

      const sheet = workbook.addWorksheet(finalSheetName);
      sheet.addRow([
        'Submission ID','Student ID','Student Name','Student Email',
        'Batch ID','Batch Name','Batch Code','Question ID','Question Title','Language ID',
        'Status','Score','Execution Time','Created At','Output'
      ]);

      for (const s of subs) {
        const student = s.Student || {};
        const matched = (student.Batches || []).find(bb => batchIds.includes(bb.id)) || (student.Batches && student.Batches[0]) || {};
        const q = s.Question || {};
        sheet.addRow([
          safeVal(s.id),
          safeVal(student.id || s.student_id),
          safeVal(student.name),
          safeVal(student.email),
          safeVal(matched.id || ''),
          safeVal(matched.name || ''),
          safeVal(matched.code || ''),
          safeVal(q.id || s.question_id),
          safeVal(q.title),
          safeVal(s.language_id),
          safeVal(s.status),
          safeVal(s.score),
          safeVal(s.execution_time),
          s.createdAt ? new Date(s.createdAt).toISOString() : '',
          typeof s.output === 'string' ? s.output : safeVal(s.output)
        ]);
      }

      wroteAnySheet = true;
    }

    if (!wroteAnySheet) {
      return res.status(404).json({ success: false, message: 'No submissions found for any batch in this course' });
    }

    const filename = `course_${courseId}_subbatches_combined.xlsx`;
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('exportCourseSubbatchesCombined error', err);
    return res.status(500).json({ success: false, message: 'Could not export combined sub-batches', error: err.message });
  }
};


// backend/excelexports/controllers/exportController.js
// Add / merge this function into your existing controller file

exports.exportMySubmissions = async (req, res) => {
  try {
    const studentId = req.user && req.user.id;
    if (!studentId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { courseId } = req.query; // optional filter

    // Build where clause to restrict to this student
    const where = { student_id: studentId };
    // If you store studentId in a different field name, change above accordingly.

    // Include Question -> Course (we filter by courseId if provided)
    const include = [
      {
        model: Question,
        attributes: ['id', 'title', 'sample_input', 'sample_output', 'course_id'],
        required: false,
        where: courseId ? { course_id: courseId } : undefined
      },
      {
        model: Student,
        attributes: ['id', 'name', 'email'],
        required: false
      }
    ];

    const subs = await Submission.findAll({
      where,
      include,
      order: [['createdAt', 'ASC']],
      distinct: true
    });

    if (!subs || subs.length === 0) {
      return res.status(404).json({ success: false, message: 'No submissions found for this student (or with provided filters)' });
    }

    // Build workbook
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`my_submissions`.substring(0, 31));

    // Header
    sheet.addRow([
      'No', 'Submission ID', 'Question ID', 'Question Title', 'Sample Input', 'Sample Output',
      'Code (submission)', 'Output', 'Status', 'Score', 'Created At'
    ]);

    const safeVal = (v) => {
      if (v === undefined || v === null) return '';
      if (typeof v === 'object') {
        try { return JSON.stringify(v); } catch (e) { return String(v); }
      }
      return String(v);
    };

    for (let i = 0; i < subs.length; i++) {
      const s = subs[i];
      const q = s.Question || {};

      sheet.addRow([
        i + 1,
        safeVal(s.id),
        safeVal(q.id ?? s.question_id),
        safeVal(q.title ?? ''),
        safeVal(q.sample_input ?? q.sampleInput ?? ''),
        safeVal(q.sample_output ?? q.sampleOutput ?? ''),
        // attempt common submission code fields
        safeVal(s.code ?? s.source ?? s.submission_code ?? s.submission ?? s.raw_code ?? ''),
        // output fields
        safeVal(s.output ?? s.stdout ?? s.result ?? ''),
        safeVal(s.status ?? ''),
        safeVal(s.score ?? ''),
        s.createdAt ? new Date(s.createdAt).toISOString() : ''
      ]);
    }

    const filename = `my_submissions_${studentId}.xlsx`;
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('exportMySubmissions error', err);
    return res.status(500).json({ success: false, message: 'Could not export submissions for student', error: err.message });
  }
};
