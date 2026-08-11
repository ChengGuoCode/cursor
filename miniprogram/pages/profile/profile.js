const { getProfile, wxLogin, logout } = require('../../api/user')

Page({
  data: {
    user: {},
    avatarText: '记',
    useMock: true
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 })
    }
    const app = getApp()
    this.setData({ useMock: app.globalData.useMock !== false })
    this.loadProfile()
  },

  async loadProfile() {
    try {
      const user = await getProfile()
      getApp().globalData.userInfo = user
      this.setData({
        user,
        avatarText: (user.nickname || '记').slice(0, 1)
      })
    } catch (err) {
      this.setData({ user: {}, avatarText: '记' })
    }
  },

  async onLoginOrLogout() {
    if (this.data.user && this.data.user.id) {
      await logout()
      getApp().globalData.userInfo = null
      this.setData({ user: {}, avatarText: '记' })
      wx.showToast({ title: '已退出', icon: 'none' })
      return
    }

    // 预留：正式环境用 wx.login 取 code 后调后端
    wx.login({
      success: async (res) => {
        try {
          const result = await wxLogin(res.code || 'mock-code')
          getApp().globalData.userInfo = result.user
          this.setData({
            user: result.user,
            avatarText: (result.user.nickname || '记').slice(0, 1)
          })
          wx.showToast({ title: '登录成功', icon: 'success' })
        } catch (err) {
          wx.showToast({ title: err.message || '登录失败', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '微信登录不可用', icon: 'none' })
      }
    })
  },

  onExport() {
    wx.showToast({ title: '预留：导出接口 /api/bills/export', icon: 'none' })
  },

  onBudget() {
    wx.showToast({ title: '预留：预算设置页', icon: 'none' })
  },

  onCategories() {
    wx.showToast({ title: '预留：分类管理页', icon: 'none' })
  },

  onAccounts() {
    wx.showToast({ title: '预留：账户管理页', icon: 'none' })
  },

  onAbout() {
    wx.showModal({
      title: '关于轻记账',
      content: '前端演示版：五栏结构（概览 / 账单 / 记账 / 群组 / 我的），已预留后端 API 调用。',
      showCancel: false
    })
  },

  onToggleMock() {
    const app = getApp()
    app.globalData.useMock = !app.globalData.useMock
    this.setData({ useMock: app.globalData.useMock })
    wx.showToast({
      title: app.globalData.useMock ? '已切换 Mock' : '已切换真实接口',
      icon: 'none'
    })
  }
})
