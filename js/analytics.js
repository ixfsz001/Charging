/**
 * 高级统计分析模块
 * 仅负责数据计算，不直接操作页面。
 */
const ChargingAnalytics = {
    normalizeRecord(record) {
        const start = new Date(record.startTime);
        const end = new Date(record.endTime);
        const durationMs = end - start;
        const energy = Number(record.chargeAmount) || 0;
        const cost = Number(record.finalPrice) || 0;
        const discount = Number(record.discountAmount) || 0;
        const durationHours = durationMs > 0 ? durationMs / 3600000 : 0;

        return {
            ...record,
            start,
            end,
            durationMs: Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0,
            energy,
            cost,
            discount,
            avgPrice: energy > 0 ? cost / energy : 0,
            avgPower: durationHours > 0 ? energy / durationHours : 0
        };
    },

    validRecords(records) {
        return records
            .map(record => this.normalizeRecord(record))
            .filter(record => !Number.isNaN(record.start.getTime()));
    },

    getMonthRecords(records, year, month) {
        return this.validRecords(records).filter(record =>
            record.start.getFullYear() === year && record.start.getMonth() === month
        );
    },

    getCalendarData(records, year, month) {
        const monthRecords = this.getMonthRecords(records, year, month);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstWeekday = new Date(year, month, 1).getDay();
        const daily = new Map();

        monthRecords.forEach(record => {
            const day = record.start.getDate();
            const item = daily.get(day) || { count: 0, cost: 0, energy: 0 };
            item.count += 1;
            item.cost += record.cost;
            item.energy += record.energy;
            daily.set(day, item);
        });

        const maxCost = Math.max(...[...daily.values()].map(item => item.cost), 0);
        return { year, month, daysInMonth, firstWeekday, daily, maxCost };
    },

    getPeriodReport(records, startDate, endDate, previousStartDate, previousEndDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const duration = end - start;
        const previousStart = previousStartDate ? new Date(previousStartDate) : new Date(start.getTime() - duration);
        const previousEnd = previousEndDate ? new Date(previousEndDate) : start;
        const validRecords = this.validRecords(records);

        const summarize = (rangeStart, rangeEnd) => {
            const list = validRecords.filter(record =>
                record.start >= rangeStart && record.start < rangeEnd
            );
            const result = {
                count: list.length,
                cost: list.reduce((sum, record) => sum + record.cost, 0),
                energy: list.reduce((sum, record) => sum + record.energy, 0),
                discount: list.reduce((sum, record) => sum + record.discount, 0)
            };
            result.avgPrice = result.energy > 0 ? result.cost / result.energy : 0;
            return result;
        };

        const current = summarize(start, end);
        const previous = summarize(previousStart, previousEnd);
        current.costChange = previous.cost > 0
            ? (current.cost - previous.cost) / previous.cost
            : null;

        return { start, end, ...current, previous };
    },

    getHeatmapData(records, startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        start.setHours(0, 0, 0, 0);

        const visibleStart = new Date(start);
        visibleStart.setDate(visibleStart.getDate() - ((visibleStart.getDay() + 6) % 7));

        const lastSelectedDay = new Date(end.getTime() - 1);
        lastSelectedDay.setHours(0, 0, 0, 0);
        const visibleEnd = new Date(lastSelectedDay);
        visibleEnd.setDate(visibleEnd.getDate() + (7 - ((visibleEnd.getDay() + 6) % 7)));

        const dateKey = date => [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('-');

        const daily = new Map();
        this.validRecords(records).forEach(record => {
            if (record.start < start || record.start >= end) return;
            const key = dateKey(record.start);
            const item = daily.get(key) || { count: 0, cost: 0, energy: 0 };
            item.count += 1;
            item.cost += record.cost;
            item.energy += record.energy;
            daily.set(key, item);
        });

        const maxCost = Math.max(...[...daily.values()].map(item => item.cost), 0);
        const days = [];
        for (let cursor = new Date(visibleStart); cursor < visibleEnd; cursor.setDate(cursor.getDate() + 1)) {
            const date = new Date(cursor);
            const key = dateKey(date);
            days.push({
                date,
                key,
                inRange: date >= start && date < end,
                data: daily.get(key) || null
            });
        }

        const columns = Math.max(days.length / 7, 1);
        const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
        const monthLabels = [];
        for (
            let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
            cursor < end;
            cursor.setMonth(cursor.getMonth() + 1)
        ) {
            const monthStart = new Date(cursor);
            const effectiveStart = monthStart < start ? start : monthStart;
            const dayOffset = Math.floor((effectiveStart - visibleStart) / 86400000);
            const column = Math.max(Math.floor(dayOffset / 7) + 1, 1);
            monthLabels.push({
                column,
                label: monthNames[monthStart.getMonth()],
                year: monthStart.getFullYear()
            });
        }

        monthLabels.forEach((item, index) => {
            const nextColumn = monthLabels[index + 1]?.column || columns + 1;
            item.span = Math.max(nextColumn - item.column, 1);
        });

        return { start, end, visibleStart, visibleEnd, days, columns, monthLabels, maxCost };
    },

    getStationRankings(records) {
        const stations = new Map();
        this.validRecords(records).forEach(record => {
            const name = (record.stationName || '未知充电站').trim();
            const item = stations.get(name) || { name, count: 0, cost: 0, discount: 0, energy: 0, durationHours: 0 };
            item.count += 1;
            item.cost += record.cost;
            item.discount += record.discount;
            item.energy += record.energy;
            item.durationHours += record.durationMs / 3600000;
            stations.set(name, item);
        });

        const list = [...stations.values()].map(item => ({
            ...item,
            avgPrice: item.energy > 0 ? item.cost / item.energy : 0,
            originalAvgPrice: item.energy > 0 ? (item.cost + item.discount) / item.energy : 0,
            avgPower: item.durationHours > 0 ? item.energy / item.durationHours : 0
        }));

        return {
            frequent: [...list].sort((a, b) => b.count - a.count || b.energy - a.energy),
            economical: list.filter(item => item.energy > 0).sort((a, b) => a.originalAvgPrice - b.originalAvgPrice),
            powerful: list.filter(item => item.avgPower > 0).sort((a, b) => b.avgPower - a.avgPower)
        };
    },

    getHabitProfile(records) {
        const list = this.validRecords(records);
        if (list.length === 0) return null;

        const periods = { '凌晨': 0, '上午': 0, '下午': 0, '晚上': 0 };
        let weekend = 0;
        let fast = 0;
        const stationCounts = new Map();
        const uniqueDays = new Set();

        list.forEach(record => {
            const hour = record.start.getHours();
            if (hour < 6) periods['凌晨'] += 1;
            else if (hour < 12) periods['上午'] += 1;
            else if (hour < 18) periods['下午'] += 1;
            else periods['晚上'] += 1;

            if (record.start.getDay() === 0 || record.start.getDay() === 6) weekend += 1;
            if (record.chargeType === 'fast') fast += 1;
            stationCounts.set(record.stationName, (stationCounts.get(record.stationName) || 0) + 1);
            uniqueDays.add(`${record.start.getFullYear()}-${record.start.getMonth()}-${record.start.getDate()}`);
        });

        const preferredPeriod = Object.entries(periods).sort((a, b) => b[1] - a[1])[0][0];
        const favoriteStation = [...stationCounts.entries()].sort((a, b) => b[1] - a[1])[0];
        const dates = [...uniqueDays]
            .map(value => {
                const [year, month, day] = value.split('-').map(Number);
                return new Date(year, month, day);
            })
            .sort((a, b) => a - b);
        const intervals = dates.slice(1).map((date, index) => (date - dates[index]) / 86400000);
        const avgInterval = intervals.length > 0
            ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
            : null;

        return {
            preferredPeriod,
            weekendRatio: weekend / list.length,
            fastRatio: fast / list.length,
            favoriteStation: favoriteStation?.[0] || '暂无',
            favoriteStationCount: favoriteStation?.[1] || 0,
            avgInterval,
            recordCount: list.length
        };
    },

    getMonthlyReport(records, year, month) {
        const current = this.getMonthRecords(records, year, month);
        const previousDate = new Date(year, month - 1, 1);
        const previous = this.getMonthRecords(records, previousDate.getFullYear(), previousDate.getMonth());
        const summarize = list => ({
            count: list.length,
            cost: list.reduce((sum, record) => sum + record.cost, 0),
            energy: list.reduce((sum, record) => sum + record.energy, 0),
            discount: list.reduce((sum, record) => sum + record.discount, 0)
        });
        const result = summarize(current);
        const previousResult = summarize(previous);
        result.avgPrice = result.energy > 0 ? result.cost / result.energy : 0;
        result.costChange = previousResult.cost > 0
            ? (result.cost - previousResult.cost) / previousResult.cost
            : null;
        return { year, month, ...result, previous: previousResult };
    },

    getCostForecast(records, now = new Date()) {
        const list = this.validRecords(records).filter(record => record.start <= now);
        if (list.length === 0) return null;

        const year = now.getFullYear();
        const month = now.getMonth();
        const currentMonth = list.filter(record => record.start.getFullYear() === year && record.start.getMonth() === month);
        const currentCost = currentMonth.reduce((sum, record) => sum + record.cost, 0);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const elapsedDays = Math.max(now.getDate(), 1);
        const currentMonthProjection = currentCost / elapsedDays * daysInMonth;

        const completedMonths = [];
        for (let offset = 1; offset <= 3; offset += 1) {
            const date = new Date(year, month - offset, 1);
            const monthCost = this.getMonthRecords(list, date.getFullYear(), date.getMonth())
                .reduce((sum, record) => sum + record.cost, 0);
            if (monthCost > 0) completedMonths.push(monthCost);
        }
        const nextMonthEstimate = completedMonths.length > 0
            ? (completedMonths.reduce((sum, value) => sum + value, 0) + currentMonthProjection) / (completedMonths.length + 1)
            : currentMonthProjection;

        const yearRecords = list.filter(record => record.start.getFullYear() === year);
        const yearCost = yearRecords.reduce((sum, record) => sum + record.cost, 0);
        const yearStart = new Date(year, 0, 1);
        const elapsedYearDays = Math.max(Math.floor((now - yearStart) / 86400000) + 1, 1);
        const totalYearDays = new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;

        return {
            currentCost,
            currentMonthProjection,
            nextMonthEstimate,
            yearProjection: yearCost / elapsedYearDays * totalYearDays,
            confidence: list.length >= 20 ? '较稳定' : list.length >= 8 ? '一般' : '记录较少',
            sampleCount: list.length
        };
    }
};

if (typeof window !== 'undefined') {
    window.ChargingAnalytics = ChargingAnalytics;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChargingAnalytics;
}
