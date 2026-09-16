let allChapters = [];
let allTerms = [];
let allModes = [];
let questions = [];
let currentIndex = 0;
let correctCount = 0;
let answered = false;
let autoTimer = null;
let autoRating = null;

const MODE_LABELS = {
  'meaning-to-term': '中文 → 英文',
  'term-to-meaning': '英文 → 中文',
  'morpheme-meaning': '词根含义',
  'decomposition': '拆解词根',
  'construction': '拼装术语'
};

async function init() {
  const params = new URLSearchParams(location.search);
  if (params.get('due') === '1') {
    await initDueMode();
    return;
  }

  const [chapters, modes] = await Promise.all([
    fetch('/api/chapters').then((r) => r.json()),
    fetch('/api/modes').then((r) => r.json())
  ]);
  allChapters = chapters;
  allModes = modes;

  // 章节列表
  document.getElementById('chapters-list').innerHTML = chapters
    .map(
      (c) => `
      <label>
        <input type="checkbox" class="chapter-cb" value="${c}" checked>
        ${c}
      </label>`
    )
    .join('');

  // 绑定章节变化 → 刷新术语列表
  document.querySelectorAll('.chapter-cb').forEach((cb) => {
    cb.addEventListener('change', refreshTerms);
  });

  // 题型
  document.getElementById('modes-list').innerHTML = modes
    .map(
      (m) => `
      <label>
        <input type="checkbox" class="mode-cb" value="${m}" checked>
        ${MODE_LABELS[m] || m}
      </label>`
    )
    .join('');

  // 初始化术语
  await refreshTerms();

  // 回车提交
  document.getElementById('answer').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (answered) return;
      submitAnswer();
    }
  });
}

async function refreshTerms() {
  const selectedChapters = [...document.querySelectorAll('.chapter-cb:checked')].map((cb) => cb.value);

  if (selectedChapters.length === 0) {
    document.getElementById('terms-list').innerHTML = '<div style="color:#888;font-size:13px">请先选择章节</div>';
    return;
  }

  // 逐个章节拿术语
  const requests = selectedChapters.map((c) =>
    fetch(`/api/terms?chapter=${encodeURIComponent(c)}`).then((r) => r.json())
  );
  const results = await Promise.all(requests);
  const merged = results.flat();

  allTerms = merged;

  document.getElementById('terms-list').innerHTML = merged
    .map(
      (t) => `
      <label>
        <input type="checkbox" class="term-cb" value="${t.id}" checked>
        ${t.english} · ${t.chinese}
      </label>`
    )
    .join('');
}

function selectAllChapters(checked) {
  document.querySelectorAll('.chapter-cb').forEach((cb) => (cb.checked = checked));
  refreshTerms();
}

function selectAllTerms(checked) {
  document.querySelectorAll('.term-cb').forEach((cb) => (cb.checked = checked));
}

async function startPractice() {
  const termIds = [...document.querySelectorAll('.term-cb:checked')].map((cb) => cb.value);
  const modes = [...document.querySelectorAll('.mode-cb:checked')].map((cb) => cb.value);

  if (termIds.length === 0 || modes.length === 0) {
    document.getElementById('setup-hint').textContent = '请至少选择一个术语和一个题型';
    return;
  }

  const res = await fetch('/api/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ termIds, modes })
  });
  questions = await res.json();

  if (questions.length === 0) {
    document.getElementById('setup-hint').textContent = '没有符合条件的题目';
    return;
  }

  currentIndex = 0;
  correctCount = 0;
  document.getElementById('setup-view').style.display = 'none';
  document.getElementById('quiz-view').style.display = 'block';

  showQuestion();
}

