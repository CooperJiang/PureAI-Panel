// Gemini模型适配器
export class GeminiModel {
    constructor(options = {}) {
        this.model = options.model || 'gemini-pro';
        this.temperature = options.temperature !== undefined ? options.temperature : 0.7;
        this.systemMessage = options.systemMessage || '';
    }

    /**
     * 整理上下文消息，生成Gemini API所需格式
     * Gemini通常只支持user/assistant角色，且格式为[{role, parts:[{text}]}]
     * @param {Array} messages - 消息数组
     * @param {Object} config - 配置项
     * @returns {Array} - 整理后的消息数组
     */
    formatMessages(messages, config = {}) {
        let finalMessages = [];
        // Gemini不支持system角色，通常忽略
        finalMessages = finalMessages.concat(
            messages.filter(msg =>
                msg && msg.content !== '' && ['user', 'assistant'].includes(msg.role)
            ).map(msg => ({
                role: msg.role,
                parts: [{ text: msg.content }]
            }))
        );
        // 如果没有user消息，补一个
        if (!finalMessages.some(msg => msg.role === 'user')) {
            finalMessages.push({ role: 'user', parts: [{ text: '请帮助我。' }] });
        }
        return finalMessages;
    }

    /**
     * 生成请求参数
     * @param {Array} messages - 整理后的消息数组
     * @param {Object} config - 额外配置
     * @returns {Object} - Gemini API请求体
     */
    buildRequest(messages, config = {}) {
        return {
            model: config.model || this.model,
            contents: messages,
            temperature: config.temperature !== undefined ? config.temperature : this.temperature
        };
    }

    /**
     * 解析Gemini响应
     * @param {Object} data - fetch返回的json
     * @returns {Object} - { message, tokenUsage }
     */
    parseResponse(data) {
        // Gemini响应结构通常为candidates[0].content.parts[0].text
        const message = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        // Gemini响应可能没有token用量
        return {
            message,
            tokenUsage: null
        };
    }

    /**
     * 解析Gemini流式响应的单行（如支持SSE）
     * @param {string} line - SSE数据行
     * @returns {string|null} - 内容
     */
    parseStreamLine(line) {
        if (!line.startsWith('data: ')) return null;
        if (line === 'data: [DONE]') return null;
        try {
            const jsonStr = line.substring(6);
            const data = JSON.parse(jsonStr);
            // 取增量内容
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } catch {
            return null;
        }
    }
} 