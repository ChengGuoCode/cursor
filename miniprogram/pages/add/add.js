const { createBill } = require('../../api/bill')
const { getGroups } = require('../../api/group')
const {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  ACCOUNT_TYPES
} = require('../../utils/constants')
const { formatDate } = require('../../utils/format')

Page({
  data: {
    type: 'expense',
    amount: '',
    amountFocus: false,
    categories: EXPENSE_CATEGORIES,
    categoryId: EXPENSE_CATEGORIES[0].id,
    accounts: ACCOUNT_TYPES,
    accountNames: ACCOUNT_TYPES.map((a) => a.name),
    accountIndex: 1,
    date: formatDate(new Date()),
    groups: [],
    groupNames: ['不计入群组'],
    groupIndex: 0,
    remark: '',
    keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'],
    submitting: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.loadGroups()
  },

  async loadGroups() {
    try {
      const { list } = await getGroups()
      const groups = list || []
      this.setData({
        groups,
        groupNames: ['不计入群组', ...groups.map((g) => g.name)]
      })
    } catch (err) {
      console.warn(err)
    }
  },

  onTypeChange(e) {
    const type = e.currentTarget.dataset.type
    const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
    this.setData({
      type,
      categories,
      categoryId: categories[0].id
    })
  },

  onAmountInput(e) {
    this.setData({ amount: this.normalizeAmount(e.detail.value) })
  },

  onCategoryPick(e) {
    this.setData({ categoryId: e.currentTarget.dataset.id })
  },

  onAccountChange(e) {
    this.setData({ accountIndex: Number(e.detail.value) })
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value })
  },

  onGroupChange(e) {
    this.setData({ groupIndex: Number(e.detail.value) })
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value })
  },

  normalizeAmount(raw) {
    let value = String(raw || '').replace(/[^\d.]/g, '')
    const parts = value.split('.')
    if (parts.length > 2) value = `${parts[0]}.${parts.slice(1).join('')}`
    const [intPart, decPart] = value.split('.')
    if (decPart != null) value = `${intPart}.${decPart.slice(0, 2)}`
    return value
  },

  onKeyTap(e) {
    const key = e.currentTarget.dataset.key
    let amount = this.data.amount || ''
    if (key === '⌫') {
      amount = amount.slice(0, -1)
    } else if (key === '.') {
      if (!amount.includes('.')) amount = amount ? `${amount}.` : '0.'
    } else {
      if (amount === '0') amount = key
      else amount = `${amount}${key}`
    }
    this.setData({ amount: this.normalizeAmount(amount) })
  },

  async onSubmit() {
    const amount = Number(this.data.amount)
    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入金额', icon: 'none' })
      return
    }
    if (!this.data.categoryId) {
      wx.showToast({ title: '请选择分类', icon: 'none' })
      return
    }

    const account = this.data.accounts[this.data.accountIndex]
    const group =
      this.data.groupIndex > 0 ? this.data.groups[this.data.groupIndex - 1] : null

    this.setData({ submitting: true })
    try {
      await createBill({
        type: this.data.type,
        amount,
        categoryId: this.data.categoryId,
        accountId: account.id,
        remark: this.data.remark,
        groupId: group ? group.id : null,
        occurredAt: `${this.data.date} 12:00`
      })
      wx.showToast({ title: '已保存', icon: 'success' })
      this.setData({
        amount: '',
        remark: '',
        categoryId: this.data.categories[0].id
      })
      setTimeout(() => {
        wx.switchTab({ url: '/pages/bills/bills' })
      }, 400)
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
