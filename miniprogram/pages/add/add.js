const { createBill } = require('../../api/bill')
const { getGroups } = require('../../api/group')
const { formatDate } = require('../../utils/format')
const { isLoggedIn, requireLogin } = require('../../utils/auth')
const {
  loadConfig,
  categoriesByBillType,
  getCachedAccounts
} = require('../../utils/config-store')
const { BILL_TYPE, normalizeBillType } = require('../../utils/bill-map')

Page({
  data: {
    /** 创建时 billType：1=收入，2=支出 */
    billType: BILL_TYPE.EXPENSE,
    amount: '',
    amountFocus: false,
    categories: [],
    categoryCode: '',
    accounts: [],
    accountNames: [],
    accountIndex: 0,
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
    this.bootstrap()
  },

  async bootstrap() {
    try {
      await loadConfig()
      this.refreshCategories()
      this.refreshAccounts()
    } catch (e) {
      console.warn(e)
      wx.showToast({ title: '枚举加载失败', icon: 'none' })
    }
    this.loadGroups()
  },

  refreshCategories() {
    const categories = categoriesByBillType(this.data.billType)
    const matched = categories.find((c) => c.code === this.data.categoryCode)
    const categoryCode =
      (matched && matched.code) || (categories[0] && categories[0].code) || ''
    this.setData({ categories, categoryCode })
  },

  refreshAccounts() {
    const accounts = getCachedAccounts()
    let accountIndex = this.data.accountIndex
    if (accountIndex >= accounts.length) accountIndex = 0
    const wechatIdx = accounts.findIndex((a) => a.accountName === '微信')
    if (!this.data.accounts.length && wechatIdx >= 0) accountIndex = wechatIdx
    this.setData({
      accounts,
      accountNames: accounts.map((a) => a.accountName),
      accountIndex
    })
  },

  async loadGroups() {
    if (!isLoggedIn()) {
      this.setData({
        groups: [],
        groupNames: ['不计入群组']
      })
      return
    }
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
    const billType = normalizeBillType(e.currentTarget.dataset.billType)
    this.setData({ billType: billType == null ? BILL_TYPE.EXPENSE : billType })
    this.refreshCategories()
  },

  onAmountInput(e) {
    this.setData({ amount: this.normalizeAmount(e.detail.value) })
  },

  onCategoryPick(e) {
    this.setData({ categoryCode: e.currentTarget.dataset.code })
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
    if (!requireLogin('保存账单前请先登录')) return

    const amount = Number(this.data.amount)
    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入金额', icon: 'none' })
      return
    }
    if (!this.data.categoryCode) {
      wx.showToast({ title: '请选择分类', icon: 'none' })
      return
    }
    const account = this.data.accounts[this.data.accountIndex]
    if (!account) {
      wx.showToast({ title: '请选择账户', icon: 'none' })
      return
    }

    const group =
      this.data.groupIndex > 0 ? this.data.groups[this.data.groupIndex - 1] : null

    this.setData({ submitting: true })
    try {
      await createBill({
        billType: this.data.billType,
        amount,
        categoryCode: this.data.categoryCode,
        accountId: account.accountId,
        remark: this.data.remark,
        groupId: group ? group.id : null,
        billDate: this.data.date
      })
      wx.showToast({ title: '已保存', icon: 'success' })
      const categories = categoriesByBillType(this.data.billType)
      this.setData({
        amount: '',
        remark: '',
        categoryCode: (categories[0] && categories[0].code) || ''
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
