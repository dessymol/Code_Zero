require('dotenv').config();
const db = require('./models');
const { generateFeedback } = require('./services/llmServices');

(async () => {
  try {
    // Get the first submission
    const submission = await db.Submission.findOne({
      include: [{ model: db.Question }]
    });

    if (!submission) {
      console.log('No submissions found');
      return;
    }

    console.log('Processing submission:', submission.id);

    // Build feedback payload
    const languageName = 'Python 3.8.1'; // Assuming Python
    const judgeResult = JSON.parse(submission.output || '{}');
    const question = submission.Question;

    const feedbackPayload = {
      code: submission.code,
      input: question.sample_input || '',
      languageName,
      question: {
        title: question.title,
        description: question.description,
        sample_output: question.sample_output
      },
      judgeResult,
      score: submission.score,
      maxScore: question.score
    };

    console.log('Generating feedback...');
    const feedback = await generateFeedback(feedbackPayload);

    // Save feedback
    await db.SubmissionFeedback.create({
      submission_id: submission.id,
      summary: feedback.summary || null,
      what_went_wrong: feedback.what_went_wrong || null,
      hint: feedback.hint || null,
      positive: feedback.positive || null,
      status: 'done'
    });

    console.log('Feedback saved successfully');
  } catch (e) {
    console.error('Error:', e.message);
  }
})();