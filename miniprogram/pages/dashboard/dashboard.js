const { getOverview } = require('../../api/bill')
const { formatMoney, formatMonthLabel, formatDate } = require('../../utils/format')
const { getCategoryById } = require('../../utils/constants')
const { isLoggedIn } = require('../../utils/auth')

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
    timeUnit: 1
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
    this.loadOverview()
  },

  async loadOverview() {
    // 未登录：不请求概览，展示空态（不跳转登录）
    if (!isLoggedIn()) {
      this.setData(emptyOverviewState(this.data.monthLabel))
      return
    }

    wx.showNavigationBarLoading()
    try {
      const data = await getOverview({
        month: this.data.month,
        statUnit: this.data.statUnit,
        timeUnit: this.data.timeUnit
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
          const categoryKey = item.code || item.categoryId
          const cat = getCategoryById(categoryKey)
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
      // 浏览失败不强制登录；401 已在 request 层清会话
      if (err && err.code === 401) {
        this.setData(emptyOverviewState(this.data.monthLabel))
      } else {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' })
      }
    } finally {
      wx.hideNavigationBarLoading()
    }
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
  },

  goBillDetail(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/bill-detail/bill-detail?id=${id}` })
  }
})
