const AppConfig = {
  defaultTab: 'income',
  years: [2025, 2026, 2027, 2028],
  defaultSortField: 'date',
  defaultSortDirection: 'desc'
};

const Dom = {
  groupNameInput: document.getElementById('groupNameInput'),
  yearSelect: document.getElementById('yearSelect'),
  categoryFilter: document.getElementById('categoryFilter'),
  sortFieldSelect: document.getElementById('sortFieldSelect'),
  sortDirectionSelect: document.getElementById('sortDirectionSelect'),
  summaryArea: document.getElementById('summaryArea'),
  cardList: document.getElementById('cardList'),
  tabButtons: Array.from(document.querySelectorAll('.tab-btn')),
  addBtnTop: document.getElementById('addBtnTop'),
  addBtnFab: document.getElementById('addBtnFab'),
  pdfBtn: document.getElementById('pdfBtn'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  importCsvBtn: document.getElementById('importCsvBtn'),
  csvFileInput: document.getElementById('csvFileInput'),
  storageStatus: document.getElementById('storageStatus'),
  modalOverlay: document.getElementById('modalOverlay'),
  modalTitle: document.getElementById('modalTitle'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  saveBtn: document.getElementById('saveBtn'),
  formType: document.getElementById('formType'),
  formYear: document.getElementById('formYear'),
  formCategory: document.getElementById('formCategory'),
  formName: document.getElementById('formName'),
  formDate: document.getElementById('formDate'),
  formAmount: document.getElementById('formAmount'),
  formMemo: document.getElementById('formMemo'),
  categoryCandidates: document.getElementById('categoryCandidates'),
  printPreviewSection: document.getElementById('printPreviewSection'),
  printPreviewBody: document.getElementById('printPreviewBody')
};

const DataStore = (() => {
  const STORAGE_KEY = 'finance-report-mobile-first-v1';
  const defaultItems = [];
  const defaultSettings = { groupName: '' };

  let sequence = 100;
  let items = [];
  let settings = { ...defaultSettings };

  const clone = value => JSON.parse(JSON.stringify(value));

  function normalizeItem(item) {
    return {
      id: Number(item.id),
      year: Number(item.year),
      type: item.type === 'expense' ? 'expense' : 'income',
      category: String(item.category || '').trim(),
      name: String(item.name || '').trim(),
      date: String(item.date || '').trim(),
      amount: Number(item.amount || 0),
      memo: String(item.memo || '').trim()
    };
  }

  function getNextSequence(sourceItems) {
    return sourceItems.reduce((max, x) => Math.max(max, Number(x.id || 0)), 100);
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        items = clone(defaultItems);
        settings = { ...defaultSettings };
        sequence = getNextSequence(items);
        return { loaded: false, message: '端末保存データはまだない。空の状態で開始した。' };
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.items)) {
        throw new Error('保存形式が不正');
      }

      items = parsed.items.map(normalizeItem);
      settings = { ...defaultSettings, ...(parsed.settings || {}) };
      sequence = Number(parsed.sequence || getNextSequence(items));
      return { loaded: true, message: `端末保存データを読込済み（${items.length}件）` };
    } catch (error) {
      items = clone(defaultItems);
      settings = { ...defaultSettings };
      sequence = getNextSequence(items);
      return { loaded: false, message: '保存データの読込に失敗したため空の状態で開始した。' };
    }
  }

  function persist() {
    const payload = {
      sequence,
      items,
      settings,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return payload.savedAt;
  }

  loadFromStorage();

  return {
    getAll() { return clone(items); },
    getById(id) { return clone(items.find(x => x.id === id) || null); },
    save(record) {
      const normalized = normalizeItem(record);
      if (normalized.id == null || Number.isNaN(normalized.id)) {
        normalized.id = ++sequence;
        items.push(clone(normalized));
        persist();
        return normalized.id;
      }
      const index = items.findIndex(x => x.id === normalized.id);
      if (index >= 0) {
        items[index] = clone(normalized);
        persist();
        return normalized.id;
      }
      normalized.id = ++sequence;
      items.push(clone(normalized));
      persist();
      return normalized.id;
    },
    remove(id) {
      items = items.filter(x => x.id !== id);
      persist();
    },
    load() { return loadFromStorage(); },
    setAll(newItems) {
      items = newItems.map(normalizeItem);
      sequence = getNextSequence(items);
      persist();
      return { count: items.length, savedAt: new Date().toISOString() };
    },
    getStorageSnapshot() {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    },
    getSettings() { return clone(settings); },
    setGroupName(groupName) {
      settings.groupName = String(groupName || '').trim();
      persist();
    }
  };
})();

