const { getOverview } = require('../../api/bill')
const { getGroups } = require('../../api/group')
const { formatMoney, formatMonthLabel } = require('../../utils/format')
const { isLoggedIn } = require('../../utils/auth')
const { loadConfig, findCategory } = require('../../utils/config-store')

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
  const scope = app.globalData.billScope === 'group' ? 'group' : 'personal'
  page.setData({
    scope,
    scopeLabel: scope === 'group' ? '群组' : '个人',
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
    statUnit: 1,
    timeUnit: 1,
    scope: 'personal',
    scopeLabel: '个人',
    currentGroupId: null,
    groupList: [],
    groupNames: [],
    groupIndex: 0,
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
        swapDisabled: true
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

  async refreshGroupAvailability() {
    try {
      const { list } = await getGroups()
      const groupList = list || []
      const hasGroups = groupList.length > 0
      this.setData({
        groupList,
        groupNames: groupList.map((g) => g.name),
        hasGroups,
        swapDisabled: !hasGroups
      })
      if (!hasGroups && this.data.scope === 'group') {
        getApp().globalData.billScope = 'personal'
        this.setData({ scope: 'personal', scopeLabel: '个人', currentGroupId: null })
      }
    } catch (e) {
      this.setData({ hasGroups: false, swapDisabled: true, groupList: [], groupNames: [] })
    }
  },

  async ensureGroupSelection() {
    const groupList = this.data.groupList || []
    if (!groupList.length) {
      this.setData({ currentGroupId: null })
      return
    }
    let currentGroupId = this.data.currentGroupId || getApp().globalData.currentGroupId
    let groupIndex = groupList.findIndex((g) => String(g.id) === String(currentGroupId))
    if (groupIndex < 0) {
      groupIndex = 0
      currentGroupId = groupList[0].id
    }
    getApp().globalData.currentGroupId = currentGroupId
    this.setData({ groupIndex, currentGroupId })
  },

  async loadOverview() {
    if (!isLoggedIn()) {
      this.setData(emptyOverviewState(this.data.monthLabel))
      return
    }

    if (this.data.scope === 'group') {
      await this.ensureGroupSelection()
      if (!this.data.currentGroupId) {
        this.setData({
          ...emptyOverviewState(this.data.monthLabel),
          guestMode: false
        })
        return
      }
    }

    wx.showNavigationBarLoading()
    try {
      const data = await getOverview({
        month: this.data.month,
        statUnit: this.data.statUnit,
        timeUnit: this.data.timeUnit,
        scope: this.data.scope,
        groupId: this.data.scope === 'group' ? this.data.currentGroupId : null
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
        wx.showToast({ title: err.message || '加载失败', icon: 'none' })
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
    const next = this.data.scope === 'personal' ? 'group' : 'personal'
    getApp().globalData.billScope = next
    this.setData({
      scope: next,
      scopeLabel: next === 'group' ? '群组' : '个人'
    })
    await this.loadOverview()
  },

  onGroupPick(e) {
    const groupIndex = Number(e.detail.value)
    const group = this.data.groupList[groupIndex]
    if (!group) return
    getApp().globalData.currentGroupId = group.id
    this.setData({ groupIndex, currentGroupId: group.id })
    this.loadOverview()
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
