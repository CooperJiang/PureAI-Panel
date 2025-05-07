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
        // 直接创建HTML预览组件实例
        try {
            this.htmlPreview = new HtmlPreview();
            this.toast = new Toast();
            
            // 设置为全局变量以便其他模块可以使用
            window['htmlPreview'] = this.htmlPreview;
            window['toast'] = this.toast;
        } catch (error) {
            console.error('[CodeBlockManager] 初始化预览组件失败:', error);
        }
        
        // 保存对代码块元素的引用
        this.codeBlocks = new Map();
        
        // 按钮样式配置
        this.buttonStyles = {
            base: 'flex items-center gap-1 px-2 py-1 rounded text-sm transition-all duration-200',
            primary: 'bg-indigo-500 hover:bg-indigo-600 text-white',
            secondary: 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200',
            icon: 'mr-1 text-xs'
        };
        
        // 初始化MutationObserver，监听DOM变化以自动重新初始化代码块
        this.initMutationObserver();
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
                console.log('[CodeBlockManager] 检测到DOM变化，重新初始化代码块');
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
            console.log('[CodeBlockManager] 初始化代码块管理器');
            
            // 确保HTML预览组件已初始化
            if (!this.htmlPreview) {
                try {
                    this.htmlPreview = new HtmlPreview();
                    window['htmlPreview'] = this.htmlPreview;
                } catch (error) {
                    console.error('[CodeBlockManager] 初始化HTML预览组件失败:', error);
                }
            }
            
            // 确保Toast组件已初始化
            if (!this.toast) {
                try {
                    this.toast = new Toast();
                    window['toast'] = this.toast;
                } catch (error) {
                    console.error('[CodeBlockManager] 初始化Toast组件失败:', error);
                }
            }
            
            // 常规初始化
            this.loadAllCodeBlocks();
            this.setupCodeBlockInteractions();
            this.beautifyCodeBlockUI();
            
            // 添加延迟初始化和变化监听，确保处理动态添加的代码块
            this.initializeDelayed();
            
            // 为window添加辅助方法，方便其他模块调用
            window['reinitializeCodeBlocks'] = () => this.refreshCodeBlocks();
            
            console.log('[CodeBlockManager] 代码块管理器初始化完成，HTML预览组件状态:', this.htmlPreview ? '已加载' : '未加载');
            
            // 触发自定义事件，通知其他组件代码块管理器已初始化
            document.dispatchEvent(new CustomEvent('codeblock-manager-ready'));
            
            return true;
        } catch (error) {
            console.error('[CodeBlockManager] 初始化代码块管理器时出错:', error);
            return false;
        }
    }
    
    /**
     * 重新初始化所有代码块
     * 这个方法将清除所有代码块上的现有事件监听器，并重新应用
     */
    reinitializeCodeBlocks() {
        console.log('[CodeBlockManager] 重新初始化所有代码块...');
        
        try {
            // 清除所有已设置的事件监听器
            document.querySelectorAll('.code-block button').forEach(button => {
                // 移除旧的事件监听器
                const oldClone = button.cloneNode(true);
                button.parentNode.replaceChild(oldClone, button);
                
                // 清除属性标记
                oldClone.removeAttribute('data-listener');
                oldClone.removeAttribute('data-beautified');
            });
            
            document.querySelectorAll('.code-block').forEach(block => {
                block.removeAttribute('data-beautified');
            });
            
            // 重新应用美化和事件绑定
            this.beautifyCodeBlockUI();
            this.setupCodeBlockInteractions();
            
            console.log('[CodeBlockManager] 已完成代码块重新初始化');
        } catch (error) {
            console.error('[CodeBlockManager] 重新初始化代码块时出错:', error);
        }
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
                    'border', 'border-gray-200', 'dark:border-gray-700',
                    'overflow-auto'
                );
                
                // 添加最大高度限制和滚动条样式
                codeContainer.style.maxHeight = '400px'; // 最大高度400px
                codeContainer.style.overflowY = 'auto';  // 垂直方向自动显示滚动条
                
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
        this.setupCopyButtons();
        this.setupWrapButtons();
        this.setupPreviewButtons();
    }
    
    /**
     * 设置复制按钮功能
     */
    setupCopyButtons() {
        document.querySelectorAll('.copy-button').forEach(button => {
            if (button.getAttribute('data-listener') === 'true') return;
            button.setAttribute('data-listener', 'true');
            
            // 克隆按钮以移除所有现有事件监听器
            const newButton = button.cloneNode(true);
            if (button.parentNode) {
                button.parentNode.replaceChild(newButton, button);
            }
            
            // 为新按钮添加事件监听器
            newButton.addEventListener('click', () => {
                const codeId = newButton.getAttribute('data-code-id');
                const codeElement = document.getElementById(codeId);
                
                if (codeElement) {
                    const code = codeElement.textContent || '';
                    
                    navigator.clipboard.writeText(code).then(() => {
                        if (this.toast) {
                            this.toast.success('代码已复制到剪贴板');
                        }
                        
                        // 复制成功视觉反馈
                        newButton.classList.add('copied');
                        const originalIcon = newButton.querySelector('i').className;
                        newButton.querySelector('i').className = 'fas fa-check';
                        newButton.querySelector('span').textContent = '已复制';
                        
                        setTimeout(() => {
                            newButton.classList.remove('copied');
                            newButton.querySelector('i').className = originalIcon;
                            newButton.querySelector('span').textContent = '复制';
                        }, 1500);
                    }).catch(err => {
                        console.error('复制代码失败:', err);
                        if (this.toast) {
                            this.toast.error('复制失败，请重试');
                        }
                    });
                }
            });
        });
    }
    
    /**
     * 设置换行按钮功能
     */
    setupWrapButtons() {
        document.querySelectorAll('.wrap-button').forEach(button => {
            if (button.getAttribute('data-listener') === 'true') return;
            button.setAttribute('data-listener', 'true');
            
            // 克隆按钮以移除所有现有事件监听器
            const newButton = button.cloneNode(true);
            if (button.parentNode) {
                button.parentNode.replaceChild(newButton, button);
            }
            
            // 为新按钮添加事件监听器
            newButton.addEventListener('click', () => {
                const codeId = newButton.getAttribute('data-code-id');
                const codeElement = document.getElementById(codeId);
                
                if (codeElement) {
                    const codeBlock = codeElement.closest('.code-block');
                    
                    if (codeBlock) {
                        // 切换换行类
                        const wasWrapped = codeBlock.classList.contains('wrap-code');
                        codeBlock.classList.toggle('wrap-code');
                        const isWrapped = codeBlock.classList.contains('wrap-code');
                        
                        // 更新按钮状态
                        newButton.querySelector('span').textContent = isWrapped ? '不换行' : '换行';
                        newButton.querySelector('i').className = isWrapped ? 'fas fa-align-left' : 'fas fa-text-width';
                        
                        // 触发窗口调整以更新滚动条
                        setTimeout(() => {
                            window.dispatchEvent(new Event('resize'));
                            
                            // 重新应用代码高亮
                            if (typeof hljs !== 'undefined') {
                                try {
                                    hljs.highlightElement(codeElement);
                                } catch (e) {
                                    console.error('重新应用代码高亮失败:', e);
                                }
                            }
                        }, 50);
                    }
                }
            });
        });
    }
    
    /**
     * 设置预览按钮功能
     */
    setupPreviewButtons() {
        document.querySelectorAll('.preview-button').forEach(button => {
            if (button.getAttribute('data-listener') === 'true') return;
            button.setAttribute('data-listener', 'true');
            
            // 克隆按钮以移除所有现有事件监听器
            const newButton = button.cloneNode(true);
            if (button.parentNode) {
                button.parentNode.replaceChild(newButton, button);
            }
            
            // 为新按钮添加事件监听器
            newButton.addEventListener('click', () => {
                // 确保HTML预览组件已初始化
                if (!this.htmlPreview) {
                    console.error('[预览] HTML预览组件未初始化，尝试重新初始化');
                    try {
                        this.htmlPreview = new HtmlPreview();
                        window['htmlPreview'] = this.htmlPreview;
                    } catch (error) {
                        console.error('[预览] 重新初始化HTML预览组件失败:', error);
                        if (this.toast) {
                            this.toast.error('无法初始化预览组件，请刷新页面后重试');
                        } else {
                            alert('无法初始化预览组件，请刷新页面后重试');
                        }
                        return;
                    }
                }
                
                const codeId = newButton.getAttribute('data-code-id');
                const codeElement = document.getElementById(codeId);
                
                if (codeElement) {
                    const htmlCode = codeElement.textContent || '';
                    
                    if (htmlCode.trim()) {
                        console.log('[预览] 显示HTML预览，代码长度:', htmlCode.length);
                        this.htmlPreview.showPreview(htmlCode);
                    } else if (this.toast) {
                        this.toast.warning('HTML代码为空，无法预览');
                    }
                }
            });
        });
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
            console.error('自动转换HTML预览失败:', e);
        }
    }
    
    /**
     * 为代码容器启用自动滚动功能
     * @param {HTMLElement} codeContainer - 代码容器元素
     */
    enableCodeBlockAutoScroll(codeContainer) {
        if (!codeContainer) return;
        
        // 标记代码容器，避免重复设置监听器
        if (codeContainer.hasAttribute('data-autoscroll')) return;
        codeContainer.setAttribute('data-autoscroll', 'true');
        
        // 获取父消息容器，用于跟踪是否为当前生成中的消息
        const messageContainer = codeContainer.closest('.chat');
        if (!messageContainer) return;
        
        // 创建MutationObserver监听代码内容变化
        const observer = new MutationObserver((mutations) => {
            try {
                // 检查是否有内容变化
                let contentChanged = false;
                
                for (const mutation of mutations) {
                    if (mutation.type === 'childList' || mutation.type === 'characterData') {
                        contentChanged = true;
                        break;
                    }
                }
                
                if (contentChanged) {
                    // 检查这是否是当前正在生成的消息
                    const isActiveMessage = messageContainer.querySelector('.cursor-blink') !== null;
                    
                    // 检查代码容器是否有滚动条
                    const hasScrollbar = codeContainer.scrollHeight > codeContainer.clientHeight;
                    
                    // 当是正在生成的消息且有滚动条时，自动滚动到底部
                    if (isActiveMessage && hasScrollbar) {
                        // 延迟一点点执行滚动，确保渲染完成
                        setTimeout(() => {
                            codeContainer.scrollTop = codeContainer.scrollHeight;
                        }, 10);
                    }
                }
            } catch (error) {
                console.error('[CodeBlockManager] 代码块自动滚动出错:', error);
            }
        });
        
        // 开始观察代码容器的变化
        observer.observe(codeContainer, {
            childList: true,   // 监听子节点添加或删除
            subtree: true,     // 监听所有后代节点
            characterData: true // 监听文本内容变化
        });
        
        // 存储observer引用以便清理
        codeContainer._autoScrollObserver = observer;
    }
    
    /**
     * 更新现有代码块的滚动状态
     * @param {HTMLElement} container - 容器元素，默认为document.body
     */
    updateExistingCodeBlocksScroll(container = document.body) {
        try {
            // 确保container不为null
            if (!container) {
                console.warn('[CodeBlockManager] 提供的容器为null或undefined，使用document.body作为替代');
                container = document.body;
            }
            
            // 再次验证container存在且为Element类型
            if (!(container instanceof Element)) {
                console.error('[CodeBlockManager] 容器不是有效的DOM元素，跳过更新');
                return;
            }
            
            // 查找所有代码块容器
            const codeContainers = container.querySelectorAll('.code-block pre');
            if (codeContainers.length === 0) {
                // 如果未找到代码块，静默返回
                return;
            }
            
            codeContainers.forEach(codeContainer => {
                // 检查代码容器是否有效
                if (!codeContainer || !(codeContainer instanceof Element)) {
                    return;
                }
                
                // 检查是否已启用自动滚动
                if (!codeContainer.hasAttribute('data-autoscroll')) {
                    this.enableCodeBlockAutoScroll(codeContainer);
                }
                
                // 检查是否需要限制高度
                if (!codeContainer.style.maxHeight) {
                    codeContainer.style.maxHeight = '400px';
                    codeContainer.style.overflowY = 'auto';
                }
                
                // 对于正在生成的消息中的代码块，直接滚动到底部
                const messageContainer = codeContainer.closest('.chat');
                if (messageContainer && messageContainer.querySelector('.cursor-blink')) {
                    setTimeout(() => {
                        if (codeContainer.scrollHeight > 0) {
                            codeContainer.scrollTop = codeContainer.scrollHeight;
                        }
                    }, 10);
                }
            });
        } catch (error) {
            console.error('[CodeBlockManager] 更新代码块滚动状态出错:', error);
        }
    }
    
    /**
     * 更新代码块UI并应用交互功能
     * @param {HTMLElement} container - 容器元素，默认为document.body
     */
    updateCodeBlocks(container = document.body) {
        try {
            // 确保container不为null
            if (!container) {
                console.warn('[CodeBlockManager] 提供的容器为null或undefined，使用document.body作为替代');
                container = document.body;
            }
            
            // 再次验证container存在且为Element类型
            if (!(container instanceof Element)) {
                console.error('[CodeBlockManager] 容器不是有效的DOM元素，跳过更新');
                return;
            }
            
            // 美化代码块UI
            this.beautifyCodeBlockUI();
            
            // 初始化代码块交互功能
            this.setupCodeBlockInteractions();
            
            // 更新代码块滚动状态
            this.updateExistingCodeBlocksScroll(container);
            
            console.log('[CodeBlockManager] 已更新代码块UI和交互功能');
        } catch (error) {
            console.error('[CodeBlockManager] 更新代码块出错:', error);
        }
    }
    
    /**
     * 延迟初始化代码块
     * 用于处理动态添加的消息中的代码块
     */
    initializeDelayed() {
        // 延迟添加初始化，确保DOM加载完毕
        setTimeout(() => {
            this.loadAllCodeBlocks();
            this.setupCodeBlockInteractions();
            this.beautifyCodeBlockUI();
        }, 50);
        
        // 添加变化监听，处理动态添加的消息
        this.setupMutationObserver();
    }
    
    /**
     * 设置DOM变化监听
     */
    setupMutationObserver() {
        // 如果已经存在监听器，先清除
        if (this.observer) {
            this.observer.disconnect();
        }
        
        // 创建新的监听器
        this.observer = new MutationObserver((mutations) => {
            let needsRefresh = false;
            
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    // 检查是否有代码块元素添加
                    const hasNewCodeBlocks = Array.from(mutation.addedNodes).some(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const element = node;
                            return element.querySelector && (
                                element.querySelector('pre code') ||
                                element.querySelector('.code-block')
                            );
                        }
                        return false;
                    });
                    
                    if (hasNewCodeBlocks) {
                        needsRefresh = true;
                        break;
                    }
                }
            }
            
            // 如果检测到新的代码块，刷新处理
            if (needsRefresh) {
                this.refreshCodeBlocks();
            }
        });
        
        // 开始监听整个聊天区域
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            this.observer.observe(chatMessages, { 
                childList: true, 
                subtree: true 
            });
        }
        
        // 监听消息添加事件
        document.addEventListener('message-added', () => {
            this.refreshCodeBlocks();
        });
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
                
                console.log('[CodeBlockManager] 已刷新代码块处理');
            } catch (error) {
                console.error('[CodeBlockManager] 刷新代码块时出错:', error);
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
            console.warn('[CodeBlockManager] 尝试在无效容器上创建代码块交互');
            return null;
        }
        
        try {
            // 创建容器
            const interactionContainer = document.createElement('div');
            interactionContainer.className = 'code-interaction-container';
            
            // 返回创建的元素
            return interactionContainer;
        } catch (error) {
            console.error('[CodeBlockManager] 创建代码块交互元素出错:', error);
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
            
            console.log(`[CodeBlockManager] 发现 ${codeBlocks.length} 个代码块，开始处理`);
            
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
                            console.warn('[CodeBlockManager] 代码高亮处理失败:', e);
                        }
                    }
                });
            } else {
                console.warn('[CodeBlockManager] highlight.js 未加载，跳过代码高亮');
            }
            
            // 更新代码块滚动状态
            this.updateExistingCodeBlocksScroll();
            
            console.log('[CodeBlockManager] 所有代码块处理完成');
        } catch (error) {
            console.error('[CodeBlockManager] 加载代码块时出错:', error);
        }
    }
} 