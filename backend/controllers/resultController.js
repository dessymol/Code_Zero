const { Result, Student, Course } = require('../models');

exports.getResultsByCourse = async (req, res) => {
  try {
    const { course_id } = req.params;

    const results = await Result.findAll({
      where: { course_id },
      include: [{ model: Student }]
    });

    res.status(200).json({ message: 'Results fetched successfully', results });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching results', error });
  }
};

exports.exportResults = async (req, res) => {
  try {
    const { course_id } = req.params;

    const results = await Result.findAll({
      where: { course_id },
      include: [{ model: Student }]
    });

    const exportData = results.map(result => ({
      student: result.Student.name,
      email: result.Student.email,
      course_id: result.course_id,
      question_id: result.question_id,
      score: result.marks_awarded,
      submitted: result.createdAt,
    }));

    res.status(200).json({ message: 'Export successful', data: exportData });
  } catch (error) {
    res.status(500).json({ message: 'Error exporting results', error });
  }
};
