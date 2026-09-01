const { getProfile } = require('./api/user')
const { getToken, clearSession, isLoggedIn } = require('./utils/auth')
const { shouldUseMock } = require('./utils/request')

App({
  globalData: {
    userInfo: null,
    /** 账单/概览作用域：1=个人，2=群组（与后端 ScopeType 一致） */
    scopeType: 1,
    /** 用户是否主动切到个人（有群组时默认群组，此标记为 true 则保持个人） */
    scopePreferPersonal: false,
    /** 群组模式下当前选中的群组 id */
    currentGroupId: null,
    // 切换为 false 并配置 apiBaseUrl 后走真实后端
    useMock: false,
    apiBaseUrl: 'http://127.0.0.1:9095'
  },

  onLaunch() {
    this.bootstrapUser()
    // 预拉类目/账户枚举（失败不影响启动）
    try {
      const { loadConfig } = require('./utils/config-store')
      loadConfig().catch(() => {})
    } catch (e) {
      /* ignore */
    }
  },

  /**
   * 启动恢复会话：
   * - 无 token：保持未登录，不请求资料
   * - 有 token：拉资料；失败则清会话（不强制跳转，避免启动打扰）
   */
  async bootstrapUser() {
    if (!shouldUseMock() && !isLoggedIn()) {
      this.globalData.userInfo = null
      return
    }

    // Mock 且从未登录过：不自动灌入用户，等待手动登录
    if (shouldUseMock() && !getToken()) {
      this.globalData.userInfo = null
      return
    }

    try {
      const user = await getProfile()
      this.globalData.userInfo = user
    } catch (err) {
      clearSession()
      console.warn('bootstrap user failed', err)
    }
  }
})
