# 轻记账 · 微信小程序前端

五栏记账小程序前端（仅前端 + Mock，已预留后端接口函数）。

## 信息架构

| Tab | 页面 | 职责 |
| --- | --- | --- |
| 1 概览 | `pages/dashboard` | 月结余、收支、预算、近七日滚动支出、分类占比、最近账单 |
| 2 账单 | `pages/bills` | 按日分组明细，支持月/类型/关键词筛选 |
| 3 记账 | `pages/add` | 中间凸起入口，快速记一笔 |
| 4 群组 | `pages/groups` | 合租/出游 AA，结算建议 |
| 5 我的 | `pages/profile` | 用户信息、预算/分类/账户入口、登录 |

子页面：`bill-detail`、`group-detail`。

## 设计是否合理 & 改进点

**合理之处**

- 「概览 → 明细 → 记账」符合查账与记帐的主路径。
- 中间栏「记账」用自定义 TabBar 凸起按钮，降低记一笔的操作成本。
- 「群组」独立成栏，适合合租/AA 是核心卖点的产品。
- 「我的」收纳低频设置，避免污染主流程。

**建议改进**

1. **记账交互**：当前为完整 Tab 页；后续可改为半屏弹层（从任意页唤起），记完自动回到原页。
2. **群组权重**：若个人记账为主、AA 为辅，可将群组收入「我的」或概览入口，Tab 改为「统计/图表」。
3. **概览信息密度**：首屏保持「结余 + 收支 + 预算」即可；趋势/分类可折叠或下沉，避免一屏过满。
4. **账单能力**：补充按分类筛选、日历视图、批量删除；长按快捷改备注。
5. **群组能力**：补齐邀请海报、谁付的/如何分摊、一键结算状态。
6. **离线与反馈**：本地草稿队列、保存成功动效、空状态引导。

## 对接后端

1. 在 `app.js` 中设置：
   ```js
   globalData: {
     useMock: false,
     apiBaseUrl: 'https://your-api.example.com'
   }
   ```
2. 接口函数位于 `api/`：
   - `api/user.js` — 登录 / 资料
   - `api/bill.js` — 概览 / 账单 CRUD
   - `api/group.js` — 群组 / 结算
3. 统一请求封装：`utils/request.js`（Bearer Token、`{ code, data, message }` 约定）。
4. 登录会话：`utils/auth.js`（token 落盘 / 清理 / 401 引导）。

### 登录闭环

1. 「我的」点登录 → `wx.login` 取 `code` → 登录接口换 token
2. 成功后将 `token` 写入 Storage，后续请求自动带 `Authorization: Bearer …`
3. 若登录响应只有 token，再请求 `GET /api/user/profile` 补全资料
4. 启动时若有 token，静默拉资料；失效则清会话（不强制跳转）
5. **浏览**（概览/账单/群组列表）：未登录不请求或失败只清会话，**不跳转登录**
6. **主动写操作**（保存账单、新建/加入群组、删除账单）：先 `requireLogin()`，未登录才跳「我的」
7. 写接口 401 时带 `forceLoginOnUnauthorized`，引导重新登录
8. 退出：调 logout（失败也清本地）

登录接口建议返回：`{ token, user }`（也兼容 `accessToken` / `userInfo`）。

### 预留接口一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/wx-login` | code 换 token |
| GET/PUT | `/api/user/profile` | 用户资料 |
| GET | `/api/overview` | 仪表盘 |
| GET/POST | `/api/bills` | 列表 / 创建 |
| GET/PUT/DELETE | `/api/bills/:id` | 详情 / 更新 / 删除 |
| GET/POST | `/api/groups` | 群组列表 / 创建 |
| GET | `/api/groups/:id` | 群组详情 |
| POST | `/api/groups/join` | 邀请码加入 |
| GET | `/api/groups/:id/settlement` | 结算建议 |

## 本地运行

1. 安装[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入项目目录：`miniprogram/`
3. AppID 可使用测试号；`project.config.json` 中当前为 `touristappid`
4. 编译预览；`app.js` 中 `useMock` 控制 Mock/真实接口，真实模式需配置可访问的 `apiBaseUrl`

## 目录结构

```
miniprogram/
  app.js / app.json / app.wxss
  custom-tab-bar/          # 自定义五栏（中间凸起）
  api/                     # 后端预留函数
  utils/                   # request / auth / format / constants / mock
  pages/
    dashboard | bills | add | groups | profile
    bill-detail | group-detail
```
