// 图片查看器组件
export class ImageViewer {
    constructor() {
        this.modal = null;
        this.image = null;
        this.init();
    }
    
    // 初始化图片查看器
    init() {
        // 创建模态框
        this.modal = document.createElement('div');
        this.modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm hidden';
        this.modal.id = 'image-viewer-modal';
        
        this.modal.innerHTML = `
            <div class="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center">
                <img src="" alt="预览图片" class="max-w-full max-h-[85vh] object-contain" id="image-viewer-img">
                <div class="absolute top-2 right-2 flex gap-2">
                    <a id="image-download-btn" href="#" download class="bg-white/20 hover:bg-white/30 p-2 rounded-full backdrop-blur-sm text-white transition-colors" title="下载图片">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                    </a>
                    <button id="image-close-btn" class="bg-white/20 hover:bg-white/30 p-2 rounded-full backdrop-blur-sm text-white transition-colors" title="关闭预览">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        // 添加到DOM
        document.body.appendChild(this.modal);
        
        // 绑定事件
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
        
        const closeBtn = document.getElementById('image-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
        
        // 添加ESC关闭功能
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
                this.close();
            }
        });
    }
    
    // 打开图片查看器
    open(imageUrl) {
        if (!this.modal) this.init();
        
        // 更新图片源
        const imgElement = /** @type {HTMLImageElement} */ (document.getElementById('image-viewer-img'));
        const downloadBtn = /** @type {HTMLAnchorElement} */ (document.getElementById('image-download-btn'));
        
        if (imgElement) {
            imgElement.src = imageUrl;
            
            // 获取图片文件名
            const fileName = imageUrl.split('/').pop();
            
            // 更新下载按钮
            if (downloadBtn) {
                downloadBtn.href = imageUrl;
                downloadBtn.download = fileName || 'image.png';
            }
            
            // 显示模态框
            this.modal.classList.remove('hidden');
            this.modal.classList.add('animate__animated', 'animate__fadeIn');
        }
    }
    
    // 关闭图片查看器
    close() {
        if (this.modal) {
            this.modal.classList.add('hidden');
            this.modal.classList.remove('animate__animated', 'animate__fadeIn');
        }
    }
    
    // 处理页面上的所有图片，添加点击预览功能
    setupImagePreviews() {
        // 为所有消息内的图片添加点击事件
        document.querySelectorAll('.markdown-content img:not(.preview-enabled)').forEach(img => {
            // 限制图片宽度
            img.classList.add('max-w-[520px]', 'cursor-pointer', 'hover:opacity-90', 'transition-opacity', 'preview-enabled');
            
            // 添加点击事件
            img.addEventListener('click', () => {
                this.open(/** @type {HTMLImageElement} */(img).src);
            });
        });
    }
} 