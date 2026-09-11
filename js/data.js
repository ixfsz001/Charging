/**
 * 数据管理模块（纯离线版）
 * 数据完全存储在本地，通过导入/导出文件管理
 */

// 数据存储键名常量
const STORAGE_KEYS = {
    RECORDS: 'charging_records',
    TIME_RANGE: 'selectedTimeRange',
    AI_BASE_URL: 'ai_base_url',
    AI_API_KEY: 'ai_api_key',
    AI_MODEL: 'ai_model'
};

// 数据管理器
const DataManager = {
    // 内部数据存储
    _records: [],
    _selectedTimeRange: { range: 'week' },
    _selectedRecordDateRange: null,

    // 统一校验并规范化外部数据，避免导入或旧版缓存中的异常字段影响统计结果
    normalizeRecord(record) {
        if (!record || typeof record !== 'object') return null;

        const startTime = new Date(record.startTime);
        const endTime = new Date(record.endTime);
        const chargeAmount = Number(record.chargeAmount);
        const finalPrice = Number(record.finalPrice);
        const discountAmount = record.discountAmount === undefined || record.discountAmount === ''
            ? 0
            : Number(record.discountAmount);
        const stationName = typeof record.stationName === 'string' ? record.stationName.trim() : '';

        if (!record.id || !stationName || !['fast', 'slow'].includes(record.chargeType)
            || !Number.isFinite(startTime.getTime()) || !Number.isFinite(endTime.getTime())
            || endTime <= startTime || !Number.isFinite(chargeAmount) || chargeAmount <= 0
            || !Number.isFinite(finalPrice) || finalPrice < 0
            || !Number.isFinite(discountAmount) || discountAmount < 0) {
            return null;
        }

        return {
            ...record,
            id: String(record.id),
            stationName,
            chargeAmount,
            finalPrice,
            discountAmount
        };
    },

    normalizeRecords(records) {
        return Array.isArray(records)
            ? records.map(record => this.normalizeRecord(record)).filter(Boolean)
            : [];
    },

    // 获取所有记录
    getRecords() {
        return this._records;
    },

    // 设置记录
    setRecords(newRecords) {
        this._records = newRecords;
    },

    // 获取当前选中的时间范围
    getSelectedTimeRange() {
        return this._selectedTimeRange;
    },

    // 设置时间范围
    setSelectedTimeRange(range) {
        this._selectedTimeRange = range;
    },

    // 获取记录页面的时间范围
    getSelectedRecordDateRange() {
        return this._selectedRecordDateRange;
    },

    // 设置记录页面的时间范围
    setSelectedRecordDateRange(range) {
        this._selectedRecordDateRange = range;
    },

    // 从localStorage加载数据
    loadData() {
        try {
            const recordsData = localStorage.getItem(STORAGE_KEYS.RECORDS);
            const timeRangeData = localStorage.getItem(STORAGE_KEYS.TIME_RANGE);

            this._records = this.normalizeRecords(recordsData ? JSON.parse(recordsData) : []);

            // 加载用户选择的时间范围
            if (timeRangeData) {
                this._selectedTimeRange = JSON.parse(timeRangeData);
                // 如果是自定义时间范围，需要将字符串日期转换为Date对象
                if (this._selectedTimeRange.range === 'custom' &&
                    this._selectedTimeRange.startDate &&
                    this._selectedTimeRange.endDate) {
                    this._selectedTimeRange.startDate = new Date(this._selectedTimeRange.startDate);
                    this._selectedTimeRange.endDate = new Date(this._selectedTimeRange.endDate);
                }
            }
        } catch (error) {
            console.error('加载数据失败:', error);
            this._records = [];
            this._selectedTimeRange = { range: 'week' };
        }
    },

    // 保存数据到localStorage
    saveData() {
        try {
            localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(this._records));
        } catch (error) {
            console.error('保存数据失败:', error);
            if (typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast('数据保存失败，请检查浏览器存储空间', 3000, 'error');
            }
        }
    },

    // 保存时间范围选择
    saveSelectedTimeRange() {
        try {
            const serializableRange = { ...this._selectedTimeRange };
            // 将Date对象转换为ISO字符串以便存储
            if (serializableRange.startDate instanceof Date) {
                serializableRange.startDate = serializableRange.startDate.toISOString();
            }
            if (serializableRange.endDate instanceof Date) {
                serializableRange.endDate = serializableRange.endDate.toISOString();
            }
            localStorage.setItem(STORAGE_KEYS.TIME_RANGE, JSON.stringify(serializableRange));
        } catch (error) {
            console.error('保存时间范围失败:', error);
            if (typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast('时间范围保存失败', 3000, 'error');
            }
        }
    },

    // 保存AI配置
    saveAIConfig(baseUrl, apiKey, model) {
        try {
            localStorage.setItem(STORAGE_KEYS.AI_BASE_URL, baseUrl);
            localStorage.setItem(STORAGE_KEYS.AI_API_KEY, apiKey);
            localStorage.setItem(STORAGE_KEYS.AI_MODEL, model || '');
        } catch (error) {
            console.error('保存AI配置失败:', error);
            if (typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast('配置保存失败，请检查浏览器存储空间', 3000, 'error');
            }
        }
    },

    // 获取AI配置
    getAIConfig() {
        return {
            baseUrl: localStorage.getItem(STORAGE_KEYS.AI_BASE_URL) || 'https://api.xiaomimimo.com/v1',
            apiKey: localStorage.getItem(STORAGE_KEYS.AI_API_KEY) || '',
            model: localStorage.getItem(STORAGE_KEYS.AI_MODEL) || ''
        };
    },

    // 检查AI配置是否有效
    isAIConfigValid() {
        const config = this.getAIConfig();
        return config.baseUrl && config.apiKey;
    },

    // 获取筛选后的记录（根据日期范围）
    getFilteredRecordsByDate() {
        let filtered = this._records;
        const selectedRange = this._selectedTimeRange || { range: 'week' };
        let startDate, endDate;

        if (selectedRange.range === 'custom' && selectedRange.startDate && selectedRange.endDate) {
            startDate = new Date(selectedRange.startDate);
            endDate = new Date(selectedRange.endDate);
            endDate.setHours(23, 59, 59, 999);
        } else {
            const dateRange = AppUtils.getDateRangeByType(selectedRange.range);
            if (dateRange) {
                startDate = dateRange.startDate;
                endDate = dateRange.endDate;
            } else {
                const now = new Date();
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            }
        }

        filtered = filtered.filter(record => {
            const recordStart = new Date(record.startTime);
            return selectedRange.range === 'custom'
                ? recordStart >= startDate && recordStart <= endDate
                : recordStart >= startDate && recordStart < endDate;
        });

        return filtered;
    },

    // 计算统计数据
    calculateStatistics(records) {
        const totalAmount = records.reduce((sum, record) => sum + record.finalPrice, 0);
        const totalDiscount = records.reduce((sum, record) => sum + record.discountAmount, 0);
        const totalEnergy = records.reduce((sum, record) => sum + record.chargeAmount, 0);
        const totalCount = records.length;
        const totalDuration = records.reduce((sum, record) => {
            return sum + (new Date(record.endTime) - new Date(record.startTime));
        }, 0);

        const avgPrice = totalEnergy > 0 ? totalAmount / totalEnergy : 0;

        // 慢充统计
        const slowRecords = records.filter(r => r.chargeType === 'slow');
        const slowEnergy = slowRecords.reduce((sum, r) => sum + r.chargeAmount, 0);
        const slowAmount = slowRecords.reduce((sum, r) => sum + r.finalPrice, 0);
        const slowDuration = slowRecords.reduce((sum, r) => sum + (new Date(r.endTime) - new Date(r.startTime)), 0);
        const slowStats = {
            count: slowRecords.length,
            energy: slowEnergy,
            amount: slowAmount,
            duration: slowDuration,
            avgPrice: slowRecords.length > 0 ? slowAmount / slowEnergy : 0
        };

        // 快充统计
        const fastRecords = records.filter(r => r.chargeType === 'fast');
        const fastEnergy = fastRecords.reduce((sum, r) => sum + r.chargeAmount, 0);
        const fastAmount = fastRecords.reduce((sum, r) => sum + r.finalPrice, 0);
        const fastDuration = fastRecords.reduce((sum, r) => sum + (new Date(r.endTime) - new Date(r.startTime)), 0);
        const fastStats = {
            count: fastRecords.length,
            energy: fastEnergy,
            amount: fastAmount,
            duration: fastDuration,
            avgPrice: fastRecords.length > 0 ? fastAmount / fastEnergy : 0
        };

        return {
            totalAmount,
            totalDiscount,
            totalEnergy,
            totalCount,
            totalDuration,
            avgPrice,
            slowStats,
            fastStats
        };
    },

    // 添加记录
    addRecord(record) {
        this._records.unshift(record);
        this.saveData();
    },

    // 按业务字段查找重复记录，兼容等价但格式不同的时间字符串
    findDuplicateRecord(record) {
        const startTime = new Date(record.startTime).getTime();
        const endTime = new Date(record.endTime).getTime();
        return this._records.find(existing =>
            new Date(existing.startTime).getTime() === startTime &&
            new Date(existing.endTime).getTime() === endTime &&
            Number(existing.chargeAmount) === Number(record.chargeAmount) &&
            Number(existing.finalPrice) === Number(record.finalPrice)
        ) || null;
    },

    // 更新记录
    updateRecord(id, updatedData) {
        const index = this._records.findIndex(r => r.id === id);
        if (index !== -1) {
            this._records[index] = { ...this._records[index], ...updatedData };
            this.saveData();
            return true;
        }
        return false;
    },

    // 删除记录
    deleteRecord(id) {
        this._records = this._records.filter(record => record.id !== id);
        this.saveData();
    },

    // 清空所有记录
    clearAllRecords() {
        this._records = [];
        this.saveData();
    },

    // 获取所有唯一的充电站名称
    getUniqueStationNames() {
        return [...new Set(this._records.map(record => record.stationName).filter(name => name))];
    },

    // 搜索记录（按站点名）
    searchRecords(keyword) {
        if (!keyword || !keyword.trim()) {
            return this._records;
        }
        const lowerKeyword = keyword.toLowerCase();
        return this._records.filter(record =>
            record.stationName && record.stationName.toLowerCase().includes(lowerKeyword)
        );
    },

    // 导出数据为JSON格式
    exportData() {
        return JSON.stringify({
            version: '2.0',
            exportDate: new Date().toISOString(),
            records: this._records
        }, null, 2);
    },

    // 导入数据
    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);

            // 支持两种格式：带version字段的和不带的
            const importedRecords = Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : null;
            if (importedRecords) {
                const normalizedRecords = this.normalizeRecords(importedRecords);
                if (normalizedRecords.length !== importedRecords.length) {
                    return { success: false, message: '数据格式无效' };
                }

                this._records = normalizedRecords;
                this.saveData();
                return { success: true, count: normalizedRecords.length };
            }

            return { success: false, message: '无法识别的数据格式' };
        } catch (error) {
            console.error('导入数据失败:', error);
            return { success: false, message: 'JSON解析失败: ' + error.message };
        }
    },

    // 获取数据统计信息（用于显示）
    getDataInfo() {
        if (this._records.length === 0) {
            return {
                totalRecords: 0,
                earliestDate: '无',
                latestDate: '无',
                totalEnergy: '0.0',
                totalCost: '0.00'
            };
        }

        let minTime = Infinity, maxTime = -Infinity;
        let totalEnergy = 0, totalCost = 0;

        for (const r of this._records) {
            const t = new Date(r.startTime).getTime();
            if (t < minTime) minTime = t;
            if (t > maxTime) maxTime = t;
            totalEnergy += r.chargeAmount;
            totalCost += r.finalPrice;
        }

        return {
            totalRecords: this._records.length,
            earliestDate: new Date(minTime).toLocaleDateString('zh-CN'),
            latestDate: new Date(maxTime).toLocaleDateString('zh-CN'),
            totalEnergy: totalEnergy.toFixed(1),
            totalCost: totalCost.toFixed(2)
        };
    }
};

// 导出数据管理器
if (typeof window !== 'undefined') {
    window.DataManager = DataManager;
    window.STORAGE_KEYS = STORAGE_KEYS;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataManager;
}
