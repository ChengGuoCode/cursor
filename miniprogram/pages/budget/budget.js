const { getBudget, updateBudget } = require('../../api/user')
const { getOverview } = require('../../api/bill')
const { toastError } = require('../../utils/request')
const { requireLogin } = require('../../utils/auth')
const { formatMoney, formatDate, formatMonthLabel } = require('../../utils/format')
const { SCOPE_TYPE } = require('../../utils/bill-map')

Page({
  data: {
    month: '',
    monthLabel: '',
    budgetInput: '',
    budgetNum: 0,
    spent: 0,
    spentText: '0.00',
    remainText: '0.00',
    presets: ['2000', '3000', '5000', '8000', '10000'],
    inputFocus: false,
    saving: false
  },

  onShow() {
    if (!requireLogin('设置预算前请先登录')) return
    const month = formatDate(new Date(), 'YYYY-MM')
    this.setData({
      month,
      monthLabel: formatMonthLabel(month),
      inputFocus: true
    })
    this.load()
  },

  async load() {
    try {
      const [budgetRes, overview] = await Promise.all([
        getBudget().catch(() => null),
        getOverview({
          month: this.data.month,
          scopeType: SCOPE_TYPE.PERSONAL,
          periodType: 1
        }).catch(() => null)
      ])

      let budget = 0
      if (budgetRes && budgetRes.budget != null) {
        budget = Number(budgetRes.budget) || 0
      } else if (overview && overview.budget != null) {
        budget = Number(overview.budget) || 0
      }

      const spent = Number((overview && overview.expense) || 0)
      const remain = Math.max(0, budget - spent)

      this.setData({
        budgetInput: budget > 0 ? String(budget) : '',
        budgetNum: budget,
        spent,
        spentText: formatMoney(spent),
        remainText: formatMoney(remain)
      })
    } catch (err) {
      toastError(err, '加载预算失败')
    }
  },

  onBudgetInput(e) {
    const raw = String(e.detail.value || '').replace(/[^\d.]/g, '')
    const parts = raw.split('.')
    let value = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : raw
    const [intPart, decPart] = value.split('.')
    if (decPart != null) value = `${intPart}.${decPart.slice(0, 2)}`
    const budgetNum = Number(value) || 0
    const remain = Math.max(0, budgetNum - this.data.spent)
    this.setData({
      budgetInput: value,
      budgetNum,
      remainText: formatMoney(remain)
    })
  },

  onPreset(e) {
    const value = String(e.currentTarget.dataset.value || '')
    const budgetNum = Number(value) || 0
    this.setData({
      budgetInput: value,
      budgetNum,
      remainText: formatMoney(Math.max(0, budgetNum - this.data.spent))
    })
  },

  async onSave() {
    if (this.data.saving) return
    if (!requireLogin('设置预算前请先登录')) return

    const budget = Number(this.data.budgetInput)
    if (Number.isNaN(budget) || budget < 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    try {
      await updateBudget(budget)
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => {
        wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/profile/profile' }) })
      }, 500)
    } catch (err) {
      toastError(err, '保存失败')
    } finally {
      this.setData({ saving: false })
    }
  }
})
