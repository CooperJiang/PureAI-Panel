/**
 * API客户端模块 - 负责处理与OpenAI API的通信
 */
import { OpenAIModel } from './models/OpenAIModel.js';
import { getLastTokenUsage, getContextMessages, tryFixJson, processHtmlCodeBlocks, processSSELine, extractMessageData } from './apiUtils.js';

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
        // 新增：模型适配器实例
        this.modelAdapter = new OpenAIModel({
            model: this.settingsManager.get('selected_model') || 'gpt-4o-mini',
            temperature: 0.7,
            systemMessage: '',
            baseUrl: this.settingsManager.get('baseUrl') || 'https://pool.mmmss.com',
            apiKey: this.settingsManager.get('apiKey') || ''
        });
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
        // 整理上下文
        const contextEnabled = this.settingsManager.get('contextEnabled', true);
        const contextMessages = getContextMessages(messages, this.conversationManager, contextEnabled);
        // 用模型适配器格式化消息
        const finalMessages = this.modelAdapter.formatMessages(contextMessages, config);
        // 直接调用模型适配器的请求方法
        return await this.modelAdapter.sendRequest({
                messages: finalMessages,
            config: { ...config, model, apiKey: this.settingsManager.get('apiKey') },
            signal
        });
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
            const contextEnabled = this.settingsManager.get('contextEnabled', true);
        const contextMessages = getContextMessages(messages, this.conversationManager, contextEnabled);
        const finalMessages = this.modelAdapter.formatMessages(contextMessages, config);
        return await this.modelAdapter.sendRequestStream({
                    messages: finalMessages,
            config: { ...config, model, apiKey: this.settingsManager.get('apiKey') },
            signal,
            onUpdate,
            onComplete
        });
    }
    
    /**
     * generateChatCompletion - 用于生成聊天完成（推荐使用的流式输出方法）
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
        // 从settingsManager读取streamEnabled设置
        const isStream = this.settingsManager.get('streamEnabled', true);
        
        // 将streamEnabled设置合并到config中
        config = { ...config, stream: isStream };
        
        // 添加检查，确保消息数组不为空
        if (!messages || messages.length === 0) {
            if (onError && typeof onError === 'function') {
                onError(new Error('消息列表为空，无法发送请求'));
                return;
            } else {
                throw new Error('消息列表为空，无法发送请求');
            }
        }
        
        // 确保消息数组中至少有一条用户消息
        let hasUserMessage = false;
        for (const msg of messages) {
            if (msg.role === 'user' && msg.content) {
                hasUserMessage = true;
                break;
            }
        }
        
        if (!hasUserMessage) {
            // 如果没有用户消息，添加一个默认的
            messages.push({
                role: 'user',
                content: '请帮助我。'
            });
        }
        
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