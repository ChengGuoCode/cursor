const { getOverview } = require('../../api/bill')
const { toastError } = require('../../utils/request')
const { getGroups } = require('../../api/group')
const { formatMoney, formatMonthLabel } = require('../../utils/format')
const { isLoggedIn } = require('../../utils/auth')
const { loadConfig, findCategory } = require('../../utils/config-store')
const { pickActiveGroups } = require('../../utils/group-map')
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
    /** 下拉仅含 status=1 */
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
        swapDisabled: true,
        groupList: [],
        groupNames: [],
        groupIndex: 0,
        currentGroupId: null
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
   * 仅用 group/list：
   * - 有 status=1 → 默认群组，下拉仅含生效群，默认选 createTime 最新
   * - 无 status=1 → 默认个人，切换置灰
   */
  async refreshGroupAvailability() {
    try {
      const { list } = await getGroups()
      const { activeList, newest, newestIndex } = pickActiveGroups(list || [])
      const hasActive = activeList.length > 0
      const app = getApp()

      if (!hasActive) {
        app.globalData.scopePreferPersonal = false
        setGlobalScopeType(SCOPE_TYPE.PERSONAL)
        app.globalData.currentGroupId = null
        this.setData({
          groupList: [],
          groupNames: [],
          groupIndex: 0,
          hasGroups: false,
          swapDisabled: true,
          scopeType: SCOPE_TYPE.PERSONAL,
          scopeLabel: scopeTypeLabel(SCOPE_TYPE.PERSONAL),
          currentGroupId: null
        })
        return
      }

      // 若全局已选中某生效群则保留，否则落到 createTime 最新
      let groupIndex = activeList.findIndex(
        (g) => String(g.groupId) === String(app.globalData.currentGroupId)
      )
      if (groupIndex < 0) {
        groupIndex = newestIndex >= 0 ? newestIndex : 0
      }
      const selected = activeList[groupIndex] || newest
      const scope = applyScopePreference(activeList, {
        currentGroupId: selected.groupId
      })

      this.setData({
        groupList: activeList,
        groupNames: activeList.map((g) => g.groupName),
        groupIndex: scope.groupIndex >= 0 ? scope.groupIndex : groupIndex,
        hasGroups: true,
        swapDisabled: false,
        scopeType: scope.scopeType,
        scopeLabel: scope.scopeLabel,
        currentGroupId: scope.currentGroupId
      })
    } catch (e) {
      this.setData({
        hasGroups: false,
        swapDisabled: true,
        groupList: [],
        groupNames: [],
        groupIndex: 0,
        currentGroupId: null
      })
    }
  },

  /** @returns {*|null} 当前选中的 groupId */
  ensureGroupSelection() {
    const groupList = this.data.groupList || []
    if (!groupList.length) {
      this.setData({ currentGroupId: null, groupIndex: 0 })
      return null
    }
    let currentGroupId = this.data.currentGroupId || getApp().globalData.currentGroupId
    let groupIndex = groupList.findIndex((g) => String(g.groupId) === String(currentGroupId))
    if (groupIndex < 0) {
      const { newestIndex } = pickActiveGroups(groupList)
      groupIndex = newestIndex >= 0 ? newestIndex : 0
      currentGroupId = groupList[groupIndex].groupId
    }
    getApp().globalData.currentGroupId = currentGroupId
    this.setData({ groupIndex, currentGroupId })
    return currentGroupId
  },

  async loadOverview() {
    if (!isLoggedIn()) {
      this.setData(emptyOverviewState(this.data.monthLabel))
      return
    }

    const groupMode = isGroupScope(this.data.scopeType)
    let groupId = null
    if (groupMode) {
      // 下拉选中的群 → overview 的 groupId
      groupId = this.ensureGroupSelection()
      if (groupId == null || groupId === '') {
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
        scopeType: this.data.scopeType,
        periodType: this.data.periodType,
        groupId: groupMode ? groupId : undefined
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
      scopeLabel: scopeTypeLabel(next)
    })
    if (next === SCOPE_TYPE.GROUP) {
      this.ensureGroupSelection()
    }
    await this.loadOverview()
  },

  onGroupPick(e) {
    const groupIndex = Number(e.detail.value)
    const group = this.data.groupList[groupIndex]
    if (!group) return
    getApp().globalData.currentGroupId = group.groupId
    setGlobalScopeType(SCOPE_TYPE.GROUP, { groupId: group.groupId })
    this.setData({
      groupIndex,
      currentGroupId: group.groupId,
      scopeType: SCOPE_TYPE.GROUP,
      scopeLabel: scopeTypeLabel(SCOPE_TYPE.GROUP)
    })
    // 切换下拉后按选中群重新拉概览
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
