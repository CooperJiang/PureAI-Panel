// API服务模块
export class ApiService {
    constructor(settingsManager, conversationManager) {
        this.settingsManager = settingsManager;
        this.conversationManager = conversationManager;
        this.currentStreamController = null;
        this.lastTokenUsage = null;
    }
    
    // 取消当前的流式请求
    cancelCurrentStream() {
        if (this.currentStreamController) {
            this.currentStreamController.abort();
            this.currentStreamController = null;
            return true;
        }
        return false;
    }
    
    // 发送消息并获取回复（常规模式）
    async sendMessage(model, onStart, onSuccess, onError, onComplete) {
        const baseUrl = this.settingsManager.get('baseUrl');
        const apiKey = this.settingsManager.get('apiKey');
        
        if (!baseUrl || !apiKey) {
            onError('请先在设置中填写 Base URL 和 API Key。');
            onComplete();
            return;
        }
        
        try {
            onStart();
            
            // 获取对话消息
            const messages = this.getConversationMessages();
            
            if (!messages || messages.length === 0) {
                throw new Error('消息列表为空，请输入至少一条消息');
            }
            
            // 记录请求参数
            console.log('发送API请求参数:', {
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
                })
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
            
            onSuccess(assistantResponse);
        } catch (error) {
            onError(`错误: ${error.message}`);
            console.error('API 请求失败:', error);
        } finally {
            onComplete();
        }
    }
    
    // 发送消息并获取流式回复
    async sendMessageStream(model, onStart, onToken, onError, onComplete) {
        const baseUrl = this.settingsManager.get('baseUrl');
        const apiKey = this.settingsManager.get('apiKey');
        
        if (!baseUrl || !apiKey) {
            onError('请先在设置中填写 Base URL 和 API Key。');
            onComplete();
            return;
        }
        
        try {
            // 创建 AbortController 用于取消请求
            const controller = new AbortController();
            this.currentStreamController = controller;
            
            onStart();
            
            // 获取对话消息
            const messages = this.getConversationMessages();
            
            if (!messages || messages.length === 0) {
                throw new Error('消息列表为空，请输入至少一条消息');
            }
            
            // 记录请求参数
            console.log('发送流式API请求参数:', {
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
                signal: controller.signal
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
                                onToken(content, accumulatedText);
                            }
                        } catch (e) {
                            console.error('解析流数据失败:', e);
                        }
                    }
                }
            }
            
            // 完成后返回完整回复
            onComplete(accumulatedText);
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('流式请求已取消');
            } else {
                onError(`错误: ${error.message}`);
                console.error('API 请求失败:', error);
            }
        } finally {
            this.currentStreamController = null;
        }
    }
    
    // 获取当前对话的消息，转换为API所需格式
    getConversationMessages() {
        if (!this.conversationManager) {
            return [];
        }
        
        const rawMessages = this.conversationManager.getMessages();
        if (!rawMessages || rawMessages.length === 0) {
            return [];
        }
        
        // 处理消息以符合OpenAI API格式
        const formattedMessages = [];
        
        // 添加系统消息
        formattedMessages.push({
            role: 'system',
            content: '你是一个有用的AI助手。'
        });
        
        // 重构为完整匹配对话对
        let processedIndices = new Set();
        
        // 首先查找完整的user-assistant对话对
        for (let i = 0; i < rawMessages.length; i++) {
            if (processedIndices.has(i)) continue;
            
            const currentMsg = rawMessages[i];
            if (currentMsg.role !== 'user' || !currentMsg.content) continue;
            
            // 寻找下一个有效的assistant回复
            let assistantIdx = -1;
            for (let j = i + 1; j < rawMessages.length; j++) {
                if (rawMessages[j].role === 'assistant' && rawMessages[j].content) {
                    assistantIdx = j;
                    break;
                }
            }
            
            // 如果找到了完整的对话对
            if (assistantIdx !== -1) {
                formattedMessages.push({
                    role: 'user',
                    content: currentMsg.content
                });
                
                formattedMessages.push({
                    role: 'assistant',
                    content: rawMessages[assistantIdx].content
                });
                
                // 标记这两条消息为已处理
                processedIndices.add(i);
                processedIndices.add(assistantIdx);
            }
        }
        
        // 处理剩下的最后一条用户消息(如果有)
        for (let i = rawMessages.length - 1; i >= 0; i--) {
            if (processedIndices.has(i)) continue;
            
            const msg = rawMessages[i];
            if (msg.role === 'user' && msg.content) {
                formattedMessages.push({
                    role: 'user',
                    content: msg.content
                });
                break; // 只处理最后一条
            }
        }
        
        console.log('格式化后的消息:', formattedMessages);
        return formattedMessages;
    }
    
    // 获取最后一次请求的token用量
    async getLastTokenUsage() {
        // 直接返回记录的token用量，如果有的话
        if (this.lastTokenUsage) {
            return this.lastTokenUsage;
        }
        
        // 否则返回零值
        return { total: 0, prompt: 0, completion: 0 };
    }
} 