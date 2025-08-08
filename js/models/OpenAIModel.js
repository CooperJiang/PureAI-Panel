// OpenAI模型适配器
export class OpenAIModel {
    constructor(options = {}) {
        this.model = options.model || 'gpt-4o-mini';
        this.temperature = options.temperature !== undefined ? options.temperature : 0.7;
        this.systemMessage = options.systemMessage || '';
        this.baseUrl = options.baseUrl || 'https://pool.mmmss.com';
        this.apiKey = options.apiKey || '';
    }

    /**
     * 整理上下文消息，生成OpenAI API所需格式
     * @param {Array} messages - 消息数组
     * @param {Object} config - 配置项
     * @returns {Array} - 整理后的消息数组
     */
    formatMessages(messages, config = {}) {
        let finalMessages = [];
        // 系统消息
        const systemMsg = config.systemMessage || this.systemMessage;
        if (systemMsg) {
            finalMessages.push({ role: 'system', content: systemMsg });
        }
        // 支持多模态：若用户消息含 metadata.images（dataURL 列表），则使用 content parts
        const normalized = (messages || []).filter(msg => msg && ['user', 'assistant', 'system'].includes(msg.role));
        for (const msg of normalized) {
            // 仅在用户消息上处理图片
            const images = msg.metadata && Array.isArray(msg.metadata.images) ? msg.metadata.images : [];
            if (msg.role === 'user' && images.length > 0) {
                const parts = [];
                const text = (msg.content || '').trim();
                if (text) {
                    parts.push({ type: 'text', text });
                }
                for (const img of images) {
                    if (img && typeof img.dataUrl === 'string') {
                        parts.push({ type: 'image_url', image_url: { url: img.dataUrl } });
                    }
                }
                if (parts.length > 0) {
                    finalMessages.push({ role: 'user', content: parts });
                    continue;
                }
            }
            // 默认路径：纯文本
            if (typeof msg.content === 'string') {
                finalMessages.push({ role: msg.role, content: msg.content });
            }
        }
        // 确保第一条非system消息是user
        const firstNonSystem = finalMessages.findIndex(m => m.role !== 'system');
        if (firstNonSystem !== -1 && finalMessages[firstNonSystem].role !== 'user') {
            const firstUser = finalMessages.findIndex(m => m.role === 'user');
            if (firstUser > firstNonSystem) {
                const systemMsgs = finalMessages.filter((m, idx) => m.role === 'system' && idx < firstUser);
                finalMessages = [...systemMsgs, ...finalMessages.slice(firstUser)];
            }
        }
        // 如果没有user消息，补一个
        if (!finalMessages.some(m => m.role === 'user')) {
            finalMessages.push({ role: 'user', content: '请帮助我。' });
        }
        return finalMessages;
    }

    /**
     * 生成请求参数
     * @param {Array} messages - 整理后的消息数组
     * @param {Object} config - 额外配置
     * @returns {Object} - OpenAI API请求体
     */
    buildRequest(messages, config = {}) {
        return {
            model: config.model || this.model,
            messages,
            temperature: config.temperature !== undefined ? config.temperature : this.temperature,
            ...(config.stream !== undefined ? { stream: config.stream } : {})
        };
    }

    /**
     * 发送请求并返回解析后的响应
     * @param {Object} param
     *   - messages: 整理后的消息数组
     *   - config: 额外配置
     *   - signal: AbortSignal
     *   - stream: 是否流式
     * @returns {Promise<Object>} - { message, tokenUsage }
     */
    async sendRequest({ messages, config = {}, signal }) {
        const url = this.baseUrl.replace(/\/$/, '') + '/v1/chat/completions';
        const apiKey = config.apiKey || this.apiKey;
        const requestBody = this.buildRequest(messages, config);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || '请求失败');
        }
        const data = await response.json();
        return this.parseResponse(data);
    }

    /**
     * 解析OpenAI响应
     * @param {Object} data - fetch返回的json
     * @returns {Object} - { message, tokenUsage }
     */
    parseResponse(data) {
        const assistantResponse = data.choices?.[0]?.message?.content || '';
        const usage = data.usage || {};
        return {
            message: assistantResponse,
            tokenUsage: {
                total: usage.total_tokens || 0,
                prompt: usage.prompt_tokens || 0,
                completion: usage.completion_tokens || 0
            }
        };
    }

    /**
     * 解析OpenAI流式响应的单行
     * @param {string} line - SSE数据行
     * @returns {string|null} - 内容
     */
    parseStreamLine(line) {
        if (!line.startsWith('data: ')) return null;
        if (line === 'data: [DONE]') return null;
        try {
            const jsonStr = line.substring(6);
            const data = JSON.parse(jsonStr);
            return data.choices?.[0]?.delta?.content || '';
        } catch {
            return null;
        }
    }

    /**
     * 发送流式请求并处理回调
     * @param {Object} param
     *   - messages: 整理后的消息数组
     *   - config: 额外配置
     *   - signal: AbortSignal
     *   - onUpdate: (text) => void
     *   - onComplete: () => void
     * @returns {Promise<string>} - 最终完整内容
     */
    async sendRequestStream({ messages, config = {}, signal, onUpdate, onComplete }) {
        const url = this.baseUrl.replace(/\/$/, '') + '/v1/chat/completions';
        const apiKey = config.apiKey || this.apiKey;
        const requestBody = this.buildRequest(messages, { ...config, stream: true });
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || '请求失败');
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let accumulatedText = '';
        let done = false;
        let buffer = '';
        let errorCount = 0;
        const MAX_ERRORS = 5;
        try {
            while (!done) {
                let value, readerDone;
                try {
                    ({ value, done: readerDone } = await reader.read());
                    done = readerDone;
                    if (done) break;
                } catch {
                    done = true;
                    break;
                }
                try {
                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;
                    let lines = buffer.split('\n');
                    if (!buffer.endsWith('\n')) {
                        buffer = lines.pop() || '';
                    } else {
                        buffer = '';
                    }
                    for (const line of lines) {
                        const content = this.parseStreamLine(line);
                        if (content) {
                            accumulatedText += content;
                            if (onUpdate && typeof onUpdate === 'function') {
                                onUpdate(accumulatedText);
                            }
                        }
                    }
                } catch {
                    errorCount++;
                    if (errorCount > MAX_ERRORS) {
                        done = true;
                    }
                }
            }
            if (buffer.trim()) {
                const content = this.parseStreamLine(buffer);
                if (content) {
                    accumulatedText += content;
                    if (onUpdate && typeof onUpdate === 'function') {
                        onUpdate(accumulatedText);
                    }
                }
            }
            if (onComplete && typeof onComplete === 'function') {
                onComplete();
            }
            return accumulatedText;
        } catch (overallError) {
            throw overallError;
        }
    }
} 