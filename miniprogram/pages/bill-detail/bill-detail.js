const { getBillDetail, deleteBill } = require('../../api/bill')
const { formatMoney, formatDate } = require('../../utils/format')
const { getCategoryByCode, ACCOUNT_TYPES } = require('../../utils/constants')
const { requireLogin } = require('../../utils/auth')

Page({
  data: {
    id: '',
    bill: null
  },

  onLoad(query) {
    this.setData({ id: query.id || '' })
    this.loadDetail()
  },

  async loadDetail() {
    if (!this.data.id) return
    wx.showLoading({ title: '加载中' })
    try {
      const bill = await getBillDetail(this.data.id)
      const cat = getCategoryByCode(bill.categoryCode || bill.categoryId)
      const account =
        ACCOUNT_TYPES.find((a) => a.id === bill.accountName) ||
        ACCOUNT_TYPES.find((a) => a.name === bill.accountName)
      this.setData({
        bill: {
          ...bill,
          icon: cat.icon,
          color: cat.color,
          categoryName: cat.name,
          accountName: account ? account.name : bill.accountName || '-',
          timeText: formatDate(bill.billDate || bill.occurredAt, 'YYYY-MM-DD'),
          amountText: formatMoney(bill.amount, { withSign: true, type: bill.type })
        }
      })
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onDelete() {
    if (!requireLogin('删除账单前请先登录')) return

    wx.showModal({
      title: '删除账单',
      content: '删除后不可恢复，确认删除？',
      confirmColor: '#C45C26',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await deleteBill(this.data.id)
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 400)
        } catch (err) {
          wx.showToast({ title: err.message || '删除失败', icon: 'none' })
        }
      }
    })
  }
})
