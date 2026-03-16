/**
 * 侧边栏狐狸分割线组件
 * 这是一个带有动画狐狸的分割线，狐狸会在分割线上左右移动并上下浮动
 *
 * 支持三种状态：
 * - normal: 正常状态，狐狸缓慢移动和浮动
 * - active: 活跃状态，狐狸移动和浮动的速度更快
 * - issue: 问题状态，狐狸停止移动，只是上下浮动
 */
export class SidebarFoxDivider {
  /**
   * 构造函数
   * @param {HTMLElement} container - 容器元素
   * @param {Object} options - 配置选项
   * @param {string} options.state - 初始状态 ('normal' | 'active' | 'issue')
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.state = 'normal';           // 当前状态
    this.hovered = false;            // 鼠标是否悬停
    this.direction = 1;              // 移动方向: 1=向右, -1=向左
    this.progress = 0.18;            // 移动进度 (0-1)
    this.phase = 0;                  // 动画相位，用于计算浮动
    this.lastTs = 0;                 // 上一次动画帧时间戳
    this.earTimer = null;            // 耳朵抽动定时器
    this.earResetTimer = null;       // 耳朵抽动重置定时器
    this.frameId = 0;                // 动画帧ID
    this.foxWidth = 38;              // 狐狸宽度（像素）
    this.edgePadding = 18;           // 边缘内边距（像素）
    this.range = 0;                  // 狐狸可移动范围
    this.handleEnter = this.handleEnter.bind(this);
    this.handleLeave = this.handleLeave.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.tick = this.tick.bind(this);
    this.render();
    this.attach();
    this.setState(options.state || 'normal');
  }

  /**
   * 渲染组件DOM结构
   * 创建包含轨道和狐狸SVG的分割线
   */
  render() {
    if (!this.container) {
      return;
    }
    this.container.innerHTML = `
      <div class="sidebar-fox-divider" data-state="normal">
        <!-- 轨道背景 -->
        <div class="sidebar-fox-divider__track" aria-hidden="true"></div>
        <!-- 狐狸SVG动画 -->
        <div class="sidebar-fox-divider__fox" aria-hidden="true">
          <svg class="sidebar-fox-divider__svg" viewBox="0 0 72 40" role="presentation" focusable="false">
            <!-- 阴影 -->
            <g class="sidebar-fox-divider__shadow">
              <ellipse cx="35" cy="31.5" rx="17" ry="3.6"></ellipse>
            </g>
            <!-- 尾巴 -->
            <g class="sidebar-fox-divider__tail">
              <path d="M49 22c6-2 11-7 13-12 2 4 1 9-2 13 2 1 4 3 4 6-5 0-10-2-15-5" class="sidebar-fox-divider__fill sidebar-fox-divider__fill--tail"></path>
              <path d="M58 14c2 3 2 7 0 10" class="sidebar-fox-divider__stroke sidebar-fox-divider__stroke--soft"></path>
            </g>
            <!-- 身体 -->
            <g class="sidebar-fox-divider__body-group">
              <path d="M18 24c0-6 6-11 15-11 9 0 16 5 16 11 0 4-4 7-10 8H27c-5-.8-9-3.5-9-8Z" class="sidebar-fox-divider__fill sidebar-fox-divider__fill--body"></path>
              <path d="M24 30c0 2-1.2 3.4-2.8 3.4S18.4 32 18.4 30" class="sidebar-fox-divider__stroke"></path>
              <path d="M34 30c0 2-1.2 3.4-2.8 3.4S28.4 32 28.4 30" class="sidebar-fox-divider__stroke"></path>
              <path d="M44 30c0 2-1.2 3.4-2.8 3.4S38.4 32 38.4 30" class="sidebar-fox-divider__stroke"></path>
            </g>
            <!-- 头部（包含耳朵和面部） -->
            <g class="sidebar-fox-divider__head-group">
              <path d="M12 20c0-7 5-12 12-12 6 0 11 5 11 12 0 6-5 11-11 11-7 0-12-5-12-11Z" class="sidebar-fox-divider__fill sidebar-fox-divider__fill--head"></path>
              <!-- 后耳朵 -->
              <path d="M15 11 19 4l5 6" class="sidebar-fox-divider__fill sidebar-fox-divider__fill--ear sidebar-fox-divider__ear sidebar-fox-divider__ear--rear"></path>
              <!-- 前耳朵 -->
              <path d="M24 10 29 3l4 7" class="sidebar-fox-divider__fill sidebar-fox-divider__fill--ear sidebar-fox-divider__ear sidebar-fox-divider__ear--front"></path>
              <!-- 后耳朵内耳 -->
              <path d="M15.8 11.8 18.9 6.6l3.5 4.2" class="sidebar-fox-divider__fill sidebar-fox-divider__fill--ear-inner sidebar-fox-divider__ear sidebar-fox-divider__ear--rear"></path>
              <!-- 前耳朵内耳 -->
              <path d="M24.8 10.8 28.5 5.8l2.8 4.4" class="sidebar-fox-divider__fill sidebar-fox-divider__fill--ear-inner sidebar-fox-divider__ear sidebar-fox-divider__ear--front"></path>
              <!-- 面具 -->
              <path d="M15 22c2.2 1.8 5.2 2.8 9 2.8 3.8 0 6.9-1 9.2-2.9" class="sidebar-fox-divider__fill sidebar-fox-divider__fill--mask"></path>
              <!-- 眼睛 -->
              <circle cx="21" cy="18.2" r="1.05" class="sidebar-fox-divider__eye"></circle>
              <circle cx="28" cy="18.2" r="1.05" class="sidebar-fox-divider__eye"></circle>
              <!-- 鼻子 -->
              <path d="M24.4 20.5 23 22.2h2.7l-1.3-1.7Z" class="sidebar-fox-divider__fill sidebar-fox-divider__fill--nose"></path>
              <!-- 嘴巴 -->
              <path d="M21.8 23.1c1 1.2 2.4 1.8 4 1.8 1.7 0 3.1-.6 4.1-1.8" class="sidebar-fox-divider__stroke sidebar-fox-divider__stroke--soft"></path>
            </g>
          </svg>
        </div>
      </div>
    `;
    this.root = this.container.firstElementChild;
    this.fox = this.root ? this.root.querySelector('.sidebar-fox-divider__fox') : null;
  }

