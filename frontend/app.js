/* ============================================================
   DocuChat — App JavaScript
   Upload • Chat • Source Modal • Toasts • Particles
   ============================================================ */

const API_BASE = window.location.origin;   // Same-origin with FastAPI

// ── DOM refs ─────────────────────────────────────────────────
const apiKeyInput        = document.getElementById('api-key-input');
const toggleKeyBtn       = document.getElementById('toggle-key-btn');
const eyeIcon            = document.getElementById('eye-icon');

const statusPill         = document.getElementById('status-pill');
const statusDot          = document.getElementById('status-dot');
const statusText         = document.getElementById('status-text');

const uploadZone         = document.getElementById('upload-zone');
const fileInput          = document.getElementById('file-input');
const uploadProgressWrap = document.getElementById('upload-progress-wrapper');
const uploadFilename     = document.getElementById('upload-filename');
const uploadPct          = document.getElementById('upload-pct');
const progressFill       = document.getElementById('progress-fill');
const uploadStatusText   = document.getElementById('upload-status-text');

const docList            = document.getElementById('doc-list');
const docListEmpty       = document.getElementById('doc-list-empty');
const docCount           = document.getElementById('doc-count');

const chatHero           = document.getElementById('chat-hero');
const messagesContainer  = document.getElementById('messages-container');

const chatInput          = document.getElementById('chat-input');
const sendBtn            = document.getElementById('send-btn');
const sendIcon           = document.getElementById('send-icon');
const loadingIcon        = document.getElementById('loading-icon');

const toastContainer     = document.getElementById('toast-container');

const modalOverlay       = document.getElementById('modal-overlay');
const modalBody          = document.getElementById('modal-body');
const modalClose         = document.getElementById('modal-close');

const clearChatBtn       = document.getElementById('clear-chat-btn');

// ── State ──────────────────────────────────────────────────────
let documents    = [];   // {id, name, pages, chunks}
let isLoading    = false;
let currentSources = [];
let messageCount = 0;

// ── API key persistence ─────────────────────────────────────────
const STORAGE_KEY = 'docuchat_api_key';

function loadApiKey() {
  const saved = localStorage.getItem(STORAGE_KEY) || '';
  if (saved) apiKeyInput.value = saved;
}

apiKeyInput.addEventListener('input', () => {
  localStorage.setItem(STORAGE_KEY, apiKeyInput.value.trim());
  updateSendBtnState();
});

toggleKeyBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  eyeIcon.innerHTML = isPassword
    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
});

// ── Health check ──────────────────────────────────────────────
async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('not ok');
    const data = await res.json();
    statusPill.className = 'status-pill healthy';
    statusDot.className  = 'status-dot';
    statusText.textContent = `Connected · ${data.documents_indexed} doc${data.documents_indexed !== 1 ? 's' : ''}`;
  } catch {
    statusPill.className = 'status-pill error';
    statusDot.className  = 'status-dot';
    statusText.textContent = 'Backend offline';
  }
}

// ── Document management ───────────────────────────────────────
async function fetchDocuments() {
  try {
    const res = await fetch(`${API_BASE}/documents`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return;
    const data = await res.json();
    documents = data.documents || [];
    renderDocuments();
    updateSendBtnState();
    await checkHealth();
  } catch {
    // silent — health check will show error
  }
}

function renderDocuments() {
  docCount.textContent = documents.length;

  Array.from(docList.querySelectorAll('.doc-item')).forEach(el => el.remove());

  if (documents.length === 0) {
    docListEmpty.style.display = '';
    return;
  }
  docListEmpty.style.display = 'none';

  documents.forEach(doc => {
    const item = createDocItem(doc);
    docList.appendChild(item);
  });
}

function createDocItem(doc) {
  const div = document.createElement('div');
  div.className = 'doc-item';
  div.setAttribute('role', 'listitem');
  div.setAttribute('data-doc-id', doc.id);
  div.innerHTML = `
    <div class="doc-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    </div>
    <div class="doc-info">
      <div class="doc-name" title="${escHtml(doc.name)}">${escHtml(doc.name)}</div>
      <div class="doc-meta">
        <span class="doc-badge">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          ${doc.pages}p
        </span>
        <span class="doc-badge">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          ${doc.chunks} chunks
        </span>
      </div>
    </div>
    <button class="doc-delete" aria-label="Delete ${escHtml(doc.name)}" title="Remove document">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
      </svg>
    </button>
  `;

  div.querySelector('.doc-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteDocument(doc.id, doc.name, div);
  });

  return div;
}

