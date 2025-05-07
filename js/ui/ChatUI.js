/**
 * 聊天UI管理模块 - 负责整合所有UI子模块并管理页面交互
 */
import { MessageHandler } from './MessageHandler.js';
import { SidebarManager } from './SidebarManager.js';
import { ModalManager } from './ModalManager.js';
import { StreamManager } from './StreamManager.js';
import { ModelManager } from './ModelManager.js';
import { ExportManager } from './ExportManager.js';
import { CodeBlockManager } from './CodeBlockManager.js';
import { MessageFormatter } from '../utils.js';

export class ChatUI {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {Object} options.conversationManager - 对话管理器
     * @param {Object} options.apiClient - API客户端
     * @param {Object} options.settingsManager - 设置管理器
     */
    constructor(options) {
        // 保存核心依赖
        this.conversationManager = options.conversationManager;
        this.apiClient = options.apiClient;
        this.settingsManager = options.settingsManager;
        
        // 状态标志
        this.isGenerating = false;
        this.abortController = null;
        
        // 最近使用的助手消息ID跟踪器
        this._lastAssistantMessageId = null;
        
        // 缓存DOM元素
        this.cacheElements();
        
        // 初始化格式化器
        this.formatter = new MessageFormatter();
        
        // 创建聊天消息组件
        this.createChatMessageComponent();
        
        // 初始化子模块
        this.initSubmodules();
        
        // 绑定事件
        this.bindEvents();
        
        // 绑定快捷键
        this.bindShortcuts();
        
        // 检查是否有当前对话
        this.loadCurrentConversation();
    }
    
    /**
     * 缓存DOM元素
     */
    cacheElements() {
        // 消息相关
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.stopButton = document.getElementById('stopButton');
        this.sendingIndicator = document.getElementById('sendingIndicator');
        
        // 侧边栏相关
        this.sidebar = document.getElementById('sidebar');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.conversationList = document.getElementById('conversationList');
        
        // 模型相关
        this.modelSelect = document.getElementById('modelSelect');
        this.selectedModelText = document.getElementById('selectedModel');
        
        // 工具栏相关
        this.clearButton = document.getElementById('clearChat');
        this.settingsButton = document.getElementById('settingsBtn');
    }
    
