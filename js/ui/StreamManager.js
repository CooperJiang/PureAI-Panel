/**
 * 流式响应管理模块 - 负责处理流式响应的文本动画效果
 */
export class StreamManager {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {Object} options.chatComponent - 聊天消息组件
     * @param {Function} options.onScroll - 滚动回调函数
     */
    constructor(options) {
        this.chatComponent = options.chatComponent;
        this.onScroll = options.onScroll;
        
        // 流式动画数据
        this.streamAnimationData = null;
        
        // 完成时的回调
        this.onAnimationComplete = null;
        
        // 全局生成状态
        this.globalGeneratingState = false;
    }
    
    /**
     * 设置全局生成状态
     * @param {boolean} isGenerating - 是否正在生成
     */
    setGlobalGeneratingState(isGenerating) {
        if (this.globalGeneratingState === isGenerating) return;
        
        this.globalGeneratingState = isGenerating;
        
        // 设置body的生成状态类
        if (isGenerating) {
            document.body.classList.add('isGenerating');
        } else {
            document.body.classList.remove('isGenerating');
            
            // 强制代码块管理器重新初始化代码块高度
            if (window.codeBlockManager) {
                setTimeout(() => {
                    window.codeBlockManager.updateExistingCodeBlocksScroll();
                }, 300);
            }
        }
    }
    
    /**
     * 更新流式消息内容
     * @param {string} messageId - 消息ID
     * @param {string} content - 消息内容
     */
    updateStreamMessage(messageId, content) {
        const contentElement = document.getElementById(`content-${messageId}`);
        if (!contentElement) return;
            
        // 保存当前内容，用于检测变化并滚动
        const previousLength = contentElement.textContent?.length || 0;
        
        // 检查是否需要重置动画数据 - 如果消息ID不同，则创建新的动画数据
        if (this.streamAnimationData && this.streamAnimationData.messageId !== messageId) {
            console.log(`[流式渲染] 检测到新的消息ID: ${messageId}，重置动画数据`);
            this.streamAnimationData = null;
        }
        
        // 创建更丝滑的渲染功能 - 使用字符级动画
        if (!this.streamAnimationData) {
            this.streamAnimationData = {
                messageId: messageId,
                fullContent: '',
                displayedContent: '',
                formattedContent: '',
                isAnimating: false,
                lastUpdateTime: 0,
                charIndex: 0,
                charsPerFrame: 1,
                rawTextContent: '',      // 原始未格式化文本
                lastChar: '',            // 最后添加的字符
                renderedIndex: 0,        // 已渲染的字符索引
                needsRerender: false     // 是否需要完全重渲染
            };
            console.log('[流式渲染] 初始化动画数据');
        }
        
        // 检测内容变化量
        const previousContent = this.streamAnimationData.rawTextContent;
        const contentDelta = content.length - previousContent.length;
        
        // 更新要显示的完整内容
        this.streamAnimationData.fullContent = content;
        
        // 记录新增字符，用于增量渲染
        if (content.length > this.streamAnimationData.rawTextContent.length) {
            this.streamAnimationData.lastChar = content.substring(this.streamAnimationData.rawTextContent.length);
            
            // 如果新增内容很多，可能需要调整渲染速度
            if (contentDelta > 100) {
                console.log(`[流式渲染] 检测到大量新内容 (${contentDelta} 字符)，将动态调整渲染速度`);
                // 大量新内容，提高每帧渲染字符数
                this.streamAnimationData.charsPerFrame = Math.max(3, Math.min(10, Math.floor(contentDelta / 50)));
            } else {
                // 恢复正常渲染速度
                this.streamAnimationData.charsPerFrame = 1;
            }
        }
        
        this.streamAnimationData.rawTextContent = content;
        
        // 使用Markdown格式化器将内容格式化为HTML
        const formatter = this.chatComponent.formatter;
        this.streamAnimationData.formattedContent = formatter.formatMessage(content);
        
        // 如果内容已经很长且有大量未渲染字符，加速渲染以追赶
        const unrenderedChars = content.length - this.streamAnimationData.renderedIndex;
        if (content.length > 1000 && unrenderedChars > 500) {
            console.log(`[流式渲染] 未渲染字符过多 (${unrenderedChars})，加速渲染`);
            // 大幅提高渲染速度，但不立即跳到结尾
            this.streamAnimationData.renderedIndex += Math.min(200, unrenderedChars / 2);
        }
        
        // 如果没有正在动画，就开始动画
        if (!this.streamAnimationData.isAnimating) {
            this.streamAnimationData.isAnimating = true;
            // 只有在首次启动动画时才重置渲染索引
            if (this.streamAnimationData.renderedIndex === 0) {
                console.log('[流式渲染] 首次动画，从头开始渲染');
            } else {
                console.log(`[流式渲染] 恢复动画，当前渲染索引: ${this.streamAnimationData.renderedIndex}/${content.length}`);
            }
            this.animateText();
        }
            
        // 如果内容变长了，滚动到底部
        if (previousLength < (contentElement.textContent?.length || 0)) {
            this.scrollToBottom();
        }
    }
    
