---
id: combat.damage-formula
title: 伤害公式与护甲减伤
area: 战斗
stage: built
priority: high
owner: ai
decision: pending
decision_question: 暴击是否采用乘法叠加？
decision_options: ["乘法叠加","加法叠加","只取最高"]
decision_impact: 影响全部数值平衡与存档兼容
decision_deadline: 2026-11-12
decision_choice: 
decision_at: 
decision_by: 
manual: none
manual_steps: []
manual_done: []
manual_estimate: 
test: failing
test_report: 
test_match: ["combat.damage"]
match: ["src/combat/**","docs/design/combat*.md"]
tags: ["数值","战斗"]
links: ["https://example.com/design/combat"]
created_at: 2026-11-01T10:00:00.000Z
updated_at: 2026-11-05T13:00:45.965Z
updated_by: workstation-A/user
---

## 备注

护甲减伤暂定 `damage * 100 / (100 + armor)`。暴击倍率等待拍板，拍板前不要锁定数值表。

测试报告中 `crit stacks` 一条仍为失败，需要先修好暴击预乘顺序，再请用户确认叠加方案。

