const mongoose = require('mongoose');
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');

const Survey = require('../models/Survey');
const SurveyQuestion = require('../models/SurveyQuestion');
const SurveyResponse = require('../models/SurveyResponse');

const createSurvey = asyncHandler(async (req, res) => {
  const { title, description, expiresAt, questions } = req.body;
  if (!title) throw new AppError('title is required', 400);
  if (!Array.isArray(questions) || !questions.length) throw new AppError('questions are required', 400);

  const survey = await Survey.create({
    title,
    description: description || '',
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    createdBy: req.user._id,
  });

  const qDocs = await SurveyQuestion.insertMany(
    questions.map((q, idx) => ({
      survey: survey._id,
      type: q.type,
      prompt: q.prompt,
      options: q.type === 'mcq' ? (Array.isArray(q.options) ? q.options : []) : [],
      order: q.order !== undefined ? q.order : idx,
    }))
  );

  res.status(201).json({ ok: true, survey, questions: qDocs });
});

const listSurveys = asyncHandler(async (req, res) => {
  const items = await Survey.find({ isActive: true }).sort({ createdAt: -1 }).limit(50);
  res.json({ ok: true, items });
});

const getSurvey = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const survey = await Survey.findById(id);
  if (!survey) throw new AppError('Survey not found', 404);

  const questions = await SurveyQuestion.find({ survey: survey._id }).sort({ order: 1, createdAt: 1 });

  res.json({ ok: true, survey, questions });
});

const submitResponse = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { answers } = req.body;
  if (!Array.isArray(answers)) throw new AppError('answers must be an array', 400);

  const survey = await Survey.findById(id);
  if (!survey) throw new AppError('Survey not found', 404);
  if (!survey.isActive) throw new AppError('Survey closed', 400);
  if (survey.expiresAt && survey.expiresAt < new Date()) throw new AppError('Survey expired', 400);

  const questions = await SurveyQuestion.find({ survey: survey._id }).lean();
  const qMap = new Map(questions.map((q) => [String(q._id), q]));

  const normalized = [];
  for (const a of answers) {
    const qId = a.question;
    const q = qMap.get(String(qId));
    if (!q) throw new AppError('Invalid question in answers', 400);

    if (q.type === 'mcq') {
      if (!q.options.includes(a.value)) throw new AppError('Invalid MCQ answer', 400);
      normalized.push({ question: q._id, value: String(a.value) });
    } else {
      normalized.push({ question: q._id, value: String(a.value || '') });
    }
  }

  try {
    const doc = await SurveyResponse.create({ survey: survey._id, user: req.user._id, answers: normalized });
    res.status(201).json({ ok: true, response: doc });
  } catch (e) {
    if (e && e.code === 11000) throw new AppError('Already submitted', 409);
    throw e;
  }
});

const analytics = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const survey = await Survey.findById(id);
  if (!survey) throw new AppError('Survey not found', 404);

  const questions = await SurveyQuestion.find({ survey: survey._id }).sort({ order: 1 });

  const responses = await SurveyResponse.find({ survey: survey._id }).lean();
  const totalResponses = responses.length;

  const byQuestion = {};

  for (const q of questions) {
    const qId = String(q._id);
    const answers = [];
    for (const r of responses) {
      const found = (r.answers || []).find((a) => String(a.question) === qId);
      if (found) answers.push(found.value);
    }

    if (q.type === 'mcq') {
      const counts = {};
      for (const opt of q.options) counts[opt] = 0;
      for (const v of answers) {
        if (counts[v] !== undefined) counts[v] += 1;
      }
      const result = Object.entries(counts).map(([option, count]) => ({
        option,
        count,
        percentage: totalResponses ? Math.round((count / totalResponses) * 10000) / 100 : 0,
      }));
      byQuestion[qId] = { type: q.type, prompt: q.prompt, results: result };
    } else {
      byQuestion[qId] = { type: q.type, prompt: q.prompt, samples: answers.slice(0, 50) };
    }
  }

  res.json({ ok: true, survey, totalResponses, byQuestion });
});

const deleteSurvey = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const survey = await Survey.findByIdAndDelete(id);
  if (!survey) throw new AppError('Survey not found', 404);

  await Promise.all([
    SurveyQuestion.deleteMany({ survey: survey._id }),
    SurveyResponse.deleteMany({ survey: survey._id }),
  ]);

  res.json({ ok: true });
});

module.exports = { createSurvey, listSurveys, getSurvey, submitResponse, analytics, deleteSurvey };