  /**
   * 附加事件监听器并启动动画
   */
  attach() {
    if (!this.root || !this.fox) {
      return;
    }
    // 鼠标进入事件
    this.fox.addEventListener('mouseenter', this.handleEnter);
    // 鼠标离开事件
    this.fox.addEventListener('mouseleave', this.handleLeave);
    // 使用ResizeObserver监听容器大小变化（如果浏览器支持）
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(this.root);
    } else {
      // 降级方案：监听window的resize事件
      window.addEventListener('resize', this.handleResize);
    }
    // 初始计算移动范围
    this.handleResize();
    // 启动耳朵抽动动画
    this.scheduleEarTwitch();
    // 启动主动画循环
    this.frameId = requestAnimationFrame(this.tick);
  }

  /**
   * 销毁组件，清理事件监听器和动画
   */
  destroy() {
    // 停止动画循环
    cancelAnimationFrame(this.frameId);
    // 清除定时器
    clearTimeout(this.earTimer);
    clearTimeout(this.earResetTimer);
    // 移除事件监听器
    if (this.fox) {
      this.fox.removeEventListener('mouseenter', this.handleEnter);
      this.fox.removeEventListener('mouseleave', this.handleLeave);
    }
    // 清理ResizeObserver
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    } else {
      window.removeEventListener('resize', this.handleResize);
    }
    // 清空容器
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  /**
   * 设置组件状态
   * @param {string} nextState - 新状态 ('normal' | 'active' | 'issue')
   */
  setState(nextState = 'normal') {
    // 规范化状态值，只接受 'normal', 'active', 'issue'
    const normalized = nextState === 'active' || nextState === 'issue' ? nextState : 'normal';
    this.state = normalized;
    // 更新DOM的data-state属性
    if (this.root) {
      this.root.dataset.state = normalized;
    }
  }

  /**
   * 鼠标进入处理函数
   */
  handleEnter() {
    this.hovered = true;
    // 添加悬停CSS类
    if (this.root) {
      this.root.classList.add('is-hovered');
    }
  }

  /**
   * 鼠标离开处理函数
   */
  handleLeave() {
    this.hovered = false;
    // 移除悬停CSS类
    if (this.root) {
      this.root.classList.remove('is-hovered');
    }
  }

  /**
   * 处理容器大小变化，重新计算狐狸移动范围
   */
  handleResize() {
    if (!this.root) {
      return;
    }
    const width = this.root.clientWidth || 0;
    // 计算可移动范围：容器宽度 - 狐狸宽度 - 左右内边距
    // 最小范围设为36px
    this.range = Math.max(36, width - this.foxWidth - this.edgePadding * 2);
  }

  /**
   * 调度耳朵抽动动画
   * 每隔 4.2-9.4 秒随机触发一次耳朵抽动
   */
  scheduleEarTwitch() {
    clearTimeout(this.earTimer);
    // 随机延迟：4200ms + 0-5200ms
    const nextDelay = 4200 + Math.random() * 5200;
    this.earTimer = setTimeout(() => {
      // 只有在非悬停状态且非问题状态时才触发抽动
      if (this.root && !this.hovered && this.state !== 'issue') {
        this.root.classList.add('is-ear-twitching');
        // 680ms后移除抽动状态
        clearTimeout(this.earResetTimer);
        this.earResetTimer = setTimeout(() => {
          if (this.root) {
            this.root.classList.remove('is-ear-twitching');
          }
        }, 680);
      }
      // 递归调度下一次抽动
      this.scheduleEarTwitch();
    }, nextDelay);
  }

  /**
   * 主动画循环，每一帧更新狐狸的位置和浮动
   * @param {number} ts - 当前时间戳（由requestAnimationFrame传入）
   */
  tick(ts) {
    if (!this.root || !this.fox) {
      return;
    }
    // 初始化时间戳
    if (!this.lastTs) {
      this.lastTs = ts;
    }
    // 计算帧间隔时间（限制最大34ms，防止长时间休眠后的跳跃）
    const dt = Math.min(34, ts - this.lastTs || 16);
    this.lastTs = ts;

    // 根据状态计算浮动幅度：
    // - issue: 0.8 (轻微浮动)
    // - active: 1.7 (大幅度浮动)
    // - normal: 1.25 (中等浮动)
    const bobAmplitude = this.state === 'issue' ? 0.8 : (this.state === 'active' ? 1.7 : 1.25);
    // 相位速度：active状态更快
    const phaseSpeed = this.state === 'active' ? 0.0032 : 0.0024;
    this.phase += dt * phaseSpeed;

    // 更新水平移动（仅在非悬停且非问题状态时）
    if (!this.hovered && this.state !== 'issue') {
      // 基础速度：active状态更快
      const baseSpeed = this.state === 'active' ? 0.00021 : 0.00014;
      // 步幅：使用两个正弦波叠加产生更自然的移动节奏
      const stride = 0.72 + Math.sin(this.phase * Math.PI * 2) * 0.2 + Math.sin(this.phase * Math.PI * 4) * 0.08;
      // 更新进度
      this.progress += dt * baseSpeed * stride * this.direction;
      // 边界检测和方向切换
      if (this.progress >= 1) {
        this.progress = 1;
        this.direction = -1;  // 向左移动
      } else if (this.progress <= 0) {
        this.progress = 0;
        this.direction = 1;   // 向右移动
      }
    }

    // 使用smoothstep函数（3t² - 2t³）使移动更平滑
    const eased = this.progress * this.progress * (3 - 2 * this.progress);
    // 计算X坐标：左内边距 + 范围 * 平滑进度
    const x = this.edgePadding + this.range * eased;
    // 计算垂直浮动（Y坐标）：
    // - 悬停时：-1.6px (向上浮动)
    // - issue状态：固定0.9px
    // - 其他状态：根据正弦波上下浮动
    const bob = this.hovered
      ? -1.6
      : (this.state === 'issue' ? 0.9 : Math.sin(this.phase * Math.PI * 2) * bobAmplitude);
    // 面部朝向：1=向右, -1=向左
    const face = this.direction >= 0 ? -1 : 1;
    // 更新CSS变量，由CSS进行实际渲染
    this.root.style.setProperty('--fox-x', `${x.toFixed(2)}px`);
    this.root.style.setProperty('--fox-bob', `${bob.toFixed(2)}px`);
    this.root.style.setProperty('--fox-face', String(face));
    // 请求下一帧动画
    this.frameId = requestAnimationFrame(this.tick);
  }
}
