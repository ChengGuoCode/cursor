const { getBillDetail, deleteBill } = require('../../api/bill')
const { toastError } = require('../../utils/request')
const { formatMoney, formatDate } = require('../../utils/format')
const { requireLogin } = require('../../utils/auth')
const { loadConfig, findCategory } = require('../../utils/config-store')

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
      try {
        await loadConfig()
      } catch (e) {
        /* ignore */
      }
      const bill = await getBillDetail(this.data.id)
      const cat = findCategory(bill.categoryCode)
      this.setData({
        bill: {
          ...bill,
          icon: cat.icon,
          color: cat.color,
          categoryName: cat.name,
          timeText: formatDate(bill.billDate || bill.occurredAt, 'YYYY-MM-DD'),
          amountText: formatMoney(bill.amount, {
            withSign: true,
            billType: bill.billType
          })
        }
      })
    } catch (err) {
      toastError(err, '加载失败')
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
          toastError(err, '删除失败')
        }
      }
    })
  }
})
