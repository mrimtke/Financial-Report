const AppConfig = {
	defaultTab: 'income',
	years: [2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034]
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
		sortField: 'category',
		sortDirection: 'desc',
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

	function compareValues(aValue, bValue, direction = 'asc') {
		const order = direction === 'asc' ? 1 : -1;

		if (typeof aValue === 'number' || typeof bValue === 'number') {
			return (Number(aValue || 0) - Number(bValue || 0)) * order;
		}

		const aText = normalizeText(aValue);
		const bText = normalizeText(bValue);
		return aText.localeCompare(bText, 'ja') * order;
	}

	function compareItems(a, b) {
		switch (state.sortField) {
			case 'category': {
				const result = compareValues(a.category, b.category, state.sortDirection);
				return result || compareValues(a.date, b.date, 'desc') || compareValues(a.id, b.id, 'asc');
			}
			case 'name': {
				const result = compareValues(a.name, b.name, state.sortDirection);
				return result || compareValues(a.date, b.date, 'desc') || compareValues(a.id, b.id, 'asc');
			}
			case 'amount': {
				const result = compareValues(Number(a.amount), Number(b.amount), state.sortDirection);
				return result || compareValues(a.date, b.date, 'desc') || compareValues(a.id, b.id, 'asc');
			}
			case 'date':
			default: {
				const result = compareValues(a.date, b.date, state.sortDirection);
				return result || compareValues(a.id, b.id, 'asc');
			}
		}
	}

	function getFilteredItems() {
		return DataStore.getAll()
			.filter(x => x.type === state.selectedTab)
			.filter(x => x.year === Number(state.selectedYear))
			.filter(x => state.selectedCategory === 'all' ? true : x.category === state.selectedCategory)
			.sort(compareItems);
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

const CsvService = (() => {
	const headers = ['id', 'type', 'year', 'category', 'name', 'date', 'amount', 'memo'];

	function escapeCsv(value) {
		const text = String(value ?? '');
		if (/[",\n]/.test(text)) {
			return `"${text.replace(/"/g, '""')}"`;
		}
		return text;
	}

	function createCsvText(items) {
		const lines = [headers.join(',')];
		items.forEach(item => {
			const row = headers.map(key => escapeCsv(item[key]));
			lines.push(row.join(','));
		});
		return '\uFEFF' + lines.join('\n');
	}

	function downloadCsv() {
		const all = DataStore.getAll().sort((a, b) => Number(a.id) - Number(b.id));
		const csv = createCsvText(all);
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		const groupName = AppService.getDisplayGroupName();
		a.href = url;
		a.download = `${groupName}_収支報告データ.csv`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}

	function parseCsvLine(line) {
		const result = [];
		let current = '';
		let inQuotes = false;

		for (let i = 0; i < line.length; i += 1) {
			const char = line[i];
			const next = line[i + 1];

			if (char === '"' && inQuotes && next === '"') {
				current += '"';
				i += 1;
				continue;
			}

			if (char === '"') {
				inQuotes = !inQuotes;
				continue;
			}

			if (char === ',' && !inQuotes) {
				result.push(current);
				current = '';
				continue;
			}

			current += char;
		}

		result.push(current);
		return result;
	}

	function parseCsvText(text) {
		const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
		const lines = normalized.split('\n').filter(line => line.trim() !== '');
		if (lines.length <= 1) return [];

		const [headerLine, ...dataLines] = lines;
		const sourceHeaders = parseCsvLine(headerLine);

		return dataLines.map(line => {
			const values = parseCsvLine(line);
			const record = {};
			sourceHeaders.forEach((header, index) => {
				record[header] = values[index] ?? '';
			});

			return {
				id: record.id ? Number(record.id) : null,
				type: record.type === 'expense' ? 'expense' : 'income',
				year: Number(record.year || AppService.state.selectedYear),
				category: String(record.category || '').trim(),
				name: String(record.name || '').trim(),
				date: String(record.date || '').trim(),
				amount: Number(record.amount || 0),
				memo: String(record.memo || '').trim()
			};
		});
	}

	function importFromFile(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				try {
					const text = String(reader.result || '');
					const records = parseCsvText(text);
					resolve(records);
				} catch (error) {
					reject(error);
				}
			};
			reader.onerror = () => reject(new Error('ファイル読込に失敗しました。'));
			reader.readAsText(file, 'utf-8');
		});
	}

	function extractGroupNameFromFileName(fileName) {
		const base = String(fileName || '').replace(/\.[^.]+$/, '');
		return base.replace(/_?収支報告データ$/, '').trim();
	}

	return { downloadCsv, importFromFile, extractGroupNameFromFileName };
})();