async function deleteDocument(docId, name, itemEl) {
  // Optimistic UI: fade out immediately
  itemEl.style.opacity = '0.4';
  itemEl.style.pointerEvents = 'none';

  try {
    const res = await fetch(`${API_BASE}/documents/${docId}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      itemEl.style.opacity = '';
      itemEl.style.pointerEvents = '';
      showToast(err.detail || 'Delete failed', 'error');
      return;
    }
    documents = documents.filter(d => d.id !== docId);
    renderDocuments();
    updateSendBtnState();
    showToast(`"${name}" removed`, 'success');
    await checkHealth();
  } catch {
    itemEl.style.opacity = '';
    itemEl.style.pointerEvents = '';
    showToast('Network error deleting document', 'error');
  }
}

// ── Upload ────────────────────────────────────────────────────
uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });

uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', e => {
  if (!uploadZone.contains(e.relatedTarget)) uploadZone.classList.remove('drag-over');
});
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
  fileInput.value = '';  // allow re-uploading same file
});

async function handleFile(file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Only PDF files are supported', 'error');
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    showToast('File exceeds 50 MB limit', 'error');
    return;
  }

  uploadProgressWrap.hidden = false;
  uploadFilename.textContent = file.name;
  setProgress(0, 'Uploading…');

  const formData = new FormData();
  formData.append('file', file);

  let progressTimer;
  try {
    progressTimer = simulateProgress(0, 55, 1000);

    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });

    clearInterval(progressTimer);
    setProgress(75, 'Embedding document…');

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Upload failed');
    }

    const data = await res.json();
    setProgress(100, 'Done!');

    setTimeout(() => {
      uploadProgressWrap.hidden = true;
      setProgress(0, 'Uploading…');
    }, 1800);

    showToast(`"${data.filename}" indexed — ${data.chunks_created} chunks`, 'success');
    await fetchDocuments();
  } catch (err) {
    clearInterval(progressTimer);
    setProgress(0, '');
    uploadProgressWrap.hidden = true;
    showToast(err.message || 'Upload failed', 'error');
  }
}

function setProgress(pct, text) {
  progressFill.style.width = `${pct}%`;
  uploadPct.textContent = `${pct}%`;
  if (text !== undefined) uploadStatusText.textContent = text;
}

function simulateProgress(from, to, duration) {
  const steps = duration / 50;
  const step = (to - from) / steps;
  let current = from;
  return setInterval(() => {
    current = Math.min(current + step, to);
    progressFill.style.width = `${current}%`;
    uploadPct.textContent = `${Math.round(current)}%`;
  }, 50);
}

// ── Chat ──────────────────────────────────────────────────────
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 150)}px`;
  updateSendBtnState();
});

chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

function updateSendBtnState() {
  const hasText   = chatInput.value.trim().length > 0;
  const hasApiKey = apiKeyInput.value.trim().length > 0;
  const hasDocs   = documents.length > 0;
  sendBtn.disabled = !hasText || !hasApiKey || !hasDocs || isLoading;

  // Update placeholder to guide user on what's missing
  if (!hasApiKey) {
    chatInput.placeholder = 'Enter your Gemini API key first…';
  } else if (!hasDocs) {
    chatInput.placeholder = 'Upload a PDF to start chatting…';
  } else {
    chatInput.placeholder = 'Ask a question about your documents…';
  }
}

// Hero suggestion chips
document.querySelectorAll('.hero-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const query = chip.dataset.query;
    chatInput.value = query;
    chatInput.style.height = 'auto';
    chatInput.style.height = `${chatInput.scrollHeight}px`;
    updateSendBtnState();
    chatInput.focus();
  });
});

// Clear chat
if (clearChatBtn) {
  clearChatBtn.addEventListener('click', () => {
    if (messageCount === 0) return;
    messagesContainer.innerHTML = '';
    messagesContainer.classList.remove('active');
    chatHero.classList.remove('hidden');
    messageCount = 0;
    currentSources = [];
    clearChatBtn.classList.add('hidden');
  });
}

async function sendMessage() {
  const query = chatInput.value.trim();
  if (!query || isLoading) return;

  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    showToast('Please enter your Gemini API key', 'error');
    apiKeyInput.focus();
    return;
  }

  if (documents.length === 0) {
    showToast('Upload a PDF document first', 'info');
    return;
  }

  showChatView();
  appendMessage('user', query);

  chatInput.value = '';
  chatInput.style.height = 'auto';

  isLoading = true;
  updateSendBtnState();
  sendIcon.classList.add('hidden');
  loadingIcon.classList.remove('hidden');

  const typingEl = appendTypingIndicator();

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, api_key: apiKey, k: 4 }),
    });

    typingEl.remove();

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Chat request failed' }));
      throw new Error(err.detail || 'Chat failed');
    }

    const data = await res.json();
    appendMessage('assistant', data.answer, data.sources);

  } catch (err) {
    typingEl.remove();
    appendMessage('assistant', `⚠️ ${err.message}`, []);
    showToast(err.message, 'error');
  } finally {
    isLoading = false;
    sendIcon.classList.remove('hidden');
    loadingIcon.classList.add('hidden');
    updateSendBtnState();
  }
}

