const { createGroup } = require('../../api/group')
const { requireLogin } = require('../../utils/auth')
const { toastError } = require('../../utils/request')
const { preferGroupScopeAfterJoin } = require('../../utils/scope-store')

Page({
  data: {
    groupName: '',
    memberName: '',
    submitting: false
  },

  onLoad() {
    if (!requireLogin('新建群组前请先登录')) {
      setTimeout(() => wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/groups/groups' }) }), 400)
    }
  },

  onGroupNameInput(e) {
    this.setData({ groupName: e.detail.value })
  },

  onMemberNameInput(e) {
    this.setData({ memberName: e.detail.value })
  },

  async onSubmit() {
    if (this.data.submitting) return
    if (!requireLogin('新建群组前请先登录')) return

    const groupName = (this.data.groupName || '').trim()
    if (!groupName) {
      wx.showToast({ title: '请输入群组名称', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    try {
      const created = await createGroup({
        groupName,
        memberName: (this.data.memberName || '').trim()
      })
      preferGroupScopeAfterJoin(created && created.groupId)
      wx.showToast({ title: '已创建', icon: 'success' })
      setTimeout(() => {
        wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/groups/groups' }) })
      }, 400)
    } catch (err) {
      toastError(err, '创建失败')
    } finally {
      this.setData({ submitting: false })
    }
  }
})
