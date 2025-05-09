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
        
        // 确保发送按钮和加载指示器的初始状态正确
        if (this.sendButton) {
            this.sendButton.style.display = 'flex';
        }
        if (this.sendingIndicator) {
            this.sendingIndicator.style.display = 'none';
        }
        
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
        this.sendingIndicator = document.getElementById('sendingIndicator');
        
        // 中断按钮相关 - 使用中断按钮代替停止按钮
        this.interruptButton = document.getElementById('interruptButton');
        this.interruptButtonContainer = document.getElementById('interruptButtonContainer');
        
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
        
        // 底部API设置按钮
        this.apiSettingsBtn = document.getElementById('apiSettingsBtn');
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
                    messageElement.dataset.timestamp = Date.now().toString();
                    
                    // 获取当前时间
                    const now = new Date();
                    const timeStr = now.toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                    }).replace(/\//g, '-');
                    
                    // 构建消息内容
                    messageElement.innerHTML = `
                        <div class="chat-row">
                            <div class="avatar w-8 h-8 ml-2 flex-shrink-0 rounded-full bg-gray-200 flex items-center justify-center">👤</div>
                            <div class="message-content bg-openai-green text-white p-3 rounded-lg rounded-br-sm">
                                <div id="content-${messageId}" class="markdown-content">${this.formatter.formatMessage(message)}</div>
                            </div>
                        </div>
                        <div class="flex items-center justify-between mr-12 mt-2">
                            <div class="message-buttons flex space-x-2">
                                <span class="message-time text-xs text-gray-500">${timeStr}</span>
                                <button class="edit-message-btn p-1 rounded transition-all transform active:scale-95 message-action-btn" title="编辑消息">
                                    <i class="fas fa-edit text-sm"></i>
                                </button>
                                <button class="copy-message-btn p-1 rounded transition-all transform active:scale-95 message-action-btn" title="复制消息">
                                    <i class="fas fa-copy text-sm"></i>
                                </button>
                                <button class="delete-message-btn p-1 rounded transition-all transform active:scale-95 message-action-btn" title="删除消息">
                                    <i class="fas fa-trash-alt text-sm"></i>
                                </button>
                            </div>
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
                    messageElement.dataset.timestamp = Date.now().toString();
                    
                    // 获取当前时间
                    const now = new Date();
                    const timeStr = now.toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                    }).replace(/\//g, '-');
                    
                    // 构建消息内容
                    messageElement.innerHTML = `
                        <div class="chat-row">
                            <div class="avatar w-8 h-8 mr-2 flex-shrink-0 rounded-full bg-openai-green text-white flex items-center justify-center">🤖</div>
                            <div class="message-content bg-gray-100 dark:bg-gray-700 p-3 rounded-lg rounded-bl-sm">
                                <div id="content-${messageId}" class="assistant-content markdown-content">
                                    ${isStream 
                                        ? '' 
                                        : this.formatter.formatMessage(message)}
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center justify-between ml-12 mt-2">
                            <div class="message-buttons flex space-x-2">
                                <button class="edit-message-btn p-1 rounded transition-all transform active:scale-95 message-action-btn" title="编辑消息">
                                    <i class="fas fa-edit text-sm"></i>
                                </button>
                                <button class="copy-message-btn p-1 rounded transition-all transform active:scale-95 message-action-btn" title="复制消息">
                                    <i class="fas fa-copy text-sm"></i>
                                </button>
                                <button class="delete-message-btn p-1 rounded transition-all transform active:scale-95 message-action-btn" title="删除消息">
                                    <i class="fas fa-trash-alt text-sm"></i>
                                </button>
                                <div class="text-xs text-openai-gray token-count estimating">估算中...</div>
                                <span class="message-time text-xs text-gray-500">${timeStr}</span>
                            </div>
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
                                            // 由于我们已删除了cursor-blink，所以这里直接判断是否在生成中
                                            const isGenerating = this.isGenerating;
                                            
                                            if (!isGenerating) {
                                                try {
                                                    hljs.highlightElement(block);
                                                } catch (e) {
                                                }
                                            }
                                        }
                                    });
                                }
                            }
                        } catch (error) {
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
                            <div class="max-w-xs p-4 rounded-lg border card-bg">
                                <div class="text-lg font-medium mb-2">💬 开始对话</div>
                                <p class="text-sm text-gray-500">在下方输入框发送消息，开始与AI对话</p>
                            </div>
                            <div class="max-w-xs p-4 rounded-lg border card-bg">
                                <div class="text-lg font-medium mb-2">⚙️ 自定义设置</div>
                                <p class="text-sm text-gray-500">选择不同AI模型，调整应用设置</p>
                            </div>
                        </div>
                    `;
                    return welcomeDiv;
                },
                
                // 创建上下文断点标记
                createContextBreakpoint: (breakpointIndex) => {
                    const breakpointElement = document.createElement('div');
                    breakpointElement.className = 'context-breakpoint flex items-center justify-center my-4 animate__animated animate__fadeIn';
                    breakpointElement.dataset.breakpointIndex = breakpointIndex !== undefined ? String(breakpointIndex) : '';
                    
                    breakpointElement.innerHTML = `
                        <div class="w-full flex items-center">
                            <div class="h-px bg-gray-300 dark:bg-gray-600 flex-grow mr-3"></div>
                            <div class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full flex items-center">
                                <i class="fas fa-cut mr-1"></i>
                                <span>上下文断点</span>
                                <button class="delete-breakpoint-btn ml-2 hover:text-red-500 transition-colors" title="删除断点">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                            <div class="h-px bg-gray-300 dark:bg-gray-600 flex-grow ml-3"></div>
                        </div>
                    `;
                    
                    return breakpointElement;
                }
            };
        } catch (error) {
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
                onNewChat: () => this.newChat(),
                onOpenSettings: () => this.openSettingsModal()
            });
            
            // 初始化模态框管理模块
            this.modalManager = new ModalManager({
                settingsManager: this.settingsManager,
                chatComponent: this.ChatMessageComponent,
                conversationManager: this.conversationManager,
                modelManager: this.modelManager,
                onEditMessage: (index, content) => this.handleEditMessage(index, content),
                onSaveSettings: () => this.handleSettingsUpdate()
            });
            
            // 初始化导出管理模块
            this.exportManager = new ExportManager({
                conversationManager: this.conversationManager,
                chatComponent: this.ChatMessageComponent
            });
            
        } catch (error) {
            console.error('初始化子模块失败:', error);
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
        
        // 中断按钮事件
        if (this.interruptButton) {
            this.interruptButton.addEventListener('click', () => this.stopGeneration());
        }
        
        // 处理输入框事件
        if (this.messageInput) {
            // 处理输入法事件
            let isComposing = false;
            
            this.messageInput.addEventListener('compositionstart', () => {
                isComposing = true;
            });
            
            this.messageInput.addEventListener('compositionend', () => {
                isComposing = false;
                // 输入法结束后重新调整高度
                this.adjustTextareaHeight();
            });
            
            // 处理输入框高度自适应
            this.messageInput.addEventListener('input', () => {
                this.adjustTextareaHeight();
            });
            
            // 添加光标移动和滚动事件监听
            this.messageInput.addEventListener('click', () => this.adjustTextareaHeight());
            this.messageInput.addEventListener('keyup', (e) => {
                // 方向键、删除键等可能改变光标位置的键需要重新调整滚动
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Backspace', 'Delete'].includes(e.key)) {
                    this.adjustTextareaHeight();
                }
            });
            
            // 增加滚动事件监听，确保滚动正常工作
            this.messageInput.addEventListener('scroll', (e) => {
                // 阻止事件冒泡，避免影响外层容器的滚动
                e.stopPropagation();
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
            
            // 处理粘贴事件
            this.messageInput.addEventListener('paste', () => {
                // 延迟调整，等待粘贴内容完成渲染
                setTimeout(() => this.adjustTextareaHeight(), 0);
            });
        }
        
        // 清除按钮事件
        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => {
                // 如果正在生成内容，不允许清除对话
                if (this.isGenerating) {
                    if (window.toast) {
                        window.toast.warning('请等待当前回复生成完成再清除对话');
                    }
                    return;
                }
                
                // 清除当前对话的所有消息
                this.conversationManager.clearMessages();
                    
                // 清空聊天区域
                this.messageHandler.clearChatArea();
                
                // 更新对话列表
                this.sidebarManager.renderConversationList();
                
                // 聚焦输入框
                if (this.messageInput) {
                    this.messageInput.focus();
                }
            });
        }
        
        // 设置按钮事件
        if (this.settingsButton) {
            this.settingsButton.addEventListener('click', () => this.openSettingsModal());
        }
        
        // 底部快捷键按钮事件
        const keyboardShortcutsBtn = document.getElementById('keyboardShortcutsBtn');
        if (keyboardShortcutsBtn) {
            keyboardShortcutsBtn.addEventListener('click', () => {
                this.modalManager.showShortcutsHelp();
            });
        }
        
        // 底部API设置按钮事件
        if (this.apiSettingsBtn) {
            this.apiSettingsBtn.addEventListener('click', () => {
                this.openSettingsModal();
            });
        }
        
        // 设置滚动检测
        this.setupScrollDetection();
        
        // 绑定快捷键
        this.bindShortcuts();
        
        // 初始调整输入框高度
        this.adjustTextareaHeight();
        
        // 绑定断点删除按钮的点击事件
        this.bindBreakpointDeleteEvents();
    }
    
    /**
     * 自动调整输入框高度
     */
    adjustTextareaHeight() {
        if (!this.messageInput) return;
        
        // 保存原始滚动条位置
        const scrollTop = this.messageInput.scrollTop;
        
        // 重置高度以准确计算内容高度
        this.messageInput.style.height = 'auto';
        
        // 获取内容的实际高度和限制高度
        const scrollHeight = this.messageInput.scrollHeight;
        const minHeight = 45; // 与CSS中保持一致
        const maxHeight = 200;
        
        // 计算新高度：不小于最小高度，不大于最大高度
        const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
        
        // 设置新高度
        this.messageInput.style.height = newHeight + 'px';
        
        // 处理滚动条类
        this.messageInput.classList.remove('scrollable');
        
        // 检查是否达到最大高度
        if (scrollHeight > maxHeight) {
            // 如果超过最大高度，启用滚动
            this.messageInput.style.overflowY = 'auto';
            this.messageInput.classList.add('scrollable');
            
            // 恢复之前的滚动位置或滚动到光标位置
            if (this.messageInput === document.activeElement) {
                // 如果正在输入，尝试滚动到光标位置
                const cursorPosition = this.messageInput.selectionStart;
                if (typeof cursorPosition === 'number') {
                    try {
                        // 创建临时元素计算光标位置
                        const textBeforeCursor = this.messageInput.value.substring(0, cursorPosition);
                        const tempEl = document.createElement('div');
                        tempEl.style.position = 'absolute';
                        tempEl.style.visibility = 'hidden';
                        tempEl.style.whiteSpace = 'pre-wrap';
                        tempEl.style.wordBreak = 'break-word';
                        tempEl.style.width = this.messageInput.clientWidth + 'px';
                        tempEl.style.font = window.getComputedStyle(this.messageInput).font;
                        tempEl.style.padding = window.getComputedStyle(this.messageInput).padding;
                        tempEl.textContent = textBeforeCursor;
                        document.body.appendChild(tempEl);
                        
                        // 计算光标高度并滚动
                        const cursorHeight = tempEl.clientHeight;
                        document.body.removeChild(tempEl);
                        
                        // 滚动到光标位置附近，留一定空间
                        if (cursorHeight > maxHeight) {
                            this.messageInput.scrollTop = Math.max(0, cursorHeight - maxHeight * 0.7);
                        }
                    } catch (e) {
                        // 失败时使用原始滚动位置
                        this.messageInput.scrollTop = scrollTop;
                    }
                } else {
                    this.messageInput.scrollTop = scrollTop;
                }
            } else {
                this.messageInput.scrollTop = scrollTop;
            }
        } else {
            // 未达到最大高度时，禁用滚动
            this.messageInput.style.overflowY = 'hidden';
        }
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
        
        // 获取断点位置信息
        const breakpoints = this.conversationManager.getBreakpoints();
        
        // 加载对话中的所有消息
        if (currentConversation.messages && currentConversation.messages.length > 0) {
            currentConversation.messages.forEach((message, index) => {
                // 检查是否是断点标记消息
                if (message.type === 'breakpoint') {
                    // 创建并添加断点标记
                    const breakpointElement = this.ChatMessageComponent.createContextBreakpoint(index);
                    
                    // 找到应该插入断点的位置
                    // 如果索引为0，添加到最前面
                    if (index === 0) {
                        if (this.chatMessages.firstChild) {
                            this.chatMessages.insertBefore(breakpointElement, this.chatMessages.firstChild);
                        } else {
                            this.chatMessages.appendChild(breakpointElement);
                        }
                    } else {
                        // 获取当前已添加的消息元素
                        const existingMessages = this.chatMessages.querySelectorAll('.chat:not(.context-breakpoint)');
                        // 确保断点添加到正确的位置之后
                        if (index - 1 < existingMessages.length) {
                            const targetMessage = existingMessages[index - 1];
                            if (targetMessage && targetMessage.nextSibling) {
                                this.chatMessages.insertBefore(breakpointElement, targetMessage.nextSibling);
                            } else {
                                this.chatMessages.appendChild(breakpointElement);
                            }
                        } else {
                            this.chatMessages.appendChild(breakpointElement);
                        }
                    }
                    return; // 跳过进一步处理
                }
                
                // 检查是否需要在此位置添加断点标记(兼容旧版数据)
                if (breakpoints.includes(index)) {
                    // 创建并添加断点标记
                    const breakpointElement = this.ChatMessageComponent.createContextBreakpoint(index);
                    
                    // 找到应该插入断点的位置 - 与上面相同的逻辑
                    // 如果索引为0，添加到最前面
                    if (index === 0) {
                        if (this.chatMessages.firstChild) {
                            this.chatMessages.insertBefore(breakpointElement, this.chatMessages.firstChild);
                        } else {
                            this.chatMessages.appendChild(breakpointElement);
                        }
                    } else {
                        // 获取当前已添加的消息元素
                        const existingMessages = this.chatMessages.querySelectorAll('.chat:not(.context-breakpoint)');
                        // 确保断点添加到正确的位置之后
                        if (index - 1 < existingMessages.length) {
                            const targetMessage = existingMessages[index - 1];
                            if (targetMessage && targetMessage.nextSibling) {
                                this.chatMessages.insertBefore(breakpointElement, targetMessage.nextSibling);
                            } else {
                                this.chatMessages.appendChild(breakpointElement);
                            }
                        } else {
                            this.chatMessages.appendChild(breakpointElement);
                        }
                    }
                }
                
                if (message.role === 'user') {
                    // 添加用户消息并设置索引
                    const userMessageElement = this.messageHandler.addUserMessage(message.content, false);
                    if (userMessageElement && userMessageElement instanceof HTMLElement) {
                        userMessageElement.dataset.index = String(index);
                    }
                } else if (message.role === 'assistant') {
                    // 添加AI消息并设置索引
                    const assistantResult = this.messageHandler.addAssistantMessage(message.content);
                    if (assistantResult && assistantResult.element instanceof HTMLElement) {
                        assistantResult.element.dataset.index = String(index);
                        
                        // 计算并更新token数量，解决"估算中..."问题
                        this.updateTokenCount(assistantResult.id, message.content);
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
        if (currentConversation.config && currentConversation.config.model) {
            // 使用对话特定的配置中的模型
            const modelId = currentConversation.config.model;
            this.modelManager.selectModel(modelId);
        } else if (currentConversation.model) {
            // 兼容旧版数据格式
            this.modelManager.selectModel(currentConversation.model);
            
            // 将旧格式数据迁移到新配置对象中
            if (!currentConversation.config) {
                currentConversation.config = {
                    model: currentConversation.model,
                    temperature: 0.7,
                    systemMessage: ''
                };
                this.conversationManager.saveConversations();
            }
        }
        
        // 更新对话列表
        this.sidebarManager.renderConversationList();
        
        // 绑定断点删除按钮事件
        this.bindBreakpointDeleteEvents();
    }
    
    /**
     * 保存当前对话（如果需要）
     */
    saveCurrentConversationIfNeeded() {
        // 这个方法只是一个兼容层，在ConversationManager中已经在每次修改后自动保存
        // 不需要额外操作，但保留此方法以维持API兼容性
    }
    
    /**
     * 加载指定对话
     * @param {string} conversationId - 对话ID
     */
    loadConversation(conversationId) {
        // 如果正在生成内容，不允许切换对话
        if (this.isGenerating) {
            if (window.toast) {
                window.toast.warning('请等待当前回复生成完成再切换对话');
            }
            return;
        }
        
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
        // 如果正在生成内容，不允许创建新对话
        if (this.isGenerating) {
            if (window.toast) {
                window.toast.warning('请等待当前回复生成完成再创建新对话');
            }
            return;
        }
        
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
        
        // 检查是否正在生成
        if (this.isGenerating) return;
        
        // 检查API设置是否有效
        const apiKey = this.settingsManager.get('apiKey');
        if (!apiKey) {
            alert('请先在设置中配置API密钥，否则无法与AI对话');
            if (this.modalManager) {
                this.modalManager.openSettingsModal();
            }
            return;
        }

        // 执行消息发送前回调，如果有的话
        if (typeof this._beforeMessageSent === 'function') {
            const shouldContinue = this._beforeMessageSent();
            if (shouldContinue === false) return;
        }
        
        // 获取用户消息内容
        const userMessage = this.messageInput.value.trim();
        
        // 清空输入框
        this.messageInput.value = '';
        
        // 重置输入框高度
        this.messageInput.style.height = '40px';
        this.adjustTextareaHeight();
        
        // 检查上下文状态，如果上下文已关闭，在用户消息前添加断点标记
        const contextEnabled = this.settingsManager.get('contextEnabled');
        if (contextEnabled === false || contextEnabled === 'false') {
            // 设置断点
            if (this.conversationManager) {
                // 设置断点并获取是否成功
                const breakpointSet = this.conversationManager.setContextBreakpoint();
                
                if (breakpointSet) {
                    // 获取最新设置的断点位置
                    const breakpoints = this.conversationManager.getBreakpoints();
                    if (breakpoints.length > 0) {
                        const latestBreakpoint = Math.max(...breakpoints);
                        
                        // 创建断点元素
                        const breakpointElement = this.ChatMessageComponent.createContextBreakpoint(latestBreakpoint);
                        
                        // 在消息区域添加断点标记 - 修正插入位置
                        // 获取所有消息元素
                        const allMessages = this.chatMessages.querySelectorAll('.chat');
                        if (allMessages.length > 0) {
                            // 计算UI中正确的插入位置
                            // 获取消息列表中实际消息数量(不包括已有断点等非消息元素)
                            const messageElements = Array.from(allMessages).filter(el => !el.classList.contains('context-breakpoint'));
                            
                            // 找到正确的插入位置，确保我们插入在正确位置之后的第一条消息之前
                            // 如果latestBreakpoint恰好等于消息数量，则放在最后
                            if (latestBreakpoint >= messageElements.length) {
                                this.chatMessages.appendChild(breakpointElement);
                            } else {
                                // 找到对应位置的消息并在其前面插入断点
                                const targetMessage = messageElements[latestBreakpoint];
                                if (targetMessage) {
                                    this.chatMessages.insertBefore(breakpointElement, targetMessage);
                                } else {
                                    // 如果找不到对应位置（异常情况），则添加到末尾
                                    this.chatMessages.appendChild(breakpointElement);
                                }
                            }
                        } else {
                            // 如果没有消息，则添加到末尾
                            this.chatMessages.appendChild(breakpointElement);
                        }
                        
                        // 绑定断点删除事件
                        this.bindBreakpointDeleteEvents();
                    }
                }
            }
        }
        
        // 添加用户消息到界面
        const userMessageElement = this.messageHandler.addUserMessage(userMessage);
        
        // 强制滚动到底部，确保用户消息可见
        this.scrollToBottom(true);
        
        // 保存消息到当前对话 - 这里只添加用户消息
        const userMsg = this.conversationManager.addMessage('user', userMessage);
        
        // 记录用户消息索引便于后续更新
        const userIndex = this.conversationManager.getCurrentConversation().messages.length - 1;
        
        // 重要：设置用户消息的索引属性
        if (userMessageElement instanceof HTMLElement) {
            userMessageElement.dataset.index = userIndex.toString();
        }
        
        // 更新对话列表
        this.sidebarManager.renderConversationList();
        
        try {
            // 防止重复生成
            if (this.isGenerating) return;
            
            // 设置生成状态
            this.isGenerating = true;
            // 设置全局生成状态
            this.streamManager.setGlobalGeneratingState(true);
            
            // 更新UI状态 - 显示加载中状态
            this.sendButton.style.display = 'none';
            this.sendingIndicator.style.display = 'flex';
            this.showInterruptButton(true);
            
            // 禁用输入
            this.disableInput();
            
            // 重置之前的消息状态数据
            this._currentStreamContent = '';
            
            // 创建新的消息元素
            const { element: assistantElement, id: assistantId } = this.ChatMessageComponent.createAssistantMessage('', null, true);
            this.chatMessages.appendChild(assistantElement);
            this._lastAssistantMessageId = assistantId;
            
            // 助手消息暂时不设置索引属性，会在回复完成后设置
            
            // 强制再次滚动到底部，确保新添加的助手消息可见
            setTimeout(() => {
                this.scrollToBottom(true);
            }, 50);
            
            // 请求响应
            this.abortController = new AbortController();
            const signal = this.abortController.signal;
            
            // 获取当前对话的配置
            const currentConversation = this.conversationManager.getCurrentConversation();
            
            // 获取对话特定的模型或全局模型
            let selectedModel;
            if (currentConversation.config && currentConversation.config.model) {
                // 使用对话特定的模型
                const modelId = currentConversation.config.model;
                selectedModel = {
                    id: modelId,
                    name: this.modelManager.getModelNameById(modelId) || modelId
                };
            } else {
                // 使用全局模型
                selectedModel = this.modelManager.getSelectedModel();
                
                // 如果对话没有配置，初始化它
                if (!currentConversation.config) {
                    currentConversation.config = {
                        model: selectedModel.id,
                        temperature: 0.7,
                        systemMessage: ''
                    };
                    this.conversationManager.saveConversations();
                }
            }
            
            // 获取特定于对话的设置
            const config = {
                temperature: currentConversation.config?.temperature || 0.7,
                systemMessage: currentConversation.config?.systemMessage || ''
            };
            
            // 处理流式响应
            const handleStreamResponse = (chunk) => {
                if (signal.aborted) return;
                
                try {
                    // 更新流消息
                    this.streamManager.updateStreamMessage(assistantId, chunk);
                    
                    // 保存最新内容到临时变量，用于最终更新
                    this._currentStreamContent = chunk;
                    
                    // 尝试获取代码块，应用代码高亮和交互功能
                    this.codeBlockManager.updateCodeBlocks();
                    
                    // 滚动到底部
                    this.scrollToBottom();
                } catch (e) {
                    console.error('流式响应处理错误:', e);
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
                    
                    // 确保更新消息元素的内容属性
                    const assistantElement = document.getElementById(assistantId);
                    if (assistantElement) {
                        assistantElement.dataset.content = finalContent;
                    }
                    
                    // 现在才将AI的回复添加到对话管理器中
                    const assistantMsg = this.conversationManager.addMessage('assistant', finalContent);
                    const assistantIndex = this.conversationManager.getCurrentConversation().messages.length - 1;
                    
                    // 预估并显示token数量
                    this.updateTokenCount(assistantId, finalContent);
                    
                    // 结束消息后的回调
                    const handleStreamingComplete = () => {
                        // 重置生成状态
                        this.isGenerating = false;
                        this.streamManager.setGlobalGeneratingState(false);
                        this.abortController = null;
                        
                        // 恢复UI状态
                        this.sendButton.style.display = 'flex';
                        this.sendingIndicator.style.display = 'none';
                        
                        // 添加消息索引，用于编辑和删除
                        const assistantElement = document.getElementById(assistantId);
                        if (assistantElement) {
                            // 设置消息索引
                            assistantElement.dataset.index = assistantIndex.toString();
                        }
                        
                        // 更新UI状态 - 隐藏中断按钮，显示发送按钮
                        this.showInterruptButton(false);
                        
                        // 启用输入
                        this.enableInput();
                        
                        // 保存当前对话
                        if (this.conversationManager && typeof this.conversationManager.saveCurrentConversation === 'function') {
                            this.conversationManager.saveCurrentConversation();
                        } else {
                            // 兼容旧版保存方式
                            this.saveCurrentConversationIfNeeded();
                        }
                        
                        // 最终处理代码块
                        setTimeout(() => {
                            try {
                                // 应用代码高亮和交互功能
                                this.codeBlockManager.updateCodeBlocks();
                                this.ChatMessageComponent.applyCodeHighlightingToElement(assistantElement);
                                
                                // 添加预览功能到HTML代码块
                                this.formatter.addCodeInteractionButtons();
                                
                                // 重新初始化代码块UI和交互
                                if (this.codeBlockManager) {
                                    this.codeBlockManager.reinitializeCodeBlocks();
                                    this.codeBlockManager.setupCodeBlockInteractions();
                                }
                                
                                // 应用图片预览功能和重新绑定消息事件
                                if (this.messageHandler && typeof this.messageHandler.bindMessageEvents === 'function') {
                                    this.messageHandler.bindMessageEvents();
                                }
                                if (this.messageHandler && typeof this.messageHandler.setupImagePreviews === 'function') {
                                    this.messageHandler.setupImagePreviews();
                                }
                                
                                // 强制滚动到AI回复的底部，无论用户是否手动滚动过
                                setTimeout(() => {
                                    this.scrollToBottom(true);
                                    
                                    // 额外延迟再次滚动，确保所有内容渲染完毕后滚动到底部
                                    setTimeout(() => {
                                        this.scrollToBottom(true);
                                    }, 200);
                                }, 300);
                            } catch (e) {
                                console.error('流式响应完成后处理错误:', e);
                            }
                        }, 100);
                    };
                    
                    // 设置流动完成回调
                    this.streamManager.setAnimationCompleteCallback(handleStreamingComplete);
                    
                    // 直接执行一次回调，确保状态被重置
                    setTimeout(() => {
                        this.isGenerating = false;
                        this.streamManager.setGlobalGeneratingState(false);
                        this.showInterruptButton(false);
                        this.sendButton.style.display = 'flex';
                        this.sendingIndicator.style.display = 'none';
                        this.enableInput();
                    }, 500);
                } catch (e) {
                    // 确保状态正确重置
                    this.isGenerating = false;
                    this.streamManager.setGlobalGeneratingState(false);
                    this.showInterruptButton(false);
                    this.sendingIndicator.style.display = 'none';
                    this.sendButton.style.display = 'flex';
                    this.enableInput();
                }
            };
            
            // 错误处理函数
            const handleStreamError = (error) => {
                console.error('生成回复错误:', error);
                
                // 重置状态
                this.isGenerating = false;
                this.streamManager.setGlobalGeneratingState(false);
                this.showInterruptButton(false);
                this.sendingIndicator.style.display = 'none';
                this.sendButton.style.display = 'flex';
                this.enableInput();
                
                // 根据错误类型显示不同的错误消息
                let errorMsg = '⚠️ 生成回复时出现错误，请稍后再试。';
                
                // 处理特定的错误类型
                if (error.message && error.message.includes('empty array')) {
                    errorMsg = '⚠️ 消息内容为空，无法生成回复。请尝试添加一条用户消息后再试。';
                } else if (error.message && error.message.includes('API key')) {
                    errorMsg = '⚠️ API密钥无效或已过期，请在设置中更新您的API密钥。';
                } else if (error.message && error.message.includes('timeout')) {
                    errorMsg = '⚠️ 请求超时，服务器可能繁忙，请稍后再试。';
                }
                
                const errorElement = document.createElement('div');
                errorElement.className = 'error-message text-red-500 text-sm mt-1 ml-12';
                errorElement.textContent = errorMsg;
                
                // 添加错误到助手消息下方
                const msgElement = document.getElementById(assistantId);
                if (msgElement) {
                    // 清空内容区域显示友好的错误提示
                    const contentElement = msgElement.querySelector('.assistant-content');
                    if (contentElement) {
                        contentElement.innerHTML = `<div class="p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">${errorMsg}</div>`;
                    }
                    msgElement.appendChild(errorElement);
                } else {
                    // 如果找不到消息元素，使用toast显示错误
                    if (window.toast) {
                        window.toast.error(errorMsg);
                    }
                }
            };

            // 获取当前对话的所有消息
            const conversationMessages = this.conversationManager.getCurrentConversation().messages;
            
            // 验证上下文设置
            const contextEnabled = this.settingsManager.get('contextEnabled');
            
            // 确保消息格式正确，并过滤掉断点标记等非消息内容
            const formattedMessages = conversationMessages
                .filter(msg => 
                    msg.role && 
                    msg.content && 
                    ['user', 'assistant', 'system'].includes(msg.role) && 
                    !msg.isBreakpoint && 
                    !msg.type
                )
                .map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));
            
            // 确保最后添加的用户消息也包含在内
            // 这是一个额外的安全检查，防止消息数组为空
            let hasLatestUserMessage = false;
            if (formattedMessages.length > 0) {
                const lastMsg = formattedMessages[formattedMessages.length - 1];
                hasLatestUserMessage = lastMsg.role === 'user';
            }
            
            if (!hasLatestUserMessage && userMessage) {
                formattedMessages.push({
                    role: 'user',
                    content: userMessage
                });
            }
            
            // 发送API请求
            await this.apiClient.generateChatCompletion(
                formattedMessages,
                selectedModel.id,
                handleStreamResponse,
                handleStreamEnd,
                handleStreamError,
                signal,
                config
            );
        } catch (error) {
            console.error('发送消息错误:', error);
            
            // 重置状态
            this.isGenerating = false;
            this.streamManager.setGlobalGeneratingState(false);
            this.showInterruptButton(false);
            this.sendingIndicator.style.display = 'none';
            this.sendButton.style.display = 'flex';
            this.enableInput();
        }
    }
    
    /**
     * 停止生成
     */
    stopGeneration() {
        if (!this.isGenerating || !this.abortController) return;
        
        // 中止当前请求
        this.abortController.abort();
        
        // 获取当前已生成的内容 - 这部分在中断时需要保存
        const currentContent = this._currentStreamContent || '';
        
        // 获取助手消息ID和元素
        const assistantId = this._lastAssistantMessageId;
        const assistantElement = document.getElementById(assistantId);
        
        if (currentContent && assistantElement) {
            // 确保更新消息元素的内容属性
            assistantElement.dataset.content = currentContent;
            
            // 将中断时的内容添加到对话中
            const assistantMsg = this.conversationManager.addMessage('assistant', currentContent);
            const assistantIndex = this.conversationManager.getCurrentConversation().messages.length - 1;
            
            // 设置消息索引属性
            assistantElement.dataset.index = assistantIndex.toString();
            
            // 保存当前对话
            if (this.conversationManager && typeof this.conversationManager.saveCurrentConversation === 'function') {
                this.conversationManager.saveCurrentConversation();
            } else {
                // 兼容旧版方式
                this.conversationManager.saveConversations();
            }
            
            // 更新token计数
            this.updateTokenCount(assistantId, currentContent);
            
            // 标记元素不再处于生成状态
            assistantElement.removeAttribute('data-generating');
        }
        
        // 重置状态
        this.isGenerating = false;
        this._currentStreamContent = '';
        
        // 恢复UI状态
        this.sendButton.style.display = 'flex';
        this.sendingIndicator.style.display = 'none';
        
        // 隐藏中断按钮
        this.hideInterruptButton();
        
        // 恢复输入框
        this.enableInput();
        
        // 重置全局生成状态
        if (this.streamManager) {
            this.streamManager.setGlobalGeneratingState(false);
            this.streamManager.stopAllAnimations();
        }
        
        // 更新代码块样式
        if (window.codeBlockManager) {
            window.codeBlockManager.updateExistingCodeBlocksScroll();
        }
        
        // 显示提示
        if (window.toast) {
            window.toast.info('已停止生成');
        }
    }
    
    /**
     * 显示或隐藏中断按钮，同时控制发送按钮状态
     * @param {boolean} show - 是否显示中断按钮
     */
    showInterruptButton(show) {
        // 显示或隐藏中断按钮容器
        if (this.interruptButtonContainer) {
            this.interruptButtonContainer.style.display = show ? 'block' : 'none';
        }
        
        // 将this.isGenerating与UI状态同步
        this.isGenerating = show;
        
        // 更新全局生成状态
        document.body.classList.toggle('isGenerating', show);
    }
    
    /**
     * 隐藏中断按钮
     */
    hideInterruptButton() {
        if (this.interruptButtonContainer) {
            this.interruptButtonContainer.style.display = 'none';
        }
        
        // 移除生成中的全局状态类
        document.body.classList.remove('isGenerating');
    }
    
    /**
     * 添加用户滚动检测
     */
    setupScrollDetection() {
        if (!this.chatMessages) return;
        
        // 添加用户是否手动滚动的标志
        this.userHasScrolled = false;
        this.lastScrollTop = 0;
        this.scrollThreshold = 100; // 滚动阈值，超过这个值才判定为用户主动滚动
        
        // 监听滚动事件
        this.chatMessages.addEventListener('scroll', () => {
            // 当前滚动位置
            const currentScrollTop = this.chatMessages.scrollTop;
            
            // 最大可滚动距离
            const maxScrollTop = this.chatMessages.scrollHeight - this.chatMessages.clientHeight;
            
            // 如果用户往上滚动了超过阈值，标记为用户手动滚动
            if (maxScrollTop - currentScrollTop > this.scrollThreshold && 
                currentScrollTop < this.lastScrollTop) {
                if (!this.userHasScrolled) {
                    this.userHasScrolled = true;
                }
            }
            
            // 如果用户滚动到了接近底部，重新启用自动滚动
            if (maxScrollTop - currentScrollTop < 30) {
                if (this.userHasScrolled) {
                    this.userHasScrolled = false;
                }
            }
            
            // 更新上次滚动位置
            this.lastScrollTop = currentScrollTop;
        });
        
        // 添加鼠标滚轮事件监听，更精确地检测用户滚动意图
        this.chatMessages.addEventListener('wheel', (e) => {
            // 检测是否是向上滚动
            if (e.deltaY < 0) {
                this.userHasScrolled = true;
            }
            // 如果用户已经接近底部并向下滚动，重新启用自动滚动
            const maxScrollTop = this.chatMessages.scrollHeight - this.chatMessages.clientHeight;
            if (maxScrollTop - this.chatMessages.scrollTop < 30 && e.deltaY > 0) {
                this.userHasScrolled = false;
            }
        });
        
    }
    
    /**
     * 滚动到底部
     * @param {boolean} force - 是否强制滚动，即使用户手动滚动过也滚动
     * @param {number} delay - 可选的延迟时间(ms)
     */
    scrollToBottom(force = false, delay = 0) {
        const scrollFn = () => {
            if (!this.chatMessages) return;
            
            // 如果用户正在查看历史消息（手动滚动了）且不是强制滚动，则不自动滚动
            if (this.userHasScrolled && !force) {
                // 显示新消息提示
                this._showNewMessageIndicator();
                return;
            }
            
            // 确保计算正确的滚动高度
            const scrollHeight = this.chatMessages.scrollHeight;
            
            // 使用平滑滚动效果，提高用户体验
            this.chatMessages.scrollTo({
                top: scrollHeight,
                behavior: 'smooth'
            });
            
            // 添加备份滚动方法，确保在某些情况下滚动是有效的
            setTimeout(() => {
                if (this.chatMessages.scrollTop < scrollHeight - 50) {
                    this.chatMessages.scrollTop = scrollHeight;
                }
                
                // 再次检查并滚动，以防内容高度在此期间发生变化
                setTimeout(() => {
                    const updatedScrollHeight = this.chatMessages.scrollHeight;
                    if (this.chatMessages.scrollTop < updatedScrollHeight - 50) {
                        this.chatMessages.scrollTop = updatedScrollHeight;
                    }
                }, 100);
            }, 150);
        };
        
        if (delay > 0) {
            setTimeout(scrollFn, delay);
        } else {
            scrollFn();
        }
    }
    
    /**
     * 显示新消息提示
     * @private
     */
    _showNewMessageIndicator() {
        // 检查是否已经有提示
        let indicator = document.getElementById('new-message-indicator');
        
        if (!indicator) {
            // 创建一个新的提示元素
            indicator = document.createElement('div');
            indicator.id = 'new-message-indicator';
            indicator.className = 'fixed bottom-20 right-6 bg-openai-green text-white px-3 py-2 rounded-full shadow-lg cursor-pointer z-50 flex items-center';
            indicator.innerHTML = '<i class="fas fa-arrow-down mr-2"></i> 新消息';
            
            // 点击滚动到底部并移除提示
            indicator.addEventListener('click', () => {
                this.userHasScrolled = false;
                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
                indicator.remove();
            });
            
            document.body.appendChild(indicator);
            
            // 5秒后自动消失
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.remove();
                }
            }, 5000);
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
            // 更新旧版模型字段（兼容性）
            currentConversation.model = modelId;
            
            // 更新新版配置对象
            if (!currentConversation.config) {
                currentConversation.config = {
                    model: modelId,
                    temperature: 0.7,
                    systemMessage: ''
                };
            } else {
                currentConversation.config.model = modelId;
            }
            
            // 保存更改
            this.conversationManager.saveConversations();
        }
    }
    
    /**
     * 处理设置更新
     */
    handleSettingsUpdate() {
        // 这里可以实现设置更新后的逻辑
    }
    
    /**
     * 更新消息的token计数
     * @param {string} messageId - 消息ID
     * @param {string} content - 消息内容
     */
    updateTokenCount(messageId, content) {
        const tokenCountElement = document.querySelector(`#${messageId} .token-count`);
        if (tokenCountElement && tokenCountElement instanceof HTMLElement) {
            try {
                // 使用ChatMessageComponent的估算方法计算token数量
                const estimatedTokens = this.ChatMessageComponent.estimateTokenCount(content);
                // 更新UI显示
                tokenCountElement.textContent = `${estimatedTokens} tokens`;
                tokenCountElement.title = "估计的Token数量";
                // 移除"估算中..."状态
                tokenCountElement.classList.remove('estimating');
            } catch (e) {
                tokenCountElement.textContent = "计算错误";
            }
        } else {
        }
    }
    
    /**
     * 禁用输入框
     */
    disableInput() {
        if (this.messageInput) {
            this.messageInput.disabled = true;
            this.messageInput.style.opacity = '0.7';
        }
    }
    
    /**
     * 启用输入框
     */
    enableInput() {
        if (this.messageInput) {
            this.messageInput.disabled = false;
            this.messageInput.style.opacity = '1';
            
            // 重置输入框高度
            this.messageInput.style.height = '40px';
            this.adjustTextareaHeight();
            
            // AI回复结束后自动聚焦输入框
            setTimeout(() => {
                this.messageInput.focus();
            }, 100); // 短暂延迟确保UI更新完成
        }
    }
    
    /**
     * 打开设置模态框
     */
    openSettingsModal() {
        if (this.modalManager && typeof this.modalManager.openSettingsModal === 'function') {
            this.modalManager.openSettingsModal();
        }
    }
    
    /**
     * 设置消息发送前的回调函数
     * @param {Function} callback - 消息发送前的回调函数
     */
    setBeforeMessageSentCallback(callback) {
        if (typeof callback === 'function') {
            this._beforeMessageSent = callback;
        }
    }
    
    /**
     * 设置消息生成完成后的回调函数
     * @param {Function} callback - 消息生成完成后的回调函数
     */
    setMessageGeneratedCallback(callback) {
        if (typeof callback === 'function') {
            this._onMessageGenerated = callback;
        }
    }
    
    /**
     * 绑定断点删除按钮的点击事件
     */
    bindBreakpointDeleteEvents() {
        if (!this.chatMessages) return;
        
        // 使用事件代理绑定到消息容器
        this.chatMessages.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-breakpoint-btn');
            if (deleteBtn) {
                // 找到断点元素
                const breakpointEl = deleteBtn.closest('.context-breakpoint');
                if (breakpointEl && breakpointEl.dataset.breakpointIndex) {
                    const breakpointIndex = parseInt(breakpointEl.dataset.breakpointIndex);
                    
                    // 删除断点
                    const success = this.conversationManager.removeBreakpoint(breakpointIndex);
                    if (success) {
                        // 从UI中移除断点标记元素
                        breakpointEl.classList.add('animate__fadeOut');
                        setTimeout(() => {
                            breakpointEl.remove();
                            // 显示成功通知
                            if (window.toast) {
                                window.toast.success('断点已删除，上下文已重新连接');
                            }
                        }, 500);
                    }
                }
            }
        });
    }
} 