Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/dashboard/dashboard', text: '概览', icon: 'home' },
      { pagePath: '/pages/bills/bills', text: '账单', icon: 'list' },
      { pagePath: '/pages/add/add', text: '记账', isCenter: true },
      { pagePath: '/pages/groups/groups', text: '群组', icon: 'group' },
      { pagePath: '/pages/profile/profile', text: '我的', icon: 'user' }
    ]
  },

  methods: {
    onSwitch(e) {
      const { path, index } = e.currentTarget.dataset
      wx.switchTab({ url: path })
      this.setData({ selected: index })
    }
  }
})
