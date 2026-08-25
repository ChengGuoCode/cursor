const { getGroupDetail, getGroupSettlement } = require('../../api/group')
const { formatMoney, formatDate } = require('../../utils/format')
const { getCategoryById } = require('../../utils/constants')

Page({
  data: {
    id: '',
    group: null,
    suggestions: [],
    recentBills: []
  },

  onLoad(query) {
    this.setData({ id: query.id || '' })
    this.loadAll()
  },

  async loadAll() {
    await Promise.all([this.loadDetail(), this.loadSettlement()])
  },

  async loadDetail() {
    if (!this.data.id) return
    wx.showNavigationBarLoading()
    try {
      const group = await getGroupDetail(this.data.id)
      this.setData({
        group: {
          ...group,
          monthExpenseText: formatMoney(group.monthExpense),
          balanceText: formatMoney(group.myBalance, { withSign: true })
        },
        recentBills: (group.recentBills || []).map((bill) => {
          const cat = getCategoryById(bill.categoryCode || bill.categoryId)
          const billType =
            bill.billType != null
              ? bill.billType
              : bill.type === 'income'
                ? 1
                : 2
          return {
            ...bill,
            billType,
            categoryName: cat.name,
            timeText: formatDate(bill.billDate || bill.occurredAt, 'MM-DD HH:mm'),
            amountText: formatMoney(bill.amount, {
              withSign: true,
              billType
            })
          }
        })
      })
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    } finally {
      wx.hideNavigationBarLoading()
    }
  },

  async loadSettlement() {
    if (!this.data.id) return
    try {
      const data = await getGroupSettlement(this.data.id)
      this.setData({
        suggestions: (data.suggestions || []).map((s) => ({
          ...s,
          amountText: formatMoney(s.amount)
        }))
      })
    } catch (err) {
      console.warn(err)
    }
  }
})
