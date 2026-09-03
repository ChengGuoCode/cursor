const {
  setBudget,
  listBudget,
  pickOverallBudget,
  BUDGET_PERIOD_TYPE,
  BUDGET_CARRY_OVER
} = require('../../api/bill')
const { toastError } = require('../../utils/request')
const { requireLogin } = require('../../utils/auth')
const { formatDate, formatMonthLabel } = require('../../utils/format')
const { SCOPE_TYPE, isGroupScope, normalizeScopeType } = require('../../utils/bill-map')

Page({
  data: {
    scopeType: SCOPE_TYPE.PERSONAL,
    groupId: null,
    groupName: '',
    isGroup: false,
    budgetId: null,
    month: '',
    monthLabel: '',
    heroTitle: '本月支出预算',
    heroDesc: '设好上限后，概览页会展示本月已用进度',
    budgetInput: '',
    budgetNum: 0,
    /** 1=沿用，0=不沿用；首次设置默认勾选 */
    carryOver: BUDGET_CARRY_OVER.ON,
    carryOverChecked: true,
    presets: ['2000', '3000', '5000', '8000', '10000'],
    inputFocus: false,
    saving: false
  },

  onLoad(query = {}) {
    const scopeType = normalizeScopeType(query.scopeType)
    const groupId =
      query.groupId != null && query.groupId !== '' ? query.groupId : null
    let groupName = ''
    try {
      groupName = query.groupName ? decodeURIComponent(query.groupName) : ''
    } catch (e) {
      groupName = query.groupName || ''
    }
    const isGroup = isGroupScope(scopeType) && groupId != null

    this.setData({
      scopeType: isGroup ? SCOPE_TYPE.GROUP : SCOPE_TYPE.PERSONAL,
      groupId: isGroup ? groupId : null,
      groupName,
      isGroup,
      heroTitle: isGroup ? '群组本月预算' : '本月支出预算',
      heroDesc: isGroup
        ? '群主与管理员可设定本群月度支出上限'
        : '设好上限后，概览页会展示本月已用进度'
    })

    wx.setNavigationBarTitle({
      title: isGroup ? '群组月度预算' : '月度预算'
    })
  },

  onShow() {
    if (!requireLogin('设置预算前请先登录')) return
    if (this.data.isGroup && (this.data.groupId == null || this.data.groupId === '')) {
      wx.showToast({ title: '缺少群组信息', icon: 'none' })
      return
    }
    const month = formatDate(new Date(), 'YYYY-MM')
    this.setData({
      month,
      monthLabel: this.data.isGroup
        ? `${formatMonthLabel(month)}${this.data.groupName ? ` · ${this.data.groupName}` : ''}`
        : formatMonthLabel(month),
      inputFocus: true
    })
    this.load()
  },

  async load() {
    try {
      const list = await listBudget({
        month: this.data.month,
        scopeType: this.data.scopeType,
        periodType: BUDGET_PERIOD_TYPE.MONTH,
        groupId: this.data.isGroup ? this.data.groupId : undefined
      })
      const overall = pickOverallBudget(list)
      const hasRecord = !!(overall && overall.id != null)
      const budget = overall ? Number(overall.amount) || 0 : 0
      // 首次设置默认沿用；已有记录用后端 carryOver
      const carryOver =
        hasRecord && overall
          ? Number(overall.carryOver) === BUDGET_CARRY_OVER.ON
            ? BUDGET_CARRY_OVER.ON
            : BUDGET_CARRY_OVER.OFF
          : BUDGET_CARRY_OVER.ON

      this.setData({
        budgetId: hasRecord ? overall.id : null,
        budgetInput: budget > 0 ? String(budget) : '',
        budgetNum: budget,
        carryOver,
        carryOverChecked: carryOver === BUDGET_CARRY_OVER.ON
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
    this.setData({
      budgetInput: value,
      budgetNum: Number(value) || 0
    })
  },

  onPreset(e) {
    const value = String(e.currentTarget.dataset.value || '')
    this.setData({
      budgetInput: value,
      budgetNum: Number(value) || 0
    })
  },

  onToggleCarryOver() {
    const next =
      this.data.carryOver === BUDGET_CARRY_OVER.ON
        ? BUDGET_CARRY_OVER.OFF
        : BUDGET_CARRY_OVER.ON
    this.setData({
      carryOver: next,
      carryOverChecked: next === BUDGET_CARRY_OVER.ON
    })
  },

  async onSave() {
    if (this.data.saving) return
    if (!requireLogin('设置预算前请先登录')) return

    const amount = Number(this.data.budgetInput)
    if (Number.isNaN(amount) || amount < 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    if (this.data.isGroup && (this.data.groupId == null || this.data.groupId === '')) {
      wx.showToast({ title: '缺少群组信息', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    try {
      const payload = {
        scopeType: this.data.scopeType,
        periodType: BUDGET_PERIOD_TYPE.MONTH,
        month: this.data.month,
        amount,
        carryOver: this.data.carryOver
      }
      if (this.data.isGroup) {
        payload.scopeId = this.data.groupId
      }
      if (this.data.budgetId != null) {
        payload.id = this.data.budgetId
      }
      await setBudget(payload)
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => {
        wx.navigateBack({
          fail: () =>
            wx.switchTab({
              url: this.data.isGroup ? '/pages/groups/groups' : '/pages/profile/profile'
            })
        })
      }, 500)
    } catch (err) {
      toastError(err, '保存失败')
    } finally {
      this.setData({ saving: false })
    }
  }
})
