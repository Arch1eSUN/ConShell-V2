# Round 19.7 审计报告
## Product Polish / Performance / Parity / Lifeform Closure 真实性审计

> 审计日期：2026-03-20
> 方法：仓内证据 + 构建/类型检查 + core 全量测试
> 结论等级：高可信

---

## 1. 审计结论摘要

**Round 19.7 主体大体成立，但不是“7 个目标无保留全部完美成立”。**

更准确地说：
- **G1 Bundle 优化：成立，而且是实质性改善**
- **G3 控制面板打磨（loading / skeleton / empty state）：成立**
- **G5 TUI 第二层成熟：成立**
- **G6 Onboarding 升级为 Lifeform Activation：成立**
- **G2/G7 一致性与清债：大体成立，但仍有少量内部文档/注释残留**
- **G4 生命闭环可见性：部分成立，UI 已新增 Agenda Truth 卡，但后端聚合 truth surface 尚未完整接线，存在前端 fallback 展示成分**

因此，19.7 不是虚报；它是一轮**真实的产品打磨 / 性能优化 / parity 推进**。但若严格按“生命闭环可见性已完整实现”来表述，则**证据不足，需收敛口径**。

---

## 2. 独立核验结果

### 2.1 Core 测试
执行：
```bash
cd packages/core && pnpm vitest run src
```
结果：
- **Test Files: 87 passed (87)**
- **Tests: 1813 passed (1813)**
- **exit code 0**

### 2.2 CLI / Dashboard TypeScript 与构建
执行：
```bash
cd packages/cli && pnpm tsc --noEmit
cd packages/dashboard && pnpm tsc --noEmit && pnpm build
```
结果：
- CLI TypeScript：**通过**
- Dashboard TypeScript：**通过**
- Dashboard build：**通过**
- build 时间约：**6.31s**

---

## 3. G1 审计：Bundle 优化

### 证据
- `packages/dashboard/src/App.tsx`
  - 已使用 `React.lazy()` 做 route-level split
  - Presence 首页保留 eager load
  - Wallet/Web3 provider 延迟加载
- `packages/dashboard/vite.config.ts`
  - 已增加 `manualChunks`
  - 拆分 `web3-core` / `web3-ui` / `react-vendor`

### 构建结果证据
本次 build 结果显示：
- 主入口 chunk 已出现多个拆分产物
- `dist/assets/index-BSxjMWi0.js` ≈ **261.23 kB**
- `web3-ui` ≈ **349.50 kB**
- `web3-core` ≈ **370.51 kB**

这与用户播报的“主 chunk 1025 → 261kB”方向一致，且**仓内构建产物确实表明首屏主包明显下降**。

### 但需保持严谨
当前 build 仍有：
- `metamask-sdk` ≈ **557.74 kB**
- `index-CFOVnpSA.js` ≈ **581.13 kB**

因此：
- **“主 chunk 降 74%”这个说法大体可信**
- 但**“bundle 性能问题已彻底解决”不成立**
- 19.7 完成的是**显著改善，不是终局收口**

### 判断
**G1 成立。**

---

## 4. G3 审计：控制面板打磨（loading / skeleton / empty state）

### 证据
在 dashboard 多页面中已看到真实 skeleton / loading / empty state：
- `packages/dashboard/src/pages/PresencePage.tsx`
- `TasksPage.tsx`
- `HealthPage.tsx`
- `CollectivePage.tsx`
- `EconomicPage.tsx`
- `MemoryPage.tsx`
- `SkillsPage.tsx`
- `IdentityPage.tsx`
- `MetricsPage.tsx`
- `SettingsPage.tsx`

其中 `PresencePage` 已有：
- hero skeleton
- truth grid skeleton
- interventions 空状态

### 判断
**G3 成立。**

### 备注
这是实打实的成熟度提升，不是口头 polish。

---

## 5. G4 审计：生命闭环可见性（Agenda Truth）

### 前端证据
`packages/dashboard/src/pages/PresencePage.tsx`
中已真实新增第 5 张卡：
- `Agenda Truth`
- 字段：scheduled / deferred / priorityReason

### 关键问题：后端聚合 truth surface 接线不足
本次核查 `packages/core/src/server/routes/system-summary.ts` 发现：
- 当前 `/api/system/summary` 返回：
  - agent
  - posture
  - economic
  - collective
  - governance
