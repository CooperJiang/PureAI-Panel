/**
 * API客户端模块 - 负责处理与OpenAI API的通信
 */
export class ApiClient {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {Object} options.settingsManager - 设置管理器
     * @param {Object} options.conversationManager - 可选的对话管理器
     */
    constructor(options) {
        this.settingsManager = options.settingsManager;
        this.conversationManager = options.conversationManager;
        this.currentStreamController = null;
        this.lastTokenUsage = null;
        
        // 用于跟踪思考模式状态
        this._isInReasoningMode = false;
    }
    
    /**
     * 取消当前的流式请求
     * @returns {boolean} - 是否成功取消
     */
    cancelCurrentStream() {
        if (this.currentStreamController) {
            this.currentStreamController.abort();
            this.currentStreamController = null;
            return true;
        }
        return false;
    }
    
    /**
     * 发送消息并获取回复（非流式）
     * @param {Array} messages - 消息数组
     * @param {string} model - 模型ID
     * @param {AbortSignal} signal - 中止信号
     * @param {Object} config - 会话特定的配置
     * @returns {Promise<Object>} - 响应对象
     */
    async sendMessage(messages, model, signal, config = {}) {
        const baseUrl = this.settingsManager.get('baseUrl') || 'https://api.openai.com';
        const apiKey = this.settingsManager.get('apiKey');
        
        if (!baseUrl || !apiKey) {
            throw new Error('请先在设置中填写 Base URL 和 API Key。');
        }
        
        if (!messages || messages.length === 0) {
            throw new Error('消息列表为空，请输入至少一条消息');
        }
        
        // 应用会话特定的配置
        const temperature = config.temperature !== undefined ? config.temperature : 0.7;
        
        // 添加系统消息
        const finalMessages = [...messages];
        if (config.systemMessage) {
            finalMessages.unshift({
                role: 'system',
                content: config.systemMessage
            });
        }
        
        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: finalMessages,
                temperature: temperature
            }),
            signal: signal
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || '请求失败');
        }
        
        const data = await response.json();
        const assistantResponse = data.choices[0].message.content;
        
        // 记录token用量（如果API返回）
        if (data.usage) {
            this.lastTokenUsage = {
                total: data.usage.total_tokens || 0,
                prompt: data.usage.prompt_tokens || 0,
                completion: data.usage.completion_tokens || 0
            };
        }
        
        return {
            message: assistantResponse,
            tokenUsage: this.lastTokenUsage
        };
    }
    
    /**
     * 发送消息并获取流式回复
     * @param {Array} messages - 消息数组
     * @param {string} model - 模型ID
     * @param {Function} onUpdate - 更新回调
     * @param {Function} onComplete - 完成回调
     * @param {AbortSignal} signal - 中止信号
     * @param {Object} config - 会话特定的配置
     * @returns {Promise<void>}
     */
    async sendMessageStream(messages, model, onUpdate, onComplete, signal, config = {}) {
        const baseUrl = this.settingsManager.get('baseUrl') || 'https://api.openai.com';
        const apiKey = this.settingsManager.get('apiKey');
        
        if (!baseUrl || !apiKey) {
            throw new Error('请先在设置中填写 Base URL 和 API Key。');
        }
        
        if (!messages || messages.length === 0) {
            throw new Error('消息列表为空，请输入至少一条消息');
        }
        
        // 创建 AbortController 用于取消请求（如果未提供）
        let localController = null;
        if (!signal) {
            localController = new AbortController();
            signal = localController.signal;
        }
        
        this.currentStreamController = localController;
        
        try {
            // 应用会话特定的配置
            const temperature = config.temperature !== undefined ? config.temperature : 0.7;
            
            // 添加系统消息
            const finalMessages = [...messages];
            if (config.systemMessage) {
                finalMessages.unshift({
                    role: 'system',
                    content: config.systemMessage
                });
            }
            
            // 发起请求
            const response = await fetch(`${baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: finalMessages,
                    temperature: temperature,
                    stream: true
                }),
                signal: signal
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || '请求失败');
            }
            
            // 处理流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            
            let accumulatedText = '';
            let done = false;
            let buffer = ''; // 用于存储跨块的不完整数据
            let totalBytesReceived = 0;
            let totalChunksReceived = 0;
            let errorCount = 0;
            const MAX_ERRORS = 5; // 最大容忍错误次数
            
            try {
                while (!done) {
                    let value, readerDone;
                    
                    try {
                        ({ value, done: readerDone } = await reader.read());
                        done = readerDone;
                        
                        if (done) {
                            break;
                        }
                        
                        // 更新统计信息
                        totalChunksReceived++;
                        totalBytesReceived += value.length;
                        
                        // 记录接收到的数据块信息
                    } catch (readError) {
                        done = true;
                        break;
                    }
                    
                    try {
                        // 解码数据块并添加到缓冲区
                        const chunk = decoder.decode(value, { stream: true });
                        buffer += chunk;
                        
                        // 处理按行拆分
                        let lines = buffer.split('\n');
                        
                        // 如果缓冲区不以换行符结束，保留最后一行等待更多数据
                        if (!buffer.endsWith('\n')) {
                            buffer = lines.pop() || '';
                        } else {
                            buffer = '';
                        }
                        
                        // 处理每一行
                        for (const line of lines) {
                            // 使用辅助函数处理SSE行
                            try {
                                this._processSSELine(line, (content) => {
                                    accumulatedText += content;
                                    if (onUpdate && typeof onUpdate === 'function') {
                                        onUpdate(accumulatedText);
                                    }
                                });
                            } catch (lineError) {
                                errorCount++;
                                
                                if (errorCount > MAX_ERRORS) {
                                    done = true;
                                    break;
                                }
                            }
                        }
                    } catch (processError) {
                        errorCount++;
                        
                        if (errorCount > MAX_ERRORS) {
                            done = true;
                        }
                    }
                }
                
                // 处理缓冲区中剩余的数据
                if (buffer.trim()) {
                    try {
                        this._processSSELine(buffer, (content) => {
                            accumulatedText += content;
                            if (onUpdate && typeof onUpdate === 'function') {
                                onUpdate(accumulatedText);
                            }
                        });
                    } catch (e) {
                    }
                }
                
                // 输出流处理统计信息
                const streamInfo = {
                    totalBytesReceived,
                    totalChunksReceived,
                    errorCount,
                    finalTextLength: accumulatedText.length
                };
                
                // 完成后调用回调
                if (onComplete && typeof onComplete === 'function') {
                    onComplete();
                }
                
                return accumulatedText;
            } catch (overallError) {
                throw overallError;
            }
            
        } catch (error) {
            if (error.name === 'AbortError') {
                throw error; // 重新抛出错误，让调用者知道被取消
            } else {
                throw error;
            }
        } finally {
            if (localController === this.currentStreamController) {
                this.currentStreamController = null;
            }
        }
    }
    
    /**
     * streamMessage别名 - 兼容性方法，调用sendMessageStream
     * @param {Array} messages - 消息数组
     * @param {string} model - 模型ID
     * @param {Function} onUpdate - 更新回调
     * @param {Function} onComplete - 完成回调
     * @param {AbortSignal} signal - 中止信号
     * @param {Object} config - 会话特定的配置
     * @returns {Promise<void>}
     */
    async streamMessage(messages, model, onUpdate, onComplete, signal, config = {}) {
        return this.sendMessageStream(messages, model, onUpdate, onComplete, signal, config);
    }
    
    /**
     * generateChatCompletion - 用于生成聊天完成，sendMessageStream的别名
     * @param {Array} messages - 消息数组
     * @param {string} model - 模型ID
     * @param {Function} onUpdate - 更新回调
     * @param {Function} onComplete - 完成回调
     * @param {Function} onError - 错误回调
     * @param {AbortSignal} signal - 中止信号
     * @param {Object} config - 会话特定的配置
     * @returns {Promise<void>}
     */
    async generateChatCompletion(messages, model, onUpdate, onComplete, onError, signal, config = {}) {
        const messagesCount = messages?.length;
        const isStream = true;
        
        // 确保之前的请求已经被取消
        if (this.currentStreamController) {
            this.cancelCurrentStream();
        }
        
        // 创建新的中断控制器
        const localController = new AbortController();
        const mergedSignal = signal || localController.signal;
        this.currentStreamController = localController;
        
        try {
            return await this.sendMessageStream(
                messages, 
                model, 
                onUpdate, 
                () => {
                    this.currentStreamController = null;
                    if (onComplete && typeof onComplete === 'function') {
                        onComplete();
                    }
                }, 
                mergedSignal,
                config
            );
        } catch (error) {
            this.currentStreamController = null;
            if (onError && typeof onError === 'function') {
                onError(error);
            } else {
                throw error;
            }
        }
    }
    
    /**
     * 获取最近一次请求的token用量
     * @returns {Object|null} - token用量信息
     */
    getLastTokenUsage() {
        return this.lastTokenUsage;
    }
    
    /**
     * 获取当前对话的消息，转换为API所需格式
     * @param {Array} messages - 消息数组
     * @returns {Array} - 格式化后的消息数组
     */
    formatMessages(messages) {
        if (!messages || messages.length === 0) {
            return [];
        }
        
        // 确保消息格式正确
        return messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
    }
    
    /**
     * 尝试修复不完整的JSON数据
     * @param {string} jsonStr - 原始JSON字符串
     * @returns {Object} - {success: boolean, data: any, error: Error|null}
     * @private
     */
    _tryFixJson(jsonStr) {
        
        // 检查是否为有效JSON
        try {
            const data = JSON.parse(jsonStr);
            return { success: true, data, error: null };
        } catch (e) {
        }
        
        let fixedJson = jsonStr;
        let result = { success: false, data: null, error: null };
        
        // 尝试修复方案1: 检查是否缺少结束括号
        try {
            // 检查是否只缺少最后的大括号
            if (jsonStr.endsWith('"') && !jsonStr.endsWith('}"')) {
                fixedJson = jsonStr + '}';
                const data = JSON.parse(fixedJson);
                return { success: true, data, error: null };
            }
        } catch (e) {
        }
        
        // 尝试修复方案2: 检查是否是不完整的JSON对象
        try {
            if (!jsonStr.endsWith('}') && jsonStr.includes(':{')) {
                fixedJson = jsonStr + '}}';
                const data = JSON.parse(fixedJson);
                return { success: true, data, error: null };
            }
        } catch (e) {
        }
        
        // 尝试修复方案3: 检查是否是开头和结尾都有问题的JSON
        try {
            if (!jsonStr.startsWith('{')) {
                // 尝试查找第一个{开始的索引
                const startIdx = jsonStr.indexOf('{');
                if (startIdx > 0) {
                    fixedJson = jsonStr.substring(startIdx);
                    
                    // 再次检查结尾
                    if (!fixedJson.endsWith('}')) {
                        fixedJson = fixedJson + '}';
                    }
                    
                    const data = JSON.parse(fixedJson);
                    return { success: true, data, error: null };
                }
            }
        } catch (e) {
        }
        
        result.error = new Error('无法修复JSON数据');
        return result;
    }
    
    /**
     * 处理流式消息，确保HTML代码块被完整捕获
     * @param {string} content - 消息内容
     * @returns {string} 处理后的内容
     * @private
     */
    _processHtmlCodeBlocks(content) {
        if (!content) return content;
        
        // 检测是否包含HTML代码块
        if (content.includes('```html') || content.includes('```htm')) {
            // 检查是否有未闭合的HTML代码块
            const htmlBlockStarts = content.match(/```html|```htm/g) || [];
            const htmlBlockEnds = content.match(/```\s*(?:$|[\r\n])/g) || [];
            
            // 如果代码块开始标记多于结束标记，加上临时结束标记
            if (htmlBlockStarts.length > htmlBlockEnds.length) {
                return content;
            }
        }
        
        return content;
    }
    
    /**
     * 安全处理SSE数据行
     * @param {string} line - 数据行
     * @param {Function} onContent - 内容回调
     * @returns {boolean} - 是否成功处理
     * @private
     */
    _processSSELine(line, onContent) {
        if (!line.trim()) {
            return false; // 空行
        }
        
        // 检查是否是数据行
        if (!line.startsWith('data: ')) {
            return false;
        }
        
        // 检查是否是完成标记
        if (line === 'data: [DONE]') {
            // 结束思考模式（如果存在）
            if (this._isInReasoningMode) {
                onContent && onContent('</think>');
                this._isInReasoningMode = false;
            }
            return true;
        }
        
        // 提取并处理JSON数据
        try {
            const messageData = this._extractMessageData(line);
            if (!messageData) return false;
            
            const { content, isFunctionCall, isThinking } = messageData;
            
            // 处理思考内容
            if (isThinking && !this._isInReasoningMode) {
                this._isInReasoningMode = true;
                onContent && onContent('<think>' + content);
                return true;
            } else if (isThinking && this._isInReasoningMode) {
                onContent && onContent(content);
                return true;
            } else if (this._isInReasoningMode && !isThinking) {
                onContent && onContent('</think>' + content);
                this._isInReasoningMode = false;
                return true;
            }
            
            // 处理HTML代码块，确保完整捕获
            const processedContent = this._processHtmlCodeBlocks(content);
            
            // 调用内容回调
            if (isFunctionCall) {
                // 处理函数调用，可能需要特殊处理...
                onContent && onContent(content);
            } else if (processedContent) {
                onContent && onContent(processedContent);
            }
            
            return true;
        } catch (e) {
            return false;
        }
    }
    
    /**
     * 从API响应行中提取消息数据
     * @param {string} line - 数据行
     * @returns {Object|null} - 提取的消息数据，或null如果失败
     * @private
     */
    _extractMessageData(line) {
        const jsonStr = line.substring(6);
        let parseResult;
        
        try {
            // 尝试常规解析
            const data = JSON.parse(jsonStr);
            parseResult = { success: true, data, error: null };
        } catch (jsonError) {
            parseResult = {
                success: false,
                data: null,
                error: {
                    message: jsonError.message,
                    input: jsonStr.length > 50 ? jsonStr.substring(0, 20) + '...' + jsonStr.substring(jsonStr.length - 20) : jsonStr
                }
            };
            
            // 尝试修复解析
            parseResult = this._tryFixJson(jsonStr);
        }
        
        if (!parseResult.success) {
            return null;
        }
        
        // 获取常规内容字段
        let content = parseResult.data.choices?.[0]?.delta?.content || '';
        
        // 检查是否是函数调用
        const functionCall = parseResult.data.choices?.[0]?.delta?.function_call;
        const isFunctionCall = !!functionCall;
        
        // Claude特殊字段: reasoning_content (思考过程)
        const reasoningContent = parseResult.data.choices?.[0]?.delta?.reasoning_content || '';
        const isThinking = !!reasoningContent;
        
        // 如果有思考内容，覆盖常规内容
        if (reasoningContent) {
            content = reasoningContent;
        }
        
        // 如果是函数调用，特殊处理
        if (isFunctionCall) {
            const functionName = functionCall.name || '';
            const functionArgs = functionCall.arguments || '{}';
            content = functionName ? `<function-call name="${functionName}">${functionArgs}</function-call>` : content;
        }
        
        return {
            content,
            isFunctionCall,
            isThinking,
            raw: parseResult.data
        };
    }
}