const { getProfile, wxLogin, logout } = require('../../api/user')
const { isLoggedIn, clearSession } = require('../../utils/auth')
const { shouldUseMock, toastError } = require('../../utils/request')
const { clearConfigCache } = require('../../utils/config-store')

function applyUserToView(user) {
  const safe = user || {}
  getApp().globalData.userInfo = safe
  return {
    user: safe,
    avatarText: (safe.nickname || '记').slice(0, 1),
    avatarUrl: safe.avatarUrl || ''
  }
}

Page({
  data: {
    user: {},
    avatarText: '记',
    avatarUrl: '',
    useMock: false,
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
    if (!isLoggedIn()) {
      getApp().globalData.userInfo = null
      this.setData({ user: {}, avatarText: '记', avatarUrl: '' })
      return
    }

    try {
      const user = await getProfile()
      this.setData(applyUserToView(user))
    } catch (err) {
      // 资料拉取失败：清会话，保持未登录展示
      clearSession()
      this.setData({ user: {}, avatarText: '记', avatarUrl: '' })
    }
  },

  async onLoginOrLogout() {
    if (this.data.loggingIn) return

    // 已登录 → 退出
    if (isLoggedIn() || (this.data.user && this.data.user.id)) {
      this.setData({ loggingIn: true })
      try {
        await logout()
        this.setData({ user: {}, avatarText: '记', avatarUrl: '' })
        wx.showToast({ title: '已退出', icon: 'none' })
      } catch (err) {
        clearSession()
        this.setData({ user: {}, avatarText: '记', avatarUrl: '' })
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

          // 1) 登录：ResDTO.data = token 字符串；失败抛错并保持未登录
          await wxLogin(res.code || 'mock-code')

          // 2) 成功后拉用户资料，填充头像/昵称
          try {
            const user = await getProfile()
            this.setData(applyUserToView(user))
            wx.showToast({ title: '登录成功', icon: 'success' })
          } catch (profileErr) {
            // token 已缓存，资料失败仍视为已登录，页面用占位展示
            this.setData(
              applyUserToView({
                id: 'logged-in',
                nickname: '已登录',
                motto: '资料暂未加载，下拉或重新进入可重试'
              })
            )
            toastError(
              profileErr,
              '登录成功，资料加载失败'
            )
          }
        } catch (err) {
          // 登录失败：清会话，保持未登录，展示后端 msg
          clearSession()
          this.setData({ user: {}, avatarText: '记', avatarUrl: '' })
          toastError(err, '登录失败')
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
    clearSession()
    // 清枚举缓存，避免 Mock 的 5 个账户残留到真实接口
    clearConfigCache()
    this.setData({
      useMock: app.globalData.useMock,
      user: {},
      avatarText: '记',
      avatarUrl: ''
    })
    wx.showToast({
      title: app.globalData.useMock ? '已切换 Mock' : '已切换真实接口',
      icon: 'none'
    })
  }
})
