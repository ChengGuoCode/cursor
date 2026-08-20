const { getBills } = require('../../api/bill')
const { getGroups } = require('../../api/group')
const { formatMoney, formatMonthLabel, groupBillsByDate } = require('../../utils/format')
const { getCategoryByCode } = require('../../utils/constants')
const { isLoggedIn } = require('../../utils/auth')

function syncScopeFromApp(page) {
  const app = getApp()
  const scope = app.globalData.billScope === 'group' ? 'group' : 'personal'
  const currentGroupId = app.globalData.currentGroupId
  page.setData({
    scope,
    scopeLabel: scope === 'group' ? '群组' : '个人',
    currentGroupId
  })
}

Page({
  data: {
    month: '',
    monthLabel: '',
    type: 'all',
    typeOptions: [
      { id: 'all', name: '全部' },
      { id: 'expense', name: '支出' },
      { id: 'income', name: '收入' }
    ],
    dayGroups: [],
    totalExpenseText: '0.00',
    totalIncomeText: '0.00',
    guestMode: false,
    scope: 'personal',
    scopeLabel: '个人',
    currentGroupId: null,
    groupList: [],
    groupNames: [],
    groupIndex: 0,
    pageNum: 1,
    pageSize: 50,
    total: 0
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    if (!this.data.month) {
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      this.setData({ month, monthLabel: formatMonthLabel(month) })
    }
    syncScopeFromApp(this)
    this.prepareAndLoad()
  },

  async prepareAndLoad() {
    if (!isLoggedIn()) {
      this.setData({
        guestMode: true,
        dayGroups: [],
        totalExpenseText: '0.00',
        totalIncomeText: '0.00',
        groupList: [],
        groupNames: []
      })
      return
    }

    // 群组模式需要群组列表，用于切换具体群组
    if (this.data.scope === 'group') {
      await this.ensureGroupSelection()
    }
    this.loadBills()
  },

  async ensureGroupSelection() {
    try {
      const { list } = await getGroups()
      const groupList = list || []
      const groupNames = groupList.map((g) => g.name)
      let currentGroupId = this.data.currentGroupId || getApp().globalData.currentGroupId
      let groupIndex = groupList.findIndex((g) => String(g.id) === String(currentGroupId))
      if (groupIndex < 0) {
        groupIndex = 0
        currentGroupId = groupList.length ? groupList[0].id : null
      }
      getApp().globalData.currentGroupId = currentGroupId
      this.setData({
        groupList,
        groupNames,
        groupIndex: groupIndex < 0 ? 0 : groupIndex,
        currentGroupId,
        guestMode: false
      })
    } catch (e) {
      this.setData({ groupList: [], groupNames: [], currentGroupId: null })
    }
  },

  async loadBills() {
    if (!isLoggedIn()) {
      this.setData({
        guestMode: true,
        dayGroups: [],
        totalExpenseText: '0.00',
        totalIncomeText: '0.00'
      })
      return
    }

    if (this.data.scope === 'group' && !this.data.currentGroupId) {
      this.setData({
        guestMode: false,
        dayGroups: [],
        totalExpenseText: '0.00',
        totalIncomeText: '0.00'
      })
      wx.showToast({ title: '暂无群组，请先创建或加入', icon: 'none' })
      return
    }

    wx.showNavigationBarLoading()
    try {
      const res = await getBills({
        month: this.data.month,
        type: this.data.type,
        scope: this.data.scope,
        groupId: this.data.scope === 'group' ? this.data.currentGroupId : null,
        pageNum: this.data.pageNum,
        pageSize: this.data.pageSize
      })

      const list = (res.records || res.list || []).map((bill) => {
        const cat = getCategoryByCode(bill.categoryCode || bill.categoryId)
        return {
          ...bill,
          icon: cat.icon,
          color: cat.color,
          categoryName: cat.name,
          amountText: formatMoney(bill.amount, { withSign: true, type: bill.type })
        }
      })

      let totalExpense = 0
      let totalIncome = 0
      list.forEach((b) => {
        if (b.type === 'income') totalIncome += Number(b.amount || 0)
        else totalExpense += Number(b.amount || 0)
      })

      const dayGroups = groupBillsByDate(list).map((g) => ({
        ...g,
        expenseText: formatMoney(g.expense),
        incomeText: formatMoney(g.income)
      }))

      this.setData({
        guestMode: false,
        dayGroups,
        total: res.total || list.length,
        totalExpenseText: formatMoney(totalExpense),
        totalIncomeText: formatMoney(totalIncome)
      })
    } catch (err) {
      if (err && err.code === 401) {
        this.setData({
          guestMode: true,
          dayGroups: [],
          totalExpenseText: '0.00',
          totalIncomeText: '0.00'
        })
      } else {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' })
      }
    } finally {
      wx.hideNavigationBarLoading()
    }
  },

  /** 右上角切换个人 / 群组 */
  async onSwapScope() {
    const next = this.data.scope === 'personal' ? 'group' : 'personal'
    const app = getApp()
    app.globalData.billScope = next
    this.setData({
      scope: next,
      scopeLabel: next === 'group' ? '群组' : '个人',
      pageNum: 1
    })
    if (next === 'group') {
      await this.ensureGroupSelection()
    }
    this.loadBills()
  },

  onGroupPick(e) {
    const groupIndex = Number(e.detail.value)
    const group = this.data.groupList[groupIndex]
    if (!group) return
    getApp().globalData.currentGroupId = group.id
    this.setData({
      groupIndex,
      currentGroupId: group.id,
      pageNum: 1
    })
    this.loadBills()
  },

  onMonthChange(e) {
    const month = e.detail.value
    this.setData({ month, monthLabel: formatMonthLabel(month), pageNum: 1 })
    this.loadBills()
  },

  onTypeChange(e) {
    this.setData({ type: e.currentTarget.dataset.id, pageNum: 1 })
    this.loadBills()
  },

  goDetail(e) {
    wx.navigateTo({
      url: `/pages/bill-detail/bill-detail?id=${e.currentTarget.dataset.id}`
    })
  },

  goAdd() {
    wx.switchTab({ url: '/pages/add/add' })
  }
})