function showQuestion() {
  answered = false;
  const q = questions[currentIndex];

  document.getElementById('mode-badge').textContent = MODE_LABELS[q.mode] || q.mode;
  document.getElementById('counter').textContent = `${currentIndex + 1} / ${questions.length}`;
  document.getElementById('prompt').textContent = q.prompt;
  document.getElementById('answer').value = '';
  document.getElementById('answer').disabled = false;
  document.getElementById('answer').focus();
  document.getElementById('feedback').innerHTML = '';
  document.getElementById('post-answer').style.display = 'none';
  document.getElementById('done-card').style.display = 'none';

  const progress = (currentIndex / questions.length) * 100;
  document.getElementById('progress').style.width = `${progress}%`;
}

function normalize(s) {
  return String(s).trim().toLowerCase().replace(/\s+/g, ' ');
}

function checkAnswer(q, answer) {
  const a = normalize(answer);
  return q.expected.some((e) => normalize(e) === a);
}

async function submitAnswer() {
  if (answered) return;
  answered = true;

  const q = questions[currentIndex];
  const input = document.getElementById('answer');
  const answer = input.value;
  const correct = checkAnswer(q, answer);

  if (correct) correctCount++;

  const fb = document.getElementById('feedback');
  fb.className = `feedback ${correct ? 'correct' : 'wrong'}`;
  fb.textContent = correct ? '✓ 正确' : `✗ 错误，参考答案：${q.display}`;

  input.disabled = true;

  q._correct = correct;
  q._answer = answer;

  autoRating = correct ? 'good' : 'again';
  const label = correct ? 'Good · 正常（自动）' : 'Again · 忘了（自动）';
  document.getElementById('auto-rating').textContent = `自动评分：${label}`;
  document.getElementById('rating-override').style.display = 'none';
  document.getElementById('post-answer').style.display = 'block';

  if (correct) {
    autoTimer = setTimeout(() => {
      if (!answered) return;
      submitRating(autoRating);
    }, 1500);
  }
}

function toggleRatingOverride() {
  if (autoTimer) {
    clearTimeout(autoTimer);
    autoTimer = null;
  }
  const el = document.getElementById('rating-override');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function skipDelay() {
  if (autoTimer) {
    clearTimeout(autoTimer);
    autoTimer = null;
  }
  submitRating(autoRating);
}

async function rate(rating) {
  if (autoTimer) {
    clearTimeout(autoTimer);
    autoTimer = null;
  }
  await submitRating(rating);
}

async function submitRating(rating) {
  const q = questions[currentIndex];

  await fetch('/api/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cardId: q.id,
      correct: q._correct,
      rating
    })
  });

  currentIndex++;

  if (currentIndex >= questions.length) {
    finish();
  } else {
    showQuestion();
  }
}

async function initDueMode() {
  const cardIds = JSON.parse(sessionStorage.getItem('dueCards') || '[]');
  if (cardIds.length === 0) {
    document.getElementById('setup-view').innerHTML = '<div class="card">没有到期的卡片。<a href="/">返回主页</a></div>';
    return;
  }

  const res = await fetch('/api/questions-by-cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardIds })
  });
  questions = await res.json();

  if (questions.length === 0) {
    document.getElementById('setup-view').innerHTML = '<div class="card">没有可用的题目。<a href="/">返回主页</a></div>';
    return;
  }

  currentIndex = 0;
  correctCount = 0;
  document.getElementById('setup-view').style.display = 'none';
  document.getElementById('quiz-view').style.display = 'block';

  document.getElementById('answer').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (answered) return;
      submitAnswer();
    }
  });

  showQuestion();
}

function finish() {
  document.getElementById('progress').style.width = '100%';
  document.getElementById('prompt').textContent = '';
  document.getElementById('answer').style.display = 'none';
  document.getElementById('feedback').innerHTML = '';
  document.getElementById('post-answer').style.display = 'none';
  document.getElementById('done-card').style.display = 'block';
  document.getElementById('summary').textContent =
    `本次共 ${questions.length} 题，正确 ${correctCount} 题，正确率 ${Math.round((correctCount / questions.length) * 100)}%。`;
}

init();