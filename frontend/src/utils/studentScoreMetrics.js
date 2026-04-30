export function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeCourse(rawCourse = {}, index = 0) {
  return {
    id: rawCourse.course_id ?? rawCourse.id ?? rawCourse._id ?? `course-${index}`,
    name: rawCourse.course_name ?? rawCourse.name ?? rawCourse.title ?? `Course ${index + 1}`,
    code: rawCourse.course_code ?? rawCourse.code ?? '',
    raw: rawCourse
  };
}

export function normalizeSubmission(rawSubmission = {}, index = 0) {
  const question = rawSubmission.question ?? rawSubmission.Question ?? {};
  const course = rawSubmission.course ?? question.Course ?? {};
  const courseId = course.id ?? rawSubmission.course_id ?? rawSubmission.courseId ?? question.course_id ?? null;
  const courseName = course.name ?? rawSubmission.course_name ?? rawSubmission.courseName ?? null;
  const score = toNumberOrNull(rawSubmission.score ?? rawSubmission.marks ?? rawSubmission.points);
  const maxScore = toNumberOrNull(
    rawSubmission.maxScore ??
    rawSubmission.questionScore ??
    rawSubmission.max_score ??
    question.score
  );
  const similarityScore = toNumberOrNull(
    rawSubmission.similarity_score ??
    rawSubmission.similarity_percentage ??
    rawSubmission.Feedback?.similarity_percentage
  );

  return {
    id: rawSubmission.id ?? rawSubmission._id ?? `submission-${index}`,
    questionId: rawSubmission.question_id ?? rawSubmission.questionId ?? question.id ?? null,
    questionTitle: rawSubmission.question_title ?? question.title ?? rawSubmission.questionTitle ?? null,
    courseId,
    courseName,
    status: String(rawSubmission.status ?? rawSubmission.state ?? ''),
    score,
    maxScore,
    similarityScore,
    createdAt: rawSubmission.createdAt ?? rawSubmission.created_at ?? rawSubmission.created_at_date ?? null,
    raw: rawSubmission
  };
}

export function selectBestSubmissionPerQuestion(submissions = []) {
  const bestByQuestion = new Map();

  submissions.forEach((submission) => {
    const courseKey = submission.courseId ?? submission.courseName ?? 'unknown-course';
    const questionKey = submission.questionId != null
      ? `${courseKey}::${submission.questionId}`
      : `${courseKey}::submission-${submission.id}`;
    const safeScore = submission.score ?? 0;
    const current = bestByQuestion.get(questionKey);

    if (
      !current ||
      safeScore > current.safeScore ||
      (safeScore === current.safeScore && new Date(submission.createdAt ?? 0) > new Date(current.createdAt ?? 0))
    ) {
      bestByQuestion.set(questionKey, { ...submission, safeScore });
    }
  });

  return Array.from(bestByQuestion.values());
}

export function aggregateStudentScores({ courses = [], submissions = [], remainingQuestionsByCourse = {} }) {
  const map = new Map();
  const keyFor = (value) => String(value ?? 'unknown-course');

  courses.forEach((course) => {
    map.set(keyFor(course.id), {
      id: course.id,
      name: course.name || course.code || String(course.id),
      code: course.code || '',
      score: 0,
      totalPossibleScore: 0,
      similarityTotal: 0,
      similarityCount: 0,
      accepted: 0,
      total: 0
    });
  });

  const bestSubmissions = selectBestSubmissionPerQuestion(submissions);

  bestSubmissions.forEach((submission) => {
    const key = keyFor(submission.courseId ?? submission.courseName);
    if (!map.has(key)) {
      map.set(key, {
        id: submission.courseId ?? submission.courseName ?? key,
        name: submission.courseName ?? 'Unknown Course',
        code: '',
        score: 0,
        totalPossibleScore: 0,
        similarityTotal: 0,
        similarityCount: 0,
        accepted: 0,
        total: 0
      });
    }

    const entry = map.get(key);
    const safeScore = submission.score ?? 0;
    const maxScore = submission.maxScore ?? 0;
    entry.score += safeScore;
    entry.totalPossibleScore += maxScore;
    entry.total += 1;

    if (submission.similarityScore != null) {
      entry.similarityTotal += submission.similarityScore;
      entry.similarityCount += 1;
    }

    const status = submission.status.toLowerCase();
    if (maxScore > 0 ? safeScore >= maxScore : status === 'accepted') {
      entry.accepted += 1;
    }
  });

  Object.entries(remainingQuestionsByCourse).forEach(([courseId, questions]) => {
    const key = keyFor(courseId);
    if (!map.has(key)) return;
    const remainingTotal = (Array.isArray(questions) ? questions : []).reduce((sum, question) => {
      return sum + (toNumberOrNull(question?.score) ?? 0);
    }, 0);
    map.get(key).totalPossibleScore += remainingTotal;
  });

  const byCourse = Array.from(map.values()).map((course) => ({
    ...course,
    similarityScore: course.similarityCount > 0
      ? Math.round(course.similarityTotal / course.similarityCount)
      : null
  }));

  return {
    byCourse,
    totals: byCourse.reduce((acc, course) => ({
      score: acc.score + course.score,
      totalPossibleScore: acc.totalPossibleScore + course.totalPossibleScore,
      accepted: acc.accepted + course.accepted,
      total: acc.total + course.total,
      similarityTotal: acc.similarityTotal + course.similarityTotal,
      similarityCount: acc.similarityCount + course.similarityCount
    }), {
      score: 0,
      totalPossibleScore: 0,
      accepted: 0,
      total: 0,
      similarityTotal: 0,
      similarityCount: 0
    })
  };
}
