const { getGroups } = require('../../api/group')
const { isLoggedIn, requireLogin } = require('../../utils/auth')
const { toastError } = require('../../utils/request')
const {
  roleTypeLabel,
  GROUP_STATUS,
  toCreateTimeMs
} = require('../../utils/group-map')
const { getActiveSelectedGroupId } = require('../../utils/scope-store')

/** status=1，按 createTime 倒序 */
function prepareGroupList(list = []) {
  return (list || [])
    .filter((g) => Number(g.status) === GROUP_STATUS.NORMAL)
    .slice()
    .sort((a, b) => toCreateTimeMs(b.createTime) - toCreateTimeMs(a.createTime))
}

Page({
  data: {
    groups: [],
    guestMode: false,
    /** 全局选中群（仅群组 scope 下有值，用于「当前」标签） */
    currentGroupId: null
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
    this.loadGroups()
  },

  async loadGroups() {
    if (!isLoggedIn()) {
      this.setData({ groups: [], guestMode: true, currentGroupId: null })
      return
    }

    wx.showNavigationBarLoading()
    try {
      const { list } = await getGroups()
      const groups = prepareGroupList(list || [])
      // 与概览/账单/记账联动：仅群组模式下展示「当前」
      const currentGroupId = getActiveSelectedGroupId()

      this.setData({
        guestMode: false,
        currentGroupId,
        groups: groups.map((g) => ({
          ...g,
          roleLabel: g.roleType != null ? roleTypeLabel(g.roleType) : '',
          isCurrent:
            currentGroupId != null && String(g.groupId) === String(currentGroupId)
        }))
      })
    } catch (err) {
      if (err && err.code === 401) {
        this.setData({ groups: [], guestMode: true, currentGroupId: null })
      } else {
        toastError(err, '加载失败')
      }
    } finally {
      wx.hideNavigationBarLoading()
    }
  },

  openCreate() {
    if (!requireLogin('新建群组前请先登录')) return
    wx.navigateTo({ url: '/pages/group-create/group-create' })
  },

  openApply() {
    if (!requireLogin('申请加入前请先登录')) return
    wx.navigateTo({ url: '/pages/group-join/group-join' })
  },

  goDetail(e) {
    const groupId = e.currentTarget.dataset.id
    if (groupId == null) return
    // 进详情不改动全局选中群（「当前」由概览/账单/记账选择驱动）
    wx.navigateTo({
      url: `/pages/group-detail/group-detail?groupId=${groupId}`
    })
  },

  goApplyList() {
    if (!requireLogin('查看申请前请先登录')) return
    wx.navigateTo({ url: '/pages/group-apply/group-apply' })
  }
})
