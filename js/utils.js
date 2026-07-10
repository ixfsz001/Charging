/**
 * 工具函数模块
 * 包含格式化、验证、转义等通用工具函数
 */

// XSS转义函数 - 防止XSS攻击（缓存div元素避免重复创建）
const _escapeDiv = typeof document !== 'undefined' ? document.createElement('div') : null;
function escapeHtml(text) {
    if (!_escapeDiv) return text;
    _escapeDiv.textContent = text;
    return _escapeDiv.innerHTML;
}

// 格式化日期时间为datetime-local格式
function formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// 格式化时间显示
function formatTime(isoString) {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
}

// 计算充电时长
function calculateDuration(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diff = end - start;

    if (diff < 0) return '0分钟';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours === 0) {
        return `${minutes}分钟`;
    }
    return `${hours}小时${minutes}分钟`;
}

// 格式化时长（毫秒转可读字符串）
function formatDuration(milliseconds) {
    if (!milliseconds || milliseconds < 0) return '0分钟';

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}天${hours % 24}小时`;
    } else if (hours > 0) {
        return `${hours}小时${minutes % 60}分钟`;
    } else {
        return `${minutes}分钟`;
    }
}

// 格式化日期为 YYYY.MM.DD 格式
function formatDateShort(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
}

// 格式化日期
function formatDate(date) {
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// 生成8位随机UID（大写字母和数字组合）
function generateRandomUID() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let uid = '';
    for (let i = 0; i < 8; i++) {
        uid += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return uid;
}

// 验证UID
function validateUID(uid) {
    // 长度检查
    if (uid.length !== 8) {
        return { valid: false, message: "UID必须为8位" };
    }

    // 字符类型检查 - 只允许大写字母和数字
    if (!/^[A-Z0-9]+$/.test(uid)) {
        return { valid: false, message: "UID只能包含大写字母和数字" };
    }

    // 特殊UID检查
    const specialUIDs = ['admin', 'root', 'system', 'guest', 'user', 'test', 'demo'];
    if (specialUIDs.includes(uid.toLowerCase())) {
        return { valid: false, message: "此UID已被占用" };
    }

    return { valid: true };
}

// 验证充电记录表单
function validateRecordForm(data) {
    const { startTime, endTime, chargeType, stationName, chargeAmount, finalPrice, discountAmount } = data;

    // 必填项验证
    if (!startTime || !endTime || !chargeType || !stationName || !chargeAmount || !finalPrice) {
        return { valid: false, message: '请填写所有必填项' };
    }

    // 时间验证
    if (new Date(endTime) <= new Date(startTime)) {
        return { valid: false, message: '结束时间必须晚于开始时间' };
    }

    // 阻止未来时间
    if (new Date(endTime) > new Date()) {
        return { valid: false, message: '结束时间不能晚于当前时间' };
    }

    // 充电量验证
    if (parseFloat(chargeAmount) <= 0) {
        return { valid: false, message: '充电量必须大于0' };
    }

    // 充电量合理性验证（上限500kWh）
    if (parseFloat(chargeAmount) > 500) {
        return { valid: false, message: '充电量不能超过500kWh' };
    }

    // 金额验证
    if (parseFloat(finalPrice) < 0 || parseFloat(discountAmount) < 0) {
        return { valid: false, message: '金额不能为负数' };
    }

    // 金额合理性验证（上限10000元）
    if (parseFloat(finalPrice) > 10000) {
        return { valid: false, message: '金额不能超过10000元' };
    }

    // 折扣不能大于实际价格
    if (parseFloat(discountAmount) > parseFloat(finalPrice)) {
        return { valid: false, message: '优惠金额不能大于实际支付金额' };
    }

    return { valid: true };
}

// 验证备份数据结构
function validateBackupData(data) {
    if (!data || typeof data !== 'object') {
        return false;
    }
    if (!Array.isArray(data.records)) {
        return false;
    }
    // 验证每条记录的基本结构
    return data.records.every(record =>
        record.id &&
        record.startTime &&
        record.endTime &&
        record.stationName &&
        record.chargeType &&
        typeof record.chargeAmount === 'number' &&
        typeof record.finalPrice === 'number'
    );
}

// 深拷贝对象
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    try {
        return JSON.parse(JSON.stringify(obj));
    } catch (e) {
        console.error('深拷贝失败:', e);
        return obj;
    }
}

// 根据时间范围名称计算起止日期
function getDateRangeByType(range, now) {
    now = now || new Date();
    let startDate, endDate;

    switch (range) {
        case 'week':
            const dayOfWeek = now.getDay() || 7;
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 8);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            break;
        case 'lastMonth':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear() + 1, 0, 1);
            break;
        default:
            return null;
    }

    return { startDate, endDate };
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 节流函数
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// 导出工具函数（用于模块化）
if (typeof window !== 'undefined') {
    window.AppUtils = {
        escapeHtml,
        formatDateTime,
        formatTime,
        calculateDuration,
        formatDuration,
        formatDateShort,
        formatDate,
        generateRandomUID,
        validateUID,
        validateRecordForm,
        validateBackupData,
        deepClone,
        debounce,
        throttle,
        getDateRangeByType
    };
}
