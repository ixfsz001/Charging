/**
 * UI模块
 * 负责所有UI渲染和用户交互
 */

const UI = {
    // 显示Toast提示（新提示滑入覆盖旧提示，旧提示稍后自行消失）
    showToast(message, duration = 3000, status = 'warning') {
        const container = document.getElementById('top-toast');

        // 创建新的提示元素
        const item = document.createElement('div');
        item.className = 'toast-item ' + status;
        item.textContent = message;
        container.appendChild(item);

        // duration后滑出并移除
        setTimeout(() => {
            item.classList.add('hiding');
            const onAnimEnd = () => {
                item.removeEventListener('animationend', onAnimEnd);
                item.remove();
            };
            item.addEventListener('animationend', onAnimEnd);
        }, duration);
    },

    // 显示加载状态
    showLoading(message = '加载中...') {
        let loadingEl = document.getElementById('global-loading');
        if (!loadingEl) {
            loadingEl = document.createElement('div');
            loadingEl.id = 'global-loading';
            loadingEl.className = 'global-loading';
            loadingEl.innerHTML = `
                <div class="loading-mask"></div>
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">${message}</div>
                </div>
            `;
            document.body.appendChild(loadingEl);
        }
        loadingEl.style.display = 'flex';
    },

    // 隐藏加载状态
    hideLoading() {
        const loadingEl = document.getElementById('global-loading');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    },

    // 显示确认弹窗
    showModal(title, message, confirmCallback = null, isValidationFailure = false) {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalMessage = document.getElementById('modal-message');
        const modalConfirm = document.getElementById('modal-confirm');

        modalTitle.textContent = title;
        modalMessage.textContent = message;

        modalConfirm.onclick = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
            if (confirmCallback) {
                confirmCallback();
            }
            this.closeModal();
            return false;
        };

        if (isValidationFailure) {
            modal.classList.add('validation-failure');
        } else {
            modal.classList.remove('validation-failure');
        }

        modal.classList.add('active');
    },

    // 关闭弹窗
    closeModal(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        document.getElementById('modal').classList.remove('active');
    },

    // 渲染记录列表
    renderRecords(filterType = 'all', searchKeyword = '') {
        const recordsList = document.getElementById('records-list');
        const emptyState = document.getElementById('empty-records');

        let filteredRecords = DataManager.getRecords();

        // 按关键词搜索
        if (searchKeyword) {
            filteredRecords = DataManager.searchRecords(searchKeyword);
        }

        // 按充电类型筛选
        if (filterType !== 'all' && filterType !== 'time') {
            filteredRecords = filteredRecords.filter(record => record.chargeType === filterType);
        }

        // 按自定义时间筛选
        if (filterType === 'time' && DataManager.getSelectedRecordDateRange()) {
            const { startDate, endDate } = DataManager.getSelectedRecordDateRange();
            filteredRecords = filteredRecords.filter(record => {
                const recordStart = new Date(record.startTime);
                const recordEnd = new Date(record.endTime);
                return recordStart >= startDate && recordEnd <= endDate;
            });
        }

        // 按结束时间倒序排列（最近的记录在前）
        filteredRecords.sort((a, b) => new Date(b.endTime) - new Date(a.endTime));

        if (filteredRecords.length === 0) {
            recordsList.innerHTML = '';
            emptyState.style.display = 'flex';
            return;
        }

        emptyState.style.display = 'none';

        recordsList.innerHTML = filteredRecords.map(record => `
            <div class="record-card" data-record-id="${record.id}">
                <div class="card-header">
                    <div class="station-info">
                        <span class="station-name">${AppUtils.escapeHtml(record.stationName)}</span>
                    </div>
                    <div class="charge-type-tag ${record.chargeType}">
                        <span class="iconfont icon-quick"></span>
                        <span>${record.chargeType === 'fast' ? '直流快充' : '交流慢充'}</span>
                    </div>
                </div>
                <div class="card-time">
                    <span>${AppUtils.formatTime(record.startTime)}</span>
                    <span>${AppUtils.calculateDuration(record.startTime, record.endTime)}</span>
                    <span>${AppUtils.formatTime(record.endTime)}</span>
                </div>
                <div class="card-stats">
                    <div class="stat-item">
                        <span class="stat-label">充电度数：</span>
                        <span class="stat-value">${record.chargeAmount} kWh</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">平均电价：</span>
                        <span class="stat-value">￥${record.chargeAmount > 0 ? (record.finalPrice / record.chargeAmount).toFixed(2) : '0.00'}/kWh</span>
                    </div>
                </div>
                <div class="card-price">
                    ${record.discountAmount > 0 ? `
                    <div class="stat-item">
                        <span class="stat-label">优惠金额</span>
                        <span class="stat-value cost-off">-￥${record.discountAmount.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div class="stat-item">
                        <span class="stat-label">实际支付：</span>
                        <span class="total-price">￥${record.finalPrice.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    },

    // 更新统计数据UI
    updateStatsUI(stats) {
        document.getElementById('total-amount').textContent = `￥${stats.totalAmount.toFixed(2)}`;
        document.getElementById('total-discount2').textContent = `￥${stats.totalDiscount.toFixed(2)}`;
        document.getElementById('total-energy2').textContent = stats.totalEnergy.toFixed(1);
        document.getElementById('total-count').textContent = stats.totalCount;

        // 计算小时数
        const hours = Math.floor(stats.totalDuration / (1000 * 60 * 60));
        document.getElementById('total-duration').textContent = hours;

        document.getElementById('avg-price').textContent = `￥${stats.avgPrice.toFixed(2)}`;
    },

    // 更新日期显示
    updateDateDisplay() {
        const dateDisplay = document.getElementById('stats-date');
        if (!dateDisplay) return;

        const selectedRange = DataManager.getSelectedTimeRange();
        let startDate, endDate;

        if (selectedRange.range === 'custom' && selectedRange.startDate && selectedRange.endDate) {
            startDate = new Date(selectedRange.startDate);
            endDate = new Date(selectedRange.endDate);
        } else {
            const now = new Date();
            const dateRange = AppUtils.getDateRangeByType(selectedRange.range, now);
            if (dateRange) {
                startDate = dateRange.startDate;
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            } else {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            }
        }

        dateDisplay.textContent = `${AppUtils.formatDateShort(startDate)} ~ ${AppUtils.formatDateShort(endDate)}`;
    },

    // 更新图表比例
    updateChartSegments() {
        const fastChargeSegment = document.getElementById('fast-charge-segment');
        const slowChargeSegment = document.getElementById('slow-charge-segment');
        const emptyChargeSegment = document.getElementById('empty-charge-segment');

        if (!fastChargeSegment || !slowChargeSegment || !emptyChargeSegment) return;

        const filteredRecords = DataManager.getFilteredRecordsByDate();
        const stats = DataManager.calculateStatistics(filteredRecords);
        const { fastStats, slowStats } = stats;
        const totalEnergy = fastStats.energy + slowStats.energy;

        // 移除动画类
        fastChargeSegment.classList.remove('slide-in');
        slowChargeSegment.classList.remove('slide-in');

        // 重置transform
        fastChargeSegment.style.transform = 'translateX(0)';
        slowChargeSegment.style.transform = 'translateX(0)';

        // 强制重排
        fastChargeSegment.offsetHeight;
        slowChargeSegment.offsetHeight;
        emptyChargeSegment.offsetHeight;

        if (totalEnergy === 0) {
            emptyChargeSegment.style.width = '100%';
            fastChargeSegment.style.width = '0%';
            slowChargeSegment.style.width = '0%';
            fastChargeSegment.style.borderRight = 'none';
        } else {
            emptyChargeSegment.style.width = '0%';
            const fastPercentage = (fastStats.energy / totalEnergy) * 100;
            const slowPercentage = (slowStats.energy / totalEnergy) * 100;

            fastChargeSegment.style.width = `${fastPercentage}%`;
            slowChargeSegment.style.width = `${slowPercentage}%`;

            const previousTotalEnergy = parseFloat(fastChargeSegment.dataset.lastTotalEnergy || 0);
            if (previousTotalEnergy === 0 || fastStats.energy !== parseFloat(fastChargeSegment.dataset.lastEnergy || 0) || slowStats.energy !== parseFloat(slowChargeSegment.dataset.lastEnergy || 0)) {
                setTimeout(() => {
                    fastChargeSegment.classList.add('slide-in');
                    setTimeout(() => {
                        slowChargeSegment.classList.add('slide-in');
                    }, 100);
                }, 50);
            }

            fastChargeSegment.dataset.lastEnergy = fastStats.energy;
            slowChargeSegment.dataset.lastEnergy = slowStats.energy;
            fastChargeSegment.dataset.lastTotalEnergy = totalEnergy;
        }

        // 同时更新快充和慢充的详细数据
        this.updateChartDetails(stats, totalEnergy);
    },

    // 更新图表详情（同时显示快充和慢充）
    updateChartDetails(stats, totalEnergy) {
        const { fastStats, slowStats } = stats;

        // 计算占比
        const fastPercentage = totalEnergy > 0 ? (fastStats.energy / totalEnergy) * 100 : 0;
        const slowPercentage = totalEnergy > 0 ? (slowStats.energy / totalEnergy) * 100 : 0;

        // 更新快充数据
        const fastPercentageEl = document.getElementById('fast-percentage');
        const fastEnergyEl = document.getElementById('fast-energy-detail');
        const fastCostEl = document.getElementById('fast-cost');
        const fastAvgPriceEl = document.getElementById('fast-avg-price');

        if (fastPercentageEl) fastPercentageEl.textContent = `${fastPercentage.toFixed(1)}%`;
        if (fastEnergyEl) fastEnergyEl.textContent = `${fastStats.energy.toFixed(1)} kWh`;
        if (fastCostEl) fastCostEl.textContent = `￥${fastStats.amount.toFixed(2)}`;
        if (fastAvgPriceEl) fastAvgPriceEl.textContent = `￥${fastStats.avgPrice.toFixed(2)}/kWh`;

        // 更新慢充数据
        const slowPercentageEl = document.getElementById('slow-percentage');
        const slowEnergyEl = document.getElementById('slow-energy-detail');
        const slowCostEl = document.getElementById('slow-cost');
        const slowAvgPriceEl = document.getElementById('slow-avg-price');

        if (slowPercentageEl) slowPercentageEl.textContent = `${slowPercentage.toFixed(1)}%`;
        if (slowEnergyEl) slowEnergyEl.textContent = `${slowStats.energy.toFixed(1)} kWh`;
        if (slowCostEl) slowCostEl.textContent = `￥${slowStats.amount.toFixed(2)}`;
        if (slowAvgPriceEl) slowAvgPriceEl.textContent = `￥${slowStats.avgPrice.toFixed(2)}/kWh`;
    },

    // 显示充电站名称自动提示
    showStationSuggestions(inputId, suggestionsId) {
        const input = document.getElementById(inputId);
        const suggestionsContainer = document.getElementById(suggestionsId);
        const inputValue = input.value.toLowerCase();

        suggestionsContainer.innerHTML = '';

        if (!inputValue.trim()) {
            return;
        }

        const uniqueStations = DataManager.getUniqueStationNames();
        const matchingStations = uniqueStations.filter(station =>
            station.toLowerCase().includes(inputValue)
        );

        if (matchingStations.length === 0) {
            return;
        }

        suggestionsContainer.innerHTML = matchingStations.map(station => `
            <div class="suggestion-item" data-station="${AppUtils.escapeHtml(station)}">
                ${AppUtils.escapeHtml(station)}
            </div>
        `).join('');
    },

    // 选择充电站名称
    selectStation(inputId, suggestionsId, stationName) {
        const input = document.getElementById(inputId);
        const suggestionsContainer = document.getElementById(suggestionsId);

        input.value = stationName;
        suggestionsContainer.innerHTML = '';
    },

    // 页面切换
    switchPage(pageId) {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        document.querySelectorAll('.tab-item').forEach(item => {
            item.classList.remove('active');
        });

        const targetPage = document.getElementById(pageId);
        const targetTab = document.querySelector(`.tab-item[data-page="${pageId}"]`);

        if (targetPage && targetTab) {
            targetPage.classList.add('active');
            targetTab.classList.add('active');

            if (pageId === 'view-records') {
                const searchInput = document.getElementById('record-search');
                const searchKeyword = searchInput ? searchInput.value : '';
                const activeFilter = document.querySelector('.filter-btn.active');
                const filterType = activeFilter ? activeFilter.dataset.type : 'all';
                this.renderRecords(filterType, searchKeyword);
            } else if (pageId === 'statistics') {
                this.updateStatistics();
            }
        }
    },

    // 更新统计
    updateStatistics() {
        const filteredRecords = DataManager.getFilteredRecordsByDate();
        const stats = DataManager.calculateStatistics(filteredRecords);
        this.updateStatsUI(stats);
        this.updateDateDisplay();
        this.updateChartSegments();
    }
};

// 导出UI模块
if (typeof window !== 'undefined') {
    window.UI = UI;
}
