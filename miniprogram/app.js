const { getProfile } = require('./api/user')

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

  async bootstrapUser() {
    try {
      const user = await getProfile()
      this.globalData.userInfo = user
    } catch (err) {
      console.warn('bootstrap user failed', err)
    }
  }
})