    /**
     * 逐字动画显示文本的函数
     */
    animateText() {
        // 确保流式动画数据存在
        if (!this.streamAnimationData) return;
        
        // 获取内容元素
        const contentElement = document.getElementById(`content-${this.streamAnimationData.messageId}`);
        if (!contentElement) {
            this.streamAnimationData.isAnimating = false;
            console.log('[流式渲染] 无法找到内容元素，停止动画');
            return;
        }
        
        const now = performance.now();
        
        // 控制动画速度 - 每帧渲染更少字符使动画更平滑
        if (now - this.streamAnimationData.lastUpdateTime < 30) { // 约33fps的更新率
            requestAnimationFrame(() => this.animateText());
            return;
        }
        
        this.streamAnimationData.lastUpdateTime = now;

        // 移除所有现有光标以避免多个光标
        const existingCursors = contentElement.querySelectorAll('.cursor-blink');
        existingCursors.forEach(cursor => cursor.remove());
        
        // 检查是否需要完全重渲染（遇到特殊格式时）
        const isSpecialFormat = this.streamAnimationData.rawTextContent.includes('```') || 
                               this.streamAnimationData.rawTextContent.includes('![') ||
                               this.streamAnimationData.rawTextContent.endsWith('*') ||
                               this.streamAnimationData.rawTextContent.endsWith('_') ||
                               this.streamAnimationData.rawTextContent.endsWith('`');
        
        if (isSpecialFormat || this.streamAnimationData.needsRerender) {
            // 对于特殊格式，完全重新渲染以确保正确格式化
            console.log('[流式渲染] 检测到特殊格式，执行完全重渲染');
            this.streamAnimationData.needsRerender = false;
            
            // 增加渲染索引 - 特殊格式时增加更多字符以加快渲染
            const charsToAdd = isSpecialFormat ? 5 : this.streamAnimationData.charsPerFrame;
            this.streamAnimationData.renderedIndex += charsToAdd;
            
            // 如果是代码块结束，立即渲染整个内容
            if (this.streamAnimationData.rawTextContent.endsWith('```')) {
                console.log('[流式渲染] 检测到代码块结束，立即渲染完整内容');
                this.streamAnimationData.renderedIndex = this.streamAnimationData.rawTextContent.length;
            }
            
            // 限制索引不超过内容长度
            if (this.streamAnimationData.renderedIndex > this.streamAnimationData.rawTextContent.length) {
                this.streamAnimationData.renderedIndex = this.streamAnimationData.rawTextContent.length;
            }
            
            // 截取到当前索引的内容
            const partialText = this.streamAnimationData.rawTextContent.substring(0, this.streamAnimationData.renderedIndex);
            
            // 格式化并显示
            contentElement.innerHTML = this.chatComponent.formatter.formatMessage(partialText);
            
            console.log(`[流式渲染] 渲染索引: ${this.streamAnimationData.renderedIndex}/${this.streamAnimationData.rawTextContent.length}`);
        } else {
            // 增加渲染索引 - 普通文本时使用动态渲染速度
            // 根据剩余内容长度动态调整速度 - 内容越长，速度越快
            const remainingChars = this.streamAnimationData.rawTextContent.length - this.streamAnimationData.renderedIndex;
            let charsPerFrame = this.streamAnimationData.charsPerFrame;
            
            // 动态调整速度
            if (remainingChars > 1000) {
                charsPerFrame = 10; // 非常长的内容，快速渲染
            } else if (remainingChars > 500) {
                charsPerFrame = 5;  // 长内容
            } else if (remainingChars > 200) {
                charsPerFrame = 3;  // 中等内容
            } else {
                charsPerFrame = 1;  // 较短内容，慢速渲染
            }
            
            this.streamAnimationData.renderedIndex += charsPerFrame;
            
            // 限制索引不超过内容长度
            if (this.streamAnimationData.renderedIndex > this.streamAnimationData.rawTextContent.length) {
                this.streamAnimationData.renderedIndex = this.streamAnimationData.rawTextContent.length;
            }
            
            // 截取到当前索引的内容并显示
            const partialText = this.streamAnimationData.rawTextContent.substring(0, this.streamAnimationData.renderedIndex);
            
            // 为简单文本使用更高效的渲染方式
            contentElement.innerHTML = this.chatComponent.formatter.formatMessage(partialText);
            
            if (this.streamAnimationData.renderedIndex % 10 === 0) {
                console.log(`[流式渲染] 渲染索引: ${this.streamAnimationData.renderedIndex}/${this.streamAnimationData.rawTextContent.length}`);
            }
        }

        // 如果动画仍在进行且未完成，添加光标
        if (this.streamAnimationData.isAnimating && 
            this.streamAnimationData.renderedIndex < this.streamAnimationData.rawTextContent.length) {
            // 添加光标
            const cursorElement = document.createElement('span');
            cursorElement.className = 'cursor-blink';
            contentElement.appendChild(cursorElement);
        }
        
        // 如果特殊格式标记或代码块开始，设置标记以进行完全重渲染
        if (this.streamAnimationData.rawTextContent.substr(this.streamAnimationData.renderedIndex - 3, 3) === '```' ||
            this.streamAnimationData.rawTextContent.substr(this.streamAnimationData.renderedIndex - 2, 2) === '![') {
            this.streamAnimationData.needsRerender = true;
            console.log('[流式渲染] 检测到格式开始标记，标记需要重渲染');
        }
        
        // 应用代码高亮和其他功能（仅当内容发生变化时）
        try {
            const formatter = this.chatComponent.formatter;
            formatter.addCodeInteractionButtons();
            this.chatComponent.applyCodeHighlightingToElement(contentElement);
        } catch (error) {
            console.error('[流式渲染] 应用代码高亮失败:', error);
        }
        
        // 处理图片预览
        try {
            const imageViewer = window['imageViewer'];
            if (imageViewer && typeof imageViewer.setupImagePreviews === 'function') {
                imageViewer.setupImagePreviews();
            }
        } catch (e) {
            console.error('[流式渲染] 设置图片预览失败:', e);
        }
        
        // 只应用一次HTML预览框架
        try {
            const htmlPreview = window["htmlPreview"];
            if (htmlPreview && typeof window.chatUI !== 'undefined' && !window.chatUI.didInitPreview) {
                if (typeof htmlPreview.setAutoPreview === 'function') {
                    htmlPreview.setAutoPreview(false);
                }
                if (typeof htmlPreview.addPreviewButtonsToHtmlBlocks === 'function') {
                    htmlPreview.addPreviewButtonsToHtmlBlocks(false);
                    window.chatUI.didInitPreview = true;
                }
            }
        } catch (e) {
            console.error('[流式渲染] 应用HTML预览失败:', e);
        }
        
        // 更新Token计数
        const tokenCountElement = document.querySelector(`#${this.streamAnimationData.messageId} .token-count`);
        if (tokenCountElement && tokenCountElement instanceof HTMLElement) {
            const estimatedTokens = this.chatComponent.estimateTokenCount(this.streamAnimationData.fullContent);
            tokenCountElement.textContent = `${estimatedTokens} tokens`;
            tokenCountElement.title = "估计的Token数量（将在完成后更新）";
        }
        
        // 滚动到底部
        this.scrollToBottom();
        
        // 检查动画是否完成
        if (this.streamAnimationData.renderedIndex >= this.streamAnimationData.rawTextContent.length) {
            console.log('[流式渲染] 动画完成');
            
            // 确保显示完整内容
            if (this.streamAnimationData.fullContent !== this.streamAnimationData.rawTextContent) {
                console.log('[流式渲染] 检测到可能的内容不匹配，强制显示完整内容');
                contentElement.innerHTML = this.chatComponent.formatter.formatMessage(this.streamAnimationData.fullContent);
            }
            
            // 移除所有光标元素
            document.querySelectorAll(`#${this.streamAnimationData.messageId} .cursor-blink`).forEach(el => el.remove());
            
            this.streamAnimationData.isAnimating = false;
            
            // 如果有完成回调，调用它
            if (this.onAnimationComplete && typeof this.onAnimationComplete === 'function') {
                console.log('[流式渲染] 调用动画完成回调');
                this.onAnimationComplete(this.streamAnimationData.messageId, this.streamAnimationData.fullContent);
            }
            
            return;
        }
        
        // 请求下一帧动画
        if (this.streamAnimationData.isAnimating) {
            requestAnimationFrame(() => this.animateText());
        } else {
            // 如果动画被外部停止，确保删除所有光标
            document.querySelectorAll(`#${this.streamAnimationData.messageId} .cursor-blink`).forEach(el => el.remove());
        }
    }
    
