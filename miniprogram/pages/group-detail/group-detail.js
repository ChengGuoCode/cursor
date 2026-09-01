const {
  selectGroup,
  updateGroup,
  updateMemberName,
  exitGroup
} = require('../../api/group')
const { getProfile } = require('../../api/user')
const { isLoggedIn, requireLogin } = require('../../utils/auth')
const { toastError } = require('../../utils/request')
const { syncScopeAfterGroupChange } = require('../../utils/scope-store')
const {
  ROLE_TYPE,
  MEMBER_STATUS,
  GROUP_STATUS,
  findMyMember,
  resolveMyRoleType,
  isOwner: checkIsOwner,
  canReview
} = require('../../utils/group-map')

function readUserId(user) {
  if (!user || typeof user !== 'object') return ''
  if (user.userId != null && user.userId !== '') return user.userId
  if (user.id != null && user.id !== '') return user.id
  if (user.user_id != null && user.user_id !== '') return user.user_id
  return ''
}

function isActiveMember(m) {
  // 后端可能返回 status: null，视为在群正常
  return m.status == null || Number(m.status) === MEMBER_STATUS.NORMAL
}

Page({
  data: {
    groupId: null,
    group: null,
    members: [],
    myRoleType: null,
    isOwner: false,
    canManage: false,
    loading: true,
    empty: false
  },

  onLoad(query) {
    const groupId = query.groupId || ''
    this.setData({ groupId: groupId || null })
    if (groupId) getApp().globalData.currentGroupId = groupId
  },

  onShow() {
    this.loadDetail()
  },

  async loadDetail() {
    if (!isLoggedIn()) {
      this.setData({
        group: null,
        members: [],
        loading: false,
        empty: true,
        isOwner: false,
        canManage: false
      })
      return
    }

    this.setData({ loading: true })
    wx.showNavigationBarLoading()
    try {
      // 详情以 select 为准（含 groupMembers / ownerUserId），不要用 list 覆盖掉权限字段
      const groupId = this.data.groupId
      const [profile, group] = await Promise.all([
        getProfile().catch(() => null),
        selectGroup(groupId).catch(() => null)
      ])

      if (profile) {
        getApp().globalData.userInfo = profile
      }

      const uid = readUserId(profile) || readUserId(getApp().globalData.userInfo)

      if (!group) {
        this.setData({
          group: null,
          members: [],
          empty: true,
          loading: false,
          isOwner: false,
          canManage: false
        })
        return
      }

      const myRoleType = resolveMyRoleType(group, uid)
      const owner = checkIsOwner(myRoleType)
      const manage = canReview(myRoleType)
      const members = (group.groupMembers || [])
        .filter(isActiveMember)
        .sort((a, b) => (a.sortNo || 0) - (b.sortNo || 0) || (a.roleType || 0) - (b.roleType || 0))

      getApp().globalData.currentGroupId = group.groupId

      this.setData({
        group,
        members,
        myRoleType,
        isOwner: owner,
        canManage: manage,
        empty: false,
        loading: false
      })
    } catch (err) {
      toastError(err, '加载失败')
      this.setData({ loading: false, empty: true, isOwner: false, canManage: false })
    } finally {
      wx.hideNavigationBarLoading()
    }
  },

  copyInvite() {
    const code = this.data.group && this.data.group.inviteCode
    if (!code) {
      wx.showToast({ title: '暂无邀请码', icon: 'none' })
      return
    }
    wx.setClipboardData({
      data: String(code),
      success: () => wx.showToast({ title: '邀请码已复制', icon: 'success' })
    })
  },

  /**
   * 组装 update 入参。
   * 刷新邀请码：inviteCode 传空；其它更新：带上旧邀请码。
   */
  buildUpdatePayload(extra = {}, { refreshInvite = false } = {}) {
    const group = this.data.group
    if (!group) return null
    const payload = {
      groupId: group.groupId,
      ...extra
    }
    if (refreshInvite) {
      payload.inviteCode = ''
    } else {
      payload.inviteCode = group.inviteCode || ''
    }
    return payload
  },

  async onRefreshInvite() {
    if (!requireLogin() || !this.data.isOwner) return
    const group = this.data.group
    if (!group) return
    wx.showModal({
      title: '刷新邀请码',
      content: '刷新后旧邀请码将失效，确认继续？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await updateGroup(
            this.buildUpdatePayload(
              { groupName: group.groupName },
              { refreshInvite: true }
            )
          )
          wx.showToast({ title: '已刷新', icon: 'success' })
          this.loadDetail()
        } catch (err) {
          toastError(err, '刷新失败')
        }
      }
    })
  },

  onRename() {
    if (!requireLogin() || !this.data.isOwner) return
    const group = this.data.group
    wx.showModal({
      title: '修改群名称',
      editable: true,
      placeholderText: group.groupName || '',
      content: group.groupName || '',
      success: async (res) => {
        if (!res.confirm) return
        const groupName = (res.content || '').trim()
        if (!groupName) {
          wx.showToast({ title: '名称不能为空', icon: 'none' })
          return
        }
        try {
          await updateGroup(this.buildUpdatePayload({ groupName }))
          wx.showToast({ title: '已更新', icon: 'success' })
          this.loadDetail()
        } catch (err) {
          toastError(err, '更新失败')
        }
      }
    })
  },

  onEditMyName() {
    if (!requireLogin()) return
    const mine = findMyMember(this.data.group, readUserId(getApp().globalData.userInfo))
    wx.showModal({
      title: '修改群昵称',
      editable: true,
      placeholderText: '输入群内昵称',
      content: (mine && mine.memberName) || '',
      success: async (res) => {
        if (!res.confirm) return
        const memberName = (res.content || '').trim()
        if (!memberName) {
          wx.showToast({ title: '昵称不能为空', icon: 'none' })
          return
        }
        try {
          await updateMemberName(memberName)
          wx.showToast({ title: '已更新', icon: 'success' })
          this.loadDetail()
        } catch (err) {
          toastError(err, '更新失败')
        }
      }
    })
  },

  onMemberAction(e) {
    if (!this.data.isOwner) return
    const index = Number(e.currentTarget.dataset.index)
    const member = this.data.members[index]
    if (!member) return
    if (String(member.userId) === String(readUserId(getApp().globalData.userInfo))) {
      wx.showToast({ title: '不能操作自己', icon: 'none' })
      return
    }

    const items = []
    const actions = []

    if (Number(member.roleType) === ROLE_TYPE.MEMBER) {
      items.push('升为管理员')
      actions.push('promote')
    }
    if (Number(member.roleType) === ROLE_TYPE.ADMIN) {
      items.push('降为成员')
      actions.push('demote')
    }
    items.push('让出群主')
    actions.push('transfer')
    items.push('移除出群')
    actions.push('remove')

    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        const action = actions[res.tapIndex]
        if (action) this.runMemberAction(action, member)
      }
    })
  },

  async runMemberAction(action, member) {
    const group = this.data.group
    if (!group) return

    try {
      if (action === 'promote') {
        await updateGroup(
          this.buildUpdatePayload({
            groupMembers: [
              {
                groupMemberId: member.groupMemberId,
                userId: member.userId,
                roleType: ROLE_TYPE.ADMIN,
                status: MEMBER_STATUS.NORMAL
              }
            ]
          })
        )
      } else if (action === 'demote') {
        await updateGroup(
          this.buildUpdatePayload({
            groupMembers: [
              {
                groupMemberId: member.groupMemberId,
                userId: member.userId,
                roleType: ROLE_TYPE.MEMBER,
                status: MEMBER_STATUS.NORMAL
              }
            ]
          })
        )
      } else if (action === 'transfer') {
        const ok = await this.confirmModal('让出群主', `确定将群主转让给「${member.memberName}」？`)
        if (!ok) return
        await updateGroup(
          this.buildUpdatePayload({
            ownerUserId: member.userId,
            groupMembers: [
              {
                groupMemberId: member.groupMemberId,
                userId: member.userId,
                roleType: ROLE_TYPE.OWNER,
                status: MEMBER_STATUS.NORMAL
              }
            ]
          })
        )
      } else if (action === 'remove') {
        const ok = await this.confirmModal('移除成员', `确定移除「${member.memberName}」？`)
        if (!ok) return
        await updateGroup(
          this.buildUpdatePayload({
            groupMembers: [
              {
                groupMemberId: member.groupMemberId,
                userId: member.userId,
                roleType: member.roleType,
                status: MEMBER_STATUS.EXITED
              }
            ]
          })
        )
      }
      wx.showToast({ title: '已更新', icon: 'success' })
      this.loadDetail()
    } catch (err) {
      toastError(err, '操作失败')
    }
  },

  confirmModal(title, content) {
    return new Promise((resolve) => {
      wx.showModal({
        title,
        content,
        success: (res) => resolve(!!res.confirm)
      })
    })
  },

  onDissolve() {
    if (!requireLogin() || !this.data.isOwner) return
    wx.showModal({
      title: '解散群组',
      content: '解散后不可恢复，确认解散？',
      confirmColor: '#C45C26',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await updateGroup(
            this.buildUpdatePayload({
              status: GROUP_STATUS.DISSOLVED
            })
          )
          await syncScopeAfterGroupChange()
          wx.showToast({ title: '已解散', icon: 'success' })
          setTimeout(() => {
            wx.switchTab({ url: '/pages/groups/groups' })
          }, 400)
        } catch (err) {
          toastError(err, '解散失败')
        }
      }
    })
  },

  onExit() {
    if (!requireLogin()) return
    if (this.data.isOwner) {
      wx.showToast({ title: '群主请先转让或解散', icon: 'none' })
      return
    }
    wx.showModal({
      title: '退出群组',
      content: '确定退出当前群组？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await exitGroup()
          await syncScopeAfterGroupChange()
          wx.showToast({ title: '已退出', icon: 'success' })
          setTimeout(() => {
            wx.switchTab({ url: '/pages/groups/groups' })
          }, 400)
        } catch (err) {
          toastError(err, '退出失败')
        }
      }
    })
  },

  goApplyList() {
    wx.navigateTo({
      url: `/pages/group-apply/group-apply?groupId=${this.data.groupId || ''}`
    })
  }
})
