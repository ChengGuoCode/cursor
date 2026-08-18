const { getProfile } = require('./api/user')
const { getToken, clearSession, isLoggedIn } = require('./utils/auth')
const { shouldUseMock } = require('./utils/request')

App({
  globalData: {
    userInfo: null,
    currentGroupId: null,
    // 切换为 false 并配置 apiBaseUrl 后走真实后端
    useMock: false,
    apiBaseUrl: 'https://127.0.0.1:9095'
  },

  onLaunch() {
    this.bootstrapUser()
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
