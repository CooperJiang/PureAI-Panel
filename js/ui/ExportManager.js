/**
 * 导出管理模块 - 负责处理聊天对话的导出功能
 */
export class ExportManager {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {Object} options.conversationManager - 对话管理器
     * @param {Object} options.chatComponent - 聊天消息组件
     */
    constructor(options) {
        this.conversationManager = options.conversationManager;
        this.chatComponent = options.chatComponent;
        
        // 添加工具栏按钮
        this.addExportButton();
    }
    
    /**
     * 添加导出按钮
     */
    addExportButton() {
        const header = document.querySelector('header');
        if (!header) return;
        
        // 检查是否已存在导出按钮
        if (document.getElementById('exportBtn')) return;
        
        // 创建导出按钮
        const exportBtn = document.createElement('button');
        exportBtn.id = 'exportBtn';
        exportBtn.className = 'h-8 w-8 flex items-center justify-center rounded-md hover:bg-openai-hover transition-all text-openai-gray mr-2';
        exportBtn.title = '导出对话';
        exportBtn.innerHTML = '<i class="fas fa-download text-sm"></i>';
        
        // 创建下拉菜单
        const dropdown = document.createElement('div');
        dropdown.className = 'export-dropdown absolute hidden mt-2 w-40 bg-white shadow-lg rounded-md border border-openai-border z-50';
        dropdown.innerHTML = `
            <ul class="py-1">
                <li>
                    <button id="exportMd" class="px-4 py-2 text-sm text-openai-text hover:bg-openai-hover w-full text-left">
                        导出为 Markdown
                    </button>
                </li>
                <li>
                    <button id="exportPdf" class="px-4 py-2 text-sm text-openai-text hover:bg-openai-hover w-full text-left">
                        导出为 PDF
                    </button>
                </li>
            </ul>
        `;
        
        // 创建包装容器以便定位下拉菜单
        const container = document.createElement('div');
        container.className = 'relative';
        container.appendChild(exportBtn);
        container.appendChild(dropdown);
        
        // 在设置按钮前插入导出按钮
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn && settingsBtn.parentNode) {
            settingsBtn.parentNode.insertBefore(container, settingsBtn);
        } else {
            // 如果找不到设置按钮，则添加到头部工具栏
            const toolbarRight = header.querySelector('.flex.items-center.gap-2');
            if (toolbarRight) {
                toolbarRight.insertBefore(container, toolbarRight.firstChild);
            }
        }
        
