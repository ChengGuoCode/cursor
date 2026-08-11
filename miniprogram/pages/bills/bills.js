const { getBills } = require('../../api/bill')
const { getGroups } = require('../../api/group')
const { formatMoney, formatMonthLabel, groupBillsByDate } = require('../../utils/format')
const { getCategoryById } = require('../../utils/constants')

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
    keyword: '',
    groups: [],
    totalExpenseText: '0.00',
    totalIncomeText: '0.00',
    groupNameMap: {}
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
    this.prepareAndLoad()
  },

  async prepareAndLoad() {
    try {
      const { list } = await getGroups()
      const groupNameMap = {}
      ;(list || []).forEach((g) => {
        groupNameMap[g.id] = g.name
      })
      this.setData({ groupNameMap })
    } catch (e) {
      // 群组名仅作增强展示，失败可忽略
    }
    this.loadBills()
  },

  async loadBills() {
    wx.showNavigationBarLoading()
    try {
      const res = await getBills({
        month: this.data.month,
        type: this.data.type,
        keyword: this.data.keyword
      })
      const list = (res.list || []).map((bill) => {
        const cat = getCategoryById(bill.categoryId)
        return {
          ...bill,
          icon: cat.icon,
          color: cat.color,
          categoryName: cat.name,
          groupName: bill.groupId ? this.data.groupNameMap[bill.groupId] : '',
          amountText: formatMoney(bill.amount, { withSign: true, type: bill.type })
        }
      })

      let totalExpense = 0
      let totalIncome = 0
      list.forEach((b) => {
        if (b.type === 'income') totalIncome += Number(b.amount || 0)
        else totalExpense += Number(b.amount || 0)
      })

      const groups = groupBillsByDate(list).map((g) => ({
        ...g,
        expenseText: formatMoney(g.expense),
        incomeText: formatMoney(g.income)
      }))

      this.setData({
        groups,
        totalExpenseText: formatMoney(totalExpense),
        totalIncomeText: formatMoney(totalIncome)
      })
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    } finally {
      wx.hideNavigationBarLoading()
    }
  },

  onMonthChange(e) {
    const month = e.detail.value
    this.setData({ month, monthLabel: formatMonthLabel(month) })
    this.loadBills()
  },

  onTypeChange(e) {
    this.setData({ type: e.currentTarget.dataset.id })
    this.loadBills()
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  onSearch() {
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
