const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');

const Poll = require('../models/Poll');
const PollVote = require('../models/PollVote');

const createPoll = asyncHandler(async (req, res) => {
  const { question, options, expiresAt } = req.body;
  if (!question) throw new AppError('question is required', 400);
  if (!Array.isArray(options) || options.length < 2) throw new AppError('options must have at least 2 items', 400);

  const doc = await Poll.create({
    question,
    options: options.map((o) => ({ text: o.text || o })),
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    createdBy: req.user._id,
  });

  res.status(201).json({ ok: true, poll: doc });
});

const listPolls = asyncHandler(async (req, res) => {
  const polls = await Poll.find({}).sort({ createdAt: -1 }).limit(50);
  res.json({ ok: true, items: polls });
});

const votePoll = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { optionId } = req.body;
  if (!optionId) throw new AppError('optionId is required', 400);

  const poll = await Poll.findById(id);
  if (!poll) throw new AppError('Poll not found', 404);

  if (!poll.isActive) throw new AppError('Poll closed', 400);
  if (poll.expiresAt && poll.expiresAt < new Date()) throw new AppError('Poll expired', 400);

  const exists = poll.options.some((o) => String(o._id) === String(optionId));
  if (!exists) throw new AppError('Invalid option', 400);

  try {
    await PollVote.create({ poll: poll._id, user: req.user._id, optionId });
  } catch (e) {
    if (e && e.code === 11000) throw new AppError('Already voted', 409);
    throw e;
  }

  res.status(201).json({ ok: true });
});

const getResults = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const poll = await Poll.findById(id);
  if (!poll) throw new AppError('Poll not found', 404);

  const agg = await PollVote.aggregate([
    { $match: { poll: poll._id } },
    { $group: { _id: '$optionId', count: { $sum: 1 } } },
  ]);

  const totalVotes = agg.reduce((s, x) => s + x.count, 0);
  const counts = new Map(agg.map((x) => [String(x._id), x.count]));

  const results = poll.options.map((o) => {
    const c = counts.get(String(o._id)) || 0;
    return {
      optionId: o._id,
      text: o.text,
      count: c,
      percentage: totalVotes ? Math.round((c / totalVotes) * 10000) / 100 : 0,
    };
  });

  res.json({ ok: true, poll, totalVotes, results });
});

const deletePoll = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const poll = await Poll.findByIdAndDelete(id);
  if (!poll) throw new AppError('Poll not found', 404);
  await PollVote.deleteMany({ poll: poll._id });
  res.json({ ok: true });
});

module.exports = { createPoll, listPolls, votePoll, getResults, deletePoll };