const UiRenderer = (() => {
	function applyTheme() {
		const root = document.documentElement;
		if (AppService.state.selectedTab === 'expense') {
			root.style.setProperty('--theme', 'var(--expense)');
			root.style.setProperty('--theme-soft', 'var(--expense-soft)');
			root.style.setProperty('--theme-border', 'var(--expense-border)');
		} else {
			root.style.setProperty('--theme', 'var(--income)');
			root.style.setProperty('--theme-soft', 'var(--income-soft)');
			root.style.setProperty('--theme-border', 'var(--income-border)');
		}
	}

	function renderYearOptions() {
		const options = AppConfig.years.map(year => `<option value="${year}">${year}</option>`).join('');
		Dom.yearSelect.innerHTML = options;
		Dom.formYear.innerHTML = options;
		Dom.yearSelect.value = String(AppService.state.selectedYear);
		Dom.formYear.value = String(AppService.state.selectedYear);
	}

	function renderTabs() {
		Dom.tabButtons.forEach(btn => {
			btn.classList.toggle('active', btn.dataset.tab === AppService.state.selectedTab);
		});
	}

	function renderGroupName() {
		Dom.groupNameInput.value = AppService.getGroupName();
	}

	function renderCategoryFilter() {
		const categories = AppService.getCategoriesByTabAndYear(
			AppService.state.selectedTab,
			AppService.state.selectedYear
		);

		const options = ['<option value="all">すべて</option>']
			.concat(categories.map(category => `<option value="${category}">${category}</option>`))
			.join('');

		Dom.categoryFilter.innerHTML = options;
		Dom.categoryFilter.value = categories.includes(AppService.state.selectedCategory)
			? AppService.state.selectedCategory
			: 'all';
	}

	function renderCategoryCandidates() {
		const categories = AppService.getAllCategories();
		Dom.categoryCandidates.innerHTML = categories
			.map(category => `<option value="${category}"></option>`)
			.join('');
	}

	function renderSortControls() {
		if (!Dom.sortFieldSelect || !Dom.sortDirectionSelect) return;
		Dom.sortFieldSelect.value = AppService.state.sortField;
		Dom.sortDirectionSelect.value = AppService.state.sortDirection;
	}

	function renderSummary() {
		const items = AppService.getFilteredItems();
		const currentSummary = AppService.getSummary(items);

		const yearIncomeItems = DataStore.getAll()
			.filter(x => x.type === 'income')
			.filter(x => x.year === Number(AppService.state.selectedYear))
			.sort((a, b) => (a.date < b.date ? 1 : -1));

		const yearExpenseItems = DataStore.getAll()
			.filter(x => x.type === 'expense')
			.filter(x => x.year === Number(AppService.state.selectedYear))
			.sort((a, b) => (a.date < b.date ? 1 : -1));

		const incomeSummary = AppService.getSummary(yearIncomeItems);
		const expenseSummary = AppService.getSummary(yearExpenseItems);

		Dom.summaryArea.innerHTML = `
		  <article class="summary-card income">
			<div class="k">収入合計</div>
			<div class="v_income">${AppService.formatCurrency(incomeSummary.total)}</div>
		  </article>
		  <article class="summary-card expense">
			<div class="k">支出合計</div>
			<div class="v_expense">${AppService.formatCurrency(expenseSummary.total)}</div>
		  </article>
		  <article class="summary-card finance">
			<div class="k">次年度繰越金</div>
			<div class="v_finance">${AppService.formatCurrency(incomeSummary.total - expenseSummary.total)}</div>
		  </article>
		`;
		/*
				  <article class="summary-card">
					<div class="k">${AppService.typeLabelMap[AppService.state.selectedTab]}件数</div>
					<div class="v">${currentSummary.count}件</div>
				  </article>
				  <article class="summary-card">
					<div class="k">平均金額</div>
					<div class="v">${AppService.formatCurrency(currentSummary.average)}</div>
				  </article>
		*/
	}

	function renderCards() {
		const items = AppService.getFilteredItems();

		if (!items.length) {
			Dom.cardList.innerHTML = `
			<div class="empty">
			  この条件のデータはまだない。<br>
			  右下の「＋」または上の「＋追加」から登録してください。
			</div>
		  `;
			return;
		}

		Dom.cardList.innerHTML = items.map(item => `
		  <article class="card">
			<div class="card-main">
			  <div>
				<div class="chip-row">
				  <span class="chip">${item.category}</span>
				  <span class="chip">${AppService.typeLabelMap[item.type]}</span>
				  <span class="chip">${AppService.formatDate(item.date)}</span>
				</div>
				<div class="meta-title">${item.name}</div>
				${item.memo ? `<div class="meta-sub">詳細: ${item.memo}</div>` : ''}
			  </div>

			  <div class="amount-box">
				<span class="amount-label">金額</span>
				<div class="amount">${AppService.formatCurrency(item.amount)}</div>
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
		const savedAt = snapshot?.savedAt ? AppService.formatDateTime(snapshot.savedAt) : '-';
		if (Dom.storageStatus) {
			Dom.storageStatus.textContent = `${message} / 端末保存キー: ${DataStore.getStorageKey()} / 最終保存: ${savedAt}`;
		}
	}

	function renderAll(statusMessage = '保存した内容を画面へ反映済み') {
		applyTheme();
		renderYearOptions();
		renderTabs();
		renderGroupName();
		renderCategoryFilter();
		renderCategoryCandidates();
		renderSortControls();
		renderSummary();
		renderCards();
		updateStorageStatus(statusMessage);
	}

	return { renderAll, updateStorageStatus };
})();

const PdfService = (() => {
	function getSortedItemsByType(type, year) {
		return DataStore.getAll()
			.filter(x => x.type === type)
			.filter(x => x.year === year)
			.filter(x => AppService.state.selectedCategory === 'all' ? true : x.category === AppService.state.selectedCategory)
			.sort((a, b) => {
				const order = AppService.state.sortDirection === 'asc' ? 1 : -1;
				const normalizeText = value => String(value || '').trim();
				const compareValues = (aValue, bValue) => {
					if (typeof aValue === 'number' || typeof bValue === 'number') {
						return (Number(aValue || 0) - Number(bValue || 0)) * order;
					}
					return normalizeText(aValue).localeCompare(normalizeText(bValue), 'ja') * order;
				};

				switch (AppService.state.sortField) {
					case 'name': {
						const result = compareValues(a.name, b.name);
						return result || normalizeText(b.date).localeCompare(normalizeText(a.date), 'ja') || (Number(a.id || 0) - Number(b.id || 0));
					}
					case 'amount': {
						const result = compareValues(Number(a.amount), Number(b.amount));
						return result || normalizeText(b.date).localeCompare(normalizeText(a.date), 'ja') || (Number(a.id || 0) - Number(b.id || 0));
					}
					case 'date':
					{
						const result = compareValues(a.date, b.date);
						return result || (Number(a.id || 0) - Number(b.id || 0));
						}
					case 'category':
					default: {
						const result = compareValues(a.category, b.category);
						return result || normalizeText(b.date).localeCompare(normalizeText(a.date), 'ja') || (Number(a.id || 0) - Number(b.id || 0));
					}
				}
			});
	}

	function getReportData() {
		const year = Number(AppService.state.selectedYear);
		const incomeItems = getSortedItemsByType('income', year);
		const expenseItems = getSortedItemsByType('expense', year);

		return {
			groupName: AppService.getDisplayGroupName(),
			year,
			createdDate: AppService.formatDate(new Date().toISOString()),
			incomeItems,
			expenseItems,
			incomeSummary: AppService.getSummary(incomeItems),
			expenseSummary: AppService.getSummary(expenseItems)
		};
	}

	function createRows(items) {
		if (!items.length) {
			return `
			<tr>
			  <td colspan="5">データなし</td>
			</tr>
		  `;
		}

		return items.map(item => `
		  <tr>
			<td>${item.category || ''}</td>
			<td>${item.name || ''}</td>
			<td>${AppService.formatDate(item.date)}</td>
			<td>${item.memo || ''}</td>
			<td class="amount-cell">${AppService.formatCurrency(item.amount)}</td>
		  </tr>
		`).join('');
	}

	function buildPreviewHtml() {
		const report = getReportData();

		return `
		  <div class="report-sheet">
			<div class="report-header">
			  <div class="report-title">${report.year}年度 ${report.groupName} 収支報告書</div>
			  <div class="report-meta">
				<div>作成日: ${report.createdDate}</div>
			  </div>

			  <div class="report-summary">
				<div class="report-summary-card-income">
				  <div class="report-summary-label">収入合計</div>
				  <div class="report-summary-value">${AppService.formatCurrency(report.incomeSummary.total)}</div>
				</div>
				<div class="report-summary-card-expense">
				  <div class="report-summary-label">支出合計</div>
				  <div class="report-summary-value">${AppService.formatCurrency(report.expenseSummary.total)}</div>
				</div>
				<div class="report-summary-card-finance">
				  <div class="report-summary-label">次年度繰越金</div>
				  <div class="report-summary-value">${AppService.formatCurrency(report.incomeSummary.total - report.expenseSummary.total)}</div>
				</div>
			  </div>
			</div>

			<section class="report-section">
			  <div class="report-section-head">
				<div class="report-section-title income">収入</div>
				<div class="report-badge income">合計: ${AppService.formatCurrency(report.incomeSummary.total)}</div>
			  </div>
			  <div class="report-table-wrap">
				<table class="report-table">
				  <thead>
					<tr>
					  <th>項目</th>
					  <th>氏名 / 対象</th>
					  <th>日付</th>
					  <th>詳細</th>
					  <th class="amount-cell">金額</th>
					</tr>
				  </thead>
				  <tbody>
					${createRows(report.incomeItems)}
				  </tbody>
				</table>
			  </div>
			</section>

			<section class="report-section">
			  <div class="report-section-head">
				<div class="report-section-title expense">支出</div>
				<div class="report-badge expense">合計: ${AppService.formatCurrency(report.expenseSummary.total)}</div>
			  </div>
			  <div class="report-table-wrap">
				<table class="report-table">
				  <thead>
					<tr>
					  <th>項目</th>
					  <th>氏名 / 対象</th>
					  <th>日付</th>
					  <th>詳細</th>
					  <th class="amount-cell">金額</th>
					</tr>
				  </thead>
				  <tbody>
					${createRows(report.expenseItems)}
				  </tbody>
				</table>
			  </div>
			</section>
		  </div>
		`;
	}

	function openPreview(shouldScroll = true) {
		Dom.printPreviewBody.innerHTML = buildPreviewHtml();
		Dom.printPreviewSection.classList.remove('hidden');

		if (shouldScroll) {
			Dom.printPreviewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	function closePreview() {
		Dom.printPreviewSection.classList.add('hidden');
	}

	function executePrint() {
		openPreview(false);
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
			return [['', 'データなし', '', '', '']];
		}
		return items.map(item => [
			item.category || '',
			item.name || '',
			AppService.formatDate(item.date),
			item.memo || '',
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
		doc.text(`合計: ${AppService.formatCurrency(summary.total)}`, 14, startY + 6);

		doc.autoTable({
			startY: startY + 10,
			head: [['項目', '氏名 / 対象', '日付', '詳細', '金額']],
			body: buildTableBody(items),
			theme: 'grid',
			styles: {
				fontSize: 9.2,
				cellPadding: 2.5,
				lineColor: [203, 213, 225],
				overflow: 'linebreak',
				valign: 'top'
			},
			headStyles: { fillColor: [248, 250, 252], textColor: [31, 41, 55] },
			alternateRowStyles: { fillColor: [255, 255, 255] },
			columnStyles: {
				0: { cellWidth: 26 },
				1: { cellWidth: 34 },
				2: { cellWidth: 24 },
				3: { cellWidth: 74 },
				4: { cellWidth: 28, halign: 'right' }
			},
			margin: { left: 12, right: 12 }
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
		doc.text(`${report.year}年度 ${report.groupName} 収支報告書`, 14, 18);

		doc.setFont('helvetica', 'normal');
		doc.setFontSize(11);
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

		if (Dom.sortFieldSelect) {
			Dom.sortFieldSelect.addEventListener('change', e => {
				AppService.state.sortField = e.target.value;
				UiRenderer.renderAll('並び替え条件を変更した');
			});
		}

		if (Dom.sortDirectionSelect) {
			Dom.sortDirectionSelect.addEventListener('change', e => {
				AppService.state.sortDirection = e.target.value;
				UiRenderer.renderAll('並び順を変更した');
			});
		}

		Dom.addBtnTop.addEventListener('click', ModalController.openNew);
		Dom.addBtnFab.addEventListener('click', ModalController.openNew);
		Dom.closeModalBtn.addEventListener('click', ModalController.close);
		Dom.cancelBtn.addEventListener('click', ModalController.close);
		Dom.saveBtn.addEventListener('click', ModalController.save);

		Dom.exportCsvBtn.addEventListener('click', () => {
			CsvService.downloadCsv();
			UiRenderer.updateStorageStatus('出力ファイルを作成した');
		});

		if (Dom.importCsvBtn && Dom.csvFileInput) {
			Dom.importCsvBtn.addEventListener('click', () => {
				Dom.csvFileInput.value = '';
				Dom.csvFileInput.click();
			});
		}

		Dom.pdfBtn.addEventListener('click', PdfService.executePrint);
		if (Dom.closePreviewBtn) Dom.closePreviewBtn.addEventListener('click', PdfService.closePreview);
		if (Dom.execPrintBtn) Dom.execPrintBtn.addEventListener('click', PdfService.executePrint);
		if (Dom.savePdfBtn) Dom.savePdfBtn.addEventListener('click', PdfService.exportPdf);

		if (Dom.csvFileInput) Dom.csvFileInput.addEventListener('change', async (e) => {
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