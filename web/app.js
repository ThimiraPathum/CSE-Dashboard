'use strict';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const state = { model: null, dataset: null, view: 'overview', page: 1, busy: false, file: null };
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct = (n, digits = 2) => `${(n * 100).toFixed(digits)}%`;
const number = (n) => new Intl.NumberFormat('en').format(n);
const arrowIcon = '<svg aria-hidden="true"><use href="#i-arrow"/></svg>';
let toastTimer;

async function api(path, options = {}) {
  let response;
  try { response = await fetch(path, options); }
  catch { throw new Error('Cannot reach the local dashboard. Check that its server is running, then try again.'); }
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.detail || `The request failed (${response.status}). Please try again.`);
  if (!payload) throw new Error('The server returned an unreadable response. Please restart the dashboard.');
  return payload;
}

function showError(selector, message) {
  const node = $(selector);
  node.textContent = message || '';
  node.hidden = !message;
}

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4000);
}

function setBusy(busy) {
  state.busy = busy;
  document.body.classList.toggle('busy', busy);
  $('#run-predictions').disabled = busy;
  $('#run-predictions').innerHTML = busy ? 'Scoring dataset…' : `Run model ${arrowIcon}`;
  $('#load-demo').disabled = busy;
  $('#export-results').disabled = busy || !state.dataset;
  $('#results-panel').setAttribute('aria-busy', String(busy));
}