    /**
     * 创建聊天消息组件
     */
    createChatMessageComponent() {
        // 导入聊天消息相关处理对象
        try {
            // 创建聊天消息组件对象
            this.ChatMessageComponent = {
                formatter: this.formatter,
                
                // 创建用户消息
                createUserMessage(message) {
                    const messageId = `user-message-${Date.now()}`;
                    const messageElement = document.createElement('div');
                    messageElement.id = messageId;
                    messageElement.className = 'chat chat-end group mb-4';
                    messageElement.dataset.content = message;
                    
                    // 构建消息内容
                    messageElement.innerHTML = `
                        <div class="chat-row">
                            <div class="avatar w-8 h-8 ml-2 flex-shrink-0 rounded-full bg-gray-200 flex items-center justify-center">👤</div>
                            <div class="message-content bg-openai-green text-white p-3 rounded-lg rounded-br-sm">
                                <div id="content-${messageId}" class="markdown-content">${this.formatter.formatMessage(message)}</div>
                            </div>
                        </div>
                        <div class="message-actions flex items-center mr-10 mt-1">
                            <button class="edit-message-btn p-1 hover:bg-gray-100 rounded" title="编辑消息">
                                <i class="fas fa-edit text-sm text-gray-500"></i>
                            </button>
                            <button class="copy-message-btn p-1 hover:bg-gray-100 rounded" title="复制消息">
                                <i class="fas fa-copy text-sm text-gray-500"></i>
                            </button>
                            <button class="delete-message-btn p-1 hover:bg-gray-100 rounded" title="删除消息">
                                <i class="fas fa-trash-alt text-sm text-gray-500"></i>
                            </button>
                        </div>
                    `;
                    
                    // 应用代码高亮
                    this.applyCodeHighlightingToElement(messageElement);
                    
                    return messageElement;
                },
                
                // 创建助手消息
                createAssistantMessage(message = '', messageId = null, isStream = false) {
                    if (!messageId) {
                        messageId = `assistant-message-${Date.now()}`;
                    }
                    
                    const messageElement = document.createElement('div');
                    messageElement.id = messageId;
                    messageElement.className = 'chat chat-start group mb-4';
                    messageElement.dataset.content = message;
                    
                    // 构建消息内容
                    messageElement.innerHTML = `
                        <div class="chat-row">
                            <div class="avatar w-8 h-8 mr-2 flex-shrink-0 rounded-full bg-openai-green text-white flex items-center justify-center">🤖</div>
                            <div class="message-content bg-gray-100 dark:bg-gray-700 p-3 rounded-lg rounded-bl-sm">
                                <div id="content-${messageId}" class="assistant-content markdown-content">
                                    ${isStream 
                                        ? '<span class="cursor-blink"></span>' 
                                        : this.formatter.formatMessage(message)}
                                </div>
                            </div>
                        </div>
                        <div class="message-actions flex items-center ml-10 mt-1">
                            <button class="edit-message-btn p-1 hover:bg-gray-100 rounded" title="编辑消息">
                                <i class="fas fa-edit text-sm text-gray-500"></i>
                            </button>
                            <button class="copy-message-btn p-1 hover:bg-gray-100 rounded" title="复制消息">
                                <i class="fas fa-copy text-sm text-gray-500"></i>
                            </button>
                            <button class="delete-message-btn p-1 hover:bg-gray-100 rounded" title="删除消息">
                                <i class="fas fa-trash-alt text-sm text-gray-500"></i>
                            </button>
                            <button class="preview-message-btn p-1 hover:bg-gray-100 rounded" title="预览HTML">
                                <i class="fas fa-eye text-sm text-gray-500"></i>
                            </button>
                            <span class="token-count text-xs text-openai-gray ml-2">估算中...</span>
                        </div>
                    `;
                    
                    // 应用代码高亮
                    this.applyCodeHighlightingToElement(messageElement);
                    return { element: messageElement, id: messageId };
                },
                
                // 应用代码高亮
                applyCodeHighlightingToElement: (element) => {
                    // 先检查元素是否有效
                    if (!element || !(element instanceof Element)) {
                        console.warn('[ChatUI] 尝试在无效元素上应用代码高亮');
                        return;
                    }
                    
                    // 减少高亮频率，降低性能压力
                    if (element.hasAttribute('data-highlighted')) {
                        return; // 避免重复高亮
                    }
                    element.setAttribute('data-highlighted', 'true');
                    
                    setTimeout(() => {
                        try {
                            if (typeof hljs !== 'undefined') {
                                const codeBlocks = element.querySelectorAll('pre code');
                                if (codeBlocks && codeBlocks.length > 0) {
                                    codeBlocks.forEach(block => {
                                        if (block && block instanceof Element) {
                                            // 检查是否是HTML代码块，HTML代码块不执行转义
                                            const language = block.className.match(/language-(\w+)/)?.[1];
                                            
                                            // 避免在正在生成的消息中进行代码高亮，减少性能消耗
                                            const messageElement = block.closest('.chat');
                                            const isGeneratingWithCursor = messageElement?.querySelector('.cursor-blink') !== null;
                                            
                                            if (!isGeneratingWithCursor) {
                                                try {
                                                    hljs.highlightElement(block);
                                                } catch (e) {
                                                    console.warn('[ChatUI] 代码高亮处理失败:', e);
                                                }
                                            }
                                        }
                                    });
                                }
                            }
                        } catch (error) {
                            console.error('[ChatUI] 应用代码高亮时出错:', error);
                        }
                    }, 0);
                },
                
                // 估算token数量的方法
                estimateTokenCount: (text) => {
                    // 简单估算: 每个单词约1.3个token，每个中文字符约2个token
                    if (!text) return 0;
                    
                    // 计算单词数（英文）
                    const englishWordCount = (text.match(/\b\w+\b/g) || []).length;
                    
                    // 计算中文字符数
                    const chineseCharCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
                    
                    // 计算其他符号数
                    const symbolCount = text.length - englishWordCount - chineseCharCount;
                    
                    // 估算token数量
                    const tokenCount = Math.round(englishWordCount * 1.3 + chineseCharCount * 2 + symbolCount * 0.5);
                    
                    return tokenCount;
                },
                
                // 创建欢迎消息
                createWelcomeMessage: () => {
                    const welcomeDiv = document.createElement('div');
                    welcomeDiv.className = 'welcome-message text-center p-8 mb-4';
                    welcomeDiv.innerHTML = `
                        <div class="text-2xl font-medium mb-3">👋 欢迎使用 PureAI 聊天面板</div>
                        <p class="text-gray-500 mb-4">随时随地与AI助手对话，获取帮助与灵感</p>
                        <div class="flex justify-center gap-3 mt-4">
                            <div class="max-w-xs p-4 bg-gray-50 rounded-lg border border-gray-100">
                                <div class="text-lg font-medium mb-2">💬 开始对话</div>
                                <p class="text-sm text-gray-500">在下方输入框发送消息，开始与AI对话</p>
                            </div>
                            <div class="max-w-xs p-4 bg-gray-50 rounded-lg border border-gray-100">
                                <div class="text-lg font-medium mb-2">⚙️ 自定义设置</div>
                                <p class="text-sm text-gray-500">选择不同AI模型，调整应用设置</p>
                            </div>
                        </div>
                    `;
                    return welcomeDiv;
                }
            };
        } catch (error) {
            console.error('初始化聊天消息组件失败:', error);
        }
    }
    