const AppService = (() => {
  const state = {
    selectedTab: AppConfig.defaultTab,
    selectedYear: 2026,
    selectedCategory: 'all',
    editingId: null,
    sortField: AppConfig.defaultSortField,
    sortDirection: AppConfig.defaultSortDirection
  };

  function formatCurrency(value) {
    return '¥' + Number(value || 0).toLocaleString('ja-JP');
  }

  function formatDate(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('/');
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return `${formatDate(value)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function getGroupName() {
    return normalizeText(DataStore.getSettings().groupName);
  }

  function getDisplayGroupName() {
    return getGroupName() || '団体名未設定';
  }

  function setGroupName(value) {
    DataStore.setGroupName(value);
  }

  function compareValues(a, b) {
    const direction = state.sortDirection === 'asc' ? 1 : -1;
    const field = state.sortField;

    let left;
    let right;

    if (field === 'amount' || field === 'year' || field === 'id') {
      left = Number(a[field] || 0);
      right = Number(b[field] || 0);
    } else if (field === 'date') {
      left = String(a.date || '');
      right = String(b.date || '');
    } else {
      left = String(a[field] || '');
      right = String(b[field] || '');
    }

    if (left < right) return -1 * direction;
    if (left > right) return 1 * direction;

    const fallbackA = Number(a.id || 0);
    const fallbackB = Number(b.id || 0);
    if (fallbackA < fallbackB) return -1 * direction;
    if (fallbackA > fallbackB) return 1 * direction;
    return 0;
  }

  function getFilteredItems() {
    return DataStore.getAll()
      .filter(x => x.type === state.selectedTab)
      .filter(x => x.year === Number(state.selectedYear))
      .filter(x => state.selectedCategory === 'all' ? true : x.category === state.selectedCategory)
      .sort(compareValues);
  }

  function getItemsForYear(type) {
    return DataStore.getAll()
      .filter(x => x.type === type)
      .filter(x => x.year === Number(state.selectedYear))
      .sort(compareValues);
  }

  function getCategoriesByTabAndYear(tab, year) {
    return Array.from(new Set(
      DataStore.getAll()
        .filter(x => x.type === tab)
        .filter(x => x.year === Number(year))
        .map(x => x.category)
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, 'ja'));
  }

  function getAllCategories() {
    return Array.from(new Set(
      DataStore.getAll().map(x => x.category).filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, 'ja'));
  }

  function getSummary(items) {
    const total = items.reduce((sum, x) => sum + Number(x.amount || 0), 0);
    const latest = items[0]?.date || '';
    return { total, latest };
  }

  function validateForm(model) {
    if (!normalizeText(model.category)) return 'カテゴリを入力してください。';
    if (!normalizeText(model.name)) return '氏名 / 対象を入力してください。';
    if (!normalizeText(model.date)) return '日付を入力してください。';
    if (Number(model.amount) < 0 || normalizeText(model.amount) === '') return '金額を正しく入力してください。';
    return '';
  }

  function buildModelFromForm() {
    return {
      id: state.editingId,
      type: Dom.formType.value,
      year: Number(Dom.formYear.value),
      category: normalizeText(Dom.formCategory.value),
      name: normalizeText(Dom.formName.value),
      date: Dom.formDate.value,
      amount: Number(Dom.formAmount.value),
      memo: normalizeText(Dom.formMemo.value)
    };
  }

  function setFormFromModel(model) {
    Dom.formType.value = model.type;
    Dom.formYear.value = String(model.year);
    Dom.formCategory.value = model.category || '';
    Dom.formName.value = model.name || '';
    Dom.formDate.value = model.date || '';
    Dom.formAmount.value = model.amount ?? '';
    Dom.formMemo.value = model.memo || '';
  }

  function clearForm() {
    state.editingId = null;
    setFormFromModel({
      type: state.selectedTab,
      year: state.selectedYear,
      category: '',
      name: '',
      date: '',
      amount: '',
      memo: ''
    });
  }

  return {
    state,
    formatCurrency,
    formatDate,
    formatDateTime,
    getGroupName,
    getDisplayGroupName,
    setGroupName,
    getFilteredItems,
    getItemsForYear,
    getCategoriesByTabAndYear,
    getAllCategories,
    getSummary,
    validateForm,
    buildModelFromForm,
    setFormFromModel,
    clearForm
  };
})();

const UiRenderer = (() => {
  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function renderGroupName() {
    Dom.groupNameInput.value = AppService.getGroupName();
    document.title = `${AppService.getDisplayGroupName()}収支報告書`;
  }

  function renderYearOptions() {
    const html = AppConfig.years.map(year =>
      `<option value="${year}" ${year === AppService.state.selectedYear ? 'selected' : ''}>${year} 年度</option>`
    ).join('');
    Dom.yearSelect.innerHTML = html;
    Dom.formYear.innerHTML = html;
  }

  function renderTheme() {
    const root = document.documentElement;
    const isIncome = AppService.state.selectedTab === 'income';
    root.style.setProperty('--theme', isIncome ? 'var(--income)' : 'var(--expense)');
    root.style.setProperty('--theme-soft', isIncome ? 'var(--income-soft)' : 'var(--expense-soft)');
    root.style.setProperty('--theme-border', isIncome ? 'var(--income-border)' : 'var(--expense-border)');
  }

  function renderTabs() {
    Dom.tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === AppService.state.selectedTab));
  }

  function renderSortControls() {
    Dom.sortFieldSelect.value = AppService.state.sortField;
    Dom.sortDirectionSelect.value = AppService.state.sortDirection;
  }

  function renderCategoryFilter() {
    const categories = AppService.getCategoriesByTabAndYear(AppService.state.selectedTab, AppService.state.selectedYear);
    if (AppService.state.selectedCategory !== 'all' && !categories.includes(AppService.state.selectedCategory)) {
      AppService.state.selectedCategory = 'all';
    }
    Dom.categoryFilter.innerHTML = [
      '<option value="all">すべて</option>',
      ...categories.map(x => `<option value="${escapeHtml(x)}" ${x === AppService.state.selectedCategory ? 'selected' : ''}>${escapeHtml(x)}</option>`)
    ].join('');
  }

  function renderCategoryCandidates() {
    Dom.categoryCandidates.innerHTML = AppService.getAllCategories()
      .map(x => `<option value="${escapeHtml(x)}"></option>`)
      .join('');
  }

  function renderSummary() {
    const incomeSummary = AppService.getSummary(AppService.getItemsForYear('income'));
    const expenseSummary = AppService.getSummary(AppService.getItemsForYear('expense'));

    Dom.summaryArea.innerHTML = `
      <div class="summary-card income">
        <div class="k">収入合計</div>
        <div class="v">${escapeHtml(AppService.formatCurrency(incomeSummary.total))}</div>
      </div>
      <div class="summary-card expense">
        <div class="k">支出合計</div>
        <div class="v">${escapeHtml(AppService.formatCurrency(expenseSummary.total))}</div>
      </div>
    `;
  }

  function renderCards(items) {
    if (!items.length) {
      Dom.cardList.innerHTML = '<div class="empty">該当データがありません。<br>「＋追加」から登録してください。</div>';
      return;
    }

    Dom.cardList.innerHTML = items.map(item => `
      <article class="card">
        <div class="card-main">
          <div>
            <div class="chip-row">
              <span class="chip">${escapeHtml(item.category)}</span>
              <span class="chip">${escapeHtml(AppService.formatDate(item.date))}</span>
            </div>
            <div class="meta-title">${escapeHtml(item.name)}</div>
            <div class="meta-sub">${escapeHtml(item.memo || '詳細なし')}</div>
          </div>
          <div class="amount-box">
            <div class="amount-label">金額</div>
            <div class="amount">${escapeHtml(AppService.formatCurrency(item.amount))}</div>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn btn-secondary" type="button" data-edit-id="${item.id}">編集</button>
          <button class="btn btn-danger" type="button" data-delete-id="${item.id}">削除</button>
        </div>
      </article>
    `).join('');
  }

  function updateStorageStatus(message) {
    const snapshot = DataStore.getStorageSnapshot();
    if (!snapshot?.savedAt) {
      Dom.storageStatus.textContent = message || 'この端末の localStorage に未保存。';
      return;
    }
    Dom.storageStatus.textContent = `${message ? `${message} / ` : ''}最終保存: ${AppService.formatDateTime(snapshot.savedAt)}`;
  }

  function renderAll(statusMessage = '') {
    renderGroupName();
    renderYearOptions();
    renderTheme();
    renderTabs();
    renderSortControls();
    renderCategoryFilter();
    renderCategoryCandidates();
    renderSummary();
    renderCards(AppService.getFilteredItems());
    updateStorageStatus(statusMessage);
  }

  return { renderAll, updateStorageStatus };
})();

const CsvService = (() => {
  const headers = ['id', 'year', 'type', 'category', 'name', 'date', 'amount', 'memo'];

  function escapeCsv(value) {
    const text = String(value ?? '');
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function buildExportFileName() {
    return `${AppService.getGroupName() || '団体名未設定'}収支報告書.csv`;
  }

  function extractGroupNameFromFileName(fileName) {
    const baseName = String(fileName || '').replace(/\.[^.]+$/, '');
    const match = baseName.match(/^(.*)収支報告書$/);
    return match ? match[1].trim() : '';
  }

  function downloadCsv() {
    const items = DataStore.getAll().sort((a, b) => Number(a.id) - Number(b.id));
    const lines = [headers.join(','), ...items.map(item => headers.map(key => escapeCsv(item[key])).join(','))];
    const blob = new Blob(["\ufeff" + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildExportFileName();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];
      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  async function importFromFile(file) {
    const text = await file.text();
    const normalized = text.replace(/^\ufeff/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n').filter(line => line.trim() !== '');
    if (!lines.length) return [];
    const headerRow = parseCsvLine(lines[0]).map(x => x.trim());
    if (headerRow.join(',') !== headers.join(',')) {
      throw new Error('CSVヘッダーが不正。必要列: ' + headers.join(','));
    }
    return lines.slice(1).map((line, index) => {
      const cols = parseCsvLine(line);
      if (cols.length !== headers.length) {
        throw new Error(`${index + 2}行目の列数が不正`);
      }
      const row = Object.fromEntries(headers.map((key, i) => [key, cols[i]]));
      return {
        id: Number(row.id),
        year: Number(row.year),
        type: String(row.type || '').trim(),
        category: String(row.category || '').trim(),
        name: String(row.name || '').trim(),
        date: String(row.date || '').trim(),
        amount: Number(row.amount),
        memo: String(row.memo || '').trim()
      };
    });
  }

  return { downloadCsv, importFromFile, extractGroupNameFromFileName };
})();

const PrintService = (() => {
  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function buildRows(items) {
    if (!items.length) {
      return '<tr><td colspan="4" style="text-align:center; color:#666;">データなし</td></tr>';
    }
    return items.map(item => `
      <tr>
        <td>${escapeHtml(item.category)}</td>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(AppService.formatDate(item.date))}</td>
        <td class="amount-cell">${escapeHtml(AppService.formatCurrency(item.amount))}</td>
      </tr>
    `).join('');
  }

  function buildSection(title, key, items) {
    const summary = AppService.getSummary(items);
    return `
      <section class="report-section">
        <div class="report-section-title ${key}">${title}</div>
        <div class="report-mini-summary">
          <div class="report-badge ${key}">合計 ${escapeHtml(AppService.formatCurrency(summary.total))}</div>
          <div class="report-badge">最新日付 ${escapeHtml(summary.latest ? AppService.formatDate(summary.latest) : '-')}</div>
        </div>
        <div class="report-table-wrap">
          <table class="report-table">
            <thead>
              <tr>
                <th>項目</th>
                <th>氏名 / 対象</th>
                <th>日付</th>
                <th class="amount-cell">金額</th>
              </tr>
            </thead>
            <tbody>${buildRows(items)}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function buildHtml() {
    const incomeItems = AppService.getItemsForYear('income');
    const expenseItems = AppService.getItemsForYear('expense');
    const incomeSummary = AppService.getSummary(incomeItems);
    const expenseSummary = AppService.getSummary(expenseItems);

    return `
      <div class="report-sheet">
        <header class="report-header">
          <div class="report-title">${escapeHtml(AppService.getDisplayGroupName())} 収支報告書</div>
          <div class="report-meta">年度: ${escapeHtml(String(AppService.state.selectedYear))} 年度</div>
          <div class="report-meta">作成日: ${escapeHtml(AppService.formatDate(new Date().toISOString()))}</div>
          <div class="report-meta">並び順: ${escapeHtml(Dom.sortFieldSelect.options[Dom.sortFieldSelect.selectedIndex].text)} / ${escapeHtml(Dom.sortDirectionSelect.options[Dom.sortDirectionSelect.selectedIndex].text)}</div>
          <div class="report-summary">
            <div class="report-summary-card">
              <div class="report-summary-label">収入合計</div>
              <div class="report-summary-value" style="color:#16a34a;">${escapeHtml(AppService.formatCurrency(incomeSummary.total))}</div>
            </div>
            <div class="report-summary-card">
              <div class="report-summary-label">支出合計</div>
              <div class="report-summary-value" style="color:#dc2626;">${escapeHtml(AppService.formatCurrency(expenseSummary.total))}</div>
            </div>
          </div>
        </header>
        ${buildSection('収入', 'income', incomeItems)}
        ${buildSection('支出', 'expense', expenseItems)}
      </div>
    `;
  }

  function executePrint() {
    Dom.printPreviewBody.innerHTML = buildHtml();
    Dom.printPreviewSection.classList.remove('hidden');
    setTimeout(() => window.print(), 50);
  }

  return { executePrint };
})();

