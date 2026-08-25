const {
  getGroups,
  createGroup,
  applyGroup,
  selectGroup
} = require('../../api/group')
const { isLoggedIn, requireLogin } = require('../../utils/auth')
const { toastError } = require('../../utils/request')
const {
  findMyMember,
  roleTypeLabel,
  GROUP_STATUS
} = require('../../utils/group-map')

function currentUserId() {
  const user = (getApp().globalData && getApp().globalData.userInfo) || {}
  return user.id || user.userId || ''
}

Page({
  data: {
    groups: [],
    guestMode: false,
    currentGroupId: null,
    panel: '', // '' | create | apply
    createName: '',
    createMemberName: '',
    inviteCode: '',
    applyMsg: '',
    submitting: false
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
      const [{ list }, current] = await Promise.all([
        getGroups(),
        selectGroup().catch(() => null)
      ])
      const uid = currentUserId()
      const currentGroupId = current && current.groupId != null ? current.groupId : null
      if (currentGroupId != null) {
        getApp().globalData.currentGroupId = currentGroupId
      }

      this.setData({
        guestMode: false,
        currentGroupId,
        groups: (list || [])
          .filter((g) => Number(g.status) !== GROUP_STATUS.DISSOLVED)
          .map((g) => {
            const mine = findMyMember(g, uid)
            return {
              ...g,
              roleLabel: mine ? roleTypeLabel(mine.roleType) : '',
              isCurrent: currentGroupId != null && String(g.groupId) === String(currentGroupId)
            }
          })
      })
    } catch (err) {
      if (err && err.code === 401) {
        this.setData({ groups: [], guestMode: true })
      } else {
        toastError(err, '加载失败')
      }
    } finally {
      wx.hideNavigationBarLoading()
    }
  },

  openCreate() {
    if (!requireLogin('新建群组前请先登录')) return
    this.setData({
      panel: 'create',
      createName: '',
      createMemberName: ''
    })
  },

  openApply() {
    if (!requireLogin('申请加入前请先登录')) return
    this.setData({
      panel: 'apply',
      inviteCode: '',
      applyMsg: ''
    })
  },

  closePanel() {
    this.setData({ panel: '' })
  },

  onCreateNameInput(e) {
    this.setData({ createName: e.detail.value })
  },

  onCreateMemberInput(e) {
    this.setData({ createMemberName: e.detail.value })
  },

  onInviteInput(e) {
    this.setData({ inviteCode: e.detail.value })
  },

  onApplyMsgInput(e) {
    this.setData({ applyMsg: e.detail.value })
  },

  async submitCreate() {
    if (this.data.submitting) return
    const groupName = (this.data.createName || '').trim()
    if (!groupName) {
      wx.showToast({ title: '请输入群组名称', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      await createGroup({
        groupName,
        memberName: (this.data.createMemberName || '').trim()
      })
      wx.showToast({ title: '已创建', icon: 'success' })
      this.setData({ panel: '' })
      this.loadGroups()
    } catch (err) {
      toastError(err, '创建失败')
    } finally {
      this.setData({ submitting: false })
    }
  },

  async submitApply() {
    if (this.data.submitting) return
    const inviteCode = (this.data.inviteCode || '').trim()
    if (!inviteCode) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      await applyGroup({
        inviteCode,
        applyMsg: (this.data.applyMsg || '').trim()
      })
      wx.showToast({ title: '已提交申请', icon: 'success' })
      this.setData({ panel: '' })
    } catch (err) {
      toastError(err, '申请失败')
    } finally {
      this.setData({ submitting: false })
    }
  },

  goDetail(e) {
    const groupId = e.currentTarget.dataset.id
    if (groupId == null) return
    getApp().globalData.currentGroupId = groupId
    wx.navigateTo({
      url: `/pages/group-detail/group-detail?groupId=${groupId}`
    })
  },

  goApplyList() {
    if (!requireLogin('查看申请前请先登录')) return
    wx.navigateTo({ url: '/pages/group-apply/group-apply' })
  }
})
