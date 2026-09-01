const { getOverview } = require('../../api/bill')
const { toastError } = require('../../utils/request')
const { selectGroup } = require('../../api/group')
const { formatMoney, formatMonthLabel } = require('../../utils/format')
const { isLoggedIn } = require('../../utils/auth')
const { loadConfig, findCategory } = require('../../utils/config-store')
const {
  SCOPE_TYPE,
  normalizeScopeType,
  scopeTypeLabel,
  isGroupScope
} = require('../../utils/bill-map')
const {
  applyScopePreference,
  setGlobalScopeType
} = require('../../utils/scope-store')

function emptyOverviewState(monthLabel) {
  return {
    monthLabel: monthLabel || '',
    balance: 0,
    balanceText: '0.00',
    expenseText: '0.00',
    incomeText: '0.00',
    budget: 0,
    budgetText: '0.00',
    budgetUsedText: '0.00',
    budgetPercent: 0,
    trend: [],
    categoryStats: [],
    recentBills: [],
    guestMode: true
  }
}

function syncScopeFromApp(page) {
  const app = getApp()
  const scopeType = normalizeScopeType(app.globalData.scopeType)
  page.setData({
    scopeType,
    scopeLabel: scopeTypeLabel(scopeType),
    currentGroupId: app.globalData.currentGroupId
  })
}

Page({
  data: {
    month: '',
    monthLabel: '',
    balance: 0,
    balanceText: '0.00',
    expenseText: '0.00',
    incomeText: '0.00',
    budget: 0,
    budgetText: '0.00',
    budgetUsedText: '0.00',
    budgetPercent: 0,
    trend: [],
    categoryStats: [],
    recentBills: [],
    guestMode: false,
    /** 1=个人，2=群组 */
    scopeType: SCOPE_TYPE.PERSONAL,
    periodType: 1,
    scopeLabel: '个人',
    currentGroupId: null,
    currentGroupName: '',
    hasGroups: false,
    swapDisabled: true
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    if (!this.data.month) {
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      this.setData({ month, monthLabel: formatMonthLabel(month) })
    }
    syncScopeFromApp(this)
    this.bootstrap()
  },

  async bootstrap() {
    if (!isLoggedIn()) {
      this.setData({
        ...emptyOverviewState(this.data.monthLabel),
        hasGroups: false,
        swapDisabled: true,
        currentGroupName: ''
      })
      return
    }
    try {
      await loadConfig()
    } catch (e) {
      console.warn(e)
    }
    await this.refreshGroupAvailability()
    await this.loadOverview()
  },

  /**
   * 仅用 group/select 判断是否加入群组：
   * 有当前群 → 默认可切群组/个人；无当前群 → 仅个人
   */
  async refreshGroupAvailability() {
    try {
      const current = await selectGroup().catch(() => null)
      const hasGroups = !!(current && current.groupId != null && current.groupId !== '')
      const scope = applyScopePreference(hasGroups ? [current] : [], {
        currentGroupId: hasGroups ? current.groupId : undefined
      })
      const currentGroupName =
        (current && current.groupName) || scope.currentGroupName || ''
      this.setData({
        hasGroups,
        swapDisabled: !hasGroups,
        scopeType: scope.scopeType,
        scopeLabel: scope.scopeLabel,
        currentGroupId: scope.currentGroupId,
        currentGroupName: scope.scopeType === SCOPE_TYPE.GROUP ? currentGroupName : ''
      })
    } catch (e) {
      this.setData({
        hasGroups: false,
        swapDisabled: true,
        currentGroupId: null,
        currentGroupName: ''
      })
    }
  },

  async loadOverview() {
    if (!isLoggedIn()) {
      this.setData(emptyOverviewState(this.data.monthLabel))
      return
    }

    if (isGroupScope(this.data.scopeType) && !this.data.currentGroupId) {
      this.setData({
        ...emptyOverviewState(this.data.monthLabel),
        guestMode: false
      })
      return
    }

    wx.showNavigationBarLoading()
    try {
      const data = await getOverview({
        month: this.data.month,
        scopeType: this.data.scopeType,
        periodType: this.data.periodType,
        groupId: isGroupScope(this.data.scopeType) ? this.data.currentGroupId : null
      })
      const expense = Number(data.expense || 0)
      const income = Number(data.income || 0)
      const balance = income - expense
      const budget = Number(data.budget || 0)
      const budgetPercent =
        budget > 0 ? Math.min(100, Math.round((expense / budget) * 100)) : 0
      const trendRaw = data.trend || []
      const maxTrend = Math.max(...trendRaw.map((t) => Number(t.expense) || 0), 1)
      const categoryRaw = data.categoryStats || []

      this.setData({
        guestMode: false,
        monthLabel: formatMonthLabel(data.month || this.data.month),
        balance,
        balanceText: formatMoney(balance, { withSign: true }),
        expenseText: formatMoney(expense),
        incomeText: formatMoney(income),
        budget,
        budgetText: formatMoney(budget),
        budgetUsedText: formatMoney(expense),
        budgetPercent,
        trend: trendRaw.map((t) => {
          const value = Number(t.expense) || 0
          return {
            ...t,
            expense: value,
            height: value > 0 ? Math.max(12, Math.round((value / maxTrend) * 100)) : 0,
            amountText: value > 0 ? formatMoney(value) : '0'
          }
        }),
        categoryStats: categoryRaw.map((item) => {
          const categoryKey = item.code || item.categoryCode || item.categoryId
          const cat = findCategory(categoryKey)
          const amount = Number(item.amount) || 0
          return {
            ...item,
            categoryId: categoryKey,
            amount,
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            percent: expense > 0 ? Math.round((amount / expense) * 100) : 0,
            amountText: formatMoney(amount)
          }
        })
      })
    } catch (err) {
      if (err && err.code === 401) {
        this.setData(emptyOverviewState(this.data.monthLabel))
      } else {
        toastError(err, '加载失败')
      }
    } finally {
      wx.hideNavigationBarLoading()
    }
  },

  async onSwapScope() {
    if (this.data.swapDisabled) {
      wx.showToast({ title: '暂无所属群组', icon: 'none' })
      return
    }
    const next = isGroupScope(this.data.scopeType)
      ? SCOPE_TYPE.PERSONAL
      : SCOPE_TYPE.GROUP
    setGlobalScopeType(next, { fromUser: true })
    this.setData({
      scopeType: next,
      scopeLabel: scopeTypeLabel(next),
      currentGroupName:
        next === SCOPE_TYPE.GROUP ? this.data.currentGroupName || '' : ''
    })
    if (next === SCOPE_TYPE.GROUP) {
      await this.refreshGroupAvailability()
    }
    await this.loadOverview()
  },

  onMonthChange(e) {
    const month = e.detail.value
    this.setData({ month, monthLabel: formatMonthLabel(month) })
    this.loadOverview()
  },

  goBills() {
    wx.switchTab({ url: '/pages/bills/bills' })
  },

  goAdd() {
    wx.switchTab({ url: '/pages/add/add' })
  }
})