const ModalController = (() => {
  function openNew() {
    AppService.clearForm();
    Dom.modalTitle.textContent = '新規登録';
    Dom.formType.value = AppService.state.selectedTab;
    Dom.formYear.value = String(AppService.state.selectedYear);
    Dom.modalOverlay.classList.add('open');
    Dom.modalOverlay.setAttribute('aria-hidden', 'false');
  }

  function openEdit(id) {
    const item = DataStore.getById(id);
    if (!item) return;
    AppService.state.editingId = id;
    AppService.setFormFromModel(item);
    Dom.modalTitle.textContent = '編集';
    Dom.modalOverlay.classList.add('open');
    Dom.modalOverlay.setAttribute('aria-hidden', 'false');
  }

  function close() {
    Dom.modalOverlay.classList.remove('open');
    Dom.modalOverlay.setAttribute('aria-hidden', 'true');
  }

  function save() {
    const model = AppService.buildModelFromForm();
    const error = AppService.validateForm(model);
    if (error) {
      alert(error);
      return;
    }
    DataStore.save(model);
    AppService.state.selectedTab = model.type;
    AppService.state.selectedYear = model.year;
    AppService.state.selectedCategory = 'all';
    close();
    UiRenderer.renderAll('保存した内容を画面へ反映済み');
  }

  return { openNew, openEdit, close, save };
})();

