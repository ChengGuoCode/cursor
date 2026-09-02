# 轻记账 · 微信小程序前端

五栏记账小程序前端（仅前端 + Mock，已预留后端接口函数）。

## 信息架构

| Tab | 页面 | 职责 |
| --- | --- | --- |
| 1 概览 | `pages/dashboard` | 月结余、收支、预算、近七日滚动支出、分类占比、最近账单 |
| 2 账单 | `pages/bills` | 按日分组明细，支持月/类型/关键词筛选 |
| 3 记账 | `pages/add` | 中间凸起入口，快速记一笔 |
| 4 群组 | `pages/groups` | 合租/出游 AA，结算建议 |
| 5 我的 | `pages/profile` | 用户资料（头像/昵称）、月度预算入口、登录 |

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
3. 统一请求封装：`utils/request.js`（Bearer Token、ResDTO、全局 401/500 异常捕获）。
4. 登录会话：`utils/auth.js`（token 落盘 / 清理 / 401 跳转登录）。

### 异常处理（对齐 GlobalExceptionHandler）

- HTTP **401**（`FfAuthException`）：清会话，toast 后跳转「我的」登录
- HTTP **500**：toast 展示后端 `ex.getMessage()`，约 2.8s 后自动消失
- ResDTO `code !== 0`：同样 toast `msg`；页面 `catch` 用 `toastError` 避免重复提示

### 登录闭环

对接后端 `ResDTO<T>`：`{ code, msg, data }`，`code === 0` 成功，失败用 `msg` 提示。

1. 「我的」点登录 → `wx.login` 取 `code` → `GET /api/user/login?code=`
2. 登录成功：`data` 为 **token 字符串** → 写入 Storage
3. 再请求 `GET /api/user/profile` 拉取用户信息，填充头像 / 昵称
4. 登录失败（`code !== 0`）：toast 展示 `msg`，保持未登录（不写 token）
5. **浏览**（概览/账单/群组）：未登录不请求，不跳转登录
6. **主动写操作**：`requireLogin()` 未登录才跳「我的」
7. 退出：清本地会话

登录接口约定：`ResDTO.ok(token)` → `{ code: 0, msg: "success", data: "<jwt>" }`。

### 账单列表约定

- 请求：`POST /api/bill/page`，body 为 `PageReqDTO<BillReqDTO>`
- 响应：`ResDTO<PageResDTO<BillResDTO>>`，列表字段为 `records`
- `billType`：展示「全部/收入/支出」，提交与存储为 `null/1/2`（1收入，2支出；全部为 null）
- `scopeType`：与后端枚举一致，`1=个人`，`2=群组`（对应 PERSONAL / GROUP）；UI 只用中文「个人/群组」，不用 personal/group 字符串
- 筛选账户用 `accountId`；展示可用返回的 `accountName`
- `scopeType=1`：不传 `groupId`；`scopeType=2`：传用户所属某个群组的 `groupId`
- **已加入群组时**：概览/账单默认 `scopeType=2`（群组）；用户手动切个人后本会话保持个人；无群组则回落个人
- 无所属群组时，切换按钮置灰（不可切到群组）
- 枚举：`GET /api/config/category`、`GET /api/config/account`
- 账单页常用筛选（月/收支）常显；账户/类目收在「更多筛选」折叠区
- **记账创建** body 对齐 `TransactionReqDTO`：`billType`、`categoryCode`、`accountId`、`amount`、`remark`；选中群组时传 `groupId`，**不传 `scopeType`**

### 群组约定

对接 `GroupController`（`/api/group`）：

- `POST /create`：创建（`groupName`，可选 `memberName`）
- `POST /update`：群主更新（改名、解散 `status=0`、转让 `ownerUserId`、刷新邀请码、成员升降/移除）
- `GET /list`：我加入的群组
- `GET /select`：当前群组（含 `groupMembers`）
- `GET /listApply`：入群申请（可选 `groupId`、`applyStatus`：0待审核 / 1通过 / 2拒绝 / 3取消）
- `POST /apply`：邀请码申请；`POST /cancelApply`：取消；`POST /review`：审核
- `POST /updateMemberName`：改群昵称（`groupId`、`memberName`）；`POST /exit`：退出（`groupId`）
- `roleType`：`1群主 / 2管理员 / 3成员`；成员与群组 `status`：`1正常 / 0退出或解散`

### 预留接口一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/user/login` | code 换 token |
| GET/PUT | `/api/user/profile` | 用户资料（昵称、头像等） |
| POST | `/api/user/avatar` | 上传头像（multipart `file`），返回 URL |
| GET/PUT | `/api/user/budget` | 月度预算（PUT body: `{ budget }`） |
| GET | `/api/bill/overview?scopeType=&groupId=&periodType=&month=` | 仪表盘（群组模式传 groupId） |
| POST | `/api/bill/page` | 账单分页 |
| GET | `/api/group/list` | 群组列表 |
| GET | `/api/group/select?groupId=` | 指定群组详情 |
| POST | `/api/group/create` | 创建群组 |
| POST | `/api/group/update` | 更新群组 |
| POST | `/api/group/apply` | 申请加入 |
| GET | `/api/group/listApply?groupId=&applyStatus=` | 入群申请列表 |
| POST | `/api/group/review` | 审核申请 |
| POST | `/api/group/cancelApply` | 取消申请 |
| POST | `/api/group/updateMemberName?groupId=&memberName=` | 更新群昵称 |
| POST | `/api/group/exit?groupId=` | 退出群组 |

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
    budget | bill-detail | group-detail
```
