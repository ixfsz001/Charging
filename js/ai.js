/**
 * AI识别模块
 * 负责截图识别、API调用、结果解析和表单填充
 */

const AIRecognizer = {
    // 识别中状态
    _isRecognizing: false,

    // 获取识别状态
    isRecognizing() {
        return this._isRecognizing;
    },

    // 保留账单小字细节，同时限制超大图片的传输体积
    compressImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxWidth = 1600;
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = (maxWidth / width) * height;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.9);
                    resolve(compressedBase64);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    // 构建识别提示词
    buildPrompt(now = new Date()) {
        const currentYear = now.getFullYear();
        const currentDate = AppUtils.formatDateTime(now).slice(0, 10);
        return `你是一个充电记录识别助手。请仔细分析这张充电相关的截图，提取以下信息。

当前日期是 ${currentDate}，当前年份是 ${currentYear}。

可能的截图类型包括：
- 充电桩屏幕截图
- 充电APP账单/订单截图
- 充电完成通知截图
- 短信通知截图

请提取以下字段（如果截图中有相关信息的话）：
1. stationName - 充电站名称（完整名称）
2. chargeType - 充电类型："fast"表示直流快充，"slow"表示交流慢充。优先根据“直流/DC/快充/超充”或“交流/AC/慢充”文字判断；仅在没有类型文字时参考功率
3. startTime - 开始时间，格式：YYYY-MM-DDTHH:MM
4. endTime - 结束时间，格式：YYYY-MM-DDTHH:MM
5. chargeAmount - 充电量，单位kWh，数字类型
6. finalPrice - 最终支付金额，单位元，数字类型
7. discountAmount - 优惠/减免金额，单位元，数字类型（如果没有优惠则为0）
8. startTimeHasYear - 截图的开始日期旁是否明确显示年份，布尔值
9. endTimeHasYear - 截图的结束日期旁是否明确显示年份，布尔值

日期规则：
- 如果截图只显示“X月X日”而没有年份，必须使用当前年份 ${currentYear}，并将对应的 HasYear 设为 false；严禁默认使用2024年
- 如果截图明确显示年份，原样使用，并将对应的 HasYear 设为 true
- 如果结束时间只显示时分，继承开始日期；如果结束时分早于开始时分，则视为次日
- 不要把订单创建时间、支付时间或通知时间误当作充电开始/结束时间
- 数值必须区分充电量(kWh)、功率(kW)、金额(元)和优惠金额，不要混用

请只返回JSON格式，不要包含其他文字说明。格式如下：
{
  "stationName": "充电站名称",
  "chargeType": "fast",
  "startTime": "${currentYear}-01-01T10:00",
  "endTime": "${currentYear}-01-01T11:30",
  "startTimeHasYear": false,
  "endTimeHasYear": false,
  "chargeAmount": 45.6,
  "finalPrice": 56.78,
  "discountAmount": 5.0
}

如果某个字段无法识别，文本或时间使用空字符串，数字使用0；不要猜测截图中没有的信息。只返回JSON，不要有其他内容。`;
    },

    // 调用AI API进行识别
    async recognize(imageBase64) {
        const config = DataManager.getAIConfig();

        if (!config.baseUrl || !config.apiKey) {
            throw new Error('请先完成AI识别配置');
        }

        // 确保baseURL末尾没有斜杠
        const baseUrl = config.baseUrl.replace(/\/+$/, '');
        const targetUrl = `${baseUrl}/chat/completions`;

        // 使用配置的模型，默认 mimo-v2.5
        const model = config.model || 'mimo-v2.5';

        const requestBody = {
            model: model,
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: this.buildPrompt()
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: imageBase64
                        }
                    }
                ]
            }],
            max_tokens: 4096,
            temperature: 0.1,
            thinking: {
                type: 'disabled'
            }
        };

        let fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': config.apiKey
            },
            body: JSON.stringify(requestBody)
        };

        const response = await fetch(targetUrl, fetchOptions);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            let errorMsg = errorData.error?.message || `API请求失败 (${response.status})`;

            // 针对常见错误提供更友好的提示
            if (errorMsg.includes('support image input') || errorMsg.includes('No endpoints found')) {
                errorMsg = `当前模型 "${model}" 不支持图片识别。请在设置中更换为支持视觉(Vision)的模型，或使用其他支持图片输入的API。`;
            }

            throw new Error(errorMsg);
        }

        const data = await response.json();

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('AI返回数据格式异常');
        }

        const message = data.choices[0].message;
        let content = message.content;

        // 如果content为空但有reasoning_content，尝试从思考过程中提取
        if (!content || content.trim() === '') {
            const reasoning = message.reasoning_content;
            if (reasoning) {
                const jsonMatch = reasoning.match(/\{[\s\S]*"stationName"[\s\S]*\}/);
                if (jsonMatch) {
                    content = jsonMatch[0];
                }
            }
        }

        if (!content || content.trim() === '') {
            throw new Error('AI返回内容为空，请检查模型是否支持图片输入，或尝试更换模型');
        }

        return this.parseResponse(content);
    },

    normalizeRecognizedDate(value, hasExplicitYear, currentYear) {
        if (typeof value !== 'string' || !value.trim()) return '';

        const normalized = value.trim().replace(' ', 'T');
        const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})T(\d{1,2}):(\d{1,2})/);
        if (!match) return '';

        const year = hasExplicitYear === true ? Number(match[1]) : currentYear;
        const month = Number(match[2]);
        const day = Number(match[3]);
        const hours = Number(match[4]);
        const minutes = Number(match[5]);
        const date = new Date(year, month - 1, day, hours, minutes);

        const isValid = date.getFullYear() === year
            && date.getMonth() === month - 1
            && date.getDate() === day
            && hours >= 0 && hours < 24
            && minutes >= 0 && minutes < 60;

        return isValid ? AppUtils.formatDateTime(date) : '';
    },

    // 解析AI返回的响应
    parseResponse(content, now = new Date()) {
        // 尝试从响应中提取JSON
        let jsonStr = (content || '').trim();

        if (!jsonStr) {
            throw new Error('AI返回内容为空，请确认模型支持图片输入(Vision)');
        }

        // 如果包含markdown代码块，提取其中的JSON
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }

        // 尝试找到JSON对象
        const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (objectMatch) {
            jsonStr = objectMatch[0];
        }

        try {
            const result = JSON.parse(jsonStr);
            const currentYear = now.getFullYear();
            const startTime = this.normalizeRecognizedDate(result.startTime, result.startTimeHasYear, currentYear);
            let endTime = this.normalizeRecognizedDate(result.endTime, result.endTimeHasYear, currentYear);

            if (startTime && endTime && new Date(endTime) <= new Date(startTime) && result.endTimeHasYear === false) {
                const nextDay = new Date(endTime);
                nextDay.setDate(nextDay.getDate() + 1);
                endTime = AppUtils.formatDateTime(nextDay);
            }

            // 标准化返回数据
            return {
                stationName: typeof result.stationName === 'string' ? result.stationName.trim() : '',
                chargeType: ['fast', 'slow'].includes(result.chargeType) ? result.chargeType : '',
                startTime,
                endTime,
                chargeAmount: Math.round((parseFloat(result.chargeAmount) || 0) * 100) / 100,
                finalPrice: parseFloat(result.finalPrice) || 0,
                discountAmount: parseFloat(result.discountAmount) || 0
            };
        } catch (e) {
            console.error('JSON解析失败:', e, '原始内容:', content);
            throw new Error('AI返回的内容无法解析，请重试');
        }
    },

    // 将识别结果填充到表单
    fillForm(data) {
        // 填充电站名称
        const stationInput = document.getElementById('station-name');
        if (stationInput && data.stationName) {
            stationInput.value = data.stationName;
        }

        // 填充电类型
        const chargeTypeBtn = document.getElementById('charge-type-btn');
        if (chargeTypeBtn && data.chargeType) {
            if (data.chargeType === 'slow') {
                chargeTypeBtn.dataset.value = 'slow';
                chargeTypeBtn.textContent = '交流慢充 （AC）';
                chargeTypeBtn.classList.remove('fast-charge');
                chargeTypeBtn.classList.add('slow-charge');
            } else {
                chargeTypeBtn.dataset.value = 'fast';
                chargeTypeBtn.textContent = '直流快充 （DC）';
                chargeTypeBtn.classList.remove('slow-charge');
                chargeTypeBtn.classList.add('fast-charge');
            }
        }

        // 填充时间
        const startTimeInput = document.getElementById('start-time');
        const endTimeInput = document.getElementById('end-time');

        if (startTimeInput && data.startTime) {
            startTimeInput.value = data.startTime;
        }
        if (endTimeInput && data.endTime) {
            endTimeInput.value = data.endTime;
        }

        // 填充电量
        const chargeAmountInput = document.getElementById('charge-amount');
        if (chargeAmountInput && data.chargeAmount > 0) {
            chargeAmountInput.value = data.chargeAmount;
        }

        // 填充价格
        const finalPriceInput = document.getElementById('final-price');
        if (finalPriceInput && data.finalPrice > 0) {
            finalPriceInput.value = data.finalPrice;
        }

        // 填充优惠金额
        const discountInput = document.getElementById('discount-amount');
        if (discountInput) {
            discountInput.value = data.discountAmount || '';
        }
    },

    // 完整的识别流程
    async recognizeAndFill(file) {
        if (this._isRecognizing) {
            throw new Error('正在识别中，请稍候');
        }

        this._isRecognizing = true;

        try {
            // 压缩图片
            const compressedImage = await this.compressImage(file);

            // 调用API识别
            const result = await this.recognize(compressedImage);

            // 填充表单
            this.fillForm(result);

            return result;
        } finally {
            this._isRecognizing = false;
        }
    }
};

// 导出AI识别模块
if (typeof window !== 'undefined') {
    window.AIRecognizer = AIRecognizer;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIRecognizer;
}