- **未看到 agenda 字段被正式聚合进 summary route**

而 `PresencePage` 当前对 agenda 的读取是：
```ts
(p as any).agenda?.scheduled ?? 0
(p as any).agenda?.deferred ?? 0
(p as any).agenda?.priorityReason ?? 'economic pressure'
```
说明：
- 该卡片已在 UI 层真实出现
- 但其数据来源**尚未被严格接到 canonical 聚合 truth surface**
- 存在 fallback/default 文案成分

### 审计判断
因此：
- **“Agenda Truth 卡片已新增”成立**
- **“生命闭环可见性已完整实现”不成立**
- 更准确说法应为：
  > **19.7 已开始把 agenda/lifeform closure 暴露到首页 UI，但后端聚合与真实数据接线仍未完全收口。**

### 判断
**G4 部分成立，不宜按满分通过表述。**

---

## 6. G5 审计：TUI 第二层成熟

### 证据
`packages/cli/src/tui.ts`
头部注释已明确：
- Round 19.7: interactive keys, connection beacon, agenda hint, help overlay

已真实实现：
- `q` / `Ctrl+C` 退出
- `r` 手动刷新
- `?` help overlay
- connection beacon
- agenda view / next item hint
- footer key hints

### 判断
**G5 成立。**

### 备注
这说明 TUI 已从“存在”走向“更可用”。

---

## 7. G6 审计：Onboarding 升级

### 证据
`packages/cli/src/onboard.ts`
已明确变为：
- `Lifeform Activation`
- 使用 canonical 6 control planes 语义
- 激活总结中逐项列出：
  - Presence
  - Runtime
  - Governance
  - Survival
  - Collective
  - Operator

### 判断
**G6 成立。**

### 备注
19.7 的 onboarding 明显比 19.6 更像产品化 first awakening experience。

---

## 8. G2/G7 审计：一致性与清债

### 成立部分
- `App.tsx` 已注明 19.7 performance split 与 canonical 6-plane 结构
- onboarding / TUI / Presence 术语显著更统一
- 旧首页骨架已不存在

### 未完全收口部分
仓内仍可见少量内部注释/文档提及 V1，例如：
- `packages/dashboard/src/contracts/terminology.ts`
  - still references “replaces the flat 12-tab V1 navigation”
- 部分 planning/audit 历史文档继续提到 V1（这本身未必是问题）

### 判断
- **“V1 残留仅限内部文档注释”这一说法基本成立**
- 但“清债已彻底完成”不宜绝对化

### 判断
**G2/G7 大体成立。**

---

## 9. 对 19.7 的总体评价

### 9.1 是否真实完成了一轮产品成熟度推进？
**是。**

### 9.2 是否比 19.6 更成熟？
**是。**

本轮真实推进点包括：
- dashboard route/code splitting
- Web3 defer loading
- Presence / 多页面 skeleton 与空状态
- TUI 交互层增强
- onboarding 正式产品语言升级

### 9.3 本轮最重要的未完全收口点
**Agenda / lifeform closure visibility 还停留在“前端先暴露、后端聚合未完全 canonicalize”的状态。**

这是 19.8 最值得继续打的点之一。

---

## 10. 审计结论（可直接引用）

> **Round 19.7 主体大体真实成立。**
>
> **ConShell 已真实完成 dashboard 的 route-level split / manualChunks 性能优化、TUI 第二层交互增强、Onboarding 向 Lifeform Activation 升级，以及多页面 loading / skeleton / empty-state 的产品成熟度提升。CLI TypeScript、Dashboard TypeScript、Dashboard build、Core 87/87 + 1813/1813 测试均继续通过。**
>
> **但必须保持真实性纪律：19.7 在“Lifeform Closure Visibility”这一项上属于部分成立。Agenda Truth 卡片已加入 Presence 首页，但当前 `/api/system/summary` 尚未看到对应 agenda truth 的完整后端聚合接线，前端仍存在 fallback/default 展示。**
>
> **因此，19.7 不是终局 polish 完成轮，而是一轮真实有效的产品成熟度与性能推进轮；其最重要的剩余缺口，是把生命闭环可见性从前端展示提升为真正 canonical、可审计、跨 surface 一致的 truth surface。**
