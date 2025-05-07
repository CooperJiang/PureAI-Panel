/**
 * 代码块管理模块 - 负责处理代码块的交互功能和UI美化
 */
import { HtmlPreview } from '../../components/HtmlPreview.js';
import { Toast } from '../../components/Toast.js';

export class CodeBlockManager {
    /**
     * 构造函数
     */
    constructor() {
        // 记录日志
        
        // 用于跟踪代码块滚动状态的变量
        this.scrollInterval = null;
        this.lastPosition = 0;
        
        // 保存对代码块元素的引用，用于跟踪已处理的代码块
        this.codeBlocks = new Set();
        
        // 延迟初始化，在页面完全加载后处理
        document.addEventListener('DOMContentLoaded', () => {
            this.initializeDelayed();
            this.setupMutationObserver();
        });
        
        // 页面已经加载完成的情况
        if (document.readyState === 'complete') {
            this.initializeDelayed();
            this.setupMutationObserver();
        }
        
        // 刷新方法的全局入口点
        window.refreshCodeBlocks = () => this.reinitializeCodeBlocks();
        
        // 直接创建HTML预览组件实例
        try {
            this.htmlPreview = new HtmlPreview();
            this.toast = new Toast();
            
            // 设置为全局变量以便其他模块可以使用
            window['htmlPreview'] = this.htmlPreview;
            window['toast'] = this.toast;
        } catch (error) {
        }
        
        // 防抖动渲染控制
        this.codeBlockRenderDebounceTimers = new Map();
        this.lastRenderTime = 0;
        
        // 已处理的代码块缓存，避免重复处理
        this.processedCodeBlocks = new Set();
    }
    
    /**
     * 初始化MutationObserver，监听DOM变化
     */
    initMutationObserver() {
        // 创建MutationObserver实例
        this.observer = new MutationObserver((mutations) => {
            let shouldReinitialize = false;
            
            // 检查是否有新增代码块
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // 如果新增了代码块或者包含代码块的元素
                            if (node.querySelector('.code-block') || node.classList?.contains('code-block')) {
                                shouldReinitialize = true;
                                break;
                            }
                        }
                    }
                }
                
