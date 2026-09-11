/**
 * UI模块
 * 负责所有UI渲染和用户交互
 */

const UI = {
    _rankingType: 'frequent',

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

    _recordPageSize: 20,
    _recordPage: 1,
    _recordFilterType: 'all',
    _recordSearchKeyword: '',

    getFilteredRecordList(filterType = 'all', searchKeyword = '') {
        let filteredRecords = DataManager.getRecords();

        if (searchKeyword) {
            filteredRecords = DataManager.searchRecords(searchKeyword);
        }
        if (filterType !== 'all' && filterType !== 'time') {
            filteredRecords = filteredRecords.filter(record => record.chargeType === filterType);
        }
        if (filterType === 'time' && DataManager.getSelectedRecordDateRange()) {
            const { startDate, endDate } = DataManager.getSelectedRecordDateRange();
            filteredRecords = filteredRecords.filter(record => {
                const recordStart = new Date(record.startTime);
                return recordStart >= startDate && recordStart <= endDate;
            });
        }

        return [...filteredRecords].sort((a, b) => {
            const timeDifference = new Date(b.endTime) - new Date(a.endTime);
            return timeDifference || String(b.id).localeCompare(String(a.id));
        });
    },

    // 渲染记录列表（每页 20 条）
    renderRecords(filterType = 'all', searchKeyword = '', requestedPage = null) {
        const recordsList = document.getElementById('records-list');
        const emptyState = document.getElementById('empty-records');
        const pagination = document.getElementById('records-pagination');
        const filteredRecords = this.getFilteredRecordList(filterType, searchKeyword);
        const filterChanged = filterType !== this._recordFilterType || searchKeyword !== this._recordSearchKeyword;
        this._recordFilterType = filterType;
        this._recordSearchKeyword = searchKeyword;

        const totalPages = Math.max(Math.ceil(filteredRecords.length / this._recordPageSize), 1);
        const desiredPage = requestedPage ?? (filterChanged ? 1 : this._recordPage);
        this._recordPage = Math.min(Math.max(desiredPage, 1), totalPages);

        if (filteredRecords.length === 0) {
            recordsList.innerHTML = '';
            emptyState.style.display = 'flex';
            if (pagination) pagination.innerHTML = '';
            return;
        }

        emptyState.style.display = 'none';
        const startIndex = (this._recordPage - 1) * this._recordPageSize;
        const pageRecords = filteredRecords.slice(startIndex, startIndex + this._recordPageSize);

        recordsList.innerHTML = pageRecords.map(record => `
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
                    <div class="stat-item">
                        <span class="stat-label">平均功率：</span>
                        <span class="stat-value">${AppUtils.calculateAveragePower(record.chargeAmount, record.startTime, record.endTime).toFixed(2)} kW</span>
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

        if (pagination) {
            const canGoPrevious = this._recordPage > 1;
            const canGoNext = this._recordPage < totalPages;
            pagination.innerHTML = `
                <button type="button" class="records-page-btn" data-record-page="${this._recordPage - 1}" ${canGoPrevious ? '' : 'disabled'}>上一页</button>
                <span class="records-page-status">第 ${this._recordPage} / ${totalPages} 页 · 共 ${filteredRecords.length} 条</span>
                <button type="button" class="records-page-btn" data-record-page="${this._recordPage + 1}" ${canGoNext ? '' : 'disabled'}>下一页</button>`;
            pagination.querySelectorAll('[data-record-page]').forEach(button => {
                button.addEventListener('click', () => {
                    const paginationTop = pagination.getBoundingClientRect().top;
                    const recordsHeight = recordsList.getBoundingClientRect().height;
                    recordsList.style.height = `${recordsHeight}px`;
                    this.renderRecords(filterType, searchKeyword, Number(button.dataset.recordPage));
                    recordsList.style.height = '';

                    // 同一帧内完成解锁与锚点补偿，避免先重排、后回弹造成闪动。
                    const offset = pagination.getBoundingClientRect().top - paginationTop;
                    if (offset) window.scrollBy({ top: offset, behavior: 'auto' });
                });
            });
        }
    },

    revealRecord(recordId) {
        const searchInput = document.getElementById('record-search');
        if (searchInput) searchInput.value = '';
        DataManager.setSelectedRecordDateRange(null);
        document.querySelectorAll('.filter-btn').forEach(button => button.classList.remove('active'));
        document.querySelector('[data-type="all"]')?.classList.add('active');

        const recordList = this.getFilteredRecordList('all');
        const recordIndex = recordList.findIndex(record => String(record.id) === String(recordId));
        if (recordIndex < 0) return;
        const targetPage = Math.floor(recordIndex / this._recordPageSize) + 1;
        this.switchPage('view-records');
        this.renderRecords('all', '', targetPage);

        const card = [...document.querySelectorAll('.record-card')]
            .find(item => item.dataset.recordId === String(recordId));
        if (!card) return;
        card.classList.add('record-card-located');
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        setTimeout(() => card.classList.remove('record-card-located'), 2400);
    },

    // 更新统计数据UI
    updateStatsUI(stats) {
        document.getElementById('total-amount').textContent = `￥${stats.totalAmount.toFixed(2)}`;
        document.getElementById('total-discount2').textContent = `￥${stats.totalDiscount.toFixed(2)}`;
        document.getElementById('total-energy2').textContent = stats.totalEnergy.toFixed(1);
        document.getElementById('total-count').textContent = stats.totalCount;

        const totalMinutes = Math.floor(stats.totalDuration / 60000);
        const totalDurationUnit = document.getElementById('total-duration-unit');
        if (totalMinutes < 60) {
            document.getElementById('total-duration').textContent = totalMinutes;
            if (totalDurationUnit) totalDurationUnit.textContent = '分钟';
        } else {
            document.getElementById('total-duration').textContent = Math.floor(totalMinutes / 60);
            if (totalDurationUnit) totalDurationUnit.textContent = '小时';
        }

        document.getElementById('avg-price').textContent = `￥${stats.avgPrice.toFixed(2)}`;
    },

    getSelectedStatsPeriod() {
        const selectedRange = DataManager.getSelectedTimeRange() || { range: 'week' };
        let startDate;
        let endDate;

        if (selectedRange.range === 'custom' && selectedRange.startDate && selectedRange.endDate) {
            startDate = new Date(selectedRange.startDate);
            const selectedEnd = new Date(selectedRange.endDate);
            endDate = new Date(selectedEnd.getFullYear(), selectedEnd.getMonth(), selectedEnd.getDate() + 1);
        } else {
            const dateRange = AppUtils.getDateRangeByType(selectedRange.range) || AppUtils.getDateRangeByType('week');
            startDate = new Date(dateRange.startDate);
            endDate = new Date(dateRange.endDate);
        }

        startDate.setHours(0, 0, 0, 0);
        const range = selectedRange.range || 'week';
        let previousStartDate;
        if (range === 'month' || range === 'lastMonth') {
            previousStartDate = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
        } else if (range === 'year') {
            previousStartDate = new Date(startDate.getFullYear() - 1, 0, 1);
        } else {
            previousStartDate = new Date(startDate.getTime() - (endDate - startDate));
        }
        return { range, startDate, endDate, previousStartDate, previousEndDate: new Date(startDate) };
    },

    // 更新日期显示
    updateDateDisplay(period = this.getSelectedStatsPeriod()) {
        const dateDisplay = document.getElementById('stats-date');
        if (!dateDisplay) return;
        const inclusiveEnd = new Date(period.endDate.getTime() - 1);
        dateDisplay.textContent = `${AppUtils.formatDateShort(period.startDate)} ~ ${AppUtils.formatDateShort(inclusiveEnd)}`;
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
        const fastDurationEl = document.getElementById('fast-duration');
        const formatExactDuration = milliseconds => {
            const totalMinutes = Math.max(Math.floor(milliseconds / 60000), 0);
            return `${Math.floor(totalMinutes / 60)}小时${totalMinutes % 60}分钟`;
        };

        if (fastPercentageEl) fastPercentageEl.textContent = `${fastPercentage.toFixed(1)}%`;
        if (fastEnergyEl) fastEnergyEl.textContent = `${fastStats.energy.toFixed(1)} kWh`;
        if (fastCostEl) fastCostEl.textContent = `￥${fastStats.amount.toFixed(2)}`;
        if (fastAvgPriceEl) fastAvgPriceEl.textContent = `￥${fastStats.avgPrice.toFixed(2)}/kWh`;
        if (fastDurationEl) fastDurationEl.textContent = formatExactDuration(fastStats.duration);

        // 更新慢充数据
        const slowPercentageEl = document.getElementById('slow-percentage');
        const slowEnergyEl = document.getElementById('slow-energy-detail');
        const slowCostEl = document.getElementById('slow-cost');
        const slowAvgPriceEl = document.getElementById('slow-avg-price');
        const slowDurationEl = document.getElementById('slow-duration');

        if (slowPercentageEl) slowPercentageEl.textContent = `${slowPercentage.toFixed(1)}%`;
        if (slowEnergyEl) slowEnergyEl.textContent = `${slowStats.energy.toFixed(1)} kWh`;
        if (slowCostEl) slowCostEl.textContent = `￥${slowStats.amount.toFixed(2)}`;
        if (slowAvgPriceEl) slowAvgPriceEl.textContent = `￥${slowStats.avgPrice.toFixed(2)}/kWh`;
        if (slowDurationEl) slowDurationEl.textContent = formatExactDuration(slowStats.duration);
    },

    // 更新本周期的趣味分析
    updateFunInsights(records) {
        const setInsight = (name, value, record) => {
            const valueEl = document.getElementById(`insight-${name}-value`);
            const metaEl = document.getElementById(`insight-${name}-meta`);
            if (!valueEl || !metaEl) return;

            valueEl.textContent = value;
            if (record) {
                const stationEl = document.createElement('span');
                stationEl.className = 'fun-insight-station';
                stationEl.textContent = record.stationName;

                const dateEl = document.createElement('span');
                dateEl.className = 'fun-insight-date';
                dateEl.textContent = AppUtils.formatDateShort(new Date(record.startTime));

                metaEl.replaceChildren(stationEl, dateEl);
            } else {
                metaEl.textContent = '暂无记录';
            }
            metaEl.title = record ? record.stationName : '';
            const card = valueEl.closest('.fun-insight-card');
            if (card) {
                card.dataset.recordId = record?.id || '';
                card.classList.toggle('is-actionable', Boolean(record));
                card.tabIndex = record ? 0 : -1;
                card.onclick = record ? () => this.revealRecord(record.id) : null;
                card.onkeydown = record ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        this.revealRecord(record.id);
                    }
                } : null;
            }
        };

        if (records.length === 0) {
            ['expensive', 'cost-low', 'discount-max', 'duration', 'power-high', 'power-low', 'price-high', 'price-low']
                .forEach(name => setInsight(name, '--', null));
            return;
        }

        const normalized = records.map(record => ({
            record,
            duration: new Date(record.endTime) - new Date(record.startTime),
            power: AppUtils.calculateAveragePower(record.chargeAmount, record.startTime, record.endTime),
            unitPrice: Number(record.chargeAmount) > 0
                ? ((Number(record.finalPrice) || 0) + (Number(record.discountAmount) || 0)) / Number(record.chargeAmount)
                : 0
        }));
        const validDurations = normalized.filter(item => Number.isFinite(item.duration) && item.duration > 0);
        const validPowers = normalized.filter(item => Number.isFinite(item.power) && item.power > 0);
        const validPrices = normalized.filter(item => Number.isFinite(item.unitPrice) && item.unitPrice >= 0 && Number(item.record.chargeAmount) > 0);
        const expensive = [...records].sort((a, b) => (Number(b.finalPrice) || 0) - (Number(a.finalPrice) || 0))[0];
        const cheapest = [...records].sort((a, b) => (Number(a.finalPrice) || 0) - (Number(b.finalPrice) || 0))[0];
        const mostDiscounted = [...records].sort((a, b) => (Number(b.discountAmount) || 0) - (Number(a.discountAmount) || 0))[0];
        const longest = [...validDurations].sort((a, b) => b.duration - a.duration)[0];
        const highestPower = [...validPowers].sort((a, b) => b.power - a.power)[0];
        const lowestPower = [...validPowers].sort((a, b) => a.power - b.power)[0];
        const highestPrice = [...validPrices].sort((a, b) => b.unitPrice - a.unitPrice)[0];
        const lowestPrice = [...validPrices].sort((a, b) => a.unitPrice - b.unitPrice)[0];

        setInsight('expensive', `￥${(Number(expensive.finalPrice) || 0).toFixed(2)}`, expensive);
        setInsight('cost-low', `￥${(Number(cheapest.finalPrice) || 0).toFixed(2)}`, cheapest);
        setInsight('discount-max', `￥${(Number(mostDiscounted.discountAmount) || 0).toFixed(2)}`, mostDiscounted);
        setInsight('duration', longest ? AppUtils.formatDuration(longest.duration) : '--', longest?.record || null);
        setInsight('power-high', highestPower ? `${highestPower.power.toFixed(2)} kW` : '--', highestPower?.record || null);
        setInsight('power-low', lowestPower ? `${lowestPower.power.toFixed(2)} kW` : '--', lowestPower?.record || null);
        setInsight('price-high', highestPrice ? `￥${highestPrice.unitPrice.toFixed(2)}/kWh` : '--', highestPrice?.record || null);
        setInsight('price-low', lowestPrice ? `￥${lowestPrice.unitPrice.toFixed(2)}/kWh` : '--', lowestPrice?.record || null);
    },

    renderChargingHeatmap(records, period) {
        const container = document.getElementById('charging-heatmap');
        if (!container || typeof ChargingAnalytics === 'undefined') return;

        const selectedEnd = new Date(period.endDate.getTime() - 1);
        const heatmapYear = selectedEnd.getFullYear();
        const heatmapPeriod = {
            startDate: new Date(heatmapYear, 0, 1),
            endDate: new Date(heatmapYear + 1, 0, 1)
        };
        const heatmap = ChargingAnalytics.getHeatmapData(records, heatmapPeriod.startDate, heatmapPeriod.endDate);
        const activeDays = heatmap.days.filter(day => day.inRange && day.data).length;
        const isSingleWeek = heatmap.columns === 1;
        const cellSize = heatmap.columns > 15 ? 9 : heatmap.columns <= 6 ? 26 : 17;
        const gap = heatmap.columns > 15 ? 3 : 4;
        const visualColumns = isSingleWeek ? 7 : heatmap.columns;
        const visualRows = isSingleWeek ? 1 : 7;
        const width = visualColumns * cellSize + Math.max(visualColumns - 1, 0) * gap;
        const todayKey = (() => {
            const now = new Date();
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        })();

        const cells = heatmap.days.map((day, index) => {
            let level = 0;
            if (day.data && heatmap.maxCost > 0) {
                const ratio = day.data.cost / heatmap.maxCost;
                level = ratio <= .25 ? 1 : ratio <= .5 ? 2 : ratio <= .75 ? 3 : 4;
            }
            const dateText = `${day.date.getFullYear()}年${day.date.getMonth() + 1}月${day.date.getDate()}日`;
            const title = day.data
                ? `${dateText}：${day.data.count}次，￥${day.data.cost.toFixed(2)}，${day.data.energy.toFixed(1)} kWh`
                : `${dateText}：无充电`;
            const classes = [
                'heatmap-cell',
                day.inRange ? '' : 'outside',
                day.data ? `has-record level-${level}` : '',
                day.key === todayKey ? 'today' : ''
            ].filter(Boolean).join(' ');
            const column = isSingleWeek ? index + 1 : Math.floor(index / 7) + 1;
            const row = isSingleWeek ? 1 : index % 7 + 1;
            return `<span class="${classes}" style="grid-column:${column};grid-row:${row}" title="${title}" aria-hidden="true"></span>`;
        }).join('');

        const monthLabels = heatmap.monthLabels.map(item =>
            `<span style="grid-column:${isSingleWeek ? 1 : item.column} / span ${isSingleWeek ? 7 : item.span}">${item.label}</span>`
        ).join('');
        const heatmapEnd = new Date(heatmapPeriod.endDate.getTime() - 1);
        const rangeLabel = `${AppUtils.formatDateShort(heatmapPeriod.startDate)}至${AppUtils.formatDateShort(heatmapEnd)}`;
        const visibleRangeLabel = document.getElementById('heatmap-range-label');
        if (visibleRangeLabel) {
            visibleRangeLabel.textContent = `${heatmapYear}年全年 · 按日花费`;
        }

        container.innerHTML = `
            <div class="heatmap-scroll" tabindex="0" aria-label="${rangeLabel}充电热力图，共${activeDays}个充电日">
              <div class="heatmap-canvas${isSingleWeek ? ' is-week' : ''}" style="--heatmap-columns:${visualColumns};--heatmap-rows:${visualRows};--heatmap-cell:${cellSize}px;--heatmap-gap:${gap}px;--heatmap-width:${width}px">
                <div class="heatmap-grid" aria-hidden="true">${cells}</div>
                <div class="heatmap-months" aria-hidden="true">${monthLabels}</div>
              </div>
            </div>`;
    },

    renderStationRanking(type = this._rankingType, records = DataManager.getFilteredRecordsByDate()) {
        const container = document.getElementById('station-ranking-list');
        if (!container || typeof ChargingAnalytics === 'undefined') return;

        this._rankingType = type;
        document.querySelectorAll('.ranking-tab').forEach(button => {
            const isActive = button.dataset.ranking === type;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', String(isActive));
        });

        const rankings = ChargingAnalytics.getStationRankings(records);
        const list = (rankings[type] || []).slice(0, 5);
        if (list.length === 0) {
            container.innerHTML = '<div class="stats-data-empty">暂无可排行的充电站</div>';
            return;
        }

        const metric = item => {
            if (type === 'economical') return `￥${item.originalAvgPrice.toFixed(2)}/kWh`;
            if (type === 'powerful') return `${item.avgPower.toFixed(1)} kW`;
            return `${item.count} 次`;
        };
        const allRecords = DataManager.getRecords();
        container.innerHTML = list.map((item, index) => {
            const latestRecord = allRecords
                .filter(record => record.stationName === item.name)
                .sort((a, b) => new Date(b.endTime) - new Date(a.endTime))[0];
            return `
            <div class="ranking-row${latestRecord ? ' is-actionable' : ''}" data-record-id="${latestRecord?.id || ''}" tabindex="${latestRecord ? '0' : '-1'}">
                <span class="ranking-position">${index + 1}</span>
                <span class="ranking-name">${AppUtils.escapeHtml(item.name)}</span>
                <span class="ranking-metric">${metric(item)}</span>
            </div>`;
        }).join('');
        container.querySelectorAll('.ranking-row.is-actionable').forEach(row => {
            const reveal = () => this.revealRecord(row.dataset.recordId);
            row.addEventListener('click', reveal);
            row.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    reveal();
                }
            });
        });
    },

    renderHabitProfile(records) {
        const container = document.getElementById('habit-profile-content');
        if (!container || typeof ChargingAnalytics === 'undefined') return;
        const profile = ChargingAnalytics.getHabitProfile(records);
        if (!profile) {
            container.innerHTML = '<div class="stats-data-empty">积累充电记录后即可生成画像</div>';
            return;
        }

        const chargePreference = profile.fastRatio >= .5 ? '偏爱快充' : '偏爱慢充';
        const dayPreference = profile.weekendRatio >= .5 ? '周末充电较多' : '工作日充电较多';
        const intervalText = profile.avgInterval === null ? '数据不足' : `${profile.avgInterval.toFixed(1)} 天`;
        container.innerHTML = `
            <p class="habit-summary">你通常在${profile.preferredPeriod}充电，${dayPreference}，${chargePreference}。最常去的是“${AppUtils.escapeHtml(profile.favoriteStation)}”。</p>
            <div class="habit-metrics">
                <div class="habit-metric"><span>常用时段</span><strong>${profile.preferredPeriod}</strong></div>
                <div class="habit-metric"><span>平均间隔</span><strong>${intervalText}</strong></div>
                <div class="habit-metric"><span>快充占比</span><strong>${(profile.fastRatio * 100).toFixed(0)}%</strong></div>
                <div class="habit-metric"><span>常去站点</span><strong>${AppUtils.escapeHtml(profile.favoriteStation)}</strong></div>
            </div>`;
    },

    renderPeriodReport(records, period) {
        if (typeof ChargingAnalytics === 'undefined') return;
        const report = ChargingAnalytics.getPeriodReport(
            records,
            period.startDate,
            period.endDate,
            period.previousStartDate,
            period.previousEndDate
        );
        const labelByRange = { week: '本周', month: '本月', lastMonth: '上月', year: '本年', custom: '自定义' };
        const subjectByRange = { week: '本周', month: '本月', lastMonth: '上月', year: '本年', custom: '所选周期' };
        const summary = document.getElementById('monthly-report-summary');
        const subject = subjectByRange[period.range] || '当前周期';
        if (summary) {
            if (report.count === 0) {
                summary.textContent = `${subject}还没有充电记录，可以通过顶部时间范围切换查看。`;
            } else if (report.costChange === null) {
                summary.textContent = `${subject}共充电 ${report.count} 次，累计节省 ￥${report.discount.toFixed(2)}；上一周期暂无可对比数据。`;
            } else {
                const direction = report.costChange >= 0 ? '增加' : '减少';
                summary.textContent = `${subject}费用较上一周期${direction} ${Math.abs(report.costChange * 100).toFixed(1)}%，累计节省 ￥${report.discount.toFixed(2)}。`;
            }
        }

        const title = document.getElementById('monthly-report-title');
        if (!title) return;
        const inclusiveEnd = new Date(period.endDate.getTime() - 1);
        const titleByRange = {
            week: '本周充电报告',
            month: `${period.startDate.getFullYear()}年${period.startDate.getMonth() + 1}月充电报告`,
            lastMonth: `${period.startDate.getFullYear()}年${period.startDate.getMonth() + 1}月充电报告`,
            year: `${period.startDate.getFullYear()}年度充电报告`,
            custom: `${AppUtils.formatDateShort(period.startDate)}—${AppUtils.formatDateShort(inclusiveEnd)} 充电报告`
        };
        title.textContent = titleByRange[period.range] || '周期充电报告';
        const rangeLabel = document.getElementById('report-range-label');
        if (rangeLabel) rangeLabel.textContent = labelByRange[period.range] || '当前周期';
        document.getElementById('report-cost').textContent = `￥${report.cost.toFixed(2)}`;
        document.getElementById('report-energy').textContent = `${report.energy.toFixed(1)} kWh`;
        document.getElementById('report-count').textContent = `${report.count} 次`;
        document.getElementById('report-avg-price').textContent = `￥${report.avgPrice.toFixed(2)}`;

    },

    renderCostForecast(records) {
        const container = document.getElementById('forecast-content');
        const confidence = document.getElementById('forecast-confidence');
        if (!container || !confidence || typeof ChargingAnalytics === 'undefined') return;
        const forecast = ChargingAnalytics.getCostForecast(records);
        if (!forecast) {
            confidence.textContent = '--';
            container.innerHTML = '<div class="stats-data-empty">积累充电记录后即可生成预测</div>';
            return;
        }

        confidence.textContent = `可信度：${forecast.confidence}`;
        container.innerHTML = `
            <div class="forecast-item"><span>本月预计</span><strong>￥${forecast.currentMonthProjection.toFixed(0)}</strong><small>当前已花 ￥${forecast.currentCost.toFixed(0)}</small></div>
            <div class="forecast-item"><span>下月预计</span><strong>￥${forecast.nextMonthEstimate.toFixed(0)}</strong><small>近三月均值</small></div>
            <div class="forecast-item"><span>全年预计</span><strong>￥${forecast.yearProjection.toFixed(0)}</strong><small>${forecast.sampleCount} 条样本</small></div>`;
    },

    renderAdvancedAnalytics(filteredRecords, period) {
        if (typeof ChargingAnalytics === 'undefined') return;
        const allRecords = DataManager.getRecords();
        this.renderChargingHeatmap(allRecords, period);
        this.renderStationRanking(this._rankingType, filteredRecords);
        this.renderPeriodReport(allRecords, period);
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
        const period = this.getSelectedStatsPeriod();
        const stats = DataManager.calculateStatistics(filteredRecords);
        this.updateStatsUI(stats);
        this.updateDateDisplay(period);
        this.updateChartSegments();
        this.updateFunInsights(filteredRecords);
        this.renderAdvancedAnalytics(filteredRecords, period);
    }
};

// 导出UI模块
if (typeof window !== 'undefined') {
    window.UI = UI;
}