function switchView(view) {
  if (!['overview', 'screener', 'model'].includes(view)) view = 'overview';
  state.view = view;
  state.page = 1;
  const labels = {
    overview: ['Overview', 'A clearer view of your universe.', 'Explore your market day with the AlphaIQ model ensemble.'],
    screener: ['Stock screener', 'Every candidate. A closer look.', 'Search, compare and inspect the scores in your current dataset.'],
    model: ['Model explorer', 'Understand what powers the score.', 'Explore the frozen model, its inputs and the boundaries of its outputs.'],
  };
  $('#breadcrumb-current').textContent = labels[view][0];
  $('#page-title').textContent = labels[view][1];
  $('#page-subtitle').textContent = labels[view][2];
  $('#view-overview').hidden = view !== 'overview';
  $('#view-model').hidden = view !== 'model';
  $('#results-panel').hidden = view === 'model';
  $('#dataset-strip').hidden = view === 'model';
  $$('.nav-link').forEach(link => {
    const selected = link.dataset.view === view;
    link.classList.toggle('active', selected);
    if (selected) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  history.replaceState(null, '', `#${view}`);
  renderTable();
}

function renderModel() {
  const model = state.model;
  $('#runtime-pill').innerHTML = `<span class="status-dot" style="${model.model_ready ? '' : 'background:#d39354'}"></span>${model.model_ready ? 'Model connected' : 'Model unavailable'}`;
  $('#threshold-label').textContent = `${pct(model.threshold)} threshold`;
  const facts = [
    ['Model', model.name], ['State', 'Experimental research'],
    ['Architecture', `${model.model_type} · FULL34 + TOP25`],
    ['Training cutoff', `Through ${model.training_cutoff}`],
    ['Training rows', number(model.training_rows)], ['Calibration rows', number(model.calibration_rows)],
    ['Frozen threshold', model.threshold.toPrecision(10)], ['Trading gates', 'Not included / not applied'],
  ];
  $('#provenance').innerHTML = facts.map(([label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('');
  const verification = model.verification;
  $('#runtime-detail').innerHTML = `
    <p><strong>${model.model_ready ? 'The local model is ready.' : 'The local model could not load.'}</strong> Inference uses the original preprocessor, two XGBoost models and saved calibrators.</p>
    <div class="runtime-versions">${Object.entries(model.runtime_versions).map(([key, value]) => `<span>${escapeHTML(key)} ${escapeHTML(value || 'missing')}</span>`).join('')}</div>
    <p><strong>Archived verification record</strong><br>${number(verification.frozen_candidates)} frozen 2025 predictions · ${verification.signal_mismatches} recorded threshold mismatches.<br>Maximum recorded probability difference: ${Number(verification.max_probability_error).toExponential(2)}.</p>
    <p>This record checks reproduction of saved predictions. It does not demonstrate profitable performance, and the original reference predictions are not included here.</p>
    ${model.warnings.filter(w => w.startsWith('Runtime ')).map(w => `<p class="runtime-warning">${escapeHTML(w)}</p>`).join('')}
    ${model.error ? `<p class="runtime-warning">${escapeHTML(model.error)}</p>` : ''}`;
  $('#features-list').innerHTML = model.feature_details.map((feature, index) => `<div class="feature-item" title="${escapeHTML(feature.description || feature.label)}"><code>${String(index + 1).padStart(2, '0')} · ${escapeHTML(feature.name)}</code>${feature.description ? `<p>${escapeHTML(feature.description)}</p>` : ''}<small><span>${escapeHTML(feature.group)}</span>${feature.is_top25 ? '<span class="top25">TOP25</span>' : '<span>FULL34</span>'}</small></div>`).join('');
  if (model.error) showError('#global-error', model.error);
}

function applyDataset(dataset) {
  state.dataset = dataset;
  state.page = 1;
  $('#search').value = '';
  $('#above-only').checked = false;
  $('#sort').value = 'score-desc';
  const demo = dataset.is_synthetic;
  $('#source-badge').textContent = demo ? 'SYNTHETIC DEMO' : 'UPLOADED DATA';
  $('#source-badge').classList.toggle('uploaded', !demo);
  $('#dataset-label').textContent = demo ? 'Artificial features · real model inference' : dataset.filename;
  $('#dataset-label').title = demo ? 'Fictional symbols and generated features. This is not live or historical CSE data.' : dataset.filename;
  $('#dataset-date').textContent = `${demo ? 'Illustrative date' : 'As of'}: ${dataset.as_of}`;
  $('#load-demo').innerHTML = `${demo ? 'Reset demo' : 'Load synthetic demo'} <span>↗</span>`;
  $('#nav-count').textContent = number(dataset.count);
  $('#stat-count').textContent = number(dataset.count);
  $('#stat-count-note').textContent = demo ? 'Fictional candidates in this demo' : 'Completeness acknowledged by uploader';
  $('#stat-mean').innerHTML = `${(dataset.summary.mean_probability * 100).toFixed(2)}<span class="percent-sign">%</span>`;
  $('#stat-above').textContent = number(dataset.summary.above_threshold);
  $('#stat-max').innerHTML = `${(dataset.summary.max_probability * 100).toFixed(2)}<span class="percent-sign">%</span>`;
  $('#stat-max-note').textContent = `${dataset.rows[0]?.symbol || '—'} · highest in this dataset`;
  $('#export-results').disabled = false;
  showError('#global-error', '');
  renderDistribution();
  renderTable();
}

function renderDistribution() {
  const dataset = state.dataset;
  if (!dataset) return;
  const scores = dataset.rows.map(row => row.ensemble_p);
  let min = Math.max(0, Math.floor(Math.min(...scores) / .025) * .025);
  let max = Math.min(1, Math.ceil(Math.max(...scores) / .025) * .025);
  if (max <= min) { min = Math.max(0, min - .025); max = Math.min(1, max + .025); }
  const bins = Array.from({ length: 10 }, () => 0);
  scores.forEach(score => bins[Math.min(9, Math.floor((score - min) / (max - min) * 10))]++);
  const peak = Math.max(...bins, 1);
  const chartTop = 12, chartBottom = 119, chartLeft = 28, chartRight = 500;
  const width = chartRight - chartLeft;
  const lines = [0, .5, 1].map(fraction => {
    const y = chartBottom - fraction * (chartBottom - chartTop);
    return `<line x1="${chartLeft}" y1="${y}" x2="${chartRight}" y2="${y}" stroke="#edf2eb" stroke-dasharray="3 4"/><text x="15" y="${y + 3}" text-anchor="end">${Math.round(peak * fraction)}</text>`;
  }).join('');
  const bars = bins.map((count, i) => {
    const barHeight = (count / peak) * (chartBottom - chartTop);
    const lower = min + i / 10 * (max - min), upper = min + (i + 1) / 10 * (max - min);
    return `<rect x="${chartLeft + i * width / 10 + 5}" y="${chartBottom - Math.max(barHeight, 1)}" width="${width / 10 - 10}" height="${Math.max(barHeight, 1)}" rx="3" fill="${count ? 'url(#bar-fill)' : '#eaf0e5'}"><title>${pct(lower, 1)}–${pct(upper, 1)}: ${count} candidates</title></rect>`;
  }).join('');
  const labels = [0, .25, .5, .75, 1].map(f => `<text x="${chartLeft + f * width}" y="141" text-anchor="middle">${pct(min + f * (max - min), 1)}</text>`).join('');
  const thresholdPosition = chartLeft + (dataset.threshold - min) / (max - min) * width;
  const thresholdLine = dataset.threshold > min && dataset.threshold < max ? `<line x1="${thresholdPosition}" y1="7" x2="${thresholdPosition}" y2="119" stroke="#b59752" stroke-dasharray="3 3"/><text x="${thresholdPosition}" y="4" text-anchor="middle" style="fill:#b59752;font-size:8px">Threshold</text>` : '';
  $('#distribution').innerHTML = `<svg class="histogram" viewBox="0 0 520 150" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="bar-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#568e70"/><stop offset="1" stop-color="#a9c7ab"/></linearGradient></defs>${lines}${bars}${labels}${thresholdLine}</svg>`;
  $('#distribution').setAttribute('aria-label', `Distribution of ${dataset.count} ${dataset.is_synthetic ? 'synthetic' : 'uploaded'} candidates. Scores range from ${pct(Math.min(...scores))} to ${pct(Math.max(...scores))}. ${dataset.summary.above_threshold} above the ${pct(dataset.threshold)} frozen threshold.`);
  $('#distribution-note').textContent = `Range ${pct(Math.min(...scores), 1)} – ${pct(Math.max(...scores), 1)}`;
}

function filteredRows() {
  if (!state.dataset) return [];
  const query = $('#search').value.trim().toLowerCase();
  let rows = state.dataset.rows.filter(row => (!query || `${row.symbol} ${row.name || ''}`.toLowerCase().includes(query)) && (!$('#above-only').checked || row.above_frozen_threshold));
  const sort = $('#sort').value;
  rows.sort((a, b) => sort === 'symbol' ? a.symbol.localeCompare(b.symbol) : sort === 'score-asc' ? a.ensemble_p - b.ensemble_p : b.ensemble_p - a.ensemble_p);
  return rows;
}

function renderTable() {
  const rows = filteredRows();
  const pageSize = state.view === 'screener' ? 15 : 6;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  state.page = Math.max(1, Math.min(state.page, pages));
  const start = (state.page - 1) * pageSize;
  $('#table-count').textContent = number(rows.length);
  $('#table-title').firstChild.textContent = state.view === 'screener' ? 'All candidate scores ' : 'Candidate scores ';
  $('#results-body').innerHTML = rows.length ? rows.slice(start, start + pageSize).map((row, i) => `<tr><td>${String(start + i + 1).padStart(2, '0')}</td><td><div class="candidate-cell"><span class="ticker-avatar">${escapeHTML(row.symbol.slice(0, 2))}</span><div><strong>${escapeHTML(row.symbol)}</strong><small>${escapeHTML(row.name || 'Uploaded candidate')}</small></div></div></td><td>${pct(row.p_FULL34)}</td><td>${pct(row.p_FULL_TOP25)}</td><td class="ensemble-cell">${pct(row.ensemble_p)}<span class="score-line"><i style="width:${Math.min(100, row.ensemble_p * 100)}%"></i></span></td><td><span class="status-chip ${row.above_frozen_threshold ? 'above' : ''}">${row.above_frozen_threshold ? 'Above threshold' : 'Below threshold'}</span></td><td><button class="detail-button" data-symbol="${escapeHTML(row.symbol)}" aria-label="View ${escapeHTML(row.symbol)} details">${arrowIcon}</button></td></tr>`).join('') : `<tr><td colspan="7" class="empty-state">${state.dataset ? 'No candidates match these filters. Try another symbol or clear the threshold filter.' : 'Import a CSV or load the synthetic demo to explore predictions.'}</td></tr>`;
  $('#showing-label').textContent = rows.length ? `Showing ${start + 1}–${Math.min(start + pageSize, rows.length)} of ${number(rows.length)} candidates${state.dataset.is_synthetic ? ' · synthetic data' : ''}` : state.dataset ? '0 matching candidates' : 'No candidates loaded';
  $('#page-label').textContent = `${state.page} / ${pages}`;
  $('#page-prev').disabled = state.page <= 1;
  $('#page-next').disabled = state.page >= pages;
}

function showCandidate(symbol) {
  const row = state.dataset?.rows.find(item => item.symbol === symbol);
  if (!row) return;
  $('#detail-title').textContent = row.symbol;
  $('#candidate-detail').innerHTML = `<p class="detail-context">${escapeHTML(row.name || 'Uploaded candidate')} · ${escapeHTML(row.date)}${state.dataset.is_synthetic ? '<br><strong>Synthetic example — not real market data.</strong>' : ''}</p><div class="detail-scores"><div><span>FULL34</span><strong>${pct(row.p_FULL34)}</strong></div><div><span>TOP25</span><strong>${pct(row.p_FULL_TOP25)}</strong></div><div><span>ENSEMBLE</span><strong>${pct(row.ensemble_p)}</strong></div></div><p class="detail-context">${row.above_frozen_threshold ? 'Above' : 'Below'} the ${pct(state.dataset.threshold)} frozen threshold. Trading eligibility and price-risk gates have not been applied.</p><h3 style="font-size:12px;margin-top:20px">Input features</h3><div class="feature-values"><table><thead><tr><th>Feature</th><th>Uploaded / generated value</th></tr></thead><tbody>${Object.entries(row.features).map(([key, value]) => `<tr><td>${escapeHTML(key)}</td><td>${Number(value).toPrecision(7)}</td></tr>`).join('')}</tbody></table></div>`;
  $('#detail-dialog').showModal();
}

function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function csvCell(value) {
  let text = String(value ?? '');
  if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function exportResults() {
  if (!state.dataset) return;
  const rows = filteredRows();
  if (!rows.length) { toast('No matching candidates to export. Clear your filters first.'); return; }
  const headers = ['date', 'symbol', 'name', 'p_FULL34', 'p_FULL_TOP25', 'ensemble_p', 'above_frozen_threshold', 'frozen_threshold', 'data_source', 'is_synthetic', 'risk_gates_applied'];
  const data = rows.map(row => [row.date, row.symbol, row.name, row.p_FULL34, row.p_FULL_TOP25, row.ensemble_p, row.above_frozen_threshold, state.dataset.threshold, state.dataset.source, state.dataset.is_synthetic, false]);
  const csv = '\uFEFF' + [headers, ...data].map(row => row.map(csvCell).join(',')).join('\r\n');
  download(csv, `alphaiq_${state.dataset.is_synthetic ? 'SYNTHETIC_' : ''}scores_${state.dataset.as_of}.csv`, 'text/csv;charset=utf-8');
  toast(`Exported ${rows.length} candidate scores${state.dataset.is_synthetic ? ' (synthetic demo)' : ''}.`);
}

async function loadDemo() {
  if (state.busy) return;
  setBusy(true);
  showError('#global-error', '');
  try { applyDataset(await api('/api/demo')); }
  catch (error) { showError('#global-error', error.message); }
  finally { setBusy(false); }
}

function csvHeader(text) {
  const cells = []; let value = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted;
    } else if (c === ',' && !quoted) { cells.push(value); value = ''; }
    else if ((c === '\r' || c === '\n') && !quoted) { cells.push(value); return cells; }
    else value += c;
  }
  cells.push(value); return cells;
}

async function selectFile(file) {
  state.file = file || null;
  showError('#import-error', '');
  $('#universe-confirmed').checked = false;
  if (!file) {
    $('#file-label').textContent = 'Choose a CSV file';
    $('#file-description').textContent = 'or drop it here · maximum 5 MB';
    return;
  }
  $('#file-label').textContent = file.name;
  $('#file-description').textContent = `${(file.size / 1024).toFixed(1)} KB · ready to validate`;
  if (!file.name.toLowerCase().endsWith('.csv')) { showError('#import-error', 'Choose a .csv file.'); return; }
  if (file.size > 5 * 1024 * 1024) { showError('#import-error', 'This file is larger than 5 MB. Upload one complete market day of 5 MB or less.'); return; }
  try {
    const headers = csvHeader(await file.slice(0, 65536).text());
    if (state.file !== file) return;
    if (state.model) {
      const required = ['date', 'symbol', ...state.model.features];
      const missing = required.filter(name => !headers.includes(name));
      $('#file-description').textContent = `${(file.size / 1024).toFixed(1)} KB · ${state.model.features.filter(name => headers.includes(name)).length}/34 model features found`;
      if (missing.length) showError('#import-error', `Missing ${missing.length} required column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}. Use the original feature pipeline to prepare these values before scoring.`);
    }
  } catch { showError('#import-error', 'The file could not be read. Choose it again and retry.'); }
}

$$('[data-view]').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));
$('.brand').addEventListener('click', event => { event.preventDefault(); switchView('overview'); });
$$('[data-open-import]').forEach(button => button.addEventListener('click', () => $('#import-dialog').showModal()));
$$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$$('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
}));
$('#load-demo').addEventListener('click', loadDemo);
$('#export-results').addEventListener('click', exportResults);
$('#results-body').addEventListener('click', event => { const button = event.target.closest('[data-symbol]'); if (button) showCandidate(button.dataset.symbol); });
['#search', '#above-only', '#sort'].forEach(selector => $(selector).addEventListener(selector === '#search' ? 'input' : 'change', () => { state.page = 1; renderTable(); }));
$('#page-prev').addEventListener('click', () => { state.page--; renderTable(); });
$('#page-next').addEventListener('click', () => { state.page++; renderTable(); });
$('#download-model').addEventListener('click', () => { if (state.model) download(JSON.stringify(state.model, null, 2), 'alphaiq_model_metadata.json', 'application/json'); });
$('#csv-file').addEventListener('change', event => selectFile(event.target.files[0]));
const zone = $('#upload-zone');
['dragenter', 'dragover'].forEach(type => zone.addEventListener(type, event => { event.preventDefault(); zone.classList.add('dragging'); }));
['dragleave', 'drop'].forEach(type => zone.addEventListener(type, event => { event.preventDefault(); zone.classList.remove('dragging'); }));
zone.addEventListener('drop', event => {
  if (event.dataTransfer.files.length) { $('#csv-file').files = event.dataTransfer.files; selectFile(event.dataTransfer.files[0]); }
});
$('#import-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (state.busy) return;
  const file = state.file || $('#csv-file').files[0];
  if (!file) { showError('#import-error', 'Choose a CSV file first.'); return; }
  if (!$('#universe-confirmed').checked) { showError('#import-error', 'Confirm the candidate universe and feature preparation first.'); return; }
  const form = new FormData(); form.append('file', file); form.append('universe_confirmed', 'true');
  showError('#import-error', '');
  setBusy(true);
  try {
    const dataset = await api('/api/predict', { method: 'POST', body: form });
    applyDataset(dataset); switchView('overview'); $('#import-dialog').close();
    toast(`Scored ${dataset.count} candidates from ${dataset.filename}.`);
  } catch (error) { showError('#import-error', error.message); }
  finally { setBusy(false); }
});

async function initialize() {
  switchView(location.hash.slice(1) || 'overview');
  try {
    state.model = await api('/api/model');
    renderModel();
    if (state.model.model_ready) await loadDemo();
  } catch (error) {
    $('#runtime-pill').textContent = 'Model disconnected';
    showError('#global-error', error.message);
  }
}
initialize();
