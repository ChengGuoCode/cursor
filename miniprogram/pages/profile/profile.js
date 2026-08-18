const { getProfile, wxLogin, logout } = require('../../api/user')
const { isLoggedIn, clearSession } = require('../../utils/auth')
const { shouldUseMock } = require('../../utils/request')

Page({
  data: {
    user: {},
    avatarText: '记',
    useMock: true,
    loggingIn: false
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
    // 无 token：直接展示未登录，避免多余 401
    if (!isLoggedIn()) {
      getApp().globalData.userInfo = null
      this.setData({ user: {}, avatarText: '记' })
      return
    }

    try {
      const user = await getProfile()
      getApp().globalData.userInfo = user
      this.setData({
        user: user || {},
        avatarText: ((user && user.nickname) || '记').slice(0, 1)
      })
    } catch (err) {
      clearSession()
      this.setData({ user: {}, avatarText: '记' })
    }
  },

  async onLoginOrLogout() {
    if (this.data.loggingIn) return

    // 已登录 → 退出
    if (isLoggedIn() || (this.data.user && this.data.user.id)) {
      this.setData({ loggingIn: true })
      try {
        await logout()
        this.setData({ user: {}, avatarText: '记' })
        wx.showToast({ title: '已退出', icon: 'none' })
      } catch (err) {
        clearSession()
        this.setData({ user: {}, avatarText: '记' })
        wx.showToast({ title: '已退出', icon: 'none' })
      } finally {
        this.setData({ loggingIn: false })
      }
      return
    }

    // 未登录 → 微信登录
    this.setData({ loggingIn: true })
    wx.login({
      success: async (res) => {
        try {
          if (!res.code && !shouldUseMock()) {
            throw new Error('未获取到微信登录 code')
          }
          const result = await wxLogin(res.code || 'mock-code')
          let user = result.user
          // 后端若只返回 token，再拉一次资料补全
          if (!user || !user.id) {
            try {
              user = await getProfile()
            } catch (e) {
              user = user || {}
            }
          }
          getApp().globalData.userInfo = user
          this.setData({
            user: user || {},
            avatarText: ((user && user.nickname) || '记').slice(0, 1)
          })
          wx.showToast({ title: '登录成功', icon: 'success' })
        } catch (err) {
          clearSession()
          this.setData({ user: {}, avatarText: '记' })
          wx.showToast({ title: err.message || '登录失败', icon: 'none' })
        } finally {
          this.setData({ loggingIn: false })
        }
      },
      fail: () => {
        this.setData({ loggingIn: false })
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
    // 切换数据模式时清会话，避免 mock/真实 token 混用
    clearSession()
    this.setData({
      useMock: app.globalData.useMock,
      user: {},
      avatarText: '记'
    })
    wx.showToast({
      title: app.globalData.useMock ? '已切换 Mock' : '已切换真实接口',
      icon: 'none'
    })
  }
})
