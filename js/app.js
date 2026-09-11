/**
 * 主应用模块（纯离线版）
 * 数据完全存储在本地，通过导入/导出文件管理
 */

// 主应用对象
const App = {
    // 当前选中的记录ID（用于长按操作）
    _currentRecordId: null,
    _tempRecordId: null,
    _pressTimer: null,

    // 初始化应用
    init() {
        // 加载数据
        DataManager.loadData();

        // 初始化事件监听
        this.initEventListeners();

        // 初始化搜索功能
        this.initSearch();

        // 设置默认日期时间
        this.setDefaultDateTime();

        // 根据保存的时间范围设置按钮状态
        this.initTimeRangeButton();

        // 更新数据信息显示
        this.updateDataInfo();

        // 加载AI配置
        this.loadAIConfig();

        // 加载备份服务器地址
        const savedUrl = localStorage.getItem('backup_server_url');
        const serverInput = document.getElementById('server-url-input');
        if (serverInput) {
            if (savedUrl) {
                serverInput.value = savedUrl;
            }
            // 输入时自动保存
            serverInput.addEventListener('input', () => {
                localStorage.setItem('backup_server_url', serverInput.value.trim());
            });
        }

        // 生成或加载用户ID（用于多用户隔离）
        if (!localStorage.getItem('user_id')) {
            localStorage.setItem('user_id', 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));
        }

        // 初始化页面数据
        UI.renderRecords();
        UI.updateStatistics();
    },

    // 根据保存的时间范围设置按钮状态
    initTimeRangeButton() {
        const savedRange = DataManager.getSelectedTimeRange();
        if (savedRange && savedRange.range) {
            // 移除所有active状态
            document.querySelectorAll('.time-btn').forEach(btn => {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            });
            // 设置对应的按钮为active
            const targetBtn = document.querySelector(`[data-range="${savedRange.range}"]`);
            if (targetBtn) {
                targetBtn.classList.add('active');
                targetBtn.setAttribute('aria-pressed', 'true');
            }
        }
    },

    // 更新数据信息显示
    updateDataInfo() {
        const info = DataManager.getDataInfo();
        const dataInfoEl = document.getElementById('data-info');
        if (dataInfoEl) {
            dataInfoEl.innerHTML = `
              <div class="data-info-item">
                <div class="label">记录数</div>
                <div class="value">${info.totalRecords}</div>
              </div>
              <div class="data-info-item">
                <div class="label">总电量</div>
                <div class="value">${info.totalEnergy} <span style="font-size:11px;font-weight:normal;color:#999;">kWh</span></div>
              </div>
              <div class="data-info-item">
                <div class="label">总花费</div>
                <div class="value">&yen;${info.totalCost}</div>
              </div>`;
        }
    },

    // 加载AI配置
    loadAIConfig() {
        const config = DataManager.getAIConfig();
        const baseUrlInput = document.getElementById('ai-base-url');
        const apiKeyInput = document.getElementById('ai-api-key');
        const modelInput = document.getElementById('ai-model');

        if (baseUrlInput) baseUrlInput.value = config.baseUrl;
        if (apiKeyInput) apiKeyInput.value = config.apiKey;
        if (modelInput) modelInput.value = config.model;
    },

    // 保存AI配置
    saveAIConfig() {
        const baseUrlInput = document.getElementById('ai-base-url');
        const apiKeyInput = document.getElementById('ai-api-key');
        const modelInput = document.getElementById('ai-model');

        const baseUrl = baseUrlInput ? baseUrlInput.value.trim() : '';
        const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
        const model = modelInput ? modelInput.value.trim() : '';

        if (!baseUrl || !apiKey) {
            UI.showToast('请填写Base URL和API Key', 3000, 'warning');
            return;
        }

        DataManager.saveAIConfig(baseUrl, apiKey, model);
        UI.showToast('AI配置已保存', 3000, 'success');
    },

    // 触发AI识别（打开文件选择）
    triggerAIRecognize() {
        // 检查AI配置
        if (!DataManager.isAIConfigValid()) {
            UI.showToast('请先完成AI识别配置', 3000, 'warning');
            return;
        }

        // 触发文件选择
        const fileInput = document.getElementById('ai-image-input');
        if (fileInput) {
            fileInput.click();
        }
    },

    // 处理AI图片选择
    async handleAIImageSelected(event) {
        const file = event.target.files[0];
        if (!file) return;

        // 验证文件类型
        if (!file.type.startsWith('image/')) {
            UI.showToast('请选择图片文件', 3000, 'warning');
            return;
        }

        const recognizeBtn = document.getElementById('ai-recognize-btn');

        try {
            // 更新UI状态
            recognizeBtn.classList.add('recognizing');
            recognizeBtn.innerHTML = '<span class="iconfont icon-flashlight-auto"></span><span>智能识别中...</span>';

            // 调用AI识别
            const result = await AIRecognizer.recognizeAndFill(file);
            const missingFields = [
                ['stationName', '充电站'],
                ['chargeType', '充电类型'],
                ['startTime', '开始时间'],
                ['endTime', '结束时间'],
                ['chargeAmount', '充电量'],
                ['finalPrice', '支付金额']
            ].filter(([key]) => !result[key]).map(([, label]) => label);

            if (missingFields.length) {
                UI.showToast(`已填充识别结果，请核对：${missingFields.join('、')}未识别`, 5000, 'warning');
            } else {
                UI.showToast('已识别并填充，请核对后保存', 3000, 'success');
            }

        } catch (error) {
            console.error('AI识别失败:', error);
            UI.showToast('AI识别失败：' + error.message, 4000, 'error');
        } finally {
            // 恢复按钮状态
            recognizeBtn.classList.remove('recognizing');
            recognizeBtn.innerHTML = '<span class="iconfont icon-search-for-similar"></span><span>AI智能图片识别</span>';
        }

        // 清空input以便可以重复选择同一文件
        event.target.value = '';
    },

    // 初始化事件监听
    initEventListeners() {
        // 底部Tab切换
        document.querySelectorAll('.tab-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const pageId = item.dataset.page;
                UI.switchPage(pageId);
            });
            item.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
                window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
            });
        });

        // 记录表单提交
        const recordForm = document.getElementById('record-form');
        if (recordForm) {
            recordForm.addEventListener('submit', (e) => this.handleRecordSubmit(e));
        }

        // 重置表单按钮
        const resetFormBtn = document.getElementById('reset-form-btn');
        if (resetFormBtn) {
            resetFormBtn.addEventListener('click', () => this.resetForm());
        }

        // 记录筛选
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                this.filterRecords(type);
            });
        });

        // 统计时间选择
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const range = btn.dataset.range;
                this.selectTimeRange(range);
            });
        });

        // 高级统计：充电站排行维度切换
        document.querySelectorAll('.ranking-tab').forEach(button => {
            button.addEventListener('click', () => UI.renderStationRanking(button.dataset.ranking));
        });

        // 充电站名称自动提示
        this.initStationSuggestions('station-name', 'station-suggestions');

        // 编辑弹窗的充电站名称自动提示
        this.initStationSuggestions('edit-station-name', 'edit-station-suggestions');

        // 开始时间和结束时间同步
        const startTimeInput = document.getElementById('start-time');
        if (startTimeInput) {
            startTimeInput.addEventListener('change', () => this.syncEndTimeDate());
        }

        // 充电类型切换按钮
        const chargeTypeBtn = document.getElementById('charge-type-btn');
        if (chargeTypeBtn) {
            chargeTypeBtn.addEventListener('click', () => this.toggleChargeType('charge-type-btn'));
        }

        const editChargeTypeBtn = document.getElementById('edit-charge-type-btn');
        if (editChargeTypeBtn) {
            editChargeTypeBtn.addEventListener('click', () => this.toggleChargeType('edit-charge-type-btn'));
        }

        // 设置页面按钮
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }

        const backupListBtn = document.getElementById('backup-list-btn');
        if (backupListBtn) {
            backupListBtn.addEventListener('click', () => this.showBackupList());
        }

        const backupListCloseBtn = document.getElementById('backup-list-close-btn');
        if (backupListCloseBtn) {
            backupListCloseBtn.addEventListener('click', () => this.closeBackupList());
        }

        const backupListCloseBtn2 = document.getElementById('backup-list-close-btn2');
        if (backupListCloseBtn2) {
            backupListCloseBtn2.addEventListener('click', () => this.closeBackupList());
        }

        const importBtn = document.getElementById('import-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => this.importData());
        }

        const clearDataBtn = document.getElementById('clear-data-btn');
        if (clearDataBtn) {
            clearDataBtn.addEventListener('click', (e) => this.clearAllData(e));
        }

        // 弹窗按钮事件
        const modalCloseBtn = document.getElementById('modal-close-btn');
        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', (e) => UI.closeModal(e));
        }

        const modalCancelBtn = document.getElementById('modal-cancel-btn');
        if (modalCancelBtn) {
            modalCancelBtn.addEventListener('click', (e) => UI.closeModal(e));
        }

        // 编辑记录弹窗按钮
        const editModalCloseBtn = document.getElementById('edit-modal-close-btn');
        if (editModalCloseBtn) {
            editModalCloseBtn.addEventListener('click', (e) => this.closeEditModal(e));
        }

        const editModalCancelBtn = document.getElementById('edit-modal-cancel-btn');
        if (editModalCancelBtn) {
            editModalCancelBtn.addEventListener('click', (e) => this.closeEditModal(e));
        }

        const editModalSaveBtn = document.getElementById('edit-modal-save-btn');
        if (editModalSaveBtn) {
            editModalSaveBtn.addEventListener('click', () => this.saveEditRecord());
        }

        // 自定义时间弹窗按钮
        const customTimeCloseBtn = document.getElementById('custom-time-close-btn');
        if (customTimeCloseBtn) {
            customTimeCloseBtn.addEventListener('click', (e) => this.closeCustomTimeModal(e));
        }

        const customTimeCancelBtn = document.getElementById('custom-time-cancel-btn');
        if (customTimeCancelBtn) {
            customTimeCancelBtn.addEventListener('click', (e) => this.closeCustomTimeModal(e));
        }

        const customTimeQueryBtn = document.getElementById('custom-time-query-btn');
        if (customTimeQueryBtn) {
            customTimeQueryBtn.addEventListener('click', () => this.queryCustomTime());
        }

        // 记录时间筛选弹窗按钮
        const recordTimeCloseBtn = document.getElementById('record-time-close-btn');
        if (recordTimeCloseBtn) {
            recordTimeCloseBtn.addEventListener('click', (e) => this.closeRecordTimeModal(e));
        }

        const recordTimeCancelBtn = document.getElementById('record-time-cancel-btn');
        if (recordTimeCancelBtn) {
            recordTimeCancelBtn.addEventListener('click', (e) => this.closeRecordTimeModal(e));
        }

        const recordTimeQueryBtn = document.getElementById('record-time-query-btn');
        if (recordTimeQueryBtn) {
            recordTimeQueryBtn.addEventListener('click', () => this.queryRecordTime());
        }

        document.querySelectorAll('[data-record-range]').forEach(button => {
            button.addEventListener('click', () => this.selectRecordQuickRange(button.dataset.recordRange));
        });

        // 长按操作按钮
        const mask = document.getElementById('mask');
        if (mask) {
            mask.addEventListener('click', () => this.closeActionSheet());
            mask.addEventListener('touchstart', (e) => this.closeActionSheet(e));
        }

        const actionEditBtn = document.getElementById('action-edit-btn');
        if (actionEditBtn) {
            actionEditBtn.addEventListener('click', () => {
                if (this._tempRecordId) {
                    const recordId = this._tempRecordId;
                    this.closeActionSheet();
                    setTimeout(() => this.editRecord(recordId), 300);
                }
            });
        }

        const actionDeleteBtn = document.getElementById('action-delete-btn');
        if (actionDeleteBtn) {
            actionDeleteBtn.addEventListener('click', () => {
                if (this._tempRecordId) {
                    const recordId = this._tempRecordId;
                    this.closeActionSheet();
                    setTimeout(() => this.deleteRecord(recordId), 300);
                }
            });
        }

        const actionCancelBtn = document.getElementById('action-cancel-btn');
        if (actionCancelBtn) {
            actionCancelBtn.addEventListener('click', (e) => this.closeActionSheet(e));
        }

        // 导入文件input
        const importFileInput = document.getElementById('import-file-input');
        if (importFileInput) {
            importFileInput.addEventListener('change', (e) => this.handleImportFile(e));
        }

        // AI配置保存按钮
        const saveAiConfigBtn = document.getElementById('save-ai-config-btn');
        if (saveAiConfigBtn) {
            saveAiConfigBtn.addEventListener('click', () => this.saveAIConfig());
        }

        // AI识别按钮
        const aiRecognizeBtn = document.getElementById('ai-recognize-btn');
        if (aiRecognizeBtn) {
            aiRecognizeBtn.addEventListener('click', () => this.triggerAIRecognize());
        }

        // AI图片选择input
        const aiImageInput = document.getElementById('ai-image-input');
        if (aiImageInput) {
            aiImageInput.addEventListener('change', (e) => this.handleAIImageSelected(e));
        }

        // 记录卡片事件委托（长按操作）
        const recordsList = document.getElementById('records-list');
        if (recordsList) {
            recordsList.addEventListener('mousedown', (e) => {
                const card = e.target.closest('.record-card');
                if (card) {
                    const recordId = card.dataset.recordId;
                    this.startLongPress(recordId, e);
                }
            });
            recordsList.addEventListener('mouseup', () => this.cancelLongPress());
            recordsList.addEventListener('mouseleave', () => this.cancelLongPress());
            recordsList.addEventListener('touchstart', (e) => {
                const card = e.target.closest('.record-card');
                if (card) {
                    const recordId = card.dataset.recordId;
                    this.startLongPress(recordId, e);
                }
            });
            recordsList.addEventListener('touchend', () => this.cancelLongPress());
            recordsList.addEventListener('touchmove', () => this.cancelLongPress());
            recordsList.addEventListener('touchcancel', () => this.cancelLongPress());
        }
    },

    // 初始化充电站名称自动提示
    initStationSuggestions(inputId, suggestionsId) {
        const input = document.getElementById(inputId);
        const suggestionsContainer = document.getElementById(suggestionsId);

        if (input && suggestionsContainer) {
            input.addEventListener('input', () => {
                UI.showStationSuggestions(inputId, suggestionsId);
            });
            input.addEventListener('focus', () => {
                UI.showStationSuggestions(inputId, suggestionsId);
            });

            // 点击建议项
            suggestionsContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('suggestion-item')) {
                    const stationName = e.target.dataset.station;
                    UI.selectStation(inputId, suggestionsId, stationName);
                }
            });

            // 点击其他地方关闭提示
            document.addEventListener('click', (e) => {
                if (!input.contains(e.target) && !suggestionsContainer.contains(e.target)) {
                    suggestionsContainer.innerHTML = '';
                }
            });
        }
    },

    // 初始化搜索功能
    initSearch() {
        const searchInput = document.getElementById('record-search');
        if (searchInput) {
            const debouncedSearch = AppUtils.debounce((keyword) => {
                const activeFilter = document.querySelector('.filter-btn.active');
                const filterType = activeFilter ? activeFilter.dataset.type : 'all';
                UI.renderRecords(filterType, keyword);
            }, 300);

            searchInput.addEventListener('input', (e) => {
                debouncedSearch(e.target.value);
            });
        }
    },

    // 设置默认日期时间
    setDefaultDateTime() {
        const now = new Date();
        const endTimeInput = document.getElementById('end-time');
        if (endTimeInput) {
            endTimeInput.value = AppUtils.formatDateTime(now);
        }

        const startTime = new Date(now.getTime() - 3600000);
        const startTimeInput = document.getElementById('start-time');
        if (startTimeInput) {
            startTimeInput.value = AppUtils.formatDateTime(startTime);
        }

        this.syncEndTimeDate();
    },

    // 重置表单内容
    resetForm() {
        UI.showModal('确认重置', '确定要清空所有输入内容吗？', () => {
            document.getElementById('record-form').reset();
            // 重置充电类型按钮为默认值（快充）
            const chargeTypeBtn = document.getElementById('charge-type-btn');
            chargeTypeBtn.dataset.value = 'fast';
            chargeTypeBtn.textContent = '直流快充 （DC）';
            chargeTypeBtn.className = 'charge-type-btn fast-charge';
            // 重新设置默认时间
            this.setDefaultDateTime();
            UI.showToast('内容已重置', 3000, 'success');
        });
    },

    // 同步结束时间的日期与开始时间一致
    syncEndTimeDate() {
        const startTimeInput = document.getElementById('start-time');
        const endTimeInput = document.getElementById('end-time');

        if (!startTimeInput || !endTimeInput || !startTimeInput.value) return;

        const startTime = new Date(startTimeInput.value);
        let endTime = endTimeInput.value ? new Date(endTimeInput.value) : new Date(startTime);

        endTime.setFullYear(startTime.getFullYear());
        endTime.setMonth(startTime.getMonth());
        endTime.setDate(startTime.getDate());

        endTimeInput.value = AppUtils.formatDateTime(endTime);
    },

    // 充电类型切换按钮逻辑（通用函数）
    toggleChargeType(btnId) {
        const btn = document.getElementById(btnId);
        if (btn.dataset.value === 'fast') {
            btn.dataset.value = 'slow';
            btn.textContent = '交流慢充 （AC）';
            btn.classList.remove('fast-charge');
            btn.classList.add('slow-charge');
        } else {
            btn.dataset.value = 'fast';
            btn.textContent = '直流快充 （DC）';
            btn.classList.remove('slow-charge');
            btn.classList.add('fast-charge');
        }

        // 添加动画（避免重复绑定监听器）
        btn.classList.remove('charge-type-btn-animation');
        void btn.offsetWidth; // 强制重排以重置动画
        btn.classList.add('charge-type-btn-animation');
        if (!btn._animListenerAdded) {
            btn.addEventListener('animationend', () => {
                btn.classList.remove('charge-type-btn-animation');
            });
            btn._animListenerAdded = true;
        }
    },

    // 处理记录表单提交
    handleRecordSubmit(e) {
        e.preventDefault();

        const formData = this.getFormData('record-form');
        // chargeType 存储在按钮的 data-value 中，FormData 无法获取
        formData.chargeType = document.getElementById('charge-type-btn').dataset.value;

        // 验证表单
        const validation = AppUtils.validateRecordForm(formData);
        if (!validation.valid) {
            UI.showToast(validation.message, 3000, 'warning');
            return;
        }

        // 创建记录对象
        const record = {
            id: Date.now().toString(),
            stationName: formData.stationName,
            chargeType: document.getElementById('charge-type-btn').dataset.value,
            startTime: new Date(formData.startTime).toISOString(),
            endTime: new Date(formData.endTime).toISOString(),
            chargeAmount: parseFloat(formData.chargeAmount),
            finalPrice: parseFloat(formData.finalPrice),
            discountAmount: parseFloat(formData.discountAmount || '0')
        };

        // 检查是否存在重复记录，并把用户带到已存在的记录处
        const duplicateRecord = DataManager.findDuplicateRecord(record);
        if (duplicateRecord) {
            UI.revealRecord(duplicateRecord.id);
            UI.showToast('该充电记录已存在', 3000, 'warning');
            return;
        }

        // 添加记录
        DataManager.addRecord(record);

        // 重置表单
        document.getElementById('record-form').reset();
        this.setDefaultDateTime();

        // 更新UI
        UI.renderRecords();
        UI.updateStatistics();
        this.updateDataInfo();

        UI.showToast('充电记录已添加', 3000, 'success');
    },

    // 获取表单数据
    getFormData(formId) {
        const form = document.getElementById(formId);
        const formData = new FormData(form);
        const data = {};

        for (const [key, value] of formData.entries()) {
            data[key] = value;
        }

        return data;
    },

    // 筛选记录
    filterRecords(type) {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-type="${type}"]`).classList.add('active');

        if (type === 'time') {
            this.openRecordTimeModal();
        } else {
            const searchInput = document.getElementById('record-search');
            const searchKeyword = searchInput ? searchInput.value : '';
            UI.renderRecords(type, searchKeyword);
        }
    },

    // 选择时间范围
    selectTimeRange(range) {
        if (range === 'custom') {
            this.openCustomTimeModal();
            return;
        }

        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        });
        const selectedButton = document.querySelector(`[data-range="${range}"]`);
        selectedButton.classList.add('active');
        selectedButton.setAttribute('aria-pressed', 'true');

        const dateRange = AppUtils.getDateRangeByType(range);
        if (!dateRange) return;
        const { startDate, endDate } = dateRange;

        DataManager.setSelectedTimeRange({
            range: range,
            startDate: startDate,
            endDate: endDate
        });

        DataManager.saveSelectedTimeRange();
        UI.updateStatistics();
    },

    // 编辑记录
    editRecord(id) {
        const records = DataManager.getRecords();
        const record = records.find(r => r.id === id);
        if (!record) return;

        document.getElementById('edit-record-id').value = record.id;
        document.getElementById('edit-start-time').value = AppUtils.formatDateTime(new Date(record.startTime));
        document.getElementById('edit-end-time').value = AppUtils.formatDateTime(new Date(record.endTime));

        const editChargeTypeBtn = document.getElementById('edit-charge-type-btn');
        if (record.chargeType === 'fast') {
            editChargeTypeBtn.dataset.value = 'fast';
            editChargeTypeBtn.textContent = '直流快充 （DC）';
            editChargeTypeBtn.className = 'charge-type-btn fast-charge';
        } else {
            editChargeTypeBtn.dataset.value = 'slow';
            editChargeTypeBtn.textContent = '交流慢充 （AC）';
            editChargeTypeBtn.className = 'charge-type-btn slow-charge';
        }

        document.getElementById('edit-station-name').value = record.stationName;
        document.getElementById('edit-charge-amount').value = record.chargeAmount;
        document.getElementById('edit-final-price').value = record.finalPrice;
        document.getElementById('edit-discount-amount').value = record.discountAmount;

        document.getElementById('edit-modal').classList.add('active');
    },

    // 保存编辑记录
    saveEditRecord() {
        const id = document.getElementById('edit-record-id').value;
        const startTime = document.getElementById('edit-start-time').value;
        const endTime = document.getElementById('edit-end-time').value;
        const chargeType = document.getElementById('edit-charge-type-btn').dataset.value;
        const stationName = document.getElementById('edit-station-name').value;
        const chargeAmount = document.getElementById('edit-charge-amount').value;
        const finalPrice = document.getElementById('edit-final-price').value;
        const discountAmount = document.getElementById('edit-discount-amount').value || '0';

        // 验证
        const validation = AppUtils.validateRecordForm({
            startTime, endTime, chargeType, stationName, chargeAmount, finalPrice, discountAmount
        });

        if (!validation.valid) {
            UI.showToast(validation.message, 3000, 'error');
            return;
        }

        // 更新记录
        DataManager.updateRecord(id, {
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            chargeType,
            stationName,
            chargeAmount: parseFloat(chargeAmount),
            finalPrice: parseFloat(finalPrice),
            discountAmount: parseFloat(discountAmount)
        });

        // 更新UI
        UI.renderRecords();
        UI.updateStatistics();
        this.updateDataInfo();
        this.closeEditModal();

        UI.showToast('充电记录已更新', 3000, 'success');
    },

    // 删除记录
    deleteRecord(id) {
        UI.showModal('确认删除', '确定要删除这条充电记录吗？', () => {
            DataManager.deleteRecord(id);
            UI.renderRecords();
            UI.updateStatistics();
            this.updateDataInfo();
            UI.showToast('充电记录已删除', 3000, 'success');
        });
    },

    // 获取用户ID
    _getUserId() {
        return localStorage.getItem('user_id') || 'default';
    },

    // 获取服务器地址
    _getServerUrl() {
        const input = document.getElementById('server-url-input');
        let url = (input ? input.value.trim() : '') || localStorage.getItem('backup_server_url') || '';
        if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'http://' + url;
        }
        return url;
    },

    // 导出数据
    exportData() {
        const records = DataManager.getRecords();
        if (!records || records.length === 0) {
            UI.showToast('没有可导出的数据', 3000, 'warning');
            return;
        }

        const jsonStr = DataManager.exportData();
        const fileName = `charging_backup_${new Date().toISOString().slice(0, 10)}.json`;
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });

        // 已配置服务器时进行局域网备份；否则直接导出本地 JSON 文件。
        if (this._getServerUrl()) {
            this._backupToServer(jsonStr, fileName, blob);
        } else {
            this._fallbackDownload(blob, fileName);
        }
    },

    // 上传到服务器备份
    _backupToServer(content, fileName, fallbackBlob) {
        const SERVER_URL = this._getServerUrl();
        if (!SERVER_URL) {
            this._fallbackDownload(fallbackBlob, fileName);
            return;
        }

        UI.showLoading('正在备份...');

        fetch(SERVER_URL + '/api/backup?uid=' + encodeURIComponent(this._getUserId()), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: content, fileName: fileName })
        })
            .then(res => res.json())
            .then(data => {
                UI.hideLoading();
                if (data.success) {
                    UI.hideLoading();

                    // 弹出系统分享面板，让用户选择如何打开链接
                    if (window.plus && plus.share) {
                        plus.share.sendWithSystem({
                            type: 'text',
                            content: data.url,
                            title: '充电记录备份下载链接'
                        }, () => {
                            console.log('分享成功');
                        }, (e) => {
                            console.error('分享取消或失败:', e);
                            // 用户取消分享，显示链接
                            UI.showModal('备份成功',
                                '下载链接：\n\n' + data.url,
                                null);
                        });
                    } else {
                        // 浏览器环境，直接显示链接
                        UI.showModal('备份成功 ✅',
                            '下载链接：\n\n' + data.url,
                            null);
                    }
                } else {
                    this._fallbackDownload(fallbackBlob, fileName, false);
                    UI.showToast('服务器备份失败，已改为下载本地备份文件', 4000, 'warning');
                }
            })
            .catch(e => {
                UI.hideLoading();
                console.error('服务器备份失败:', e);
                this._fallbackDownload(fallbackBlob, fileName, false);
                UI.showToast('服务器备份失败，已改为下载本地备份文件', 4000, 'warning');
            });
    },

    // 显示备份列表
    showBackupList() {
        const SERVER_URL = this._getServerUrl();
        if (!SERVER_URL) {
            UI.showToast('请先填写备份服务器地址', 3000, 'warning');
            return;
        }

        const uid = this._getUserId();
        document.getElementById('backup-list-modal').classList.add('active');
        document.getElementById('backup-list-body').innerHTML = '<div class="backup-empty">加载中...</div>';

        fetch(SERVER_URL + '/api/backups?uid=' + encodeURIComponent(uid))
            .then(res => res.json())
            .then(data => {
                if (!data.success || !data.files.length) {
                    document.getElementById('backup-list-body').innerHTML = '<div class="backup-empty">暂无备份记录</div>';
                    return;
                }

                let html = '';
                data.files.forEach(f => {
                    const date = new Date(f.time);
                    const timeStr = date.toLocaleString('zh-CN');
                    const sizeStr = (f.size / 1024).toFixed(1) + ' KB';
                    const downloadUrl = SERVER_URL + '/api/download/' + encodeURIComponent(f.name) + '?uid=' + encodeURIComponent(uid);

                    html += `
                    <div class="backup-item" data-name="${f.name}">
                        <div class="backup-item-info">
                            <div class="backup-item-name">${f.name}</div>
                            <div class="backup-item-meta">${timeStr} · ${sizeStr}</div>
                        </div>
                        <div class="backup-item-actions">
                            <button class="backup-btn-open" onclick="App.openBackupLink('${downloadUrl}')">下载</button>
                            <button class="backup-btn-import" onclick="App.importFromServer('${f.name}')">恢复</button>
                            <button class="backup-btn-delete" onclick="App.deleteBackup('${f.name}')">删除</button>
                        </div>
                    </div>`;
                });

                document.getElementById('backup-list-body').innerHTML = html;
            })
            .catch(e => {
                console.error('获取备份列表失败:', e);
                document.getElementById('backup-list-body').innerHTML = '<div class="backup-empty">无法连接服务器</div>';
            });
    },

    // 关闭备份列表
    closeBackupList() {
        document.getElementById('backup-list-modal').classList.remove('active');
    },

    // 打开备份下载链接
    openBackupLink(url) {
        if (window.plus && plus.share) {
            plus.share.sendWithSystem({
                type: 'text',
                content: url,
                title: '充电记录备份'
            });
        } else {
            window.open(url, '_blank');
        }
    },

    // 从服务器恢复备份
    importFromServer(fileName) {
        const SERVER_URL = this._getServerUrl();
        const uid = this._getUserId();

        UI.showModal('确认恢复', `确定要恢复备份文件\n\n${fileName}\n\n吗？当前数据将被覆盖。`, () => {
            UI.showLoading('正在获取备份...');

            fetch(SERVER_URL + '/api/content/' + encodeURIComponent(fileName) + '?uid=' + encodeURIComponent(uid))
                .then(res => res.json())
                .then(data => {
                    UI.hideLoading();
                    if (data.success) {
                        this.processImport(data.content);
                        this.closeBackupList();
                    } else {
                        UI.showToast('获取备份失败', 3000, 'error');
                    }
                })
                .catch(e => {
                    UI.hideLoading();
                    console.error('获取备份失败:', e);
                    UI.showToast('无法连接服务器', 3000, 'error');
                });
        });
    },

    // 删除服务器上的备份
    deleteBackup(fileName) {
        const SERVER_URL = this._getServerUrl();
        const uid = this._getUserId();

        UI.showModal('确认删除', `确定要删除备份文件\n\n${fileName}\n\n吗？`, () => {
            fetch(SERVER_URL + '/api/backups/' + encodeURIComponent(fileName) + '?uid=' + encodeURIComponent(uid), {
                method: 'DELETE'
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        UI.showToast('已删除', 3000, 'success');
                        this.showBackupList(); // 刷新列表
                    } else {
                        UI.showToast('删除失败', 3000, 'error');
                    }
                })
                .catch(e => {
                    console.error('删除失败:', e);
                    UI.showToast('删除失败', 3000, 'error');
                });
        });
    },

    // 下载方式（回退方案）
    _fallbackDownload(blob, fileName, showSuccessMessage = true) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        if (showSuccessMessage) {
            UI.showToast('导出成功，请查看下载文件夹', 4000, 'success');
        }
    },

    // 导入数据
    importData() {
        // 检测是否为移动设备
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile) {
            // 移动端：先显示提示，然后触发文件选择
            UI.showToast('请选择之前导出的 .json 备份文件', 3000, 'info');
        }

        // 触发文件选择
        const fileInput = document.getElementById('import-file-input');
        if (fileInput) {
            fileInput.click();
        }
    },

    // 处理导入文件
    handleImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        // 检查文件类型
        if (!file.name.endsWith('.json') && !file.name.endsWith('.txt') && !file.name.endsWith('.db')) {
            UI.showToast('请选择 .json / .txt / .db 格式的备份文件', 3000, 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;

            // 如果有现有数据，询问是否覆盖
            const currentRecords = DataManager.getRecords();
            if (currentRecords && currentRecords.length > 0) {
                UI.showModal('确认导入', '导入将覆盖当前所有数据，是否继续？', () => {
                    this.processImport(content);
                });
            } else {
                this.processImport(content);
            }
        };
        reader.readAsText(file);

        // 清空input以便可以重复选择同一文件
        event.target.value = '';
    },

    // 处理导入数据
    processImport(content) {
        const result = DataManager.importData(content);

        if (result.success) {
            UI.showToast(`成功导入 ${result.count} 条记录`, 3000, 'success');
            UI.renderRecords();
            UI.updateStatistics();
            this.updateDataInfo();
        } else {
            UI.showToast(result.message, 3000, 'error');
        }
    },

    // 清空本地数据
    clearAllData(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        UI.showModal('确认清空', '确定要清空所有充电记录吗？此操作不可恢复。建议先导出数据备份。', () => {
            DataManager.clearAllRecords();
            UI.renderRecords();
            UI.updateStatistics();
            this.updateDataInfo();
            UI.showToast('所有数据已清空', 3000, 'success');
        });
    },

    // 长按功能
    startLongPress(id, event) {
        this._currentRecordId = id;
        this._pressTimer = setTimeout(() => {
            this.openActionSheet();
        }, 500);
    },

    cancelLongPress() {
        if (this._pressTimer) {
            clearTimeout(this._pressTimer);
            this._pressTimer = null;
        }
        this._currentRecordId = null;
    },

    openActionSheet() {
        const mask = document.getElementById('mask');
        const actionSheet = document.getElementById('action-sheet');

        this._tempRecordId = this._currentRecordId;

        mask.classList.add('active');
        actionSheet.classList.add('active');
    },

    closeActionSheet(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        const mask = document.getElementById('mask');
        const actionSheet = document.getElementById('action-sheet');

        mask.classList.remove('active');
        actionSheet.classList.remove('active');

        this.cancelLongPress();
        this._tempRecordId = null;
    },

    // 弹窗相关
    closeEditModal(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        document.getElementById('edit-modal').classList.remove('active');
    },

    // 自定义时间弹窗
    openCustomTimeModal() {
        document.getElementById('custom-time-modal').classList.add('active');
    },

    closeCustomTimeModal(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        document.getElementById('custom-time-modal').classList.remove('active');
    },

    queryCustomTime() {
        const startTimeInput = document.getElementById('custom-start-time');
        const endTimeInput = document.getElementById('custom-end-time');

        const startDate = startTimeInput.value;
        const endDate = endTimeInput.value;

        if (!startDate || !endDate) {
            UI.showToast('请选择开始日期和结束日期', 3000, 'warning');
            return;
        }

        const startDateTime = new Date(startDate + 'T00:00:00');
        const endDateTime = new Date(endDate + 'T23:59:59');

        if (endDateTime <= startDateTime) {
            UI.showToast('结束日期必须晚于开始日期', 3000, 'error');
            return;
        }

        DataManager.setSelectedTimeRange({
            range: 'custom',
            startDate: startDateTime.toISOString(),
            endDate: endDateTime.toISOString()
        });

        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        });
        const customButton = document.querySelector('[data-range="custom"]');
        customButton.classList.add('active');
        customButton.setAttribute('aria-pressed', 'true');

        DataManager.saveSelectedTimeRange();

        document.getElementById('custom-time-modal').classList.remove('active');
        UI.updateStatistics();
    },

    // 记录页面时间筛选弹窗
    openRecordTimeModal() {
        const modal = document.getElementById('record-time-modal');
        modal.classList.add('active');

        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const formatDateInput = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        document.getElementById('record-start-date').value = formatDateInput(oneWeekAgo);
        document.getElementById('record-end-date').value = formatDateInput(now);
        this.updateRecordQuickRangeState(null);
    },

    selectRecordQuickRange(range) {
        const dateRange = AppUtils.getDateRangeByType(range);
        if (!dateRange) return;

        const inclusiveEndDate = new Date(dateRange.endDate);
        inclusiveEndDate.setDate(inclusiveEndDate.getDate() - 1);

        document.getElementById('record-start-date').value = AppUtils.formatDateTime(dateRange.startDate).slice(0, 10);
        document.getElementById('record-end-date').value = AppUtils.formatDateTime(inclusiveEndDate).slice(0, 10);
        this.updateRecordQuickRangeState(range);
    },

    updateRecordQuickRangeState(activeRange) {
        document.querySelectorAll('[data-record-range]').forEach(button => {
            const isActive = button.dataset.recordRange === activeRange;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    },

    closeRecordTimeModal(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        const modal = document.getElementById('record-time-modal');
        modal.classList.remove('active');

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector('[data-type="all"]').classList.add('active');
        UI.renderRecords('all');
    },

    queryRecordTime() {
        const startDateInput = document.getElementById('record-start-date');
        const endDateInput = document.getElementById('record-end-date');

        const startDate = startDateInput.value;
        const endDate = endDateInput.value;

        if (!startDate || !endDate) {
            UI.showToast('请选择开始日期和结束日期', 3000, 'warning');
            return;
        }

        if (new Date(endDate) < new Date(startDate)) {
            UI.showToast('结束日期必须晚于或等于开始日期', 3000, 'error');
            return;
        }

        DataManager.setSelectedRecordDateRange({
            startDate: new Date(startDate + 'T00:00:00'),
            endDate: new Date(endDate + 'T23:59:59')
        });

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector('[data-type="time"]').classList.add('active');

        UI.renderRecords('time');

        document.getElementById('record-time-modal').classList.remove('active');
    }
};

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// 导出App对象
if (typeof window !== 'undefined') {
    window.App = App;
}
