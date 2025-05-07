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
        console.log('[ApiClient] 初始化完成，方法列表:', 
            Object.getOwnPropertyNames(Object.getPrototypeOf(this))
                .filter(method => method !== 'constructor')
                .join(', ')
        );
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
     * @returns {Promise<Object>} - 响应对象
     */
    async sendMessage(messages, model, signal) {
        const baseUrl = this.settingsManager.get('baseUrl') || 'https://api.openai.com';
        const apiKey = this.settingsManager.get('apiKey');
        
        if (!baseUrl || !apiKey) {
            throw new Error('请先在设置中填写 Base URL 和 API Key。');
        }
        
        if (!messages || messages.length === 0) {
            throw new Error('消息列表为空，请输入至少一条消息');
        }
        
        // 记录请求参数
        console.log('[API] 发送请求参数:', {
            model: model,
            messages: messages,
            temperature: 0.7
        });
        
        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: 0.7
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
     * @returns {Promise<void>}
     */
    async sendMessageStream(messages, model, onUpdate, onComplete, signal) {
        console.log('[API] sendMessageStream 方法被调用', { 
            messagesCount: messages?.length, 
            model, 
            hasOnUpdate: !!onUpdate, 
            hasOnComplete: !!onComplete,
            hasSignal: !!signal
        });
        
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
            // 记录请求参数
            console.log('[API] 发送流式请求参数:', {
                model: model,
                messages: messages,
                temperature: 0.7,
                stream: true
            });
            
            // 发起请求
            const response = await fetch(`${baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    temperature: 0.7,
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
            
            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const data = JSON.parse(line.substring(6));
                            const content = data.choices[0]?.delta?.content || '';
                            
                            if (content) {
                                accumulatedText += content;
                                onUpdate(accumulatedText);
                            }
                        } catch (e) {
                            console.error('[API] 解析流数据失败:', e);
                        }
                    }
                }
            }
            
            // 完成后调用回调
            if (onComplete && typeof onComplete === 'function') {
                onComplete();
            }
            
            return accumulatedText;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('[API] 流式请求已取消');
                throw error; // 重新抛出错误，让调用者知道被取消
            } else {
                console.error('[API] 请求失败:', error);
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
     * @returns {Promise<void>}
     */
    async streamMessage(messages, model, onUpdate, onComplete, signal) {
        console.log('[API] streamMessage别名被调用，转发到sendMessageStream');
        return this.sendMessageStream(messages, model, onUpdate, onComplete, signal);
    }
    
    /**
     * generateChatCompletion - 用于生成聊天完成，sendMessageStream的别名
     * @param {Array} messages - 消息数组
     * @param {string} model - 模型ID
     * @param {Function} onUpdate - 更新回调
     * @param {Function} onComplete - 完成回调
     * @param {Function} onError - 错误回调
     * @param {AbortSignal} signal - 中止信号
     * @returns {Promise<void>}
     */
    async generateChatCompletion(messages, model, onUpdate, onComplete, onError, signal) {
        console.log('[API] generateChatCompletion被调用，转发到sendMessageStream');
        try {
            return await this.sendMessageStream(messages, model, onUpdate, onComplete, signal);
        } catch (error) {
            if (onError && typeof onError === 'function') {
                onError(error);
            } else {
                console.error('[API] generateChatCompletion错误未处理:', error);
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
} 