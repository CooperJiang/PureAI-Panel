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
        
        if (isGenerating) {
            document.body.classList.add('isGenerating');
        } else {
            document.body.classList.remove('isGenerating');
            
            // 更新所有代码块状态
            if (window.codeBlockManager) {
                window.codeBlockManager.updateExistingCodeBlocksHeight();
            }
            
            // 如果当前存在消息ID，处理该消息中的代码块
            if (this.streamAnimationData && this.streamAnimationData.messageId) {
                const messageElement = document.getElementById(this.streamAnimationData.messageId);
                if (messageElement) {
                    messageElement.setAttribute('data-generating', 'false');
                    
                    // 更新消息中的代码块状态
                    messageElement.querySelectorAll('pre.code-block-container').forEach(pre => {
                        pre.setAttribute('data-generating', 'false');
                    });
                }
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
        
        // 如果是新的消息，初始化状态
        if (!this.streamAnimationData || this.streamAnimationData.messageId !== messageId) {
            this.streamAnimationData = {
                messageId: messageId,
                fullContent: '',
                displayedContent: '',
                formattedContent: '',
                isAnimating: false,
                lastUpdateTime: 0,
                charIndex: 0,
                charsPerFrame: 1,
                rawTextContent: '',
                lastChar: '',
                renderedIndex: 0,
                needsRerender: false
            };
            
            // 设置消息生成状态
            const messageElement = document.getElementById(messageId);
            if (messageElement) {
                messageElement.setAttribute('data-generating', 'true');
                
                // 设置代码块容器状态
                messageElement.querySelectorAll('pre').forEach(pre => {
                    // 确保添加了code-block-container类
                    if (!pre.classList.contains('code-block-container')) {
                        pre.classList.add('code-block-container');
                    }
                    pre.setAttribute('data-generating', 'true');
                });
            }
        }
        
        // 更新内容
        this.streamAnimationData.fullContent = content;
        
        // 使用Markdown格式化器将内容格式化为HTML
        const formatter = this.chatComponent.formatter;
        const formattedContent = formatter.formatMessage(content);
        
        // 更新内容
        contentElement.innerHTML = formattedContent;
        
        // 为新内容中的代码块添加交互按钮和高亮
        formatter.addCodeInteractionButtons();
        this.chatComponent.applyCodeHighlightingToElement(contentElement);
        
        // 处理图片预览 - 检查是否存在此方法
        if (formatter.setupImagePreviews && typeof formatter.setupImagePreviews === 'function') {
            formatter.setupImagePreviews();
        } else if (window.imageViewer && typeof window.imageViewer.setupImagePreviews === 'function') {
            window.imageViewer.setupImagePreviews();
        }
        
        // 更新Token计数
        const tokenCountElement = document.querySelector(`#${messageId} .token-count`);
        if (tokenCountElement && tokenCountElement instanceof HTMLElement) {
            const estimatedTokens = this.chatComponent.estimateTokenCount(content);
            tokenCountElement.textContent = `${estimatedTokens} tokens`;
            tokenCountElement.title = "估计的Token数量（将在完成后更新）";
        }
        
        this.scrollToBottom();
    }
    
    /**
     * 执行流式文本动画
     */
    animateText() {
        // 确保streamAnimationData存在
        if (!this.streamAnimationData) return;
        
        // 获取消息内容元素
        const contentElement = document.getElementById(`content-${this.streamAnimationData.messageId}`);
        if (!contentElement) {
            // 如果无法找到内容元素，停止动画
            this.streamAnimationData.isAnimating = false;
            return;
        }
        
        // 如果此时动画结束，退出
        if (!this.streamAnimationData.isAnimating) {
            return;
        }
        
        // 获取文本内容长度
        const contentLength = this.streamAnimationData.rawTextContent.length;
        
        // 确保滚动到底部
        this.scrollToBottom();
        
        // 根据剩余文本长度动态调整渲染速度
        let frameInterval = 16; // 1000ms / 60fps ≈ 16.7ms
        
        // 防止过于频繁的DOM更新
        const now = Date.now();
        if (!this.streamAnimationData.lastUpdateTime) {
            this.streamAnimationData.lastUpdateTime = now - frameInterval;
        }
        
        // 限制帧率，避免性能问题
        if (now - this.streamAnimationData.lastUpdateTime < frameInterval) {
            // 如果还在动画中，请求下一帧
            if (this.streamAnimationData.isAnimating) {
                requestAnimationFrame(() => this.animateText());
            }
            return;
        }
        this.streamAnimationData.lastUpdateTime = now;
        
        // 检查特殊格式，如代码块、图片链接等需要完全渲染的情况
        const isSpecialFormat = this.streamAnimationData && (
            this.streamAnimationData.rawTextContent.includes('```') ||
            this.streamAnimationData.rawTextContent.includes('![') ||
            this.streamAnimationData.rawTextContent.endsWith('*') ||
            this.streamAnimationData.rawTextContent.endsWith('_') ||
            this.streamAnimationData.rawTextContent.endsWith('`')
        );
        
        // 检查是否有未完成的代码块
        const hasUncompletedCodeBlock = (
            this.streamAnimationData && 
            this.streamAnimationData.rawTextContent.includes('```') && 
            this.streamAnimationData.rawTextContent.substring(0, this.streamAnimationData.renderedIndex) && 
            !this.streamAnimationData.rawTextContent.substring(0, this.streamAnimationData.renderedIndex).endsWith('```')
        );
        
        // 处理特殊格式或需要重新渲染的情况
        if ((isSpecialFormat || (this.streamAnimationData && this.streamAnimationData.needsRerender)) && this.streamAnimationData) {
            // 标记已重新渲染
            this.streamAnimationData.needsRerender = false;
            
            // 更快地渲染特殊格式
            let charsToAdd = isSpecialFormat ? 5 : this.streamAnimationData.charsPerFrame;
            
            // 确保代码块能够快速完整渲染
            if (hasUncompletedCodeBlock) {
                // 查找未完成代码块的结束位置
                const codeBlockStart = this.streamAnimationData.rawTextContent.lastIndexOf('```', this.streamAnimationData.renderedIndex);
                if (codeBlockStart !== -1) {
                    const codeBlockEnd = this.streamAnimationData.rawTextContent.indexOf('```', codeBlockStart + 3);
                    if (codeBlockEnd !== -1 && codeBlockEnd > this.streamAnimationData.renderedIndex) {
                        // 快速渲染到代码块结束
                        charsToAdd = codeBlockEnd + 3 - this.streamAnimationData.renderedIndex;
                    }
                }
            }
            
            // 更新已渲染的字符索引
            if (this.streamAnimationData) {
                this.streamAnimationData.renderedIndex += charsToAdd;
                
                // 对于以```结尾的代码块，直接显示完整内容
                if (this.streamAnimationData.rawTextContent.endsWith('```')) {
                    this.streamAnimationData.renderedIndex = this.streamAnimationData.rawTextContent.length;
                }
                
                // 确保不超过内容长度
                if (this.streamAnimationData.renderedIndex > this.streamAnimationData.rawTextContent.length) {
                    this.streamAnimationData.renderedIndex = this.streamAnimationData.rawTextContent.length;
                }
                
                // 获取部分文本并格式化显示
                const partialText = this.streamAnimationData.rawTextContent.substring(0, this.streamAnimationData.renderedIndex);
                contentElement.innerHTML = this.chatComponent.formatter.formatMessage(partialText);
                
                // 定期应用代码高亮，减轻性能负担
                if (this.streamAnimationData.renderedIndex % 20 === 0 ||
                    this.streamAnimationData.renderedIndex === this.streamAnimationData.rawTextContent.length) {
                    this.chatComponent.applyCodeHighlightingToElement(contentElement.closest('.chat'));
                }
            }
        } else if (this.streamAnimationData) {
            // 标准文本逐字渲染
            const remainingChars = this.streamAnimationData.rawTextContent.length - this.streamAnimationData.renderedIndex;
            let charsPerFrame = this.streamAnimationData.charsPerFrame;
            
            // 根据剩余字符动态调整速度
            if (remainingChars < 100) {
                // 接近结尾时放慢速度
                charsPerFrame = Math.max(1, Math.min(charsPerFrame, Math.ceil(remainingChars / 20)));
            } else if (remainingChars > 1000) {
                // 对于长文本加速
                charsPerFrame = Math.min(20, charsPerFrame * 1.5);
            }
            
            // 避免在通常的阅读位置（句末）过快
            const nextChar = this.streamAnimationData.rawTextContent.charAt(this.streamAnimationData.renderedIndex);
            if ('.!?。！？'.includes(nextChar)) {
                // 句子结束时短暂放慢一点
                charsPerFrame = Math.max(1, charsPerFrame / 2);
            }
            
            // 更新已渲染的字符索引
            this.streamAnimationData.renderedIndex += charsPerFrame;
            
            // 确保不超过内容长度
            if (this.streamAnimationData.renderedIndex > this.streamAnimationData.rawTextContent.length) {
                this.streamAnimationData.renderedIndex = this.streamAnimationData.rawTextContent.length;
            }
            
            // 获取部分文本并格式化显示
            const partialText = this.streamAnimationData.rawTextContent.substring(0, this.streamAnimationData.renderedIndex);
            contentElement.innerHTML = this.chatComponent.formatter.formatMessage(partialText);
            
            // 定期应用代码高亮，减轻性能负担
            if (this.streamAnimationData.renderedIndex % 50 === 0 ||
                this.streamAnimationData.renderedIndex === this.streamAnimationData.rawTextContent.length) {
                this.chatComponent.applyCodeHighlightingToElement(contentElement.closest('.chat'));
            }
        }

        // 如果特殊格式标记或代码块开始，设置标记以进行完全重渲染
        if (this.streamAnimationData.rawTextContent.substr(this.streamAnimationData.renderedIndex - 3, 3) === '```' ||
            this.streamAnimationData.rawTextContent.substr(this.streamAnimationData.renderedIndex - 2, 2) === '![') {
            this.streamAnimationData.needsRerender = true;
        }
        
        // 检查动画是否完成
        if (this.streamAnimationData && this.streamAnimationData.renderedIndex >= this.streamAnimationData.rawTextContent.length) {
            
            // 添加轻微延迟，确保最后部分内容有时间显示
            setTimeout(() => {
                // 确保流数据仍然存在（可能在延迟期间被外部清除）
                if (this.streamAnimationData) {
                    // 确保显示完整内容
                    if (this.streamAnimationData.fullContent !== this.streamAnimationData.rawTextContent) {
                        contentElement.innerHTML = this.chatComponent.formatter.formatMessage(this.streamAnimationData.fullContent);
                    }
                    
                    // 保存最终消息ID和内容，因为我们即将清除streamAnimationData
                    const messageId = this.streamAnimationData.messageId;
                    const finalContent = this.streamAnimationData.fullContent;
                    
                    this.streamAnimationData.isAnimating = false;
                    
                    // 如果有完成回调，调用它
                    if (this.onAnimationComplete && typeof this.onAnimationComplete === 'function') {
                        this.onAnimationComplete(messageId, finalContent);
                    }
                }
            }, 50);
            
            return;
        }
        
        // 请求下一帧动画
        if (this.streamAnimationData && this.streamAnimationData.isAnimating) {
            requestAnimationFrame(() => this.animateText());
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
     * 停止所有动画
     */
    stopAllAnimations() {
        // 停止动画
        if (this.streamAnimationData) {
            this.streamAnimationData.isAnimating = false;
            
            // 移除生成中的全局状态类
            document.body.classList.remove('isGenerating');
            
            // 保存最终的渲染进度，方便外部检查
            const finalProgress = this.getRenderingProgress();
            this.streamAnimationData = null;
            
            // 在控制台记录最终渲染进度
            if (finalProgress) {
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
        
        // 获取内容元素
        const contentElement = document.getElementById(`content-${messageId}`);
        if (!contentElement) {
            return;
        }
        
        // 获取消息元素并更新dataset.content属性
        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            messageElement.dataset.content = finalContent;
        } else {
        }
        
        // 处理并收集HTML代码块
        try {
            // 检查是否有CodeBlockManager实例
            const codeBlockManager = window['codeBlockManager'];
            if (codeBlockManager && typeof codeBlockManager.collectHtmlStreams === 'function') {
                // 处理可能被分割的HTML代码块
                codeBlockManager.collectHtmlStreams(contentElement);
            }
        } catch (error) {
        }
        
        // 添加渐进式渲染的过渡效果
        const currentContent = contentElement.innerHTML;
        const formattedFinalContent = this.chatComponent.formatter.formatMessage(finalContent);
        
        // 如果当前显示的内容和最终内容差异较大，使用平滑过渡
        if (Math.abs(currentContent.length - formattedFinalContent.length) > 50) {
            // 使用CSS过渡效果
            contentElement.style.transition = 'opacity 0.3s ease';
            contentElement.style.opacity = '0.7';
            
            // 设置一个短暂延迟后再更新内容，让过渡效果更明显
            setTimeout(() => {
                // 更新内容
                contentElement.innerHTML = formattedFinalContent;
                
                // 应用代码高亮
                this.chatComponent.applyCodeHighlightingToElement(contentElement.closest('.chat'));
                
                // 添加代码交互按钮
                this.chatComponent.formatter.addCodeInteractionButtons();
                
                // 再次处理HTML代码块，确保预览按钮正常工作
                try {
                    if (window['codeBlockManager']) {
                        window['codeBlockManager'].updateCodeBlocks();
                    }
                } catch (error) {
                }
                
                // 恢复透明度，产生淡入效果
                contentElement.style.opacity = '1';
                
                // 延迟后移除过渡效果
                setTimeout(() => {
                    contentElement.style.transition = '';
                }, 300);
                
                // 触发回调
                if (typeof this.onAnimationComplete === 'function') {
                    this._executeCallback(messageId, finalContent);
                }
            }, 100);
        } else {
            // 如果差异小，直接更新内容
            contentElement.innerHTML = formattedFinalContent;
            
            // 应用代码高亮
            this.chatComponent.applyCodeHighlightingToElement(contentElement.closest('.chat'));
            
            // 添加代码交互按钮
            this.chatComponent.formatter.addCodeInteractionButtons();
            
            // 更新代码块
            try {
                if (window['codeBlockManager']) {
                    window['codeBlockManager'].updateCodeBlocks();
                }
            } catch (error) {
            }
            
            // 触发回调
            if (typeof this.onAnimationComplete === 'function') {
                this._executeCallback(messageId, finalContent);
            }
        }
        
        // 停止所有动画
        this.stopAllAnimations();
        
        // 移除生成中的全局状态类
        document.body.classList.remove('isGenerating');

        // 更新代码块滚动条，避免UI抖动
        if (window.codeBlockManager) {
            window.codeBlockManager.updateExistingCodeBlocksScroll();
        }

        // 只修改当前消息中的代码块状态
        if (messageElement) {
            // 移除消息元素的生成标记
            messageElement.removeAttribute('data-generating');
            
            messageElement.querySelectorAll('pre.code-block-container').forEach(pre => {
                pre.setAttribute('data-generating', 'false');
            });
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
            
            // 使用Promise并添加延迟执行回调，彻底避免递归调用
            Promise.resolve().then(() => {
                // 确保回调调用前检查状态，防止多次调用
                try {
                    callback(messageId, finalContent);
                } catch (error) {
                } finally {
                    // 强制确保生成状态被重置
                    document.body.classList.remove('isGenerating');
                    
                    // 重置状态
                    this.globalGeneratingState = false;
                    
                    // 尝试获取全局UI实例并重置状态
                    if (window.chatUI) {
                        try {
                            window.chatUI.isGenerating = false;
                            if (typeof window.chatUI.showInterruptButton === 'function') {
                                window.chatUI.showInterruptButton(false);
                            }
                        } catch (e) {
                        }
                    }
                }
            });
            
            // 设置超时保障机制，确保即使Promise执行失败，状态也能被重置
            setTimeout(() => {
                document.body.classList.remove('isGenerating');
                if (window.chatUI && window.chatUI.isGenerating) {
                    window.chatUI.isGenerating = false;
                    if (typeof window.chatUI.showInterruptButton === 'function') {
                        window.chatUI.showInterruptButton(false);
                    }
                }
            }, 1000);
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