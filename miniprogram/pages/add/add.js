const { createBill } = require('../../api/bill')
const { toastError } = require('../../utils/request')
const { getGroups } = require('../../api/group')
const { formatDate } = require('../../utils/format')
const { isLoggedIn, requireLogin } = require('../../utils/auth')
const {
  loadConfig,
  categoriesByBillType,
  getCachedAccounts
} = require('../../utils/config-store')
const { BILL_TYPE, normalizeBillType, SCOPE_TYPE } = require('../../utils/bill-map')
const { GROUP_STATUS, pickActiveGroups } = require('../../utils/group-map')
const {
  getActiveSelectedGroupId,
  selectGroupScope,
  selectPersonalScope
} = require('../../utils/scope-store')

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
        groupNames: ['不计入群组'],
        groupIndex: 0
      })
      return
    }
    try {
      const { list } = await getGroups()
      // 记账可选群：仅 status=1 生效群
      const { activeList, newest } = pickActiveGroups(list || [])
      const groups = activeList.length
        ? activeList
        : (list || []).filter((g) => Number(g.status) === GROUP_STATUS.NORMAL)

      let groupIndex = 0
      const preferredId = getActiveSelectedGroupId()
      if (preferredId != null && preferredId !== '') {
        const idx = groups.findIndex((g) => String(g.groupId) === String(preferredId))
        if (idx >= 0) groupIndex = idx + 1 // +1：前面有「不计入群组」
      } else if (newest && getApp().globalData.scopeType === SCOPE_TYPE.GROUP) {
        const idx = groups.findIndex((g) => String(g.groupId) === String(newest.groupId))
        if (idx >= 0) groupIndex = idx + 1
      }

      this.setData({
        groups,
        groupNames: ['不计入群组', ...groups.map((g) => g.groupName)],
        groupIndex
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
    const groupIndex = Number(e.detail.value)
    this.setData({ groupIndex })
    // 与概览/账单/群组页「当前」标签联动
    if (groupIndex <= 0) {
      selectPersonalScope({ fromUser: true })
    } else {
      const group = this.data.groups[groupIndex - 1]
      if (group) selectGroupScope(group.groupId, { fromUser: true })
    }
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

    // groupIndex 0 = 个人（不传 groupId）；>0 = 选中群组
    const group =
      this.data.groupIndex > 0 ? this.data.groups[this.data.groupIndex - 1] : null

    this.setData({ submitting: true })
    try {
      const payload = {
        billType: this.data.billType,
        categoryCode: this.data.categoryCode,
        accountId: account.accountId,
        amount,
        remark: this.data.remark
      }
      if (group && group.groupId != null && group.groupId !== '') {
        payload.groupId = group.groupId
      }
      await createBill(payload)
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
      toastError(err, '保存失败')
    } finally {
      this.setData({ submitting: false })
    }
  }
})