        // 点击导出按钮显示下拉菜单
        exportBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        });
        
        // 点击文档任何地方关闭下拉菜单
        document.addEventListener('click', () => {
            dropdown.classList.add('hidden');
        });
        
        // 导出为Markdown
        const exportMd = document.getElementById('exportMd');
        if (exportMd) {
            exportMd.addEventListener('click', () => {
                this.exportChat('markdown');
                dropdown.classList.add('hidden');
            });
        }
        
        // 导出为PDF
        const exportPdf = document.getElementById('exportPdf');
        if (exportPdf) {
            exportPdf.addEventListener('click', () => {
                this.exportChat('pdf');
                dropdown.classList.add('hidden');
            });
        }
    }
    
    /**
     * 导出对话
     * @param {string} format - 导出格式：'markdown'或'pdf'
     */
    exportChat(format) {
        const conversation = this.conversationManager.getCurrentConversation();
        if (!conversation || !conversation.messages || conversation.messages.length === 0) {
            // @ts-ignore
            window.toast.info('当前对话为空，无法导出');
            return;
        }
        
        const title = conversation.title || '对话记录';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const filename = `${title}-${timestamp}`;
        
        if (format === 'markdown') {
            // 导出为Markdown
            let markdown = `# ${title}\n\n`;
            markdown += `导出时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
            
            conversation.messages.forEach(msg => {
                const role = msg.role === 'user' ? '🧑 用户' : '🤖 助手';
                markdown += `## ${role}\n\n${msg.content}\n\n`;
            });
            
            // 创建下载链接
            const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
            this.createDownload(blob, `${filename}.md`);
            
            // @ts-ignore
            window.toast.success('已导出为Markdown格式');
        } else if (format === 'pdf') {
            // @ts-ignore
            window.toast.info('正在生成PDF...');
            
            // 创建临时容器
            const tempContainer = document.createElement('div');
            tempContainer.className = 'pdf-export-container';
            tempContainer.style.padding = '20px';
            tempContainer.style.maxWidth = '800px';
            tempContainer.style.margin = '0 auto';
            tempContainer.style.fontFamily = 'Arial, sans-serif';
            document.body.appendChild(tempContainer);
            
            // 添加标题
            const titleEl = document.createElement('h1');
            titleEl.textContent = title;
            titleEl.style.marginBottom = '10px';
            tempContainer.appendChild(titleEl);
            
            // 添加时间戳
            const timestampEl = document.createElement('p');
            timestampEl.textContent = `导出时间: ${new Date().toLocaleString('zh-CN')}`;
            timestampEl.style.marginBottom = '20px';
            timestampEl.style.color = '#666';
            tempContainer.appendChild(timestampEl);
            
            // 添加内容
            conversation.messages.forEach(msg => {
                // 角色标题
                const roleTitle = document.createElement('h2');
                roleTitle.textContent = msg.role === 'user' ? '🧑 用户' : '🤖 助手';
                roleTitle.style.marginTop = '20px';
                roleTitle.style.marginBottom = '10px';
                roleTitle.style.color = msg.role === 'user' ? '#10a37f' : '#000';
                tempContainer.appendChild(roleTitle);
                
                // 消息内容
                const contentEl = document.createElement('div');
                // 使用marked解析markdown
                // @ts-ignore
                if (typeof marked !== 'undefined') {
                    // @ts-ignore
                    contentEl.innerHTML = marked.parse(msg.content);
                } else {
                    contentEl.innerText = msg.content;
                }
                
                contentEl.style.marginBottom = '20px';
                contentEl.style.lineHeight = '1.6';
                tempContainer.appendChild(contentEl);
            });
            
            // 尝试导入html2pdf库
            this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js')
                .then(() => {
                    // @ts-ignore
                    if (typeof html2pdf !== 'undefined') {
                        const options = {
                            margin: 10,
                            filename: `${filename}.pdf`,
                            image: { type: 'jpeg', quality: 0.98 },
                            html2canvas: { scale: 2 },
                            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                        };
                        
                        // @ts-ignore
                        html2pdf().from(tempContainer).set(options).save()
                            .then(() => {
                                document.body.removeChild(tempContainer);
                                // @ts-ignore
                                window.toast.success('已导出为PDF格式');
                            })
                            .catch(err => {
                                console.error('PDF导出失败:', err);
                                document.body.removeChild(tempContainer);
                                // @ts-ignore
                                window.toast.error('PDF导出失败，请稍后重试');
                            });
                    } else {
                        document.body.removeChild(tempContainer);
                        // @ts-ignore
                        window.toast.error('未能加载PDF生成库，请检查网络连接');
                    }
                })
                .catch(err => {
                    console.error('加载html2pdf失败:', err);
                    document.body.removeChild(tempContainer);
                    // @ts-ignore
                    window.toast.error('加载PDF生成库失败，请检查网络连接');
                });
        }
    }
    
    /**
     * 创建文件下载
     * @param {Blob} blob - 文件blob对象
     * @param {string} filename - 文件名
     */
    createDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        
        // 添加到DOM中并触发下载
        document.body.appendChild(a);
        a.click();
        
        // 清理
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
    
    /**
     * 加载脚本
     * @param {string} src - 脚本URL
     * @returns {Promise} - Promise对象
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            // 检查是否已经加载
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
} 