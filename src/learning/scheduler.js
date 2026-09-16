import { createEmptyCard, fsrs, Rating, State } from 'ts-fsrs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_FILE = path.resolve(__dirname, '../../data/learning_state.json');

const f = fsrs();

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export function getOrCreateCard(cardId) {
  const state = loadState();
  if (!state[cardId]) {
    const card = createEmptyCard();
    state[cardId] = {
      ...card,
      due: card.due.toISOString(),
      last_review: card.last_review ? card.last_review.toISOString() : null
    };
    saveState(state);
  }
  return state[cardId];
}

export function reviewCard(cardId, rating) {
  const state = loadState();
  const stored = state[cardId];
  if (!stored) {
    throw new Error(`Card not found: ${cardId}`);
  }

  // 把 ISO 字符串转回 Date
  const card = {
    ...stored,
    due: new Date(stored.due),
    last_review: stored.last_review ? new Date(stored.last_review) : undefined
  };

  const now = new Date();
  const scheduling = f.repeat(card, now);
  const result = scheduling[rating];

  state[cardId] = {
    ...result.card,
    due: result.card.due.toISOString(),
    last_review: result.card.last_review
      ? result.card.last_review.toISOString()
      : null
  };
  saveState(state);

  return state[cardId];
}

export { Rating, State };

export function getAllCards() {
  return loadState();
}

export function getCard(cardId) {
  const state = loadState();
  return state[cardId] || null;
}

export function getStats() {
  const state = loadState();
  const cards = Object.values(state);

  const total = cards.length;
  const due = cards.filter((c) => new Date(c.due) <= new Date()).length;
  const learning = cards.filter((c) => c.state === 1 || c.state === 3).length;
  const review = cards.filter((c) => c.state === 2).length;

  // 按 cardId 前缀粗略分类
  // cardId 形如：
  //   "sternocleidomastoid:meaning-to-term"  → term 类
  //   "sterno:meaning"                        → morpheme 类
  // 无法从字符串直接区分，改用 mode 后缀
  const modeCount = {};
  for (const cardId of Object.keys(state)) {
    const parts = cardId.split(':');
    const mode = parts[1] || 'unknown';
    modeCount[mode] = (modeCount[mode] || 0) + 1;
  }

  return { total, due, learning, review, modeCount };
}

export function getDueCards(now = new Date()) {
  const state = loadState();
  const due = [];
  for (const [cardId, card] of Object.entries(state)) {
    if (new Date(card.due) <= now) {
      due.push({ cardId, ...card });
    }
  }
  return due;
}

export function getDueCardIds(now = new Date()) {
  return getDueCards(now).map((c) => c.cardId);
}