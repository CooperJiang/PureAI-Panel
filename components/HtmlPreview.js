// HTML预览组件
export class HtmlPreview {
    constructor() {
        this.previewModal = null;
        this.currentHtmlCode = null;
        this.createPreviewModal();
        this.iframeCount = 0; // 用于创建不同名称的iframe，避免变量冲突
        this.lastUpdateTime = {}; // 记录每个iframe最后更新时间
        this.updateThrottleInterval = 5000; // 节流时间间隔，单位毫秒
        this.pendingUpdates = {}; // 等待更新的内容
        this.pendingTimeouts = {}; // 待更新的定时器
        this.isUpdating = {}; // 记录各预览是否正在更新中
        
        // 获取当前页面的基础URL，用于解决相对路径问题
        this.baseUrl = window.location.origin;
        
        // 默认设置为不自动预览（在AI回复过程中不启用预览）
        this.autoPreviewEnabled = false;
    }
    
    // 设置是否启用自动预览（流式回复中）
    setAutoPreview(enabled) {
        this.autoPreviewEnabled = enabled;
    }
    
    // 创建预览模态框
    createPreviewModal() {
        // 检查是否已存在
        if (document.getElementById('html-preview-modal')) {
            this.previewModal = document.getElementById('html-preview-modal');
            return;
        }
        
        // 创建模态框容器
        this.previewModal = document.createElement('div');
        this.previewModal.id = 'html-preview-modal';
        this.previewModal.className = 'fixed inset-0 z-50 hidden';
        
        // 模态框内容
        this.previewModal.innerHTML = `
            <div class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl flex flex-col h-[80vh]">
                    <div class="border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
                        <div class="text-lg font-medium">HTML 预览</div>
                        <div class="flex gap-2">
                            <button id="html-preview-fullscreen" class="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1 text-sm" title="全屏预览">
                                <i class="fas fa-expand text-gray-600 dark:text-gray-300"></i>
                                <span class="hidden sm:inline">全屏</span>
                            </button>
                            <button id="html-preview-refresh" class="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1 text-sm" title="刷新预览">
                                <i class="fas fa-sync-alt text-gray-600 dark:text-gray-300"></i>
                                <span class="hidden sm:inline">刷新</span>
                            </button>
                            <button id="html-preview-close" class="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1 text-sm" title="关闭预览">
                                <i class="fas fa-times text-gray-600 dark:text-gray-300"></i>
                                <span class="hidden sm:inline">关闭</span>
                            </button>
                        </div>
                    </div>
                    <div class="flex-1 p-4 overflow-auto relative bg-gray-50 dark:bg-gray-900" id="iframe-container">
                        <iframe id="html-preview-frame" class="w-full h-full bg-white border-0 rounded shadow"></iframe>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.previewModal);
        
        // 添加事件监听
        document.getElementById('html-preview-close').addEventListener('click', () => {
            this.hidePreview();
        });
        
        document.getElementById('html-preview-refresh').addEventListener('click', () => {
            this.refreshPreview();
        });
        
        document.getElementById('html-preview-fullscreen').addEventListener('click', () => {
            this.toggleFullscreen();
        });
        
        // 点击背景关闭
        this.previewModal.addEventListener('click', (e) => {
            if (e.target === this.previewModal.querySelector('.absolute')) {
                this.hidePreview();
            }
        });
    }
    
    // 处理HTML内容，修复资源路径问题
    processHtmlContent(htmlContent) {
        // 如果HTML内容为空，返回空字符串
        if (!htmlContent || htmlContent.trim() === '') {
            return '';
        }
        
        try {
            // 添加base标签解决相对路径问题
            const baseTag = `<base href="${this.baseUrl}/">`;
            
            // 检查HTML是否包含完整的结构
            const hasHtmlTag = /<html[^>]*>/i.test(htmlContent);
            const hasHeadTag = /<head[^>]*>/i.test(htmlContent);
            
            if (hasHtmlTag && hasHeadTag) {
                // 在head标签内添加base
                return htmlContent.replace(/<head[^>]*>/i, match => `${match}${baseTag}`);
            } else if (hasHtmlTag) {
                // 有html标签但没有head标签，添加head和base
                return htmlContent.replace(/<html[^>]*>/i, match => `${match}<head>${baseTag}</head>`);
            } else {
                // 只是HTML片段，构建完整结构
                return `<!DOCTYPE html>
<html>
<head>
    ${baseTag}
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        /* 内联基本样式以确保预览正常显示 */
        body { font-family: Arial, sans-serif; margin: 0; padding: 10px; }
        img { max-width: 100%; height: auto; }
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>`;
            }
        } catch (e) {
            console.error('处理HTML内容时出错:', e);
            return htmlContent; // 发生错误时返回原始内容
        }
    }
    
    // 显示HTML预览
    showPreview(htmlCode) {
        if (!this.previewModal) {
            this.createPreviewModal();
        }
        
        // 保存当前的HTML代码
        this.currentHtmlCode = htmlCode;
        
        // 创建一个新的iframe来避免JavaScript变量重复声明问题
        this.iframeCount++;
        const iframeContainer = document.getElementById('iframe-container');
        const oldIframe = document.getElementById('html-preview-frame');
        if (oldIframe) {
            oldIframe.remove();
        }
        
        const newIframe = document.createElement('iframe');
        newIframe.id = 'html-preview-frame';
        newIframe.className = 'w-full h-full bg-white border-0 rounded shadow';
        iframeContainer.appendChild(newIframe);
        
        // 处理HTML内容，修复资源路径问题
        const processedHtmlCode = this.processHtmlContent(htmlCode);
        
        // 使用srcdoc属性设置iframe内容，而不是通过document.write
        newIframe.srcdoc = processedHtmlCode;
        
        // 显示模态框
        this.previewModal.classList.remove('hidden');
    }
    
    // 刷新预览
    refreshPreview() {
        if (this.currentHtmlCode) {
            // 直接创建新iframe并加载内容，而不是重用旧iframe
            this.showPreview(this.currentHtmlCode);
        }
    }
    
    // 隐藏预览
    hidePreview() {
        if (this.previewModal) {
            this.previewModal.classList.add('hidden');
            
            // 清理iframe内容以释放资源
            const iframe = document.getElementById('html-preview-frame');
            if (iframe) {
                // @ts-ignore - HTMLIFrameElement确实有srcdoc属性
                iframe.srcdoc = '';
            }
        }
    }
    
    // 切换全屏显示
    toggleFullscreen() {
        const previewContainer = this.previewModal.querySelector('.bg-white.dark\\:bg-gray-800') || 
                                 this.previewModal.querySelector('.max-w-4xl');
        const fullscreenBtn = document.getElementById('html-preview-fullscreen');
        
        if (!previewContainer) return;
        
        const isFullscreen = previewContainer.classList.contains('max-w-full');
        
        if (!isFullscreen) {
            // 放大
            previewContainer.classList.remove('max-w-4xl', 'h-[80vh]');
            previewContainer.classList.add('max-w-full', 'h-[95vh]', 'w-[95vw]');
            if (fullscreenBtn) {
                fullscreenBtn.innerHTML = `
                    <i class="fas fa-compress text-gray-600 dark:text-gray-300"></i>
                    <span class="hidden sm:inline">退出全屏</span>
                `;
                fullscreenBtn.title = "退出全屏";
            }
        } else {
            // 缩小
            previewContainer.classList.add('max-w-4xl', 'h-[80vh]');
            previewContainer.classList.remove('max-w-full', 'h-[95vh]', 'w-[95vw]');
            if (fullscreenBtn) {
                fullscreenBtn.innerHTML = `
                    <i class="fas fa-expand text-gray-600 dark:text-gray-300"></i>
                    <span class="hidden sm:inline">全屏</span>
                `;
                fullscreenBtn.title = "全屏预览";
            }
        }
    }
    
    // 为HTML代码块添加预览按钮
    addPreviewButtonsToHtmlBlocks(forcePreview = false) {
        // 查找所有代码块
        document.querySelectorAll('.code-block').forEach(codeBlock => {
            // 检查是否是HTML代码块
            const headerElement = codeBlock.querySelector('.code-header span');
            if (!headerElement) return;
            
            const language = headerElement.textContent.toLowerCase();
            if (language === 'html' || language === 'htm') {
                // 如果已经处理过，则跳过
                if (codeBlock.getAttribute('data-preview-initialized') === 'true') return;
                codeBlock.setAttribute('data-preview-initialized', 'true');
                
                // 创建唯一ID用于节流更新
                const previewId = 'preview-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
                codeBlock.setAttribute('data-preview-id', previewId);
                
                const codeHeader = codeBlock.querySelector('.code-header');
                const codeElement = codeBlock.querySelector('code');
                const codeId = codeElement?.id;
                
                if (codeHeader && codeId && codeElement) {
                    // 获取HTML代码
                    const htmlCode = codeElement.textContent || '';
                    
                    // 保存原始代码到数据属性，便于复制按钮使用
                    codeBlock.setAttribute('data-original-code', htmlCode);
                    
                    // 重新构建代码头部结构
                    // 创建左侧按钮容器
                    const leftButtons = document.createElement('div');
                    leftButtons.className = 'left-buttons';
                    
                    // 创建右侧按钮容器
                    const rightButtons = document.createElement('div');
                    rightButtons.className = 'right-buttons';
                    
                    // 语言标识
                    const langSpan = codeHeader.querySelector('span');
                    if (langSpan) {
                        leftButtons.appendChild(langSpan);
                    }
                    
                    // 清空代码头部，重新组织结构
                    codeHeader.innerHTML = '';
                    codeHeader.appendChild(leftButtons);
                    codeHeader.appendChild(rightButtons);
                    
                    // 创建一个容器，用于切换代码和预览
                    const contentContainer = codeBlock.querySelector('pre');
                    const codeContainer = contentContainer.cloneNode(true);
                    const previewContainer = document.createElement('div');
                    previewContainer.className = 'html-preview-container';
                    
                    // 创建一个iframe用于安全渲染HTML
                    const iframe = document.createElement('iframe');
                    iframe.className = 'preview-iframe';
                    iframe.style.width = '100%';
                    iframe.style.height = '100%';
                    iframe.style.border = 'none';
                    iframe.style.backgroundColor = 'white';
                    previewContainer.appendChild(iframe);
                    
                    // 添加"查看源码/预览"按钮
                    const viewSourceButton = document.createElement('button');
                    viewSourceButton.className = 'source-button';
                    
                    // 添加放大预览按钮
                    const previewButton = document.createElement('button');
                    previewButton.className = 'preview-button';
                    previewButton.setAttribute('data-code-id', codeId);
                    previewButton.setAttribute('title', '弹窗放大预览');
                    previewButton.innerHTML = `
                        <i class="fas fa-external-link-alt"></i>
                        <span>放大</span>
                    `;
                    
                    // 添加刷新按钮
                    const refreshButton = document.createElement('button');
                    refreshButton.className = 'refresh-button';
                    refreshButton.setAttribute('title', '刷新预览');
                    refreshButton.innerHTML = `
                        <i class="fas fa-sync-alt"></i>
                        <span>刷新</span>
                    `;
                    
                    // 添加复制按钮
                    const copyButton = document.createElement('button');
                    copyButton.className = 'copy-button';
                    copyButton.setAttribute('title', '复制代码');
                    copyButton.innerHTML = `
                        <i class="fas fa-copy"></i>
                        <span>复制</span>
                    `;
                    
                    // 添加代码换行切换按钮
                    const wrapButton = document.createElement('button');
                    wrapButton.className = 'wrap-button';
                    wrapButton.setAttribute('title', '切换代码换行');
                    wrapButton.innerHTML = `
                        <i class="fas fa-exchange-alt"></i>
                        <span>换行</span>
                    `;
                    
                    // 添加按钮到界面上
                    // 左侧放控制按钮
                    leftButtons.appendChild(viewSourceButton);
                    leftButtons.appendChild(refreshButton);
                    leftButtons.appendChild(previewButton);
                    
                    // 右侧放工具按钮
                    rightButtons.appendChild(wrapButton);
                    rightButtons.appendChild(copyButton);
                    
                    // 根据设置决定是显示预览还是源代码
                    // 默认在AI回复中显示源代码，回复完成后由调用者决定是否切换到预览
                    const shouldShowPreview = forcePreview || this.autoPreviewEnabled;
                    
                    if (shouldShowPreview) {
                        // 预览模式
                        if (contentContainer.parentNode) {
                            contentContainer.parentNode.replaceChild(previewContainer, contentContainer);
                        }
                        viewSourceButton.innerHTML = `
                            <i class="fas fa-code"></i>
                            <span>源代码</span>
                        `;
                        viewSourceButton.setAttribute('title', '查看源代码');
                        codeBlock.setAttribute('data-preview-mode', 'true');
                        
                        // 立即渲染HTML
                        setTimeout(() => {
                            if (iframe instanceof HTMLIFrameElement) {
                                iframe.srcdoc = this.processHtmlContent(htmlCode);
                            }
                        }, 0);
                    } else {
                        // 源代码模式
                        viewSourceButton.innerHTML = `
                            <i class="fas fa-eye"></i>
                            <span>预览</span>
                        `;
                        viewSourceButton.setAttribute('title', '查看预览');
                        codeBlock.setAttribute('data-preview-mode', 'false');
                        
                        // 禁用刷新按钮
                        refreshButton.style.opacity = '0.5';
                        refreshButton.style.pointerEvents = 'none';
                    }
                    
                    // 添加切换功能
                    viewSourceButton.addEventListener('click', () => {
                        const isPreviewMode = codeBlock.getAttribute('data-preview-mode') === 'true';
                        
                        if (isPreviewMode) {
                            // 切换到源码视图
                            if (previewContainer.parentNode) {
                                previewContainer.parentNode.replaceChild(codeContainer, previewContainer);
                            }
                            viewSourceButton.innerHTML = `
                                <i class="fas fa-eye"></i>
                                <span>预览</span>
                            `;
                            viewSourceButton.setAttribute('title', '查看预览');
                            codeBlock.setAttribute('data-preview-mode', 'false');
                            
                            // 禁用刷新按钮
                            refreshButton.style.opacity = '0.5';
                            refreshButton.style.pointerEvents = 'none';
                        } else {
                            // 切换到预览视图
                            if (codeContainer.parentNode) {
                                codeContainer.parentNode.replaceChild(previewContainer, codeContainer);
                            }
                            viewSourceButton.innerHTML = `
                                <i class="fas fa-code"></i>
                                <span>源代码</span>
                            `;
                            viewSourceButton.setAttribute('title', '查看源代码');
                            codeBlock.setAttribute('data-preview-mode', 'true');
                            
                            // 更新预览
                            if (iframe instanceof HTMLIFrameElement) {
                                iframe.srcdoc = this.processHtmlContent(codeElement.textContent || '');
                            }
                            
                            // 启用刷新按钮
                            refreshButton.style.opacity = '1';
                            refreshButton.style.pointerEvents = 'auto';
                        }
                    });
                    
                    // 添加弹窗预览功能
                    previewButton.addEventListener('click', () => {
                        if (htmlCode.trim()) {
                            this.showPreview(htmlCode);
                        }
                    });
                    
                    // 添加刷新功能
                    refreshButton.addEventListener('click', () => {
                        if (codeBlock.getAttribute('data-preview-mode') === 'true') {
                            // 更新预览
                            if (iframe instanceof HTMLIFrameElement) {
                                iframe.srcdoc = this.processHtmlContent(codeElement.textContent || '');
                            }
                        }
                    });
                    
                    // 添加复制功能
                    copyButton.addEventListener('click', () => {
                        const code = codeBlock.getAttribute('data-original-code') || '';
                        if (code) {
                            navigator.clipboard.writeText(code)
                                .then(() => {
                                    // 更新复制按钮文本为"已复制"
                                    const copyText = copyButton.querySelector('span');
                                    if (copyText) {
                                        const originalText = copyText.textContent;
                                        copyText.textContent = '已复制';
                                        setTimeout(() => {
                                            copyText.textContent = originalText;
                                        }, 2000);
                                    }
                                })
                                .catch(err => {
                                    console.error('复制失败:', err);
                                });
                        }
                    });
                    
                    // 添加代码换行功能
                    wrapButton.addEventListener('click', () => {
                        codeBlock.classList.toggle('wrap-code');
                        const wrapText = wrapButton.querySelector('span');
                        if (wrapText) {
                            wrapText.textContent = codeBlock.classList.contains('wrap-code') ? '不换行' : '换行';
                        }
                    });
                }
            }
        });
    }
    
    // 更新特定HTML预览的内容，使用节流控制更新频率
    updatePreview(codeBlockId, htmlContent) {
        if (!codeBlockId) return;
        
        // 保存待更新的内容
        this.pendingUpdates[codeBlockId] = htmlContent;
        
        const now = Date.now();
        // 检查是否需要立即更新（首次更新或者超过节流时间间隔）
        if (!this.lastUpdateTime[codeBlockId] || 
            (now - this.lastUpdateTime[codeBlockId] > this.updateThrottleInterval)) {
            
            this.performUpdate(codeBlockId);
        } else if (!this.pendingTimeouts?.[codeBlockId]) {
            // 设置定时器，延迟更新
            if (!this.pendingTimeouts) this.pendingTimeouts = {};
            
            // 清除之前的定时器（如果有）
            if (this.pendingTimeouts[codeBlockId]) {
                clearTimeout(this.pendingTimeouts[codeBlockId]);
            }
            
            // 计算还需等待多久
            const timeToWait = this.updateThrottleInterval - (now - this.lastUpdateTime[codeBlockId]);
            
            // 设置新的定时器
            this.pendingTimeouts[codeBlockId] = setTimeout(() => {
                this.performUpdate(codeBlockId);
                delete this.pendingTimeouts[codeBlockId];
            }, timeToWait);
        }
    }
    
    // 执行实际的更新操作
    performUpdate(codeBlockId) {
        if (!this.pendingUpdates[codeBlockId]) return;
        
        const codeBlock = document.querySelector(`.code-block[data-preview-id="${codeBlockId}"]`);
        if (!codeBlock) return;
        
        // 检查是否处于预览模式
        if (codeBlock.getAttribute('data-preview-mode') === 'true') {
            // 如果正在更新中，不执行更新以避免闪烁
            if (this.isUpdating[codeBlockId]) return;
            this.isUpdating[codeBlockId] = true;
            
            const previewContainer = codeBlock.querySelector('.html-preview-container');
            if (!previewContainer) {
                this.isUpdating[codeBlockId] = false;
                return;
            }
            
            // 使用双缓冲技术：创建新iframe在后台加载
            const newIframe = document.createElement('iframe');
            newIframe.className = 'preview-iframe new-iframe';
            newIframe.style.opacity = '0';
            newIframe.style.position = 'absolute';
            newIframe.style.top = '0';
            newIframe.style.left = '0';
            newIframe.style.width = '100%';
            newIframe.style.height = '100%';
            newIframe.style.border = 'none';
            newIframe.style.backgroundColor = 'white';
            newIframe.style.transition = 'opacity 0.3s ease';
            
            // 将新iframe添加到容器
            previewContainer.appendChild(newIframe);
            
            // 显示更新指示器
            this.showUpdateIndicator(previewContainer);
            
            // 加载新内容到隐藏的iframe
            if (newIframe instanceof HTMLIFrameElement) {
                // 获取当前帧的滚动位置
                const currentIframe = previewContainer.querySelector('.preview-iframe:not(.new-iframe)');
                let scrollTop = 0;
                let scrollLeft = 0;
                
                if (currentIframe instanceof HTMLIFrameElement && currentIframe.contentWindow) {
                    try {
                        scrollTop = currentIframe.contentWindow.document.documentElement.scrollTop || 
                                  currentIframe.contentWindow.document.body.scrollTop;
                        scrollLeft = currentIframe.contentWindow.document.documentElement.scrollLeft || 
                                   currentIframe.contentWindow.document.body.scrollLeft;
                    } catch (e) {
                        console.log('无法获取滚动位置:', e);
                    }
                }
                
                // 设置内容
                newIframe.srcdoc = this.processHtmlContent(this.pendingUpdates[codeBlockId]);
                
                // 当新iframe加载完成后
                newIframe.onload = () => {
                    // 恢复滚动位置
                    if (newIframe.contentWindow) {
                        try {
                            newIframe.contentWindow.document.documentElement.scrollTop = scrollTop;
                            newIframe.contentWindow.document.documentElement.scrollLeft = scrollLeft;
                            newIframe.contentWindow.document.body.scrollTop = scrollTop;
                            newIframe.contentWindow.document.body.scrollLeft = scrollLeft;
                        } catch (e) {
                            console.log('无法设置滚动位置:', e);
                        }
                    }
                    
                    // 淡入显示新iframe
                    newIframe.style.opacity = '1';
                    
                    // 删除旧iframe
                    setTimeout(() => {
                        const oldIframes = previewContainer.querySelectorAll('.preview-iframe:not(.new-iframe)');
                        oldIframes.forEach(oldIframe => {
                            if (oldIframe.parentNode) {
                                oldIframe.parentNode.removeChild(oldIframe);
                            }
                        });
                        
                        // 移除新iframe的标记类
                        newIframe.classList.remove('new-iframe');
                        
                        // 更新最后更新时间
                        this.lastUpdateTime[codeBlockId] = Date.now();
                        
                        // 隐藏更新指示器
                        this.hideUpdateIndicator(previewContainer);
                        
                        // 标记更新完成
                        this.isUpdating[codeBlockId] = false;
                    }, 300);
                };
            }
        }
        
        // 保留内容，便于下次更新
        codeBlock.setAttribute('data-original-code', this.pendingUpdates[codeBlockId]);
    }
    
    // 显示更新指示器
    showUpdateIndicator(container) {
        if (!container) return;
        
        // 检查是否已存在指示器
        let indicator = container.querySelector('.preview-update-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'preview-update-indicator';
            indicator.innerHTML = '<div class="preview-update-spinner"></div><span>更新中...</span>';
            container.appendChild(indicator);
        } else {
            indicator.style.display = 'flex';
        }
    }
    
    // 隐藏更新指示器
    hideUpdateIndicator(container) {
        if (!container) return;
        
        const indicator = container.querySelector('.preview-update-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
}