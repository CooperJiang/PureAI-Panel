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
    
    static createUserMessage(content) {
        const messageElement = document.createElement('div');
        messageElement.className = 'chat chat-end animate__animated animate__fadeIn';
        messageElement.dataset.content = content;
        
        const timestamp = new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});
        
        messageElement.innerHTML = `
            <div class="chat-row">
                <div class="chat-bubble">
                    ${this.formatter.formatMessage(content)}
                </div>
                <div class="chat-image avatar flex items-center justify-center">
                    <div class="w-8 h-8 rounded-full bg-openai-green flex items-center justify-center overflow-hidden">
                        <i class="fas fa-user text-white text-xs"></i>
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-1 text-openai-gray text-xs mt-1 ml-auto mr-11">
                <span class="message-time">${timestamp}</span>
                <div class="message-actions">
                    <button class="edit-message-btn" title="编辑消息">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button class="delete-message-btn" title="删除消息">
                        <i class="fas fa-trash-alt"></i>
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
        messageElement.className = 'chat chat-start animate__animated animate__fadeIn';
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
                    <div id="content-${messageId}" class="markdown-content">
                        ${content ? this.formatter.formatMessage(content) : ''}
                        ${isStream ? '<span class="cursor-blink"></span>' : ''}
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-1 text-openai-gray text-xs mt-1 ml-11">
                <span class="message-time">${timestamp}</span>
                <span class="token-count" title="Token数量">${tokenCount > 0 ? `${tokenCount} tokens` : ''}</span>
                <div class="message-actions">
                    <button class="edit-message-btn" title="编辑回复">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button class="delete-message-btn" title="删除回复">
                        <i class="fas fa-trash-alt"></i>
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
                    console.error('代码高亮失败:', e);
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
            console.error('应用HTML预览失败:', e);
        }
    }
    
    // 估算Token数量 (简单估算，实际数量可能有差异)
    static estimateTokenCount(text) {
        // 英文单词约等于每个单词0.75个token
        // 中文字符约等于每个字符1.5个token
        const english = text.match(/[a-zA-Z]+/g) || [];
        const chinese = text.match(/[\u4e00-\u9fa5]/g) || [];
        const englishTokens = english.join(' ').split(' ').length * 0.75;
        const chineseTokens = chinese.length * 1.5;
        
        // 加上符号、数字等其他字符，粗略估计每个0.25个token
        const other = text.length - (english.join('').length + chinese.length);
        const otherTokens = other * 0.25;
        
        return Math.round(englishTokens + chineseTokens + otherTokens);
    }
} 