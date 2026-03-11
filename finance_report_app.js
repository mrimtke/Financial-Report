const AppConfig = {
      defaultTab: 'income',
      years: [2025, 2026, 2027, 2028]
    };

    const Dom = {
      groupNameInput: document.getElementById('groupNameInput'),
      yearSelect: document.getElementById('yearSelect'),
      categoryFilter: document.getElementById('categoryFilter'),
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
      printPreviewBody: document.getElementById('printPreviewBody'),
      closePreviewBtn: document.getElementById('closePreviewBtn'),
      execPrintBtn: document.getElementById('execPrintBtn'),
      savePdfBtn: document.getElementById('savePdfBtn')
    };

    const DataStore = (() => {
      const STORAGE_KEY = 'finance-report-mobile-first-v1';
      const defaultItems = [];
      const defaultSettings = {
        groupName: ''
      };

      let sequence = 100;
      let items = [];
      let settings = { ...defaultSettings };

      const clone = value => JSON.parse(JSON.stringify(value));

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

          items = clone(parsed.items);
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
        getStorageKey() {
          return STORAGE_KEY;
        },
        getAll() {
          return clone(items);
        },
        getById(id) {
          return clone(items.find(x => x.id === id) || null);
        },
        save(record) {
          if (record.id == null) {
            record.id = ++sequence;
            items.push(clone(record));
            persist();
            return record.id;
          }
          const index = items.findIndex(x => x.id === record.id);
          if (index >= 0) {
            items[index] = clone(record);
            persist();
            return record.id;
          }
          record.id = ++sequence;
          items.push(clone(record));
          persist();
          return record.id;
        },
        remove(id) {
          items = items.filter(x => x.id !== id);
          persist();
        },
        load() {
          return loadFromStorage();
        },
        persist() {
          return persist();
        },
        getStorageSnapshot() {
          const raw = localStorage.getItem(STORAGE_KEY);
          return raw ? JSON.parse(raw) : null;
        },
        clearStorage() {
          localStorage.removeItem(STORAGE_KEY);
          return loadFromStorage();
        },
        setAll(newItems) {
          items = clone(newItems);
          sequence = getNextSequence(items);
          persist();
          return { count: items.length, savedAt: new Date().toISOString() };
        },
        getSettings() {
          return clone(settings);
        },
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
        editingId: null
      };

      const typeLabelMap = {
        income: '収入',
        expense: '支出'
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

      function normalizeText(value) {
        return String(value || '').trim();
      }

      function getGroupName() {
        return normalizeText(DataStore.getSettings().groupName);
      }

      function setGroupName(value) {
        DataStore.setGroupName(value);
      }

      function getDisplayGroupName() {
        return getGroupName() || '団体名未設定';
      }

      function getFilteredItems() {
        return DataStore.getAll()
          .filter(x => x.type === state.selectedTab)
          .filter(x => x.year === Number(state.selectedYear))
          .filter(x => state.selectedCategory === 'all' ? true : x.category === state.selectedCategory)
          .sort((a, b) => (a.date < b.date ? 1 : -1));
      }

      function getCategoriesByTabAndYear(tab, year) {
        const categories = DataStore.getAll()
          .filter(x => x.type === tab)
          .filter(x => x.year === Number(year))
          .map(x => x.category)
          .filter(Boolean);

        return Array.from(new Set(categories)).sort((a, b) => a.localeCompare(b, 'ja'));
      }

      function getAllCategories() {
        const categories = DataStore.getAll().map(x => x.category).filter(Boolean);
        return Array.from(new Set(categories)).sort((a, b) => a.localeCompare(b, 'ja'));
      }

      function getSummary(items) {
        const total = items.reduce((sum, x) => sum + Number(x.amount || 0), 0);
        const count = items.length;
        const average = count === 0 ? 0 : Math.round(total / count);
        const latest = items[0]?.date || '';
        return { total, count, average, latest };
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

      function formatDateTime(value) {
        if (!value) return '-';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return value;
        return [
          d.getFullYear(),
          String(d.getMonth() + 1).padStart(2, '0'),
          String(d.getDate()).padStart(2, '0')
        ].join('/') + ' ' +
        [
          String(d.getHours()).padStart(2, '0'),
          String(d.getMinutes()).padStart(2, '0')
        ].join(':');
      }

      function setEditingId(id) {
        state.editingId = id;
      }

      return {
        state,
        typeLabelMap,
        formatCurrency,
        formatDate,
        getGroupName,
        getDisplayGroupName,
        setGroupName,
        getFilteredItems,
        getCategoriesByTabAndYear,
        getAllCategories,
        getSummary,
        validateForm,
        buildModelFromForm,
        setFormFromModel,
        clearForm,
        formatDateTime,
        setEditingId
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
        document.title = AppService.getDisplayGroupName() + '収支報告書';
      }

      function renderYearOptions() {
        const html = AppConfig.years.map(year =>
          `<option value="${year}" ${year === AppService.state.selectedYear ? 'selected' : ''}>${year}</option>`
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
        Dom.tabButtons.forEach(btn => {
          btn.classList.toggle('active', btn.dataset.tab === AppService.state.selectedTab);
        });
      }

      function renderCategoryFilter() {
        const categories = AppService.getCategoriesByTabAndYear(AppService.state.selectedTab, AppService.state.selectedYear);
        if (AppService.state.selectedCategory !== 'all' && !categories.includes(AppService.state.selectedCategory)) {
          AppService.state.selectedCategory = 'all';
        }
        const options = [
          `<option value="all">すべて</option>`,
          ...categories.map(x =>
            `<option value="${escapeHtml(x)}" ${x === AppService.state.selectedCategory ? 'selected' : ''}>${escapeHtml(x)}</option>`
          )
        ];
        Dom.categoryFilter.innerHTML = options.join('');
      }

      function renderCategoryCandidates() {
        const categories = AppService.getAllCategories();
        Dom.categoryCandidates.innerHTML = categories
          .map(x => `<option value="${escapeHtml(x)}"></option>`)
          .join('');
      }

      function summaryBox(key, value) {
        return `
          <div class="summary-card">
            <div class="k">${escapeHtml(key)}</div>
            <div class="v">${escapeHtml(value)}</div>
          </div>
        `;
      }

      function renderSummary(items) {
        const summary = AppService.getSummary(items);
        const label = AppService.typeLabelMap[AppService.state.selectedTab];
        const oppositeItems = DataStore.getAll()
          .filter(x => x.year === Number(AppService.state.selectedYear))
          .filter(x => x.type !== AppService.state.selectedTab);
        const oppositeSummary = AppService.getSummary(oppositeItems);
        const oppositeLabel = AppService.typeLabelMap[AppService.state.selectedTab === 'income' ? 'expense' : 'income'];

        Dom.summaryArea.innerHTML = [
          summaryBox(`${label}合計`, AppService.formatCurrency(summary.total)),
          summaryBox(`${oppositeLabel}合計`, AppService.formatCurrency(oppositeSummary.total)),
          summaryBox('最新日付', summary.latest ? AppService.formatDate(summary.latest) : '-')
        ].join('');
      }

      function renderCards(items) {
        if (!items.length) {
          Dom.cardList.innerHTML = `<div class="empty">該当データがありません。<br>「＋追加」から登録してください。</div>`;
          return;
        }

        Dom.cardList.innerHTML = items.map(item => `
          <article class="card">
            <div class="card-main">
              <div class="chip-row">
                <span class="chip">${escapeHtml(item.category)}</span>
                <span class="chip">${escapeHtml(AppService.formatDate(item.date))}</span>
              </div>
              <div class="meta-title">${escapeHtml(item.name)}</div>
              <div class="meta-sub">${escapeHtml(item.memo || '詳細なし')}</div>
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
        if (!snapshot || !snapshot.savedAt) {
          Dom.storageStatus.textContent = message || 'この端末の localStorage に未保存。';
          return;
        }
        Dom.storageStatus.textContent = (message ? message + ' / ' : '') + '最終保存: ' + AppService.formatDateTime(snapshot.savedAt);
      }

      function renderAll(statusMessage = '') {
        renderGroupName();
        renderTheme();
        renderYearOptions();
        renderTabs();
        renderCategoryFilter();
        renderCategoryCandidates();
        const items = AppService.getFilteredItems();
        renderSummary(items);
        renderCards(items);
        updateStorageStatus(statusMessage);
      }

      return { renderAll, updateStorageStatus };
    })();


    const CsvService = (() => {
      const headers = ['id', 'year', 'type', 'category', 'name', 'date', 'amount', 'memo'];

      function escapeCsv(value) {
        const text = String(value ?? '');
        if (/[",\n\r]/.test(text)) {
          return '"' + text.replace(/"/g, '""') + '"';
        }
        return text;
      }

      function buildCsvText(items) {
        const lines = [
          headers.join(','),
          ...items.map(item => headers.map(key => escapeCsv(item[key])).join(','))
        ];
        return "\ufeff" + lines.join('\r\n');
      }

      function buildExportFileName() {
        const groupName = AppService.getGroupName() || '団体名未設定';
        return `${groupName}収支報告書.csv`;
      }

      function extractGroupNameFromFileName(fileName) {
        const baseName = String(fileName || '').replace(/\.[^.]+$/, '');
        const match = baseName.match(/^(.*)収支報告書$/);
        return match ? match[1].trim() : '';
      }

      function downloadCsv() {
        const items = DataStore.getAll().sort((a, b) => Number(a.id) - Number(b.id));
        const csvText = buildCsvText(items);
        const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
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

      function parseCsvText(text) {
        const normalized = text.replace(/^\ufeff/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = normalized.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) {
          return [];
        }

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
          const id = Number(row.id);
          const year = Number(row.year);
          const amount = Number(row.amount);
          const type = String(row.type || '').trim();

          if (!['income', 'expense'].includes(type)) {
            throw new Error(`${index + 2}行目の区分は income または expense で入力`);
          }
          if (!Number.isFinite(id) || !Number.isFinite(year) || !Number.isFinite(amount)) {
            throw new Error(`${index + 2}行目の id/year/amount が不正`);
          }

          return {
            id,
            year,
            type,
            category: String(row.category || '').trim(),
            name: String(row.name || '').trim(),
            date: String(row.date || '').trim(),
            amount,
            memo: String(row.memo || '').trim()
          };
        });
      }

      async function importFromFile(file) {
        const text = await file.text();
        return parseCsvText(text);
      }

      return {
        downloadCsv,
        importFromFile,
        extractGroupNameFromFileName
      };
    })();


    const PdfService = (() => {
      function escapeHtml(value) {
        return String(value ?? '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');
      }

      function getReportData() {
        const allItems = DataStore.getAll()
          .filter(x => x.year === Number(AppService.state.selectedYear));

        const incomeItems = allItems
          .filter(x => x.type === 'income')
          .sort((a, b) => (a.date > b.date ? 1 : -1));

        const expenseItems = allItems
          .filter(x => x.type === 'expense')
          .sort((a, b) => (a.date > b.date ? 1 : -1));

        return {
          groupName: AppService.getDisplayGroupName(),
          year: AppService.state.selectedYear,
          createdDate: AppService.formatDate(new Date().toISOString()),
          incomeItems,
          expenseItems,
          incomeSummary: AppService.getSummary(incomeItems),
          expenseSummary: AppService.getSummary(expenseItems)
        };
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
        const themeClass = key === 'income' ? 'income' : 'expense';

        return `
          <section class="report-section">
            <div class="report-section-title ${themeClass}">${title}</div>
            <div class="report-mini-summary">
              <div class="report-badge ${themeClass}">合計 ${escapeHtml(AppService.formatCurrency(summary.total))}</div>
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
                <tbody>
                  ${buildRows(items)}
                </tbody>
              </table>
            </div>
          </section>
        `;
      }

      function buildPreviewHtml() {
        const report = getReportData();

        return `
          <div class="report-sheet">
            <header class="report-header">
              <div class="report-title">${escapeHtml(report.groupName)} 収支報告書</div>
              <div class="report-meta">年度: ${escapeHtml(String(report.year))}</div>
              <div class="report-meta">作成日: ${escapeHtml(report.createdDate)}</div>

              <div class="report-summary">
                <div class="report-summary-card">
                  <div class="report-summary-label">収入合計</div>
                  <div class="report-summary-value" style="color:#16a34a;">${escapeHtml(AppService.formatCurrency(report.incomeSummary.total))}</div>
                </div>
                <div class="report-summary-card">
                  <div class="report-summary-label">支出合計</div>
                  <div class="report-summary-value" style="color:#dc2626;">${escapeHtml(AppService.formatCurrency(report.expenseSummary.total))}</div>
                </div>
              </div>
            </header>

            ${buildSection('収入', 'income', report.incomeItems)}
            ${buildSection('支出', 'expense', report.expenseItems)}
          </div>
        `;
      }

      function openPreview() {
        Dom.printPreviewBody.innerHTML = buildPreviewHtml();
        Dom.printPreviewSection.classList.remove('hidden');
        Dom.printPreviewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      function closePreview() {
        Dom.printPreviewSection.classList.add('hidden');
      }

      function executePrint() {
        if (Dom.printPreviewSection.classList.contains('hidden')) {
          openPreview();
        }
        setTimeout(() => window.print(), 50);
      }

      function getPdfFileName() {
        return `${AppService.getDisplayGroupName()}収支報告書.pdf`;
      }

      function isIOSLike() {
        const ua = navigator.userAgent || '';
        const platform = navigator.platform || '';
        return /iPad|iPhone|iPod/.test(ua) ||
          (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      }

      function ensurePdfLib() {
        return !!(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API);
      }

      function buildTableBody(items) {
        if (!items.length) {
          return [['', 'データなし', '', '']];
        }
        return items.map(item => [
          item.category || '',
          item.name || '',
          AppService.formatDate(item.date),
          AppService.formatCurrency(item.amount)
        ]);
      }

      function drawTable(doc, startY, title, items, themeColor) {
        doc.setFontSize(15);
        doc.setTextColor(themeColor[0], themeColor[1], themeColor[2]);
        doc.text(title, 14, startY);
        const summary = AppService.getSummary(items);
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.text(`合計: ${AppService.formatCurrency(summary.total)}    最新日付: ${summary.latest ? AppService.formatDate(summary.latest) : '-'}`, 14, startY + 6);

        doc.autoTable({
          startY: startY + 10,
          head: [['項目', '氏名 / 対象', '日付', '金額']],
          body: buildTableBody(items),
          theme: 'grid',
          styles: { fontSize: 10, cellPadding: 2.5, lineColor: [203, 213, 225] },
          headStyles: { fillColor: [248, 250, 252], textColor: [31, 41, 55] },
          alternateRowStyles: { fillColor: [255, 255, 255] },
          columnStyles: {
            3: { halign: 'right' }
          },
          margin: { left: 14, right: 14 }
        });

        return doc.lastAutoTable.finalY + 12;
      }

      function generatePdfDocument() {
        if (!ensurePdfLib()) {
          throw new Error('PDFライブラリの読込に失敗した。通信環境を確認してもう一度試してください。');
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const report = getReportData();

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(17, 24, 39);
        doc.text(`${report.groupName} 収支報告書`, 14, 18);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(`年度: ${report.year}`, 14, 26);
        doc.text(`作成日: ${report.createdDate}`, 14, 32);

        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(14, 38, 88, 20, 2, 2);
        doc.roundedRect(108, 38, 88, 20, 2, 2);

        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128);
        doc.text('収入合計', 18, 45);
        doc.text('支出合計', 112, 45);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(22, 163, 74);
        doc.text(AppService.formatCurrency(report.incomeSummary.total), 18, 53);
        doc.setTextColor(220, 38, 38);
        doc.text(AppService.formatCurrency(report.expenseSummary.total), 112, 53);

        doc.setTextColor(17, 24, 39);
        let currentY = 68;
        currentY = drawTable(doc, currentY, '収入', report.incomeItems, [22, 163, 74]);

        if (currentY > 230) {
          doc.addPage();
          currentY = 18;
        }

        drawTable(doc, currentY, '支出', report.expenseItems, [220, 38, 38]);
        return doc;
      }

      async function exportPdf() {
        try {
          const doc = generatePdfDocument();
          const fileName = getPdfFileName();

          if (isIOSLike()) {
            const blobUrl = doc.output('bloburl');
            const win = window.open(blobUrl, '_blank');
            if (!win) {
              alert('PDFを開けなかった。ポップアップブロックを確認してください。');
              return;
            }
            alert('PDFを別タブで開いた。共有メニューから「ファイルに保存」を選ぶと保存できる。');
            return;
          }

          doc.save(fileName);
        } catch (error) {
          alert(error.message || 'PDF化に失敗した。');
        }
      }

      return { openPreview, closePreview, executePrint, exportPdf };
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
        AppService.setEditingId(id);
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
            UiRenderer.renderAll('保存した内容を画面へ反映済み');
          });
        });

        Dom.groupNameInput.addEventListener('change', e => {
          AppService.setGroupName(e.target.value);
          UiRenderer.renderAll('団体名を端末保存へ反映済み');
        });

        Dom.yearSelect.addEventListener('change', e => {
          AppService.state.selectedYear = Number(e.target.value);
          AppService.state.selectedCategory = 'all';
          UiRenderer.renderAll('保存した内容を画面へ反映済み');
        });

        Dom.categoryFilter.addEventListener('change', e => {
          AppService.state.selectedCategory = e.target.value;
          UiRenderer.renderAll('保存した内容を画面へ反映済み');
        });

        Dom.addBtnTop.addEventListener('click', ModalController.openNew);
        Dom.addBtnFab.addEventListener('click', ModalController.openNew);
        Dom.closeModalBtn.addEventListener('click', ModalController.close);
        Dom.cancelBtn.addEventListener('click', ModalController.close);
        Dom.saveBtn.addEventListener('click', ModalController.save);

        Dom.exportCsvBtn.addEventListener('click', () => {
          CsvService.downloadCsv();
          UiRenderer.updateStorageStatus('出力ファイルを作成した');
        });

        Dom.importCsvBtn.addEventListener('click', () => {
          Dom.csvFileInput.value = '';
          Dom.csvFileInput.click();
        });

        Dom.pdfBtn.addEventListener('click', PdfService.executePrint);
        if (Dom.closePreviewBtn) Dom.closePreviewBtn.addEventListener('click', PdfService.closePreview);
        if (Dom.execPrintBtn) Dom.execPrintBtn.addEventListener('click', PdfService.executePrint);
        if (Dom.savePdfBtn) Dom.savePdfBtn.addEventListener('click', PdfService.exportPdf);

        Dom.csvFileInput.addEventListener('change', async (e) => {
          const file = e.target.files && e.target.files[0];
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
