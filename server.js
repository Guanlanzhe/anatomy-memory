import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { buildGraph, exportToCytoscape } from './src/knowledge/graph.js';
import {
  loadTerms,
  loadMorphemes,
  getChapters,
  getTermsByChapter,
  getTermsByMorpheme
} from './src/knowledge/loader.js';
import { generateQuestions, ALL_MODES } from './src/learning/question.js';
import {
  getOrCreateCard,
  reviewCard,
  Rating,
  getStats,
  getDueCards,
  getDueCardIds
} from './src/learning/scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- 基础数据 API ----------

app.get('/api/chapters', (req, res) => {
  res.json(getChapters());
});

app.get('/api/terms', (req, res) => {
  const { chapter } = req.query;
  const terms = chapter ? getTermsByChapter(chapter) : loadTerms();
  res.json(terms.map((t) => ({
    id: t.id,
    english: t.english,
    chinese: t.chinese,
    chapter: t.chapter
  })));
});

app.get('/api/morphemes', (req, res) => {
  res.json(loadMorphemes());
});

app.get('/api/modes', (req, res) => {
  res.json(ALL_MODES);
});

// ---------- 图谱 API ----------

// 按章节：/api/graph?chapter=运动系统
// 按词根：/api/graph?morpheme=cardi
// 不带参数：全图
app.get('/api/graph', (req, res) => {
  const { chapter, morpheme } = req.query;

  let filterFn = null;
  if (chapter) {
    filterFn = (t) => t.chapter === chapter;
  } else if (morpheme) {
    filterFn = (t) => t.morphemes.includes(morpheme);
  }

  const graph = buildGraph(filterFn);
  res.json(exportToCytoscape(graph));
});

// ---------- 练习 API ----------

app.post('/api/questions', (req, res) => {
  const { termIds, modes } = req.body;
  if (!Array.isArray(termIds) || termIds.length === 0) {
    return res.status(400).json({ error: 'termIds required' });
  }
  const qs = generateQuestions(termIds, modes && modes.length ? modes : ALL_MODES);
  for (const q of qs) getOrCreateCard(q.id);
  res.json(qs);
});

app.post('/api/questions-by-cards', (req, res) => {
  const { cardIds } = req.body;
  if (!Array.isArray(cardIds)) {
    return res.status(400).json({ error: 'cardIds required' });
  }

  const terms = loadTerms();
  const allTermIds = terms.map((t) => t.id);
  const allQuestions = generateQuestions(allTermIds, ALL_MODES);

  const qMap = new Map();
  for (const q of allQuestions) {
    qMap.set(q.id, q);
  }

  const filtered = cardIds.map((id) => qMap.get(id)).filter(Boolean);
  res.json(filtered);
});

app.post('/api/review', (req, res) => {
  const { cardId, correct, rating } = req.body;
  if (!cardId) return res.status(400).json({ error: 'cardId required' });

  let r;
  if (rating) {
    r = {
      again: Rating.Again,
      hard: Rating.Hard,
      good: Rating.Good,
      easy: Rating.Easy
    }[rating] ?? Rating.Good;
  } else {
    r = correct ? Rating.Good : Rating.Again;
  }

  const card = reviewCard(cardId, r);
  res.json(card);
});

// ---------- 统计 API ----------

app.get('/api/stats', (req, res) => {
  res.json(getStats());
});

app.get('/api/due', (req, res) => {
  const due = getDueCards();
  res.json({ count: due.length, cards: due });
});

app.get('/api/fsrs-state', (req, res) => {
  const statePath = path.resolve(__dirname, 'data/learning_state.json');
  if (!fs.existsSync(statePath)) return res.json({});
  res.json(JSON.parse(fs.readFileSync(statePath, 'utf-8')));
});

app.listen(PORT, () => {
  console.log(`\nAnatomy Memory running at http://localhost:${PORT}\n`);
});


const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Anatomy Memory running at http://localhost:${PORT}`);
  });
}

export default app;