function showChatView() {
  chatHero.classList.add('hidden');
  messagesContainer.classList.add('active');
  if (clearChatBtn) clearChatBtn.classList.remove('hidden');
}

function appendMessage(role, content, sources = []) {
  const time    = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const initial = role === 'user' ? 'Y' : '✦';
  messageCount++;

  const div = document.createElement('div');
  div.className = `message ${role}`;

  const sourcesHtml = (role === 'assistant' && sources.length > 0)
    ? `<button class="sources-btn" aria-label="View ${sources.length} source${sources.length > 1 ? 's' : ''}">
         <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
         ${sources.length} source${sources.length > 1 ? 's' : ''}
       </button>`
    : '';

  div.innerHTML = `
    <div class="msg-avatar" aria-hidden="true">${initial}</div>
    <div class="msg-body">
      <div class="msg-bubble">${formatMessage(content)}</div>
      <div class="msg-meta">
        <span class="msg-time">${time}</span>
        ${sourcesHtml}
      </div>
    </div>
  `;

  if (sources.length > 0) {
    const srcBtn = div.querySelector('.sources-btn');
    srcBtn.addEventListener('click', () => openSourcesModal(sources));
  }

  messagesContainer.appendChild(div);
  // Smooth scroll to bottom
  messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });

  return div;
}

function formatMessage(text) {
  // Escape HTML first, then apply markdown-like formatting
  let safe = escHtml(text);
  safe = safe
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
  return `<p>${safe}</p>`;
}

function appendTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'typing-indicator';
  div.innerHTML = `
    <div class="msg-avatar" aria-hidden="true">✦</div>
    <div class="typing-bubble" aria-label="AI is thinking">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  messagesContainer.appendChild(div);
  messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
  return div;
}

// ── Sources Modal ──────────────────────────────────────────────
function openSourcesModal(sources) {
  modalBody.innerHTML = '';

  sources.forEach((src, i) => {
    // Use the pre-calculated similarity_pct if available; fallback for old responses
    const matchPct = src.similarity_pct !== undefined
      ? `${src.similarity_pct}%`
      : null;

    const pageMeta = src.metadata?.page !== undefined
      ? `<div class="source-meta-item"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg><span>Page <strong>${src.metadata.page + 1}</strong></span></div>`
      : '';

    const fileMeta = src.metadata?.filename
      ? `<div class="source-meta-item"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><span><strong>${escHtml(src.metadata.filename)}</strong></span></div>`
      : '';

    const card = document.createElement('div');
    card.className = 'source-card';
    card.innerHTML = `
      <div class="source-card-header">
        <div class="source-card-title">
          <div class="source-number">${i + 1}</div>
          Source ${i + 1}
        </div>
        ${matchPct ? `<span class="relevance-badge">${matchPct} match</span>` : ''}
      </div>
      <div class="source-card-body">
        <p class="source-content">${escHtml(src.content)}</p>
        ${(pageMeta || fileMeta) ? `<div class="source-meta">${fileMeta}${pageMeta}</div>` : ''}
      </div>
    `;
    modalBody.appendChild(card);
  });

  modalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
  modalClose.focus();
}

function closeModal() {
  modalOverlay.hidden = true;
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modalOverlay.hidden) closeModal(); });

// ── Toasts ─────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `<div class="toast-dot"></div><span>${escHtml(message)}</span>`;
  toastContainer.appendChild(toast);
  toast.addEventListener('animationend', e => {
    if (e.animationName === 'toast-out') toast.remove();
  });
}

// ── Helpers ────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Particles (canvas) ────────────────────────────────────────
function initParticles() {
  const container = document.getElementById('bg-particles');
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0.3;';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let W, H, particles = [];
  let rafId;

  const COLORS = ['#6C63FF', '#00C9FF', '#FC5C7D', '#8B84FF'];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function createParticles() {
    particles = Array.from({ length: 50 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.6 + 0.4,
      dx: (Math.random() - 0.5) * 0.25,
      dy: (Math.random() - 0.5) * 0.25,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: Math.random() * 0.45 + 0.15,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color + Math.floor(p.alpha * 255).toString(16).padStart(2, '0');
      ctx.fill();
      p.x += p.dx;
      p.y += p.dy;
      if (p.x < 0 || p.x > W) p.dx *= -1;
      if (p.y < 0 || p.y > H) p.dy *= -1;
    });
    rafId = requestAnimationFrame(draw);
  }

  resize();
  createParticles();
  draw();

  window.addEventListener('resize', () => {
    cancelAnimationFrame(rafId);
    resize();
    createParticles();
    draw();
  });
}

// ── Init ──────────────────────────────────────────────────────
(async function init() {
  loadApiKey();
  updateSendBtnState();
  initParticles();
  await fetchDocuments();
  await checkHealth();

  // Poll health every 30s
  setInterval(checkHealth, 30_000);
})();
