// Toast组件 - 全局消息提示
export class Toast {
    constructor() {
        this.toastContainer = null;
        this.createToastContainer();
    }
    
    // 创建Toast容器
    createToastContainer() {
        // 检查是否已存在
        if (document.getElementById('toast-container')) {
            this.toastContainer = document.getElementById('toast-container');
            return;
        }
        
        // 创建Toast容器
        this.toastContainer = document.createElement('div');
        this.toastContainer.id = 'toast-container';
        this.toastContainer.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2';
        document.body.appendChild(this.toastContainer);
    }
    
    // 显示提示
    show(message, type = 'success', duration = 3000) {
        // 创建toast元素
        const toast = document.createElement('div');
        toast.className = `toast-item animate__animated animate__fadeInRight flex items-center gap-2 py-2 px-4 rounded-md shadow-md text-sm max-w-sm`;
        
        // 设置不同类型的样式
        switch (type) {
            case 'success':
                toast.classList.add('bg-green-100', 'text-green-800', 'border-l-4', 'border-green-500');
                toast.innerHTML = `<i class="fas fa-check-circle text-green-500"></i>`;
                break;
            case 'info':
                toast.classList.add('bg-blue-100', 'text-blue-800', 'border-l-4', 'border-blue-500');
                toast.innerHTML = `<i class="fas fa-info-circle text-blue-500"></i>`;
                break;
            case 'warning':
                toast.classList.add('bg-yellow-100', 'text-yellow-800', 'border-l-4', 'border-yellow-500');
                toast.innerHTML = `<i class="fas fa-exclamation-circle text-yellow-500"></i>`;
                break;
            case 'error':
                toast.classList.add('bg-red-100', 'text-red-800', 'border-l-4', 'border-red-500');
                toast.innerHTML = `<i class="fas fa-times-circle text-red-500"></i>`;
                break;
            default:
                toast.classList.add('bg-gray-100', 'text-gray-800', 'border-l-4', 'border-gray-500');
                toast.innerHTML = `<i class="fas fa-bell text-gray-500"></i>`;
        }
        
        // 添加消息文本
        toast.innerHTML += `<span>${message}</span>`;
        
        // 添加到容器
        this.toastContainer.appendChild(toast);
        
        // 设置自动消失
        setTimeout(() => {
            toast.classList.replace('animate__fadeInRight', 'animate__fadeOutRight');
            setTimeout(() => {
                if (toast.parentNode === this.toastContainer) {
                    this.toastContainer.removeChild(toast);
                }
            }, 500);
        }, duration);
        
        return toast;
    }
    
    // 成功提示
    success(message, duration = 3000) {
        return this.show(message, 'success', duration);
    }
    
    // 信息提示
    info(message, duration = 3000) {
        return this.show(message, 'info', duration);
    }
    
    // 警告提示
    warning(message, duration = 3000) {
        return this.show(message, 'warning', duration);
    }
    
    // 错误提示
    error(message, duration = 3000) {
        return this.show(message, 'error', duration);
    }
} 