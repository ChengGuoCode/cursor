const { getProfile } = require('./api/user')

App({
  globalData: {
    userInfo: null,
    currentGroupId: null,
    // 切换为 false 并配置 apiBaseUrl 后走真实后端
    useMock: true,
    apiBaseUrl: 'https://api.example.com'
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
