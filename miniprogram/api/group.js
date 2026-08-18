const { request, shouldUseMock } = require('../utils/request')
const { mockGroups, mockBills } = require('../utils/mock')

/** 我的群组列表 — GET /api/groups */
function getGroups() {
  if (shouldUseMock()) {
    return Promise.resolve({ list: mockGroups.map((g) => ({ ...g })) })
  }
  return request({ url: '/api/groups', method: 'GET' })
}

/** 群组详情 — GET /api/groups/:id */
function getGroupDetail(id) {
  if (shouldUseMock()) {
    const group = mockGroups.find((g) => g.id === id)
    if (!group) return Promise.reject(new Error('群组不存在'))
    const bills = mockBills.filter((b) => b.groupId === id)
    return Promise.resolve({
      ...group,
      members: [
        { id: 'u_1001', nickname: '阿树', role: 'owner' },
        { id: 'u_1002', nickname: '小林', role: 'member' },
        { id: 'u_1003', nickname: '阿宁', role: 'member' }
      ],
      recentBills: bills
    })
  }
  return request({ url: `/api/groups/${id}`, method: 'GET' })
}

/**
 * 创建群组 — POST /api/groups
 * @param {{ name: string, remark?: string }} payload
 */
function createGroup(payload) {
  if (shouldUseMock()) {
    const created = {
      id: `g_${Date.now()}`,
      name: payload.name,
      coverColor: '#0B3D2E',
      memberCount: 1,
      monthExpense: 0,
      myBalance: 0,
      role: 'owner',
      updatedAt: new Date().toISOString()
    }
    mockGroups.unshift(created)
    return Promise.resolve(created)
  }
  return request({
    url: '/api/groups',
    method: 'POST',
    data: payload,
    forceLoginOnUnauthorized: true
  })
}

/** 加入群组 — POST /api/groups/join */
function joinGroup(inviteCode) {
  if (shouldUseMock()) {
    return Promise.resolve({ ok: true, inviteCode })
  }
  return request({
    url: '/api/groups/join',
    method: 'POST',
    data: { inviteCode },
    forceLoginOnUnauthorized: true
  })
}

/** 群组结算摘要 — GET /api/groups/:id/settlement */
function getGroupSettlement(id) {
  if (shouldUseMock()) {
    return Promise.resolve({
      groupId: id,
      balances: [
        { userId: 'u_1001', nickname: '阿树', amount: -42.5 },
        { userId: 'u_1002', nickname: '小林', amount: 20 },
        { userId: 'u_1003', nickname: '阿宁', amount: 22.5 }
      ],
      suggestions: [
        { from: '阿树', to: '小林', amount: 20 },
        { from: '阿树', to: '阿宁', amount: 22.5 }
      ]
    })
  }
  return request({ url: `/api/groups/${id}/settlement`, method: 'GET' })
}

module.exports = {
  getGroups,
  getGroupDetail,
  createGroup,
  joinGroup,
  getGroupSettlement
}
