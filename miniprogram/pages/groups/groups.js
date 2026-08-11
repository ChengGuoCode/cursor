const { getGroups, createGroup, joinGroup } = require('../../api/group')
const { formatMoney } = require('../../utils/format')

Page({
  data: {
    groups: []
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
    this.loadGroups()
  },

  async loadGroups() {
    wx.showNavigationBarLoading()
    try {
      const { list } = await getGroups()
      this.setData({
        groups: (list || []).map((g) => ({
          ...g,
          monthExpenseText: formatMoney(g.monthExpense),
          balanceText: formatMoney(g.myBalance, { withSign: true })
        }))
      })
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    } finally {
      wx.hideNavigationBarLoading()
    }
  },

  onCreate() {
    wx.showModal({
      title: '新建群组',
      editable: true,
      placeholderText: '例如：合租小家',
      success: async (res) => {
        if (!res.confirm) return
        const name = (res.content || '').trim()
        if (!name) {
          wx.showToast({ title: '请输入名称', icon: 'none' })
          return
        }
        try {
          await createGroup({ name })
          wx.showToast({ title: '已创建', icon: 'success' })
          this.loadGroups()
        } catch (err) {
          wx.showToast({ title: err.message || '创建失败', icon: 'none' })
        }
      }
    })
  },

  onJoin() {
    wx.showModal({
      title: '加入群组',
      editable: true,
      placeholderText: '输入邀请码',
      success: async (res) => {
        if (!res.confirm) return
        const inviteCode = (res.content || '').trim()
        if (!inviteCode) {
          wx.showToast({ title: '请输入邀请码', icon: 'none' })
          return
        }
        try {
          await joinGroup(inviteCode)
          wx.showToast({ title: '已申请加入', icon: 'success' })
          this.loadGroups()
        } catch (err) {
          wx.showToast({ title: err.message || '加入失败', icon: 'none' })
        }
      }
    })
  },

  goDetail(e) {
    wx.navigateTo({
      url: `/pages/group-detail/group-detail?id=${e.currentTarget.dataset.id}`
    })
  }
})