    /**
     * 初始化子模块
     */
    initSubmodules() {
        try {
            // 初始化代码块管理模块（先初始化，让其他模块能使用它的组件）
            this.codeBlockManager = new CodeBlockManager();
            this.codeBlockManager.init();
            
            // 将代码块管理器设置为全局可访问对象
            window.codeBlockManager = this.codeBlockManager;
            
            // 确保格式化器使用相同的预览实例
            if (this.formatter && this.codeBlockManager.htmlPreview) {
                this.formatter.htmlPreview = this.codeBlockManager.htmlPreview;
            }
            
            // 初始化消息处理模块
            this.messageHandler = new MessageHandler({
                chatMessages: this.chatMessages,
                chatComponent: this.ChatMessageComponent,
                conversationManager: this.conversationManager,
                onDeleteMessage: (index) => this.handleDeleteMessage(index),
                onEditMessage: (index, content) => this.handleEditMessage(index, content)
            });
            // 初始化消息处理模块 - 绑定事件
            this.messageHandler.init();
            
            // 初始化流式响应管理模块
            this.streamManager = new StreamManager({
                chatComponent: this.ChatMessageComponent,
                onScroll: () => this.scrollToBottom()
            });
            
            // 初始化模型管理模块
            this.modelManager = new ModelManager({
                modelSelect: this.modelSelect,
                selectedModelText: this.selectedModelText,
                onModelChange: (modelId) => this.handleModelChange(modelId)
            });
            
            // 初始化侧边栏管理模块
            this.sidebarManager = new SidebarManager({
                sidebar: this.sidebar,
                conversationList: this.conversationList,
                newChatBtn: this.newChatBtn,
                conversationManager: this.conversationManager,
                onSwitchConversation: (conversationId) => this.loadConversation(conversationId),
                onNewChat: () => this.newChat()
            });
            
            // 初始化模态框管理模块
            this.modalManager = new ModalManager({
                settingsManager: this.settingsManager,
                chatComponent: this.ChatMessageComponent,
                onEditMessage: (index, content) => this.handleEditMessage(index, content),
                onSaveSettings: () => this.handleSettingsUpdate()
            });
            
            // 初始化导出管理模块
            this.exportManager = new ExportManager({
                conversationManager: this.conversationManager,
                chatComponent: this.ChatMessageComponent
            });
            
            console.log('[ChatUI] 所有子模块初始化完成');
        } catch (error) {
            console.error('[ChatUI] 初始化子模块时发生错误:', error);
        }
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 发送按钮事件
        if (this.sendButton) {
            this.sendButton.addEventListener('click', () => {
                if (!this.isGenerating) {
                    this.sendMessage();
                }
            });
        }
        
        // 停止按钮事件
        if (this.stopButton) {
            this.stopButton.addEventListener('click', () => this.stopGeneration());
        }
        
        // 消息输入框事件
        if (this.messageInput) {
            // 处理输入法事件
            let isComposing = false;
            
            this.messageInput.addEventListener('compositionstart', () => {
                isComposing = true;
            });
            
            this.messageInput.addEventListener('compositionend', () => {
                isComposing = false;
            });
            
            // 处理输入框高度自适应
            this.messageInput.addEventListener('input', () => {
                this.adjustTextareaHeight();
            });
            
            // 处理按键事件，避免中文输入法问题
            this.messageInput.addEventListener('keydown', (e) => {
                // 检查是否处于中文输入法状态
                if (e.key === 'Enter' && !e.shiftKey && !isComposing && e.keyCode !== 229) {
                    e.preventDefault();
                    if (!this.isGenerating) {
                        this.sendMessage();
                    }
                }
            });
        }
        
        // 清除按钮事件
        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => {
                if (confirm('确定要清除所有消息吗？这将创建一个新的对话。')) {
                    this.newChat();
                }
            });
        }
        
        // 设置按钮事件
        if (this.settingsButton) {
            this.settingsButton.addEventListener('click', () => this.modalManager.openSettingsModal());
        }
        
        // 绑定快捷键
        this.bindShortcuts();
        
        // 初始调整输入框高度
        this.adjustTextareaHeight();
    }
    
    /**
     * 自动调整输入框高度
     */
    adjustTextareaHeight() {
        if (!this.messageInput) return;
        
        // 重置高度
        this.messageInput.style.height = 'auto';
        
        // 计算新高度
        const newHeight = Math.min(Math.max(this.messageInput.scrollHeight, 40), 200); // 最小高度40px，最大高度200px
        
        // 设置新高度
        this.messageInput.style.height = newHeight + 'px';
    }
    
    /**
     * 绑定键盘快捷键
     */
    bindShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+K/Cmd+K: 聚焦到输入框
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                if (this.messageInput) {
                    this.messageInput.focus();
                }
            }
            
            // Ctrl+N/Cmd+N: 新建对话
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.newChat();
            }
            
            // Esc: 停止生成
            if (e.key === 'Escape' && this.isGenerating) {
                e.preventDefault();
                this.stopGeneration();
            }
            
            // Alt+T: 切换暗/亮模式
            if (e.altKey && e.key === 't') {
                e.preventDefault();
                document.body.classList.toggle('dark');
                localStorage.setItem('dark_mode', document.body.classList.contains('dark') ? 'true' : 'false');
            }
            
            // Ctrl+E/Cmd+E: 导出为Markdown
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'e') {
                e.preventDefault();
                this.exportManager.exportChat('markdown');
            }
            
            // Ctrl+Shift+E/Cmd+Shift+E: 导出为PDF
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
                e.preventDefault();
                this.exportManager.exportChat('pdf');
            }
            
            // ?: 显示快捷键帮助
            if (e.key === '?' && !e.target.matches('input, textarea')) {
                e.preventDefault();
                this.modalManager.showShortcutsHelp();
            }
        });
    }
    
    /**
     * 加载当前对话
     */
    loadCurrentConversation() {
        const currentConversation = this.conversationManager.getCurrentConversation();
        
        // 如果没有当前对话，创建一个新对话
        if (!currentConversation) {
            this.newChat();
            return;
        }
        
        // 清空聊天区域
        this.messageHandler.clearChatArea();
        
        // 加载对话中的所有消息
        if (currentConversation.messages && currentConversation.messages.length > 0) {
            currentConversation.messages.forEach((message, index) => {
                if (message.role === 'user') {
                    // 添加用户消息并设置索引
                    const userMessageElement = this.messageHandler.addUserMessage(message.content, false);
                    if (userMessageElement && userMessageElement instanceof HTMLElement) {
                        userMessageElement.dataset.index = String(index);
                        console.log(`[ChatUI] 加载对话 - 为用户消息(${message.role})设置索引: ${index}`);
                    }
                } else if (message.role === 'assistant') {
                    // 添加AI消息并设置索引
                    const assistantResult = this.messageHandler.addAssistantMessage(message.content);
                    if (assistantResult && assistantResult.element instanceof HTMLElement) {
                        assistantResult.element.dataset.index = String(index);
                        console.log(`[ChatUI] 加载对话 - 为AI消息(${message.role})设置索引: ${index}`);
                    }
                }
            });
            
            // 确保绑定所有消息的事件
            this.messageHandler.bindMessageEvents();
            
            // 应用代码高亮和互动功能
            this.formatter.addCodeInteractionButtons();
            
            // 重新初始化代码块UI和交互
            if (this.codeBlockManager) {
                this.codeBlockManager.reinitializeCodeBlocks();
            }
            
            // 滚动到底部
            this.scrollToBottom();
        }
        
        // 设置页面标题
        document.title = currentConversation.title || 'PureAI Panel';
        
        // 选择当前对话使用的模型
        if (currentConversation.model) {
            this.modelManager.selectModel(currentConversation.model);
        }
        
        // 更新对话列表
        this.sidebarManager.renderConversationList();
    }
    
    /**
     * 保存当前对话（如果需要）
     */
    saveCurrentConversationIfNeeded() {
        // 这个方法只是一个兼容层，在ConversationManager中已经在每次修改后自动保存
        // 不需要额外操作，但保留此方法以维持API兼容性
        console.log('保存当前对话');
    }
    
    /**
     * 加载指定对话
     * @param {string} conversationId - 对话ID
     */
    loadConversation(conversationId) {
        // 保存当前对话
        this.saveCurrentConversationIfNeeded();
        
        // 设置当前对话
        if (conversationId) {
            this.conversationManager.switchConversation(conversationId);
        } else {
            // 如果没有指定对话ID，则创建新对话
            this.newChat();
            return;
        }
        
        // 加载对话内容
        this.loadCurrentConversation();
    }
    
    /**
     * 新建对话
     */
    newChat() {
        // 创建新对话
        this.conversationManager.createNewConversation();
        
        // 清空聊天区域
        this.messageHandler.clearChatArea();
        
        // 更新对话列表
        this.sidebarManager.renderConversationList();
        
        // 设置页面标题
        document.title = '新对话 - PureAI Panel';
        
        // 聚焦输入框
        if (this.messageInput) {
            this.messageInput.focus();
        }
    }
    
    /**
     * 发送消息
     */
    async sendMessage() {
        if (!this.messageInput || !this.messageInput.value.trim()) return;
        
        // 检查API设置是否有效
        const apiKey = this.settingsManager.get('apiKey');
        if (!apiKey) {
            alert('请先在设置中配置API密钥，否则无法与AI对话');
            if (this.modalManager) {
                this.modalManager.openSettingsModal();
            }
            return;
        }
        
        // 获取用户消息内容
        const userMessage = this.messageInput.value.trim();
        
        // 清空输入框
        this.messageInput.value = '';
        
        // 添加用户消息到界面
        const userMessageElement = this.messageHandler.addUserMessage(userMessage);
        
        // 保存消息到当前对话
        this.conversationManager.addMessage('user', userMessage);
        
        // 重要：设置用户消息的索引属性
        if (userMessageElement instanceof HTMLElement) {
            const currentConversation = this.conversationManager.getCurrentConversation();
            if (currentConversation && currentConversation.messages) {
                const messageIndex = currentConversation.messages.length - 1;
                userMessageElement.dataset.index = messageIndex.toString();
                console.log(`[ChatUI] 为用户消息设置索引: ${messageIndex}`);
            }
        }
        
        // 更新对话列表
        this.sidebarManager.renderConversationList();
        
        // 发送到API获取回复
        await this.generateResponse(userMessage);
    }
    
    /**
     * 生成AI响应
     * @param {string} userMessage - 用户消息
     */
    async generateResponse(userMessage) {
        // 防止重复生成
        if (this.isGenerating) return;
        
        try {
            // 设置生成状态
            this.isGenerating = true;
            // 设置全局生成状态
            this.streamManager.setGlobalGeneratingState(true);
            
            // 更新UI状态
            this.showStopButton(true);
            this.sendingIndicator.classList.remove('hidden');
            
            // 创建新的消息元素
            const { element: assistantElement, id: assistantId } = this.ChatMessageComponent.createAssistantMessage('', null, true);
            this.chatMessages.appendChild(assistantElement);
            this._lastAssistantMessageId = assistantId;
            
            // 请求响应
            this.abortController = new AbortController();
            const signal = this.abortController.signal;
            
            // 获取选择的模型
            const selectedModel = this.modelManager.getSelectedModel();
            
            // 处理流式响应
            const handleStreamResponse = (chunk) => {
                if (signal.aborted) return;
                
                try {
                    // 更新流消息
                    this.streamManager.updateStreamMessage(assistantId, chunk);
                    
                    // 保存最新内容到临时变量，用于最终更新
                    this._currentStreamContent = chunk;
                    
                    // 尝试获取代码块，应用代码高亮和交互功能
                    this.codeBlockManager.updateExistingCodeBlocks();
                    
                    // 滚动到底部
                    this.scrollToBottom();
                } catch (e) {
                    console.error('[流式响应处理错误]', e);
                }
            };
            
            // 完成处理函数
            const handleStreamEnd = () => {
                if (signal.aborted) return;
                
                try {
                    // 获取完整的流式内容
                    const finalContent = this._currentStreamContent || '';
                    
                    // 完成流式动画
                    this.streamManager.completeStreaming(assistantId, finalContent);
                    
                    // 预估并显示token数量
                    this.updateTokenCount(assistantId, finalContent);
                    
                    // 结束消息后的回调
                    const handleStreamingComplete = () => {
                        // 重置生成状态
                        this.isGenerating = false;
                        this.streamManager.setGlobalGeneratingState(false);
                        this.abortController = null;
                        
                        // 更新UI状态
                        this.showStopButton(false);
                        this.sendingIndicator.classList.add('hidden');
                        
                        // 保存对话
                        const userIndex = this.conversationManager.getCurrentConversation().messages.length - 2;
                        const assistantIndex = this.conversationManager.getCurrentConversation().messages.length - 1;
                        
                        if (userIndex >= 0 && assistantIndex >= 0) {
                            this.conversationManager.updateMessagePair(
                                userIndex,
                                assistantIndex,
                                userMessage,
                                finalContent
                            );
                        }
                        
                        // 最终处理代码块
                        setTimeout(() => {
                            try {
                                // 应用代码高亮和交互功能
                                this.codeBlockManager.updateExistingCodeBlocks();
                                this.ChatMessageComponent.applyCodeHighlightingToElement(assistantElement);
                                
                                // 添加预览功能到HTML代码块
                                this.formatter.addCodeInteractionButtons();
                                
                                // 应用图片预览功能
                                this.messageHandler.setupMessageActions();
                            } catch (e) {
                                console.error('[最终代码处理错误]', e);
                            }
                        }, 100);
                    };
                    
                    // 设置流动完成回调
                    this.streamManager.setAnimationCompleteCallback(handleStreamingComplete);
                    
                    // 保存当前对话
                    this.saveCurrentConversationIfNeeded();
                } catch (e) {
                    console.error('[流式响应完成处理错误]', e);
                    
                    // 确保状态正确重置
                    this.isGenerating = false;
                    this.streamManager.setGlobalGeneratingState(false);
                    this.showStopButton(false);
                    this.sendingIndicator.classList.add('hidden');
                }
            };
            
            // 错误处理函数
            const handleStreamError = (error) => {
                console.error('[API请求错误]', error);
                
                // 重置状态
                this.isGenerating = false;
                this.streamManager.setGlobalGeneratingState(false);
                this.showStopButton(false);
                this.sendingIndicator.classList.add('hidden');
                
                // 显示错误消息
                const errorMsg = '⚠️ 生成回复时出现错误，请稍后再试。';
                const errorElement = document.createElement('div');
                errorElement.className = 'error-message text-red-500 text-sm mt-1 ml-12';
                errorElement.textContent = errorMsg;
                
                // 添加错误到助手消息下方
                const msgElement = document.getElementById(assistantId);
                if (msgElement) {
                    msgElement.appendChild(errorElement);
                }
            };
            
            // 添加消息到对话
            this.conversationManager.addMessagePair(userMessage, '');
            
            // 发送API请求
            await this.apiClient.generateChatCompletion(
                this.conversationManager.getCurrentConversation().messages,
                selectedModel.id,
                handleStreamResponse,
                handleStreamEnd,
                handleStreamError,
                signal
            );
        } catch (error) {
            console.error('[生成响应错误]', error);
            
            // 重置状态
            this.isGenerating = false;
            this.streamManager.setGlobalGeneratingState(false);
            this.showStopButton(false);
            this.sendingIndicator.classList.add('hidden');
        }
    }
    
    /**
     * 停止生成
     */
    stopGeneration() {
        if (!this.isGenerating || !this.abortController) return;
        
        // 中止当前请求
        this.abortController.abort();
        
        // 停止流式动画
        this.streamManager.stopAllAnimations();
        
        // 更新状态
        this.isGenerating = false;
        this.showStopButton(false);
        
        // 移除生成中的全局状态类
        document.body.classList.remove('isGenerating');
    }
    
    /**
     * 显示或隐藏停止按钮，同时控制发送按钮状态
     * @param {boolean} show - 是否显示停止按钮
     */
    showStopButton(show) {
        if (this.stopButton) {
            this.stopButton.classList.toggle('hidden', !show);
        }
        
        if (this.sendingIndicator) {
            this.sendingIndicator.classList.toggle('hidden', !show);
        }
        
        if (this.sendButton) {
            if (show) {
                // 生成中状态
                this.sendButton.classList.add('hidden');
                this.sendButton.disabled = true;
            } else {
                // 可发送状态
                this.sendButton.classList.remove('hidden');
                this.sendButton.disabled = false;
            }
        }
    }
    
    /**
     * 滚动到底部
     */
    scrollToBottom() {
        if (this.chatMessages) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }
    
    /**
     * 处理删除消息
     * @param {number} index - 消息索引
     */
    handleDeleteMessage(index) {
        // 删除指定索引的消息
        this.conversationManager.deleteMessage(index);
        
        // 重新加载当前对话
        this.loadCurrentConversation();
    }
    
    /**
     * 处理编辑消息
     * @param {number} index - 消息索引
     * @param {string} content - 新消息内容
     */
    handleEditMessage(index, content) {
        // 更新指定索引的消息
        this.conversationManager.editMessage(index, content);
        
        // 重新加载当前对话
        this.loadCurrentConversation();
    }
    
    /**
     * 处理模型变更
     * @param {string} modelId - 模型ID
     */
    handleModelChange(modelId) {
        // 更新当前对话使用的模型
        const currentConversation = this.conversationManager.getCurrentConversation();
        if (currentConversation) {
            currentConversation.model = modelId;
            this.conversationManager.saveConversations();
        }
    }
    
    /**
     * 处理设置更新
     */
    handleSettingsUpdate() {
        // 这里可以实现设置更新后的逻辑
        console.log('[ChatUI] 设置已更新');
    }
    
    /**
     * 更新消息的token计数
     * @param {string} messageId - 消息ID
     * @param {string} content - 消息内容
     */
    updateTokenCount(messageId, content) {
        const tokenCountElement = document.querySelector(`#${messageId} .token-count`);
        if (tokenCountElement && tokenCountElement instanceof HTMLElement) {
            const estimatedTokens = this.ChatMessageComponent.estimateTokenCount(content);
            tokenCountElement.textContent = `${estimatedTokens} tokens`;
            tokenCountElement.title = "估计的Token数量";
        }
    }
} 