    /**
     * 滚动到底部
     */
    scrollToBottom() {
        if (this.onScroll && typeof this.onScroll === 'function') {
            this.onScroll();
        }
    }
    
    /**
     * 清除光标
     * @param {string} messageId - 可选的消息ID，如果提供则只清除该消息中的光标
     */
    clearCursors(messageId) {
        if (messageId) {
            document.querySelectorAll(`#${messageId} .cursor-blink`).forEach(el => el.remove());
        } else {
            document.querySelectorAll('.cursor-blink').forEach(el => el.remove());
        }
    }
    
    /**
     * 停止所有动画
     */
    stopAllAnimations() {
        // 停止动画
        if (this.streamAnimationData) {
            this.streamAnimationData.isAnimating = false;
            console.log(`[流式渲染] 停止动画：${this.streamAnimationData.messageId}`);
            
            // 移除生成中的全局状态类
            document.body.classList.remove('isGenerating');
            
            // 为安全确保清除所有光标
            if (this.streamAnimationData.messageId) {
                this.clearCursors(this.streamAnimationData.messageId);
            }
            
            // 保存最终的渲染进度，方便外部检查
            const finalProgress = this.getRenderingProgress();
            this.streamAnimationData = null;
            
            // 在控制台记录最终渲染进度
            if (finalProgress) {
                console.log(`[流式渲染] 最终渲染进度: ${finalProgress.percentage.toFixed(1)}%`);
            }
        }
    }
    