                if (shouldReinitialize) break;
            }
            
            // 如果需要重新初始化
            if (shouldReinitialize) {
                this.reinitializeCodeBlocks();
            }
        });
        
        // 开始观察document.body的变化，包括子节点变化和子树变化
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    /**
     * 初始化代码块管理器
     */
    init() {
        try {
            
            // 确保HTML预览组件已初始化
            if (!this.htmlPreview) {
                try {
                    this.htmlPreview = new HtmlPreview();
                    window['htmlPreview'] = this.htmlPreview;
                } catch (error) {
                }
            }
            
            // 确保Toast组件已初始化
            if (!this.toast) {
                try {
                    this.toast = new Toast();
                    window['toast'] = this.toast;
                } catch (error) {
                }
            }
            
            // 常规初始化
            this.loadAllCodeBlocks();
            this.beautifyCodeBlockUI();
            this.setupCodeBlockInteractions();
            
            // 添加延迟初始化和变化监听，确保处理动态添加的代码块
            this.initializeDelayed();
            
            // 为window添加辅助方法，方便其他模块调用
            window['reinitializeCodeBlocks'] = () => this.refreshCodeBlocks();
            
            
            // 触发自定义事件，通知其他组件代码块管理器已初始化
            document.dispatchEvent(new CustomEvent('codeblock-manager-ready'));
            
            return true;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * 重新初始化所有代码块
     */
    reinitializeCodeBlocks() {
        // 查找页面中的所有pre元素
        const preElements = document.querySelectorAll('pre');
        
        preElements.forEach(preElement => {
            try {
                // 重新处理代码块
                this.processCodeBlock(preElement);
                
                // 检查生成状态
                const isGenerating = document.body.classList.contains('isGenerating') || 
                                    preElement.closest('.chat')?.classList.contains('isGenerating');
                
                if (!isGenerating) {
                    // 如果生成已完成，确保正确设置高度和滚动属性
                    preElement.style.maxHeight = '400px';
                    preElement.style.overflowY = 'auto';
                    preElement.style.removeProperty('min-height');
                    preElement.setAttribute('data-generating', 'false');
                    
                    // 添加代码块容器类
                    preElement.classList.add('code-block-container');
                }
            } catch (error) {
            }
        });
    }
    
    /**
     * 美化代码块UI
     */
    beautifyCodeBlockUI() {
        // 查找所有代码块
        document.querySelectorAll('.code-block').forEach(codeBlock => {
            // 已经美化过的跳过
            if (codeBlock.getAttribute('data-beautified') === 'true') return;
            codeBlock.setAttribute('data-beautified', 'true');
            
            // 美化代码头部
            const codeHeader = codeBlock.querySelector('.code-header');
            if (codeHeader) {
                codeHeader.classList.add(
                    'flex', 'justify-between', 'items-center',
                    'p-2', 'rounded-t-md', 'bg-gray-50', 'dark:bg-gray-800', 
                    'border-b', 'border-gray-200', 'dark:border-gray-700'
                );
                
                // 语言标签美化
                const langLabel = codeHeader.querySelector('span');
                if (langLabel) {
                    langLabel.classList.add(
                        'px-2', 'py-1', 'rounded', 'text-xs', 'font-medium',
                        'bg-gray-200', 'dark:bg-gray-700', 
                        'text-gray-800', 'dark:text-gray-200'
                    );
                }
                
                // 美化按钮容器
                const buttonContainer = codeHeader.querySelector('.flex');
                if (buttonContainer) {
                    buttonContainer.classList.add('gap-1');
                    
                    // 美化所有按钮
                    const buttons = buttonContainer.querySelectorAll('button');
                    buttons.forEach(button => {
                        this.beautifyButton(button);
                    });
                }
            }
            
            // 美化代码区域
            const codeContainer = codeBlock.querySelector('pre');
            if (codeContainer) {
                codeContainer.classList.add(
                    'p-4', 'rounded-b-md', 'bg-gray-50', 'dark:bg-gray-800',
                    'border', 'border-gray-200', 'dark:border-gray-700'
                );
                
                // 判断当前是否在生成中
                const isGenerating = document.body.classList.contains('isGenerating') || 
                                     codeBlock.closest('.chat')?.classList.contains('isGenerating');
                
                // 生成中不限制高度，生成结束后限制高度
                if (isGenerating) {
                    // 在生成过程中，取消最大高度限制，使用自然高度并记录状态
                    codeContainer.style.maxHeight = 'none';
                    codeContainer.style.overflowY = 'hidden'; // 隐藏滚动条防止闪烁
                    codeContainer.setAttribute('data-generating', 'true');
                } else {
                    // 已经完成生成，使用固定最大高度
                    codeContainer.style.maxHeight = '400px';
                    codeContainer.style.overflowY = 'auto';
                    codeContainer.setAttribute('data-generating', 'false');
                }
                
                // 启用代码块自动滚动功能
                this.enableCodeBlockAutoScroll(codeContainer);
            }
        });
    }
    
    /**
     * 美化按钮
     * @param {HTMLButtonElement} button - 按钮元素
     */
    beautifyButton(button) {
        // 已经美化过的跳过
        if (button.getAttribute('data-beautified') === 'true') return;
        button.setAttribute('data-beautified', 'true');
        
        // 添加基础样式
        const classes = this.buttonStyles.base.split(' ');
        button.classList.add(...classes);
        
        // 根据按钮类型添加特殊样式
        if (button.classList.contains('preview-button')) {
            button.classList.add(...this.buttonStyles.primary.split(' '));
        } else {
            button.classList.add(...this.buttonStyles.secondary.split(' '));
        }
        
        // 美化图标
        const icon = button.querySelector('i');
        if (icon) {
            icon.classList.add(...this.buttonStyles.icon.split(' '));
        }
    }
    
    /**
     * 设置代码块的交互功能
     */
    setupCodeBlockInteractions() {
        try {
            
            // 直接绑定事件委托，避免单独绑定每个按钮
            document.removeEventListener('click', this.codeBlockButtonHandler);
            
            this.codeBlockButtonHandler = (e) => {
                // 找到最近的按钮元素
                const button = e.target.closest('.copy-button, .wrap-button, .preview-button');
                if (!button) return;
                
                // 获取代码ID
                const codeId = button.getAttribute('data-code-id');
                if (!codeId) {
                    return;
                }
                
                // 尝试多种方式找到代码元素
                let codeElement = document.getElementById(codeId);
                
                // 如果找不到，尝试通过选择器查找
                if (!codeElement) {
                    
                    // 方案1: 通过选择器查找
                    codeElement = document.querySelector(`code#${codeId}, pre#${codeId} > code`);
                }
                
                // 方案2: 如果没有#前缀，可能是ID属性存储格式问题，尝试加上前缀
                if (!codeElement && !codeId.startsWith('code-md-')) {
                    const altId = `code-md-${codeId}`;
                    codeElement = document.getElementById(altId);
                }
                
                // 方案3: 如果依然找不到，可能是相邻的代码块，通过距离找到最近的
                if (!codeElement) {
                    const codeHeader = button.closest('.code-header');
                    if (codeHeader) {
                        const codeBlock = codeHeader.closest('.code-block');
                        if (codeBlock) {
                            codeElement = codeBlock.querySelector('code');
                        }
                    }
                }
                
                // 如果仍然找不到代码元素
                if (!codeElement) {
                    
                    // 尝试最后的备用方案：从整个文档中找到按钮最近的code元素
                    const buttonContainer = button.closest('.code-header');
                    if (buttonContainer && buttonContainer.nextElementSibling) {
                        const preElement = buttonContainer.nextElementSibling;
                        if (preElement.tagName === 'PRE') {
                            codeElement = preElement.querySelector('code');
                            if (codeElement) {
                                codeElement.id = codeId;
                            }
                        }
                    }
                    
                    // 如果仍然找不到，通知用户并返回
                    if (!codeElement) {
                        if (this.toast) {
                            this.toast.error('无法找到相关代码块，操作失败');
                        } else if (window.toast) {
                            window.toast.error('无法找到相关代码块，操作失败');
                        }
                        return;
                    }
                }
                
                // 执行按钮对应的功能
                if (button.classList.contains('copy-button')) {
                    // 复制代码
                    const textToCopy = codeElement.textContent || '';
                    
                    if (textToCopy.trim()) {
                        try {
                            navigator.clipboard.writeText(textToCopy).then(() => {
                                
                                // 显示复制成功提示
                                const span = button.querySelector('span');
                                if (span) {
                                    const originalText = span.textContent;
                                    span.textContent = '已复制!';
                                    setTimeout(() => {
                                        span.textContent = originalText;
                                    }, 1500);
                                }
                                
                                if (this.toast) {
                                    this.toast.success('代码已复制到剪贴板');
                                } else if (window.toast) {
                                    window.toast.success('代码已复制到剪贴板');
                                }
                            }).catch(err => {
                                if (this.toast) {
                                    this.toast.error('复制失败: ' + err.message);
                                } else if (window.toast) {
                                    window.toast.error('复制失败: ' + err.message);
                                }
                            });
                        } catch (err) {
                            // 尝试使用旧方法
                            this.fallbackCopy(textToCopy, button);
                        }
                    } else {
                        if (this.toast) {
                            this.toast.warning('代码块为空，无法复制');
                        } else if (window.toast) {
                            window.toast.warning('代码块为空，无法复制');
                        }
                    }
                }
                else if (button.classList.contains('wrap-button')) {
                    // 切换换行
                    const codeBlock = codeElement.closest('.code-block');
                    if (!codeBlock) return;
                    
                    // 切换换行类
                    const wasWrapped = codeBlock.classList.contains('wrap-code');
                    codeBlock.classList.toggle('wrap-code');
                    const isWrapped = codeBlock.classList.contains('wrap-code');
                    
                    // 更新按钮文本
                    const spanElement = button.querySelector('span');
                    if (spanElement) spanElement.textContent = isWrapped ? '不换行' : '换行';
                    
                    // 更新图标
                    const iconElement = button.querySelector('i');
                    if (iconElement) iconElement.className = isWrapped ? 'fas fa-align-left' : 'fas fa-text-width';
                    
                    // 触发窗口调整以更新滚动条
                    setTimeout(() => {
                        window.dispatchEvent(new Event('resize'));
                        
                        // 重新应用代码高亮
                        if (typeof hljs !== 'undefined') {
                            try {
                                hljs.highlightElement(codeElement);
                            } catch (e) {
                            }
                        }
                    }, 50);
                }
                else if (button.classList.contains('preview-button')) {
                    // HTML预览
                    // 确保HTML预览组件已初始化
                    if (!this.htmlPreview) {
                        try {
                            if (typeof HtmlPreview !== 'undefined') {
                                this.htmlPreview = new HtmlPreview();
                                window['htmlPreview'] = this.htmlPreview;
                            } else {
                                // 尝试获取全局模块
                                if (window.components && window.components.HtmlPreview) {
                                    this.htmlPreview = new window.components.HtmlPreview();
                                    window['htmlPreview'] = this.htmlPreview;
                                } else {
                                    throw new Error('无法找到HtmlPreview模块');
                                }
                            }
                        } catch (error) {
                            if (this.toast) {
                                this.toast.error('无法初始化预览组件，请刷新页面后重试');
                            } else if (window.toast) {
                                window.toast.error('无法初始化预览组件，请刷新页面后重试');
                            } else {
                                alert('无法初始化预览组件，请刷新页面后重试');
                            }
                            return;
                        }
                    }
                    
                    const htmlCode = codeElement.textContent || '';
                    if (htmlCode.trim()) {
                        this.htmlPreview.showPreview(htmlCode);
                    } else if (this.toast) {
                        this.toast.warning('HTML代码为空，无法预览');
                    } else if (window.toast) {
                        window.toast.warning('HTML代码为空，无法预览');
                    } else {
                        alert('HTML代码为空，无法预览');
                    }
                }
            };
            
            // 全局事件委托
            document.addEventListener('click', this.codeBlockButtonHandler);
        } catch (error) {
        }
    }
    
    /**
     * 在消息生成完成后，将HTML代码块转换为预览模式
     */
    convertHtmlToPreview() {
        if (!this.htmlPreview) return;
        
        try {
            // 找到所有HTML代码块
            const htmlBlocks = document.querySelectorAll('.code-block');
            htmlBlocks.forEach(block => {
                const headerElement = block.querySelector('.code-header span');
                if (headerElement && ['html', 'htm'].includes(headerElement.textContent.toLowerCase())) {
                    // 检查是否处于源代码模式
                    if (block.getAttribute('data-preview-mode') === 'false') {
                        // 找到源代码/预览切换按钮并模拟点击
                        const viewButton = block.querySelector('.source-button');
                        if (viewButton && viewButton instanceof HTMLElement) {
                            viewButton.click(); // 自动切换到预览模式
                        }
                    }
                }
            });
        } catch (e) {
        }
    }
    
    /**
     * 启用代码块自动滚动功能
     * @param {HTMLElement} preElement - 代码块pre元素
     */
    enableCodeBlockAutoScroll(preElement) {
        if (!preElement) return;
        
        const codeElement = preElement.querySelector('code');
        if (!codeElement) return;
        
        preElement.setAttribute('data-autoscroll', 'true');
        
        // 当前生成状态下不限制高度
        preElement.style.maxHeight = 'none';
        preElement.style.overflowY = 'hidden';
        
        // 获取代码高度
        const codeHeight = codeElement.offsetHeight;
        
        // 自动滚动相关变量初始化
        this.lastPosition = codeHeight;
        
        // 滚动到底部
        preElement.scrollTop = preElement.scrollHeight;
        
        // 清除之前的定时器
        if (this.scrollInterval) {
            clearInterval(this.scrollInterval);
        }
        
        // 设置新的定时器，定期检查和滚动
        this.scrollInterval = setInterval(() => {
            if (!document.body.contains(preElement)) {
                // 如果元素不再存在于文档中，清除定时器
                clearInterval(this.scrollInterval);
                return;
            }
            
            // 重新计算代码高度
            const newHeight = codeElement.offsetHeight;
            
            // 如果高度有变化，则滚动
            if (newHeight > this.lastPosition) {
                this.lastPosition = newHeight;
                preElement.scrollTop = preElement.scrollHeight;
            }
            
            // 检查是否生成完成
            const isGenerating = document.body.classList.contains('isGenerating') ||
                                preElement.closest('.chat')?.classList.contains('isGenerating');
            
            if (!isGenerating) {
                // 生成结束，清除滚动定时器
                clearInterval(this.scrollInterval);
                this.scrollInterval = null;
                
                // 添加过渡效果
                preElement.style.transition = 'max-height 0.3s ease-in-out';
                
                // 确保设置了正确的属性
                setTimeout(() => {
                    preElement.style.maxHeight = '400px';
                    preElement.style.overflowY = 'auto';
                    preElement.style.removeProperty('min-height');
                    preElement.setAttribute('data-generating', 'false');
                    
                    // 300ms后移除过渡效果
                    setTimeout(() => {
                        preElement.style.transition = '';
                    }, 300);
                }, 100);
            }
        }, 100);
    }
    
    /**
     * 更新已有代码块的滚动状态
     * @param {HTMLElement} container - 容器元素，默认为document.body
     */
    updateExistingCodeBlocksScroll(container = document.body) {
        // 更新代码块的高度状态
        this.updateExistingCodeBlocksHeight();
        
        // 获取所有已处理的代码块
        const processedPreElements = container.querySelectorAll('pre[data-processed="true"]');
        
        processedPreElements.forEach(preElement => {
            try {
                // 检查是否需要自动滚动
                if (preElement.getAttribute('data-autoscroll') === 'true') {
                    // 检查生成状态
                    const isGenerating = document.body.classList.contains('isGenerating') || 
                                        preElement.closest('.chat')?.classList.contains('isGenerating');
                    
                    if (isGenerating) {
                        // 确保正在生成时可以自动滚动到底部
                        preElement.scrollTop = preElement.scrollHeight;
                    } else if (preElement.getAttribute('data-generating') === 'true') {
                        // 生成刚结束，设置正确的滚动状态
                        preElement.style.maxHeight = '400px';
                        preElement.style.overflowY = 'auto';
                        preElement.style.removeProperty('min-height');
                        preElement.setAttribute('data-generating', 'false');
                    }
                }
            } catch (error) {
            }
        });
    }
    
    /**
     * 更新现有的代码块
     */
    updateCodeBlocks() {
        try {
            // 找到所有代码块
            const preElements = document.querySelectorAll('pre:not([data-processed="true"])');
            
            if (preElements.length === 0) {
                // 即使没有新代码块，也要确保所有按钮事件都被正确绑定
                this.setupCodeBlockInteractions();
                return; // 没有新的代码块
            }
            
            
            preElements.forEach(preElement => {
                if (preElement.getAttribute('data-processed') === 'true') {
                    return; // 跳过已处理的代码块
                }
                
                // 获取代码元素
                const codeElement = preElement.querySelector('code');
                if (!codeElement) return;
                
                // 标记为已处理
                preElement.setAttribute('data-processed', 'true');
                
                try {
                    // 处理代码块
                    this.processCodeBlock(preElement);
                    
                    // 应用代码高亮
                    if (typeof hljs !== 'undefined') {
                        try {
                            hljs.highlightElement(codeElement);
                        } catch (e) {
                        }
                    }
                    
                    // 将代码块添加到管理集合
                    if (this.codeBlocks) {
                        this.codeBlocks.add(preElement);
                    }
                } catch (error) {
                }
            });
            
            // 更新所有代码块的高度和滚动状态
            this.updateExistingCodeBlocksHeight();
            this.updateExistingCodeBlocksScroll();
            
            // 重新设置所有代码块的交互功能，确保事件绑定
            this.setupCodeBlockInteractions();
            
        } catch (error) {
        }
    }
    
    /**
     * 延迟初始化，在页面加载后处理所有代码块
     */
    initializeDelayed() {
        
        // 延迟一段时间后处理页面中的所有代码块
        setTimeout(() => {
            try {
                // 处理所有pre元素
                const preElements = document.querySelectorAll('pre:not([data-processed="true"])');
                
                if (preElements.length > 0) {
                    
                    preElements.forEach(preElement => {
                        this.processCodeBlock(preElement);
                    });
                }
                
                // 定期检查和更新代码块滚动状态
                setInterval(() => {
                    this.updateExistingCodeBlocksScroll();
                }, 1000);
                
            } catch (error) {
            }
        }, 1000);
    }
    
    /**
     * 设置DOM变化监听器，处理动态添加的代码块
     */
    setupMutationObserver() {
        // 创建一个观察器实例
        this.observer = new MutationObserver((mutations) => {
            let hasNewBlocks = false;
            
            // 检查是否有新的代码块被添加
            mutations.forEach(mutation => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // 直接子节点中的pre元素
                            const directPres = node.querySelectorAll('pre:not([data-processed="true"])');
                            
                            if (directPres.length > 0) {
                                hasNewBlocks = true;
                                directPres.forEach(preElement => {
                                    this.processCodeBlock(preElement);
                                });
                            }
                            
                            // 对于新添加的消息容器，查找其中的所有pre元素
                            if (node.classList && node.classList.contains('chat')) {
                                const messagePres = node.querySelectorAll('pre:not([data-processed="true"])');
                                
                                if (messagePres.length > 0) {
                                    hasNewBlocks = true;
                                    messagePres.forEach(preElement => {
                                        this.processCodeBlock(preElement);
                                    });
                                }
                            }
                        }
                    });
                }
            });
            
            // 如果发现新的代码块，更新滚动状态
            if (hasNewBlocks) {
                this.updateExistingCodeBlocksScroll();
            }
        });
        
        // 配置观察选项
        const config = { 
            childList: true, 
            subtree: true 
        };
        
        // 开始观察文档
        this.observer.observe(document.body, config);
        
    }
    
    /**
     * 刷新所有代码块
     */
    refreshCodeBlocks() {
        // 延迟执行，确保DOM完全更新
        setTimeout(() => {
            try {
                // 使用loadAllCodeBlocks加载所有代码块
                this.loadAllCodeBlocks();
                
                // 美化代码块UI
                this.beautifyCodeBlockUI();
                
                // 设置代码块交互功能
                this.setupCodeBlockInteractions();
                
            } catch (error) {
            }
        }, 50);
    }
    
    /**
     * 创建代码块交互 - 安全地创建
     * @param {HTMLElement} container - 容器元素
     * @returns {HTMLElement|null} - 创建的交互元素或null
     */
    createCodeBlockInteraction(container) {
        if (!container || !(container instanceof Element)) {
            return null;
        }
        
        try {
            // 创建容器
            const interactionContainer = document.createElement('div');
            interactionContainer.className = 'code-interaction-container';
            
            // 返回创建的元素
            return interactionContainer;
        } catch (error) {
            return null;
        }
    }
    
    /**
     * 加载并处理所有代码块
     */
    loadAllCodeBlocks() {
        try {
            // 查找所有代码块并处理
            const codeBlocks = document.querySelectorAll('pre code, .code-block');
            if (codeBlocks.length === 0) {
                return; // 没有代码块，直接返回
            }
            
            
            // 如果有highlight.js可用，应用高亮
            if (typeof hljs !== 'undefined') {
                codeBlocks.forEach(block => {
                    if (block && block instanceof Element) {
                        try {
                            // 如果block是pre>code，应用高亮
                            if (block.tagName === 'CODE' && block.parentElement && block.parentElement.tagName === 'PRE') {
                                hljs.highlightElement(block);
                            }
                        } catch (e) {
                        }
                    }
                });
            } else {
            }
            
            // 更新代码块滚动状态
            this.updateExistingCodeBlocksScroll();
            
        } catch (error) {
        }
    }
    
    /**
     * 收集HTML代码流，避免在流式消息中被分割
     * @param {Node} container - 消息容器
     */
    collectHtmlStreams(container) {
        try {
            // 查找标记为未完成的HTML代码块
            const incompleteHtmlBlocks = container.querySelectorAll('.code-block[data-html-collecting="true"]');
            
            if (incompleteHtmlBlocks.length > 0) {
                incompleteHtmlBlocks.forEach(block => {
                    // 获取代码元素
                    const codeElement = block.querySelector('code');
                    if (!codeElement) return;
                    
                    // 获取当前HTML内容
                    const currentHtml = codeElement.textContent || '';
                    
                    // 检查HTML是否已经完成
                    if (currentHtml.includes('```') && currentHtml.trim().endsWith('```')) {
                        // HTML代码块完成
                        
                        // 清理内容 - 移除结束标记
                        let cleanedHtml = currentHtml.replace(/```\s*$/, '');
                        
                        // 更新代码元素内容
                        codeElement.textContent = cleanedHtml;
                        
                        // 标记为完成
                        block.setAttribute('data-html-collecting', 'false');
                        
                        // 应用语法高亮
                        if (typeof hljs !== 'undefined') {
                            try {
                                hljs.highlightElement(codeElement);
                            } catch (e) {
                            }
                        }
                    }
                });
            }
            
            // 查找新的HTML代码块
            const htmlBlocks = container.querySelectorAll('.code-block:not([data-html-collecting])');
            
            htmlBlocks.forEach(block => {
                const headerElement = block.querySelector('.code-header span');
                if (!headerElement) return;
                
                // 检查是否是HTML代码块
                const language = headerElement.textContent.toLowerCase();
                if (language === 'html' || language === 'htm') {
                    // 获取代码元素
                    const codeElement = block.querySelector('code');
                    if (!codeElement) return;
                    
                    // 标记为正在收集
                    block.setAttribute('data-html-collecting', 'true');
                    
                }
            });
        } catch (error) {
        }
    }
    
    /**
     * 处理单个代码块
     * @param {HTMLElement} preElement - 代码块pre元素
     */
    processCodeBlock(preElement) {
        if (!preElement) return;
        
        // 检查是否已经处理过
        if (this.processedCodeBlocks && this.processedCodeBlocks.has(preElement)) {
            return;
        }
        
        // 检查是否有代码元素
        const codeElement = preElement.querySelector('code');
        if (!codeElement) return;
        
        // 获取语言类
        let language = 'plaintext';
        const classNames = codeElement.className.split(' ');
        for (const className of classNames) {
            if (className.startsWith('language-')) {
                language = className.replace('language-', '');
                break;
            }
        }
        
        // 生成唯一ID
        const uniqueId = `code-block-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        codeElement.id = uniqueId;
        
        // 检查是否已经是代码块容器结构
        if (preElement.parentElement && preElement.parentElement.classList.contains('code-block')) {
            // 已经是代码块容器，只需处理样式和事件
            preElement.classList.add('code-block-container');
            preElement.style.position = 'relative';
            preElement.style.overflow = 'hidden';
            preElement.style.maxHeight = '400px';
            preElement.style.minHeight = '100px';
            
            // 标记为已处理
            preElement.setAttribute('data-processed', 'true');
            if (this.processedCodeBlocks) {
                this.processedCodeBlocks.add(preElement);
            }
            
            // 检查是否有预览按钮，如果是HTML代码块
            if (language === 'html' || language === 'htm') {
                const headerElement = preElement.parentElement.querySelector('.code-header');
                if (headerElement) {
                    const rightButtons = headerElement.querySelector('.flex') || document.createElement('div');
                    rightButtons.className = 'flex';
                    
                    // 检查是否已经有预览按钮
                    if (!rightButtons.querySelector('.preview-button')) {
                        // 创建预览按钮
                        const previewButton = document.createElement('button');
                        previewButton.className = 'preview-button mr-2';
                        previewButton.setAttribute('data-code-id', uniqueId);
                        previewButton.setAttribute('title', '预览HTML');
                        previewButton.innerHTML = '<i class="fas fa-eye"></i><span>预览</span>';
                        
                        // 插入到第一个位置
                        if (rightButtons.firstChild) {
                            rightButtons.insertBefore(previewButton, rightButtons.firstChild);
                        } else {
                            rightButtons.appendChild(previewButton);
                        }
                        
                        // 如果header中没有按钮容器，添加一个
                        if (!headerElement.querySelector('.flex')) {
                            headerElement.appendChild(rightButtons);
                        }
                    }
                }
            }
            
            // 启用自动滚动
            this.enableCodeBlockAutoScroll(preElement);
            this.updateCodeBlockHeight(preElement);
            
            return;
        }
        
        // 创建代码块容器
        const codeBlockDiv = document.createElement('div');
        codeBlockDiv.className = 'code-block';
        
        // 创建代码块头部
        const headerDiv = document.createElement('div');
        headerDiv.className = 'code-header';
        
        // 标记为已处理
        preElement.setAttribute('data-processed', 'true');
        if (this.processedCodeBlocks) {
            this.processedCodeBlocks.add(preElement);
        }
        
        // 添加代码块容器样式
        preElement.classList.add('code-block-container');
        preElement.style.position = 'relative';
        preElement.style.overflow = 'hidden';
        preElement.style.maxHeight = '400px';
        preElement.style.minHeight = '100px';
        
        // 判断是否为HTML代码
        if (language === 'html' || language === 'htm') {
            headerDiv.innerHTML = `
                <span>${language}</span>
                <div class="flex">
                    <button class="preview-button mr-2" data-code-id="${uniqueId}" title="预览HTML">
                        <i class="fas fa-eye"></i>
                        <span>预览</span>
                    </button>
                    <button class="wrap-button" data-code-id="${uniqueId}" title="切换换行">
                        <i class="fas fa-text-width"></i>
                        <span>换行</span>
                    </button>
                    <button class="copy-button" data-code-id="${uniqueId}">
                        <i class="fas fa-copy"></i>
                        <span>复制</span>
                    </button>
                </div>
            `;
        } else {
            headerDiv.innerHTML = `
                <span>${language}</span>
                <div class="flex">
                    <button class="wrap-button" data-code-id="${uniqueId}" title="切换换行">
                        <i class="fas fa-text-width"></i>
                        <span>换行</span>
                    </button>
                    <button class="copy-button" data-code-id="${uniqueId}">
                        <i class="fas fa-copy"></i>
                        <span>复制</span>
                    </button>
                </div>
            `;
        }
        
        // 如果是HTML代码块，标记为正在收集
        if (language === 'html' || language === 'htm') {
            codeBlockDiv.setAttribute('data-html-collecting', 'true');
        }
        
        // 替换原始pre元素
        if (preElement.parentNode) {
            preElement.parentNode.insertBefore(codeBlockDiv, preElement);
            codeBlockDiv.appendChild(headerDiv);
            codeBlockDiv.appendChild(preElement);
            
            // 启用自动滚动
            this.enableCodeBlockAutoScroll(preElement);
            this.updateCodeBlockHeight(preElement);
        }
    }
    
    /**
     * 更新代码块高度，避免抖动
     * @param {HTMLElement} preElement - 代码块pre元素
     */
    updateCodeBlockHeight(preElement) {
        if (!preElement) return;
        
        const codeElement = preElement.querySelector('code');
        if (!codeElement) return;
        
        // 检查是否在生成中
        const isGenerating = document.body.classList.contains('isGenerating') || 
                             preElement.closest('.chat')?.classList.contains('isGenerating') || 
                             preElement.getAttribute('data-generating') === 'true';
        
        // 如果是首次设置高度
        if (!preElement.dataset.heightStabilized) {
            // 不再设置过大的minHeight，使用固定的合理值
            preElement.style.minHeight = '100px';
            preElement.dataset.heightStabilized = 'true';
            
            // 同时处理滚动条显示
            if (isGenerating) {
                preElement.style.overflowY = 'hidden'; // 生成中隐藏滚动条
                preElement.style.maxHeight = 'none'; // 不限制高度
            } else {
                preElement.style.overflowY = 'auto'; // 生成后显示滚动条
                preElement.style.maxHeight = '400px'; // 限制高度
                // 确保移除任何可能存在的大min-height
                preElement.style.removeProperty('min-height');
            }
        }
        // 如果代码块已经完成渲染
        else if (preElement.dataset.heightStabilized === 'true') {
            // 根据生成状态切换滚动条和高度限制
            if (!isGenerating && preElement.getAttribute('data-generating') === 'true') {
                // 生成刚刚结束，从无限制切换到有限制
                preElement.style.transition = 'max-height 0.3s ease-in-out';
                preElement.style.maxHeight = '400px';
                preElement.style.overflowY = 'auto';
                
                // 完全移除min-height属性，确保滚动条可以显示
                preElement.style.removeProperty('min-height');
                
                preElement.setAttribute('data-generating', 'false');
                
                // 300ms后移除过渡效果
                setTimeout(() => {
                    preElement.style.transition = '';
                }, 300);
            }
            else if (isGenerating) {
                // 正在生成，避免滚动条闪烁
                preElement.style.maxHeight = 'none';
                preElement.style.overflowY = 'hidden';
                preElement.setAttribute('data-generating', 'true');
                
                // 不再调整minHeight，保持一个合理的固定值
                preElement.style.minHeight = '100px';
            }
        }
    }
    
    /**
     * 更新已有代码块的高度，防止渲染抖动
     */
    updateExistingCodeBlocksHeight() {
        // 获取所有已处理的代码块
        const processedPreElements = document.querySelectorAll('pre[data-processed="true"]');
        
        processedPreElements.forEach(preElement => {
            try {
                // 更新高度以防止抖动
                this.updateCodeBlockHeight(preElement);
                
                // 检查是否生成已完成，如果完成则确保移除过大的min-height
                const isGenerating = document.body.classList.contains('isGenerating') || 
                                    preElement.closest('.chat')?.classList.contains('isGenerating');
                if (!isGenerating) {
                    // 确保移除任何过大的min-height值
                    preElement.style.removeProperty('min-height');
                    preElement.style.maxHeight = '400px';
                    preElement.style.overflowY = 'auto';
                }
            } catch (error) {
            }
        });
    }
    
    /**
     * 更新代码块交互功能，为代码块添加复制、预览等按钮功能
     */
    updateCodeBlockInteractions() {
        try {
            // 直接调用setupCodeBlockInteractions以确保所有按钮事件都被重新绑定
            this.setupCodeBlockInteractions();
            
        } catch (error) {
        }
    }
    
    // 将按钮样式配置添加到类中，使其可用
    get buttonStyles() {
        return {
            base: 'text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors',
            primary: 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800',
            secondary: 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
            icon: 'text-xs mr-1'
        };
    }

    // 不再需要这些单独的方法，但保留空方法实现以保持向后兼容性
    setupCopyButtons() {
        // 为向后兼容保留空方法
    }

    setupWrapButtons() {
        // 为向后兼容保留空方法
    }

    setupPreviewButtons() {
        // 为向后兼容保留空方法
    }
} 