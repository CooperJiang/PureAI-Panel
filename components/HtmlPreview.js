/**
 * HTML预览组件 - 负责处理HTML代码的预览功能
 */
export class HtmlPreview {
    constructor() {
        this.previewContainer = null;
        this.currentHtml = '';
        this.isShowing = false;
        this.isFullscreen = false;
        
        // 创建预览容器
        this.createPreviewContainer();
        
        // 绑定关闭事件
        this.bindEvents();
        
    }
    
    /**
     * 创建HTML预览容器
     */
    createPreviewContainer() {
        // 首先检查并移除可能存在的旧容器
        const existingContainer = document.getElementById('html-preview-container');
        if (existingContainer) {
            try {
                existingContainer.remove();
            } catch (error) {
        }
        }
        
        try {
            // 创建新的预览容器
            this.previewContainer = document.createElement('div');
            this.previewContainer.id = 'html-preview-container';
            this.previewContainer.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 hidden';
            
            // 创建预览内容
            this.previewContainer.innerHTML = `
                <div class="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                    <div class="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700">
                        <h3 class="text-lg font-medium text-gray-900 dark:text-white">HTML预览</h3>
                        <div class="flex space-x-2">
                            <button id="fullscreen-preview-btn" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                                </svg>
                            </button>
                            <button id="refresh-preview-btn" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                            <button id="close-preview-btn" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="overflow-auto p-4 flex-grow" style="background-color: white;">
                        <iframe id="html-preview-frame" class="w-full h-full border-0 dark:bg-white" style="min-height: 400px;"></iframe>
                    </div>
                    <div class="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
                        完整HTML预览：支持所有功能和外部资源访问。
                </div>
            </div>
        `;
        
            // 添加到body
            document.body.appendChild(this.previewContainer);
        } catch (error) {
        }
    }
    
