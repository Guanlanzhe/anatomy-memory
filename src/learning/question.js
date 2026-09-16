import { loadTerms, loadMorphemes } from '../knowledge/loader.js';

export const ALL_MODES = [
  'meaning-to-term',
  'term-to-meaning',
  'morpheme-meaning',
  'decomposition',
  'construction'
];

export function generateQuestionsForTerm(termId, modes = ALL_MODES) {
  const terms = loadTerms();
  const morphemes = loadMorphemes();

  const term = terms.find((t) => t.id === termId);
  if (!term) return [];

  const questions = [];
  const has = (m) => modes.includes(m);

  if (has('meaning-to-term')) {
    questions.push({
      id: `${term.id}:meaning-to-term`,
      termId: term.id,
      mode: 'meaning-to-term',
      prompt: `"${term.chinese}" 的英文是？`,
      expected: [term.english],
      display: term.english
    });
  }

  if (has('term-to-meaning')) {
    questions.push({
      id: `${term.id}:term-to-meaning`,
      termId: term.id,
      mode: 'term-to-meaning',
      prompt: `"${term.english}" 的中文是？`,
      expected: [term.chinese],
      display: term.chinese
    });
  }

  if (has('morpheme-meaning')) {
    for (const morphemeId of term.morphemes) {
      const m = morphemes[morphemeId];
      if (!m) continue;
      if (m.meaning && m.meaning.startsWith('(')) continue;

      const expectedList = [m.meaning];
      if (m.chinese) expectedList.push(m.chinese);

      questions.push({
        id: `${morphemeId}:meaning`,
        termId: term.id,
        mode: 'morpheme-meaning',
        prompt: `"${morphemeId}" 这个词根是什么意思？（中英文都接受）`,
        expected: expectedList,
        display: `${m.meaning} / ${m.chinese}`
      });
    }
  }

  if (has('decomposition') && term.morphemes.length > 0) {
    questions.push({
      id: `${term.id}:decomposition`,
      termId: term.id,
      mode: 'decomposition',
      prompt: `把 "${term.english}" 拆成词根（用 + 连接，按顺序）`,
      expected: [term.morphemes.join(' + ')],
      display: term.morphemes.join(' + ')
    });
  }

  if (has('construction') && term.morphemes.length >= 2) {
    const parts = term.morphemes
      .map((id) => {
        const m = morphemes[id] || {};
        return `${id} (${m.chinese ?? m.meaning ?? '?'})`;
      })
      .join(' + ');

    questions.push({
      id: `${term.id}:construction`,
      termId: term.id,
      mode: 'construction',
      prompt: `把下面几个词根拼成解剖学术语：\n${parts}`,
      expected: [term.english],
      display: term.english
    });
  }

  return questions;
}

export function generateQuestions(termIds, modes = ALL_MODES) {
  const all = [];
  for (const id of termIds) {
    all.push(...generateQuestionsForTerm(id, modes));
  }
  return shuffle(all);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}