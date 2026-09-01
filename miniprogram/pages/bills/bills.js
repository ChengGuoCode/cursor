const { getBills } = require('../../api/bill')
const { toastError } = require('../../utils/request')
const { getGroups } = require('../../api/group')
const { formatMoney, formatMonthLabel, groupBillsByDate } = require('../../utils/format')
const { isLoggedIn } = require('../../utils/auth')
const { loadConfig, findCategory, getCachedCategories } = require('../../utils/config-store')
const { GROUP_STATUS, pickActiveGroups } = require('../../utils/group-map')
const {
  BILL_TYPE,
  BILL_TYPE_OPTIONS,
  SCOPE_TYPE,
  normalizeBillType,
  normalizeScopeType,
  scopeTypeLabel,
  isGroupScope,
  isIncome
} = require('../../utils/bill-map')
const {
  applyScopePreference,
  setGlobalScopeType
} = require('../../utils/scope-store')

function syncScopeFromApp(page) {
  const app = getApp()
  const scopeType = normalizeScopeType(app.globalData.scopeType)
  page.setData({
    scopeType,
    scopeLabel: scopeTypeLabel(scopeType),
    currentGroupId: app.globalData.currentGroupId
  })
}

Page({
  data: {
    month: '',
    monthLabel: '',
    /** 筛选 billType：null=全部，1=收入，2=支出 */
    billType: null,
    typeOptions: BILL_TYPE_OPTIONS.map((o) => ({
      ...o,
      key: o.id == null ? 'all' : String(o.id)
    })),
    billTypeKey: 'all',
    dayGroups: [],
    totalExpenseText: '0.00',
    totalIncomeText: '0.00',
    guestMode: false,
    /** 1=个人，2=群组 */
    scopeType: SCOPE_TYPE.PERSONAL,
    scopeLabel: '个人',
    currentGroupId: null,
    groupList: [],
    groupNames: [],
    groupIndex: 0,
    hasGroups: false,
    swapDisabled: true,
    filterExpanded: false,
    accounts: [],
    accountNames: ['全部账户'],
    accountIndex: 0,
    accountId: null,
    categoryOptions: [{ code: '', name: '全部类目' }],
    categoryNames: ['全部类目'],
    categoryIndex: 0,
    categoryCode: '',
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
    this.bootstrap()
  },

  async bootstrap() {
    if (!isLoggedIn()) {
      this.setData({
        guestMode: true,
        dayGroups: [],
        hasGroups: false,
        swapDisabled: true,
        totalExpenseText: '0.00',
        totalIncomeText: '0.00'
      })
      return
    }

    try {
      await loadConfig()
      this.applyAccountOptions()
      this.applyCategoryOptions()
    } catch (e) {
      console.warn('load config failed', e)
    }

    await this.refreshGroupAvailability()
    this.loadBills()
  },

  applyAccountOptions() {
    const { getCachedAccounts } = require('../../utils/config-store')
    const accounts = getCachedAccounts()
    this.setData({
      accounts,
      accountNames: ['全部账户', ...accounts.map((a) => a.accountName)]
    })
  },

  applyCategoryOptions() {
    let list = getCachedCategories()
    if (this.data.billType === BILL_TYPE.INCOME) {
      list = list.filter((c) => c.type === BILL_TYPE.INCOME)
    } else if (this.data.billType === BILL_TYPE.EXPENSE) {
      list = list.filter((c) => c.type === BILL_TYPE.EXPENSE)
    }
    const categoryOptions = [{ code: '', name: '全部类目' }, ...list]
    this.setData({
      categoryOptions,
      categoryNames: categoryOptions.map((c) => c.name)
    })
  },

  /**
   * 仅用 group/list：
   * - 集合为空 → 个人，切换置灰
   * - 有 status=1 → 默认群组，下拉选中生效群（多条取 createTime 最新）
   * - 无 status=1 → 默认个人；集合非空仍可切换
   */
  async refreshGroupAvailability() {
    try {
      const { list } = await getGroups()
      const groupList = list || []
      const canSwap = groupList.length > 0
      const { newest } = pickActiveGroups(groupList)
      const hasActive = !!newest
      const app = getApp()

      let scopeType = SCOPE_TYPE.PERSONAL
      let currentGroupId = null
      let groupIndex = 0

      if (!canSwap) {
        app.globalData.scopePreferPersonal = false
        setGlobalScopeType(SCOPE_TYPE.PERSONAL)
        app.globalData.currentGroupId = null
      } else if (hasActive) {
        // 已选中且仍为 status=1 则保留，否则落到 createTime 最新
        const currentStillActive = groupList.some(
          (g) =>
            Number(g.status) === GROUP_STATUS.NORMAL &&
            String(g.groupId) === String(app.globalData.currentGroupId)
        )
        const preferredId = currentStillActive
          ? app.globalData.currentGroupId
          : newest.groupId
        const scope = applyScopePreference(groupList, {
          currentGroupId: preferredId
        })
        scopeType = scope.scopeType
        currentGroupId = scope.currentGroupId
        groupIndex = groupList.findIndex(
          (g) => String(g.groupId) === String(currentGroupId)
        )
        if (groupIndex < 0) {
          groupIndex = groupList.findIndex(
            (g) => String(g.groupId) === String(newest.groupId)
          )
          if (groupIndex < 0) groupIndex = 0
          currentGroupId = groupList[groupIndex].groupId
          app.globalData.currentGroupId = currentGroupId
        }
      } else {
        // 有群但无生效群：默认个人；切群组时用列表第一项（或已选中项）
        groupIndex = Math.max(
          0,
          groupList.findIndex(
            (g) => String(g.groupId) === String(app.globalData.currentGroupId)
          )
        )
        currentGroupId = groupList[groupIndex].groupId
        app.globalData.currentGroupId = currentGroupId

        if (app.globalData.scopePreferPersonal) {
          scopeType = SCOPE_TYPE.PERSONAL
          app.globalData.scopeType = SCOPE_TYPE.PERSONAL
        } else if (normalizeScopeType(app.globalData.scopeType) === SCOPE_TYPE.GROUP) {
          // 用户本会话已切到群组，保持
          scopeType = SCOPE_TYPE.GROUP
        } else {
          scopeType = SCOPE_TYPE.PERSONAL
          setGlobalScopeType(SCOPE_TYPE.PERSONAL)
        }
      }

      this.setData({
        groupList,
        groupNames: groupList.map((g) => g.groupName),
        hasGroups: canSwap,
        swapDisabled: !canSwap,
        scopeType,
        scopeLabel: scopeTypeLabel(scopeType),
        currentGroupId: canSwap ? currentGroupId : null,
        groupIndex
      })
    } catch (e) {
      this.setData({
        hasGroups: false,
        swapDisabled: true,
        groupList: [],
        groupNames: [],
        currentGroupId: null
      })
    }
  },

  ensureGroupSelection() {
    const groupList = this.data.groupList || []
    if (!groupList.length) {
      this.setData({ currentGroupId: null, groupIndex: 0 })
      return
    }
    let currentGroupId = this.data.currentGroupId || getApp().globalData.currentGroupId
    let groupIndex = groupList.findIndex((g) => String(g.groupId) === String(currentGroupId))
    if (groupIndex < 0) {
      // 优先落到 createTime 最新的 status=1 生效群
      const { newest } = pickActiveGroups(groupList)
      if (newest) {
        groupIndex = groupList.findIndex(
          (g) => String(g.groupId) === String(newest.groupId)
        )
      }
      if (groupIndex < 0) groupIndex = 0
      currentGroupId = groupList[groupIndex].groupId
    }
    getApp().globalData.currentGroupId = currentGroupId
    this.setData({ groupIndex, currentGroupId })
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

    if (isGroupScope(this.data.scopeType) && !this.data.currentGroupId) {
      this.ensureGroupSelection()
      if (!this.data.currentGroupId) {
        this.setData({
          guestMode: false,
          dayGroups: [],
          totalExpenseText: '0.00',
          totalIncomeText: '0.00'
        })
        return
      }
    }

    wx.showNavigationBarLoading()
    try {
      const res = await getBills({
        month: this.data.month,
        billType: this.data.billType, // null | 1 | 2
        categoryCode: this.data.categoryCode || undefined,
        accountId: this.data.accountId,
        scopeType: this.data.scopeType,
        groupId: isGroupScope(this.data.scopeType) ? this.data.currentGroupId : null,
        pageNum: this.data.pageNum,
        pageSize: this.data.pageSize
      })

      const list = (res.records || res.list || []).map((bill) => {
        const cat = findCategory(bill.categoryCode)
        return {
          ...bill,
          icon: cat.icon,
          color: cat.color,
          categoryName: cat.name,
          amountText: formatMoney(bill.amount, {
            withSign: true,
            billType: bill.billType
          })
        }
      })

      let totalExpense = 0
      let totalIncome = 0
      list.forEach((b) => {
        if (isIncome(b.billType)) totalIncome += Number(b.amount || 0)
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
        toastError(err, '加载失败')
      }
    } finally {
      wx.hideNavigationBarLoading()
    }
  },

  onToggleFilter() {
    this.setData({ filterExpanded: !this.data.filterExpanded })
  },

  async onSwapScope() {
    if (this.data.swapDisabled) {
      wx.showToast({ title: '暂无所属群组', icon: 'none' })
      return
    }
    const next = isGroupScope(this.data.scopeType)
      ? SCOPE_TYPE.PERSONAL
      : SCOPE_TYPE.GROUP
    setGlobalScopeType(next, { fromUser: true })
    this.setData({
      scopeType: next,
      scopeLabel: scopeTypeLabel(next),
      pageNum: 1
    })
    if (isGroupScope(next)) this.ensureGroupSelection()
    this.loadBills()
  },

  onGroupPick(e) {
    const groupIndex = Number(e.detail.value)
    const group = this.data.groupList[groupIndex]
    if (!group) return
    getApp().globalData.currentGroupId = group.groupId
    this.setData({ groupIndex, currentGroupId: group.groupId, pageNum: 1 })
    this.loadBills()
  },

  onMonthChange(e) {
    const month = e.detail.value
    this.setData({ month, monthLabel: formatMonthLabel(month), pageNum: 1 })
    this.loadBills()
  },

  onTypeChange(e) {
    const key = e.currentTarget.dataset.key
    const opt = this.data.typeOptions.find((o) => o.key === key)
    const billType = opt ? normalizeBillType(opt.id) : null
    this.setData({
      billType,
      billTypeKey: key || 'all',
      categoryCode: '',
      categoryIndex: 0,
      pageNum: 1
    })
    this.applyCategoryOptions()
    this.loadBills()
  },

  onAccountChange(e) {
    const accountIndex = Number(e.detail.value)
    const accountId = accountIndex === 0 ? null : this.data.accounts[accountIndex - 1].accountId
    this.setData({ accountIndex, accountId, pageNum: 1 })
    this.loadBills()
  },

  onCategoryFilterChange(e) {
    const categoryIndex = Number(e.detail.value)
    const opt = this.data.categoryOptions[categoryIndex]
    this.setData({
      categoryIndex,
      categoryCode: opt ? opt.code : '',
      pageNum: 1
    })
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