    /**
     * 检查动画是否正在渲染中
     * @returns {boolean} 是否正在渲染中
     */
    isAnimating() {
        return this.streamAnimationData && this.streamAnimationData.isAnimating;
    }
    
    /**
     * 获取渲染进度信息
     * @returns {Object|null} 渲染进度信息
     */
    getRenderingProgress() {
        if (!this.streamAnimationData) return null;
        
        return {
            messageId: this.streamAnimationData.messageId,
            renderedIndex: this.streamAnimationData.renderedIndex,
            totalLength: this.streamAnimationData.rawTextContent.length,
            percentage: this.streamAnimationData.rawTextContent.length > 0 
                ? (this.streamAnimationData.renderedIndex / this.streamAnimationData.rawTextContent.length) * 100 
                : 0,
            isAnimating: this.streamAnimationData.isAnimating
        };
    }
    
    /**
     * 设置动画完成时的回调
     * @param {Function} callback - 完成回调
     */
    setAnimationCompleteCallback(callback) {
        this.onAnimationComplete = callback;
    }
    
    /**
     * 完成流式响应
     * @param {string} messageId - 消息ID
     * @param {string} finalContent - 最终内容
     */
    completeStreaming(messageId, finalContent) {
        console.log(`[流式渲染] 完成流式响应 ${messageId}`);
        
        // 停止所有动画
        this.stopAllAnimations();
        
        // 移除生成中的全局状态类
        document.body.classList.remove('isGenerating');
        
        // 获取内容元素
        const contentElement = document.getElementById(`content-${messageId}`);
        if (!contentElement) {
            console.warn(`[流式渲染] 无法找到内容元素 #content-${messageId}`);
            return;
        }
        
        // 清除所有光标
        this.clearCursors(messageId);
        
        // 设置最终内容
        try {
            // 使用最终内容进行渲染
            contentElement.innerHTML = this.chatComponent.formatter.formatMessage(finalContent);
            
            // 应用代码高亮
            this.chatComponent.applyCodeHighlightingToElement(contentElement.closest('.chat'));
            
            // 添加代码交互按钮
            this.chatComponent.formatter.addCodeInteractionButtons();
            
            // 触发回调
            if (typeof this.onAnimationComplete === 'function') {
                this._executeCallback(messageId, finalContent);
            }
        } catch (error) {
            console.error(`[流式渲染] 完成流式响应时出错:`, error);
        }
    }
    
    /**
     * 执行回调函数的辅助方法
     * @param {string} messageId - 消息ID
     * @param {string} finalContent - 最终内容
     * @private
     */
    _executeCallback(messageId, finalContent) {
        // 保存回调引用并清除原始引用
        const callback = this.onAnimationComplete;
        
        // 重要：清空回调引用，防止递归调用
        this.onAnimationComplete = null;
        
        // 分离回调执行，确保其在当前函数栈完成后才执行
        if (callback && typeof callback === 'function') {
            console.log('[流式响应] 安排动画完成回调异步执行');
            
            // 使用Promise并添加延迟执行回调，彻底避免递归调用
            Promise.resolve().then(() => {
                // 确保回调调用前检查状态，防止多次调用
                try {
                    console.log(`[流式响应] 执行异步回调，消息ID: ${messageId}`);
                    callback(messageId, finalContent);
                } catch (error) {
                    console.error('[流式响应] 回调执行出错:', error);
                }
            });
        }
    }
    
    /**
     * 动画是否在运行
     * @returns {boolean} 是否有动画在运行
     */
    hasRunningAnimation() {
        return this.streamAnimationData !== null && this.streamAnimationData.isAnimating;
    }
} 