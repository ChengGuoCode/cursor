const {
  getProfile,
  wxLogin,
  logout,
  updateProfile,
  uploadAvatar
} = require('../../api/user')
const { listBudget, pickOverallBudget, BUDGET_PERIOD_TYPE } = require('../../api/bill')
const { isLoggedIn, clearSession, requireLogin } = require('../../utils/auth')
const { shouldUseMock, toastError, resolveAssetUrl } = require('../../utils/request')
const { formatMoney, formatDate, formatMonthLabel } = require('../../utils/format')
const { SCOPE_TYPE } = require('../../utils/bill-map')

function applyUserToView(user) {
  const safe = user || {}
  getApp().globalData.userInfo = safe
  const rawAvatar = safe.avatarUrl || ''
  return {
    user: safe,
    loggedIn: true,
    avatarText: (safe.nickname || '记').slice(0, 1),
    // 展示用：相对路径 /avatar/xxx.jpg → apiBaseUrl + path
    avatarUrl: resolveAssetUrl(rawAvatar)
  }
}

function emptyUserView() {
  getApp().globalData.userInfo = null
  return {
    user: {},
    loggedIn: false,
    avatarText: '记',
    avatarUrl: '',
    budget: 0,
    budgetText: '0.00'
  }
}

Page({
  data: {
    user: {},
    loggedIn: false,
    avatarText: '记',
    avatarUrl: '',
    loggingIn: false,
    savingProfile: false,
    showNicknameEditor: false,
    draftNickname: '',
    monthLabel: '',
    budget: 0,
    budgetText: '0.00'
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 })
    }
    const month = formatDate(new Date(), 'YYYY-MM')
    this.setData({ monthLabel: formatMonthLabel(month) })
    this.loadProfile()
  },

  async loadProfile() {
    if (!isLoggedIn()) {
      this.setData(emptyUserView())
      return
    }

    try {
      const user = await getProfile()
      this.setData(applyUserToView(user))
      this.loadBudgetSummary()
    } catch (err) {
      clearSession()
      this.setData(emptyUserView())
    }
  },

  async loadBudgetSummary() {
    const month = formatDate(new Date(), 'YYYY-MM')
    try {
      const list = await listBudget({
        month,
        scopeType: SCOPE_TYPE.PERSONAL,
        periodType: BUDGET_PERIOD_TYPE.MONTH
      })
      const overall = pickOverallBudget(list)
      const budget = overall ? Number(overall.amount) || 0 : 0

      this.setData({
        budget,
        budgetText: formatMoney(budget)
      })
    } catch (e) {
      /* 预算摘要失败不影响主资料 */
    }
  },

  async onLoginOrLogout() {
    if (this.data.loggingIn || this.data.savingProfile) return

    if (isLoggedIn() || (this.data.user && this.data.user.id)) {
      this.setData({ loggingIn: true })
      try {
        await logout()
        this.setData(emptyUserView())
        wx.showToast({ title: '已退出', icon: 'none' })
      } catch (err) {
        clearSession()
        this.setData(emptyUserView())
        wx.showToast({ title: '已退出', icon: 'none' })
      } finally {
        this.setData({ loggingIn: false })
      }
      return
    }

    this.setData({ loggingIn: true })
    wx.login({
      success: async (res) => {
        try {
          if (!res.code && !shouldUseMock()) {
            throw new Error('未获取到微信登录 code')
          }

          await wxLogin(res.code || 'mock-code')

          try {
            const user = await getProfile()
            this.setData(applyUserToView(user))
            this.loadBudgetSummary()
            wx.showToast({ title: '登录成功', icon: 'success' })
          } catch (profileErr) {
            this.setData(
              applyUserToView({
                id: 'logged-in',
                nickname: '已登录',
                motto: '资料暂未加载，下拉或重新进入可重试'
              })
            )
            toastError(profileErr, '登录成功，资料加载失败')
          }
        } catch (err) {
          clearSession()
          this.setData(emptyUserView())
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

  async onChooseAvatar(e) {
    if (!requireLogin('请先登录后再设置头像')) return
    const tempPath = e.detail && e.detail.avatarUrl
    if (!tempPath) return

    // /api/user/avatar 上传并已更新头像，不必再调 /update
    this.setData({ savingProfile: true })
    try {
      const avatarPath = await uploadAvatar(tempPath)
      if (!avatarPath) {
        throw new Error('头像上传未返回路径')
      }
      this.setData(
        applyUserToView({
          ...this.data.user,
          avatarUrl: avatarPath
        })
      )
      wx.showToast({ title: '头像已更新', icon: 'success' })
    } catch (err) {
      toastError(err, '头像更新失败')
    } finally {
      this.setData({ savingProfile: false })
    }
  },

  onEditNickname() {
    if (!requireLogin('请先登录后再设置昵称')) return
    this.setData({
      showNicknameEditor: true,
      draftNickname: (this.data.user && this.data.user.nickname) || ''
    })
  },

  onDraftNicknameInput(e) {
    this.setData({ draftNickname: e.detail.value })
  },

  onCancelNickname() {
    this.setData({ showNicknameEditor: false, draftNickname: '' })
  },

  async onSaveNickname() {
    if (this.data.savingProfile) return
    const nickname = String(this.data.draftNickname || '').trim()
    if (!nickname) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' })
      return
    }
    if (nickname.length > 20) {
      wx.showToast({ title: '昵称最多 20 字', icon: 'none' })
      return
    }

    this.setData({ savingProfile: true })
    try {
      const user = await updateProfile({ nickname })
      this.setData({
        ...applyUserToView(
          user && user.nickname != null
            ? user
            : { ...this.data.user, nickname }
        ),
        showNicknameEditor: false,
        draftNickname: ''
      })
      wx.showToast({ title: '昵称已更新', icon: 'success' })
    } catch (err) {
      toastError(err, '昵称更新失败')
    } finally {
      this.setData({ savingProfile: false })
    }
  },

  onBudget() {
    if (!requireLogin('设置预算前请先登录')) return
    wx.navigateTo({ url: '/pages/budget/budget' })
  },

  onAbout() {
    wx.showModal({
      title: '关于轻记账',
      content: '轻记账：个人与群组记账，支持月度预算与账单概览。',
      showCancel: false
    })
  },

  noop() {}
})