const EventBinder = (() => {
  function bind() {
    Dom.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        AppService.state.selectedTab = btn.dataset.tab;
        AppService.state.selectedCategory = 'all';
        UiRenderer.renderAll('表示を更新した');
      });
    });

    Dom.groupNameInput.addEventListener('change', e => {
      AppService.setGroupName(e.target.value);
      UiRenderer.renderAll('団体名を端末保存へ反映済み');
    });

    Dom.yearSelect.addEventListener('change', e => {
      AppService.state.selectedYear = Number(e.target.value);
      AppService.state.selectedCategory = 'all';
      UiRenderer.renderAll('表示を更新した');
    });

    Dom.categoryFilter.addEventListener('change', e => {
      AppService.state.selectedCategory = e.target.value;
      UiRenderer.renderAll('表示を更新した');
    });

    Dom.sortFieldSelect.addEventListener('change', e => {
      AppService.state.sortField = e.target.value;
      UiRenderer.renderAll('並び順を更新した');
    });

    Dom.sortDirectionSelect.addEventListener('change', e => {
      AppService.state.sortDirection = e.target.value;
      UiRenderer.renderAll('並び順を更新した');
    });

    Dom.addBtnTop.addEventListener('click', ModalController.openNew);
    Dom.addBtnFab.addEventListener('click', ModalController.openNew);
    Dom.closeModalBtn.addEventListener('click', ModalController.close);
    Dom.cancelBtn.addEventListener('click', ModalController.close);
    Dom.saveBtn.addEventListener('click', ModalController.save);

    Dom.pdfBtn.addEventListener('click', () => {
      PrintService.executePrint();
    });

    Dom.exportCsvBtn.addEventListener('click', () => {
      CsvService.downloadCsv();
      UiRenderer.updateStorageStatus('出力ファイルを作成した');
    });

    Dom.importCsvBtn.addEventListener('click', () => {
      Dom.csvFileInput.value = '';
      Dom.csvFileInput.click();
    });

    Dom.csvFileInput.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const items = await CsvService.importFromFile(file);
        DataStore.setAll(items);
        const importedGroupName = CsvService.extractGroupNameFromFileName(file.name);
        if (importedGroupName) {
          AppService.setGroupName(importedGroupName);
        }
        const message = importedGroupName
          ? `CSVを読込して ${items.length}件 を反映した / 団体名: ${importedGroupName}`
          : `CSVを読込して ${items.length}件 を反映した`;
        UiRenderer.renderAll(message);
        alert(message);
      } catch (error) {
        alert('読込に失敗した。\n' + error.message);
      }
    });

    Dom.modalOverlay.addEventListener('click', e => {
      if (e.target === Dom.modalOverlay) ModalController.close();
    });

    Dom.cardList.addEventListener('click', e => {
      const editButton = e.target.closest('[data-edit-id]');
      if (editButton) {
        ModalController.openEdit(Number(editButton.dataset.editId));
        return;
      }
      const deleteButton = e.target.closest('[data-delete-id]');
      if (deleteButton) {
        const id = Number(deleteButton.dataset.deleteId);
        if (confirm('このデータを削除しますか？')) {
          DataStore.remove(id);
          UiRenderer.renderAll('保存した内容を画面へ反映済み');
        }
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && Dom.modalOverlay.classList.contains('open')) {
        ModalController.close();
      }
    });
  }

  return { bind };
})();

const initialLoad = DataStore.load();
UiRenderer.renderAll(initialLoad.message);
EventBinder.bind();