    /**
     * 绑定关闭和刷新事件
     */
    bindEvents() {
        if (!this.previewContainer) {
            return;
        }
        
        try {
            // 重新选择预览容器，以防初始化时没有成功捕获
            if (!this.previewContainer) {
                this.previewContainer = document.getElementById('html-preview-container');
                if (!this.previewContainer) {
                    return;
                }
            }
            
            // 绑定关闭按钮
            const closeBtn = document.getElementById('close-preview-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closePreview());
            } else {
                // 备用方案：通过容器查找
                const closeBtnInContainer = this.previewContainer.querySelector('#close-preview-btn');
                if (closeBtnInContainer) {
                    closeBtnInContainer.addEventListener('click', () => this.closePreview());
                }
            }
            
            // 绑定刷新按钮
            const refreshBtn = document.getElementById('refresh-preview-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => this.refreshPreview());
            } else {
                // 备用方案
                const refreshBtnInContainer = this.previewContainer.querySelector('#refresh-preview-btn');
                if (refreshBtnInContainer) {
                    refreshBtnInContainer.addEventListener('click', () => this.refreshPreview());
            }
            }
            
            // 绑定全屏按钮
            const fullscreenBtn = document.getElementById('fullscreen-preview-btn');
            if (fullscreenBtn) {
                fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
            } else {
                // 备用方案
                const fullscreenBtnInContainer = this.previewContainer.querySelector('#fullscreen-preview-btn');
                if (fullscreenBtnInContainer) {
                    fullscreenBtnInContainer.addEventListener('click', () => this.toggleFullscreen());
                }
            }
            
            // 添加ESC键关闭预览
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isShowing) {
                    this.closePreview();
                }
            });
            
        } catch (error) {
        }
    }
    
    /**
     * 修复不完整的HTML
     * @param {string} html - HTML内容
     * @returns {string} - 修复后的HTML
     */
    fixIncompleteHtml(html) {
        if (!html) return '';
        
        let fixedHtml = html.trim();
        
        // 如果不包含DOCTYPE，添加一个
        if (!fixedHtml.includes('<!DOCTYPE') && !fixedHtml.includes('<!doctype')) {
            fixedHtml = '<!DOCTYPE html>\n' + fixedHtml;
        }
        
        // 如果不包含<html>标签，添加一个
        if (!fixedHtml.includes('<html') && !fixedHtml.includes('<HTML')) {
            if (!fixedHtml.includes('<body') && !fixedHtml.includes('<BODY')) {
                fixedHtml = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n</head>\n<body>\n' + fixedHtml + '\n</body>\n</html>';
            } else {
                fixedHtml = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n</head>\n' + fixedHtml + '\n</html>';
            }
        }
        
        return fixedHtml;
    }
    
    /**
     * 显示HTML预览
     * @param {string} html - HTML内容
     */
    showPreview(html) {
        if (!html) {
            return;
        }
        
        // 保存当前HTML
        this.currentHtml = html;
        
        // 处理HTML内容，修复不完整的HTML
        const fixedHtml = this.fixIncompleteHtml(html);
        
        // 确保预览容器存在
        if (!this.previewContainer || !document.body.contains(this.previewContainer)) {
            this.createPreviewContainer();
            this.bindEvents(); // 重新绑定事件
            
            // 如果仍然创建失败，提示错误并返回
            if (!this.previewContainer) {
                if (window.toast) {
                    window.toast.error('无法创建预览窗口，请刷新页面后重试');
                } else {
                    alert('无法创建预览窗口，请刷新页面后重试');
                }
                return;
        }
    }
    
        // 显示预览容器
        this.previewContainer.classList.remove('hidden');
        this.isShowing = true;
            
        // 获取iframe - 使用多种方式尝试获取
        let iframe = document.getElementById('html-preview-frame');
        
        // 如果找不到，尝试在预览容器中查找
        if (!iframe && this.previewContainer) {
            iframe = this.previewContainer.querySelector('#html-preview-frame');
    }
    
        // 如果仍然找不到，尝试创建一个
        if (!iframe) {
            const contentContainer = this.previewContainer.querySelector('.overflow-auto');
            
            if (contentContainer) {
                // 清空并创建新iframe
                contentContainer.innerHTML = '';
                iframe = document.createElement('iframe');
                iframe.id = 'html-preview-frame';
                iframe.className = 'w-full h-full border-0 dark:bg-white';
                iframe.style.minHeight = '400px';
                contentContainer.appendChild(iframe);
            } else {
                if (window.toast) {
                    window.toast.error('预览初始化失败，请刷新页面后重试');
                } else {
                    alert('预览初始化失败，请刷新页面后重试');
                }
                return;
            }
        }
        
        // 确保iframe存在
        if (!iframe) {
            if (window.toast) {
                window.toast.error('预览初始化失败，请刷新页面后重试');
        } else {
                alert('预览初始化失败，请刷新页面后重试');
            }
            return;
    }
    
        // 写入HTML内容
        try {
            // 设置iframe允许所有权限
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-pointer-lock allow-popups-to-escape-sandbox allow-downloads allow-top-navigation');
            iframe.setAttribute('allow', 'microphone; camera; geolocation; fullscreen; midi; encrypted-media; autoplay');
            
            const iframeDoc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
            if (!iframeDoc) {
                return;
            }
            
            iframeDoc.open();
            iframeDoc.write(fixedHtml);
            iframeDoc.close();
                    
            // 允许iframe访问所有功能，移除限制代码

        } catch (error) {
            if (window.toast) {
                window.toast.error('HTML预览渲染失败');
                    } else {
                alert('HTML预览渲染失败');
            }
        }
    }
    
    /**
     * 刷新预览
     */
    refreshPreview() {
        if (this.isShowing && this.currentHtml) {
            this.showPreview(this.currentHtml);
        }
    }
    
    /**
     * 关闭预览
     */
    closePreview() {
        if (this.previewContainer) {
            this.previewContainer.classList.add('hidden');
            this.isShowing = false;
            this.isFullscreen = false;
                            
            // 重置全屏状态
            const previewContent = this.previewContainer.querySelector('.relative');
            if (previewContent) {
                previewContent.classList.remove('fixed', 'inset-0', 'z-[100]', 'max-w-none');
                previewContent.style.width = '';
                previewContent.style.height = '';
                previewContent.style.maxHeight = '';
                previewContent.style.margin = '';
                previewContent.style.left = '';
                previewContent.style.right = '';
                previewContent.style.top = '';
                previewContent.style.bottom = '';
                            }
                    
            // 重置iframe高度
            const iframe = document.getElementById('html-preview-frame');
            if (iframe) {
                iframe.style.height = '';
            }
            
            // 重置内容区域高度
            const contentContainer = this.previewContainer.querySelector('.overflow-auto');
            if (contentContainer) {
                contentContainer.style.maxHeight = '';
            }
                        }
    }
    
    // 添加新方法: 切换全屏模式
    toggleFullscreen() {
        const previewContent = this.previewContainer?.querySelector('.relative');
        const iframe = document.getElementById('html-preview-frame') || 
                     (this.previewContainer && this.previewContainer.querySelector('#html-preview-frame'));
        const contentContainer = this.previewContainer?.querySelector('.overflow-auto');
        
        if (!previewContent || !iframe) {
            return;
        }
        
        if (!this.isFullscreen) {
            // 进入全屏模式 - 使用95vw和95vh以占据尽可能多的屏幕空间
            previewContent.classList.add('fixed', 'inset-0', 'z-[100]', 'max-w-none');
            previewContent.style.width = '95vw';
            previewContent.style.height = '95vh';
            previewContent.style.margin = 'auto';
            // previewContent.style.left = '2.5vw'; // 居中显示
            // previewContent.style.right = '2.5vw';
            // previewContent.style.top = '2.5vh';
            // previewContent.style.bottom = '2.5vh';
            
            // 调整iframe高度，让它填充可用空间
            iframe.style.height = 'calc(95vh - 90px)'; // 保留顶部和底部空间
         
            // 增加内容区域高度
            if (contentContainer) {
                contentContainer.style.maxHeight = 'calc(95vh - 110px)';
            }
            
            this.isFullscreen = true;
            
            // 更新全屏按钮图标
            const fullscreenBtn = document.getElementById('fullscreen-preview-btn') || 
                                 (this.previewContainer && this.previewContainer.querySelector('#fullscreen-preview-btn'));
            if (fullscreenBtn) {
                fullscreenBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M9 6H6v3m12 9v-3m0 0h-3" />
                    </svg>
                `;
                    }
        } else {
            // 退出全屏模式
            previewContent.classList.remove('fixed', 'inset-0', 'z-[100]', 'max-w-none');
            previewContent.style.width = '';
            previewContent.style.height = '';
            previewContent.style.maxHeight = '';
            previewContent.style.margin = '';
            previewContent.style.left = '';
            previewContent.style.right = '';
            previewContent.style.top = '';
            previewContent.style.bottom = '';
            
            // 重置iframe高度
            iframe.style.height = '';
            
            // 重置内容区域高度
            if (contentContainer) {
                contentContainer.style.maxHeight = '';
            }
            
            this.isFullscreen = false;
                        
            // 更新全屏按钮图标
            const fullscreenBtn = document.getElementById('fullscreen-preview-btn') || 
                                 (this.previewContainer && this.previewContainer.querySelector('#fullscreen-preview-btn'));
            if (fullscreenBtn) {
                fullscreenBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                    </svg>
                `;
            }
        }
    }
}