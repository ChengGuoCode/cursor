const { getOverview } = require('../../api/bill')
const { formatMoney, formatMonthLabel, formatDate } = require('../../utils/format')
const { getCategoryById } = require('../../utils/constants')

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
    wx.showNavigationBarLoading()
    try {
      const data = await getOverview({ month: this.data.month, statUnit: this.data.statUnit, timeUnit: this.data.timeUnit })
      const expense = Number(data.expense || 0)
      const income = Number(data.income || 0)
      const balance = income - expense
      const budget = Number(data.budget || 0)
      const trendRaw = data.trend || []
      const maxTrend = Math.max(...trendRaw.map((t) => Number(t.expense) || 0), 1)

      this.setData({
        monthLabel: formatMonthLabel(data.month || this.data.month),
        balance,
        balanceText: formatMoney(balance, { withSign: true }),
        expenseText: formatMoney(expense),
        incomeText: formatMoney(income),
        budget,
        budgetText: formatMoney(budget),
        budgetUsedText: formatMoney(expense),
        budgetPercent: Math.min(100, Math.round((data.budgetUsedRatio || 0) * 100)),
        // 始终 7 列：无支出高度为 0，不是少画几根柱
        trend: trendRaw.map((t) => {
          const value = Number(t.expense) || 0
          return {
            ...t,
            expense: value,
            height: value > 0 ? Math.max(12, Math.round((value / maxTrend) * 100)) : 0,
            amountText: value > 0 ? formatMoney(value) : '0'
          }
        }),
        categoryStats: (data.categoryStats || []).map((item) => {
          const cat = getCategoryById(item.code)
          return {
            ...item,
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            percent: Math.round((item.ratio || 0) * 100),
            amountText: formatMoney(item.amount)
          }
        })
      })
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
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
