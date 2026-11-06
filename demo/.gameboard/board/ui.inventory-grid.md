---
id: ui.inventory-grid
title: 物品栏网格与拖拽排序
area: UI
stage: built
priority: normal
owner: ai
decision: none
manual: pending
manual_steps: ["在 1280x720 下检查 6x8 网格对齐", "用键盘完成一次拖拽，确认焦点环不丢失", "退出并重新进入游戏，确认物品顺序已保存"]
manual_done: [0]
manual_estimate: 15 分钟
test: untested
match: ["src/ui/inventory.tsx"]
tags: ["UI", "交互"]
links: []
created_at: 2026-10-29T09:30:00.000Z
updated_at: 2026-11-04T16:20:00.000Z
updated_by: workstation-B
---

## 备注

网格与拖拽逻辑已实现，剩余步骤只能由人实际打开游戏确认。第一步已在工作站 B 上勾选完成。

自动测试尚未补齐；补齐后可在 `test_match` 里加入用例名关键字。
