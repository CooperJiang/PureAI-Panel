// 聊天消息组件
import { MessageFormatter } from '../js/utils.js';

/**
 * @typedef {Object} HtmlPreview
 * @method addPreviewButtonsToHtmlBlocks
 * 
 * @typedef {Object} Toast
 * @method success
 * @method error
 * @method info
 * 
 * @typedef {Object} WindowWithExtensions
 * @property {HtmlPreview} htmlPreview
 * @property {Toast} toast
 */

export class ChatMessageComponent {
    static formatter = new MessageFormatter();
    
    /**
     * 创建上下文断点标记
     * @param {number} breakpointIndex - 断点的索引位置
     * @returns {HTMLElement} 断点标记元素
     */
    static createContextBreakpoint(breakpointIndex) {
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
    
    static createUserMessage(content) {
        const messageElement = document.createElement('div');
        messageElement.className = 'chat chat-end animate__animated animate__fadeIn group';
        messageElement.dataset.content = content;
        
        const timestamp = new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});
        
        messageElement.innerHTML = `
            <div class="chat-row">
                <div class="chat-bubble">
                    <div class="markdown-content text-sm leading-snug">
                        ${this.formatter.formatMessage(content)}
                    </div>
                </div>
                <div class="chat-image avatar flex items-center justify-center">
                    <div class="w-8 h-8 rounded-full bg-openai-green flex items-center justify-center overflow-hidden">
                        <i class="fas fa-user text-white text-xs"></i>
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-1 text-openai-gray text-xs mt-1 ml-auto mr-11">
                <span class="message-time">${timestamp}</span>
                <div class="message-actions opacity-0 transition-opacity group-hover:opacity-100">
                    <button class="edit-message-btn p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="编辑消息">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button class="delete-message-btn p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="删除消息">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                    <button class="copy-message-btn p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="复制内容">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
        `;
        
        // 添加代码块交互按钮并应用语法高亮
        setTimeout(() => {
            this.formatter.addCodeInteractionButtons();
            this.applyCodeHighlightingToElement(messageElement);
        }, 10);
        
        return messageElement;
    }
    
    static createAssistantMessage(content, formatter = this.formatter, isStream = false) {
        const messageId = 'msg-' + Date.now();
        const messageElement = document.createElement('div');
        messageElement.className = 'chat chat-start animate__animated animate__fadeIn group';
        messageElement.id = messageId;
        if (content) messageElement.dataset.content = content;
        
        const timestamp = new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});
        const tokenCount = content ? this.estimateTokenCount(content) : 0;
        
        messageElement.innerHTML = `
            <div class="chat-row">
                <div class="chat-image avatar flex items-center justify-center">
                    <div class="w-8 h-8 rounded-full bg-black flex items-center justify-center overflow-hidden">
                        <i class="fas fa-robot text-white text-xs"></i>
                    </div>
                </div>
                <div class="chat-bubble">
                    <div id="content-${messageId}" class="markdown-content text-sm leading-snug">
                        ${content ? this.formatter.formatMessage(content) : ''}
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-1 text-openai-gray text-xs mt-1 ml-11">
                <span class="message-time">${timestamp}</span>
                <span class="token-count" title="Token数量">${tokenCount > 0 ? `${tokenCount} tokens` : ''}</span>
                <div class="message-actions opacity-0 transition-opacity group-hover:opacity-100">
                    <button class="edit-message-btn p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="编辑回复">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button class="delete-message-btn p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="删除回复">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                    <button class="copy-message-btn p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="复制内容">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
        `;
        
        // 添加代码块交互按钮
        setTimeout(() => {
            // 为新生成的代码块添加复制和预览按钮
            this.formatter.addCodeInteractionButtons();
            
            // 如果不是流式响应，立即执行语法高亮
            if (!isStream && content) {
                this.applyCodeHighlighting(messageId);
            }
        }, 10);
        
        return { element: messageElement, id: messageId };
    }
    
    static createWelcomeMessage() {
        const messageElement = document.createElement('div');
        messageElement.className = 'chat chat-start animate__animated animate__fadeIn welcome-message';
        
        messageElement.innerHTML = `
            <div class="chat-image avatar flex items-center justify-center">
                <div class="w-8 h-8 rounded-full bg-black flex items-center justify-center overflow-hidden">
                    <i class="fas fa-robot text-white text-xs"></i>
                </div>
            </div>
            <div class="chat-bubble">
                <div class="markdown-content">
                    <div class="flex flex-col gap-2">
                        <p>你好！我是 AI 助手，有什么可以帮到你的？</p>
                        <div class="text-xs opacity-70 welcome-hint">
                            💡 提示：您可以在顶部选择不同的模型，左侧查看历史对话
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        return messageElement;
    }
    
    // 为完成的消息应用代码高亮
    static applyCodeHighlighting(messageId) {
        const contentElement = document.getElementById(`content-${messageId}`);
        if (!contentElement) return;
        
        this.applyCodeHighlightingToElement(contentElement);
    }
    
    // 为元素内的所有代码块应用高亮
    static applyCodeHighlightingToElement(element) {
        // 查找所有代码块并应用高亮
        const codeBlocks = element.querySelectorAll('pre code');
        if (codeBlocks.length === 0) return;
        
        // @ts-ignore
        if (typeof hljs !== 'undefined') {
            codeBlocks.forEach(block => {
                try {
                    // @ts-ignore
                    hljs.highlightElement(block);
                } catch (e) {
                }
            });
        }
        
        // 尝试应用HTML预览 - 安全调用
        try {
            setTimeout(() => {
                const previewObj = window['htmlPreview'];
                if (previewObj && typeof previewObj.addPreviewButtonsToHtmlBlocks === 'function') {
                    previewObj.addPreviewButtonsToHtmlBlocks();
                }
            }, 100);
        } catch (e) {
        }
    }
    
    // 估算Token数量 (简单估算，实际数量可能有差异)
    static estimateTokenCount(text) {
        if (!text) return 0;
        
        try {
            // 一个更精确的token估算算法
            // 英文单词约等于每个单词0.75个token
            // 中文字符约等于每个字符1.5个token
            const english = (text.match(/[a-zA-Z]+/g) || []).join('').length;
            const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
            const numbers = (text.match(/\d+/g) || []).join('').length;
            const spaces = (text.match(/\s+/g) || []).join('').length;
            const punctuation = text.length - english - chinese - numbers - spaces;
            
            // 估算token数量
            const englishTokens = english * 0.25; // 英文字符
            const chineseTokens = chinese * 1.5;  // 中文字符
            const numberTokens = numbers * 0.25;  // 数字
            const spaceTokens = spaces * 0.15;    // 空格
            const punctTokens = punctuation * 0.5; // 标点和其他字符
            
            const totalTokens = Math.round(englishTokens + chineseTokens + numberTokens + spaceTokens + punctTokens);
            
            return totalTokens;
        } catch (e) {
            // 备用方案 - 简单估算
            return Math.round(text.length * 0.75);
        }
    }
} 