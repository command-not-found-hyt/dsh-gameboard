window.__ModuleLoader__.load({
  id: 'dsh-gameboard',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'gameboard';
    const TOKEN_NAME = '__GAMEBOARD_TOKEN__';
    const POLL_MS = 4000;
    const STAGES = ['idea', 'spec', 'building', 'built', 'tested', 'shipped'];
    const DECISION_GATES = ['none', 'pending', 'decided'];
    const MANUAL_GATES = ['none', 'pending', 'done'];
    const TEST_GATES = ['untested', 'failing', 'passing'];
    const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
    const CHANGE_KINDS = [
      'item-added',
      'item-updated',
      'item-missing',
      'decision-added',
      'decision-cleared',
      'manual-added',
      'manual-cleared',
      'test-failed',
      'test-fixed',
    ];
    const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };
    const TABS = [
      { id: 'overview', key: 'tab.overview' },
      { id: 'pending', key: 'tab.pending' },
      { id: 'board', key: 'tab.board' },
      { id: 'changes', key: 'tab.changes' },
    ];
    const zh = {
      'nav.label': '项目状态板', 'panel.kicker': 'Gameboard',
      'panel.title': '项目状态板', 'header.lastScan': '上次扫描 {time}',
      'header.never': '尚未扫描', 'header.refresh': '刷新',
      'header.refreshing': '刷新中…', 'header.scanNow': '立即扫描',
      'header.scan': '{files} 个文件 · {ms} ms', 'header.errors': '{count} 个错误',
      'header.truncated': '文件过多，已截断', 'header.revision': '版本 r{revision}',
      'header.writeOff': '未连接写入通道', 'header.writeOffHint': '页面没有注入写入令牌，当前只能查看，拍板和勾选按钮已禁用。',
      'tab.overview': '概览', 'tab.pending': '待处理',
      'tab.board': '看板', 'tab.changes': '变更',
      'stats.total': '工作项', 'stats.built': '已完成开发',
      'stats.tested': '已测通过', 'stats.decision': '待你拍板',
      'stats.manual': '待你手动', 'stats.failing': '测试失败',
      'stats.missing': '文件缺失', 'stats.ratio': '{value} / {total}',
      'overview.areas': '按领域', 'overview.areasEmpty': '还没有可统计的领域。',
      'overview.areaPending': '{count} 项待处理', 'overview.areaLine': '{total} 项 · 开发 {built} · 测试 {tested}',
      'overview.health': '质量信号', 'pending.decision': '待你拍板',
      'pending.manual': '待你手动', 'pending.test': '测试失败',
      'pending.empty': '现在没有需要你处理的事情。', 'pending.emptyHint': '待拍板、待手动和测试失败的条目会出现在这里。',
      'pending.deadline': '截止 {date}', 'pending.noDeadline': '无截止时间',
      'pending.impact': '影响：{impact}', 'pending.question': '问题',
      'pending.noQuestion': '这个问题还没有写明。', 'pending.evidence': '证据文件',
      'pending.evidenceNone': '没有匹配到文件', 'pending.evidenceMore': '另有 {count} 个文件',
      'pending.choose': '选择一个方案：', 'pending.noOptions': '这个问题还没有给出选项。',
      'pending.steps': '手动步骤 {done}/{total}', 'pending.estimate': '预估', 'pending.noSteps': '这个手动项没有可勾选的步骤。',
      'pending.markDone': '标记为已完成', 'pending.copy': '复制给 AI 的提示',
      'pending.copied': '提示已复制到剪贴板', 'pending.copyFailed': '复制失败，请手动选择文本。',
      'pending.testLine': '测试报告：{report}', 'pending.testFallback': '最近一次测试没有通过。',
      'pending.updated': '更新于 {time}', 'pending.area': '领域：{area}',
      'pending.priority': '优先级：{priority}', 'priority.low': '低',
      'priority.normal': '普通', 'priority.high': '高',
      'priority.urgent': '紧急', 'stage.idea': '想法',
      'stage.spec': '设计', 'stage.building': '开发中',
      'stage.built': '已开发', 'stage.tested': '已测试',
      'stage.shipped': '已发布', 'stage.unknown': '未知阶段',
      'gate.decision.none': '无需拍板', 'gate.decision.pending': '待拍板',
      'gate.decision.decided': '已拍板', 'gate.manual.none': '无需手动',
      'gate.manual.pending': '待手动', 'gate.manual.done': '手动完成',
      'gate.test.untested': '未测试', 'gate.test.failing': '测试失败',
      'gate.test.passing': '测试通过', 'board.empty': '看板里还没有工作项。',
      'board.emptyHint': 'AI 会在实现过程中创建条目；也可以先用工具写入一条。', 'board.columnEmpty': '暂无',
      'board.missing': '文件缺失', 'changes.empty': '还没有变更记录。',
      'changes.emptyHint': '扫描到新增、阶段推进或门状态变化时会记录在这里。', 'change.item-added': '新增条目',
      'change.item-updated': '条目更新', 'change.item-missing': '文件缺失',
      'change.decision-added': '新增待拍板', 'change.decision-cleared': '拍板已清除',
      'change.manual-added': '新增手动项', 'change.manual-cleared': '手动项已清除',
      'change.test-failed': '测试失败', 'change.test-fixed': '测试修复',
      'change.unknown': '其它变更', 'state.loading': '正在读取状态板…',
      'state.noSnapshot': '还没有拿到状态板数据。', 'state.retry': '重试',
      'state.offline': '无法连接 Host，显示的是上次数据。', 'error.title': '请求失败',
      'error.dismiss': '关闭', 'error.action': '操作失败：{message}',
      'error.http': 'HTTP {status}', 'error.badPayload': '响应格式不正确',
      'error.unknown': '未知错误', 'empty.init.title': '还没有初始化看板',
      'empty.init.desc': '在游戏仓库里创建 .gameboard/board/ 和 config.json，然后开始扫描。', 'empty.init.action': '初始化看板',
      'empty.init.busy': '正在初始化…', 'empty.noItems.title': '看板是空的',
      'empty.noItems.desc': '初始化完成，但还没有任何工作项。', 'item.untitled': '未命名条目',
      'item.files': '{count} 个文件', 'item.area': '领域',
      'action.decideBusy': '正在记录拍板…', 'action.stepBusy': '正在保存步骤…',
      'action.scanBusy': '正在扫描…', 'action.scanDone': '扫描完成',
      'action.initDone': '看板已初始化', 'action.decided': '已记录：{choice}',
      'action.stepSaved': '步骤已更新', 'action.doneSaved': '已标记为完成',
      'copy.promptDecision': '工作项 {id}（{title}）需要拍板。\n问题：{question}\n选项：{options}\n影响：{impact}\n截止：{deadline}\n请帮我分析各选项的利弊，并给出建议。', 'copy.promptManual': '工作项 {id}（{title}）需要我手动完成以下步骤：\n{steps}\n完成后请更新状态板。',
      'copy.promptTest': '工作项 {id}（{title}）测试失败，涉及文件：\n{files}\n请帮我定位失败原因并修复。', 'boundary.title': '面板渲染出错了',
      'boundary.desc': '状态板数据仍在后台刷新，可以重试渲染。', 'boundary.retry': '重新渲染',
    };
    const en = {
      'nav.label': 'Project board', 'panel.kicker': 'Gameboard',
      'panel.title': 'Project board', 'header.lastScan': 'Last scan {time}',
      'header.never': 'Not scanned yet', 'header.refresh': 'Refresh',
      'header.refreshing': 'Refreshing…', 'header.scanNow': 'Scan now',
      'header.scan': '{files} files · {ms} ms', 'header.errors': '{count} errors',
      'header.truncated': 'File list truncated', 'header.revision': 'rev r{revision}',
      'header.writeOff': 'Write channel not connected', 'header.writeOffHint': 'The page did not inject a write token, so the board is read-only and action buttons are disabled.',
      'tab.overview': 'Overview', 'tab.pending': 'Pending',
      'tab.board': 'Board', 'tab.changes': 'Changes',
      'stats.total': 'Items', 'stats.built': 'Built',
      'stats.tested': 'Tested', 'stats.decision': 'Your decisions',
      'stats.manual': 'Your manual steps', 'stats.failing': 'Tests failing',
      'stats.missing': 'Files missing', 'stats.ratio': '{value} / {total}',
      'overview.areas': 'By area', 'overview.areasEmpty': 'No areas to summarize yet.',
      'overview.areaPending': '{count} pending', 'overview.areaLine': '{total} items · built {built} · tested {tested}',
      'overview.health': 'Quality signals', 'pending.decision': 'Waiting on your decision',
      'pending.manual': 'Waiting on manual steps', 'pending.test': 'Failing tests',
      'pending.empty': 'Nothing needs you right now.', 'pending.emptyHint': 'Decisions, manual steps, and failing tests will show up here.',
      'pending.deadline': 'Due {date}', 'pending.noDeadline': 'No deadline',
      'pending.impact': 'Impact: {impact}', 'pending.question': 'Question',
      'pending.noQuestion': 'This question has not been written yet.', 'pending.evidence': 'Evidence files',
      'pending.evidenceNone': 'No files matched', 'pending.evidenceMore': '{count} more files',
      'pending.choose': 'Choose an option:', 'pending.noOptions': 'This question has no options yet.',
      'pending.steps': 'Manual steps {done}/{total}', 'pending.estimate': 'Estimate', 'pending.noSteps': 'This manual item has no steps to check off.',
      'pending.markDone': 'Mark as done', 'pending.copy': 'Copy prompt for the AI',
      'pending.copied': 'Prompt copied to the clipboard', 'pending.copyFailed': 'Copy failed; select the text manually.',
      'pending.testLine': 'Test report: {report}', 'pending.testFallback': 'The latest test run did not pass.',
      'pending.updated': 'Updated {time}', 'pending.area': 'Area: {area}',
      'pending.priority': 'Priority: {priority}', 'priority.low': 'Low',
      'priority.normal': 'Normal', 'priority.high': 'High',
      'priority.urgent': 'Urgent', 'stage.idea': 'Idea',
      'stage.spec': 'Spec', 'stage.building': 'Building',
      'stage.built': 'Built', 'stage.tested': 'Tested',
      'stage.shipped': 'Shipped', 'stage.unknown': 'Unknown stage',
      'gate.decision.none': 'No decision', 'gate.decision.pending': 'Decision pending',
      'gate.decision.decided': 'Decided', 'gate.manual.none': 'No manual step',
      'gate.manual.pending': 'Manual pending', 'gate.manual.done': 'Manual done',
      'gate.test.untested': 'Untested', 'gate.test.failing': 'Tests failing',
      'gate.test.passing': 'Tests passing', 'board.empty': 'No work items on the board yet.',
      'board.emptyHint': 'The AI creates entries as it works; you can also write one with the tool.', 'board.columnEmpty': 'Empty',
      'board.missing': 'Files missing', 'changes.empty': 'No changes recorded yet.',
      'changes.emptyHint': 'New items, stage moves, and gate changes are recorded here.', 'change.item-added': 'Item added',
      'change.item-updated': 'Item updated', 'change.item-missing': 'Item file missing',
      'change.decision-added': 'Decision added', 'change.decision-cleared': 'Decision cleared',
      'change.manual-added': 'Manual step added', 'change.manual-cleared': 'Manual step cleared',
      'change.test-failed': 'Test failed', 'change.test-fixed': 'Test fixed',
      'change.unknown': 'Other change', 'state.loading': 'Loading the board…',
      'state.noSnapshot': 'No board data yet.', 'state.retry': 'Retry',
      'state.offline': 'Cannot reach the host; showing the last data.', 'error.title': 'Request failed',
      'error.dismiss': 'Dismiss', 'error.action': 'Action failed: {message}',
      'error.http': 'HTTP {status}', 'error.badPayload': 'Unexpected response',
      'error.unknown': 'Unknown error', 'empty.init.title': 'The board is not initialized',
      'empty.init.desc': 'Create .gameboard/board/ and config.json in the game repository, then scan.', 'empty.init.action': 'Initialize board',
      'empty.init.busy': 'Initializing…', 'empty.noItems.title': 'The board is empty',
      'empty.noItems.desc': 'Initialization finished, but there are no work items yet.', 'item.untitled': 'Untitled item',
      'item.files': '{count} files', 'item.area': 'Area',
      'action.decideBusy': 'Recording decision…', 'action.stepBusy': 'Saving step…',
      'action.scanBusy': 'Scanning…', 'action.scanDone': 'Scan complete',
      'action.initDone': 'Board initialized', 'action.decided': 'Recorded: {choice}',
      'action.stepSaved': 'Step saved', 'action.doneSaved': 'Marked as done',
      'copy.promptDecision': 'Work item {id} ({title}) needs a decision.\nQuestion: {question}\nOptions: {options}\nImpact: {impact}\nDeadline: {deadline}\nPlease compare the options and recommend one.', 'copy.promptManual': 'Work item {id} ({title}) needs these manual steps from me:\n{steps}\nPlease update the board once they are done.',
      'copy.promptTest': 'Work item {id} ({title}) is failing tests. Files:\n{files}\nPlease find the cause and fix it.', 'boundary.title': 'The panel failed to render',
      'boundary.desc': 'Board data keeps refreshing in the background; you can retry rendering.', 'boundary.retry': 'Render again',
    };
    const css = `
.gb-root{display:flex;flex-direction:column;gap:14px;box-sizing:border-box;width:100%;min-height:100%;padding:20px 24px 28px;overflow:auto;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}.gb-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
.gb-heading{min-width:0}.gb-kicker{font-size:11px;line-height:16px;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
.gb-title{margin:2px 0 0;font-size:18px;line-height:26px;font-weight:600;color:var(--dsw-alias-label-primary)}.gb-meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;margin-top:4px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.gb-meta-item{white-space:nowrap}.gb-meta-item+.gb-meta-item{padding-left:12px;border-left:1px solid var(--dsw-alias-border-l1)}
.gb-meta-warn{color:var(--dsw-alias-state-warn-primary,var(--dsw-alias-label-secondary))}.gb-meta-error{color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-secondary))}
.gb-head-actions{display:flex;align-items:center;gap:8px;flex:none}.gb-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;box-sizing:border-box;padding:6px 12px;font:inherit;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);background:transparent;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,10px);cursor:pointer;white-space:nowrap}
.gb-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.gb-btn:focus-visible{outline:2px solid var(--dsw-alias-label-primary);outline-offset:2px}
.gb-btn:disabled{opacity:.45;cursor:not-allowed}.gb-btn-primary{color:var(--dsw-alias-label-primary-inverted,#fff);background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-label-primary));border-color:transparent}
.gb-btn-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-label-primary));opacity:.94}.gb-btn-sm{padding:3px 9px;font-size:12px;line-height:18px;border-radius:var(--dsw-radius-sm,8px)}
.gb-icon{display:block;flex:none}.gb-writeoff{display:flex;flex-direction:column;gap:2px;padding:9px 12px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2,transparent);border:1px solid var(--dsw-alias-border-l1);border-left:3px solid var(--dsw-alias-state-warn-primary,var(--dsw-alias-border-l2));border-radius:var(--dsw-radius-md,10px)}
.gb-writeoff strong{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}.gb-error{display:flex;align-items:flex-start;gap:10px;padding:9px 12px;background:var(--dsw-alias-bg-layer-2,transparent);border:1px solid var(--dsw-alias-border-l1);border-left:3px solid var(--dsw-alias-state-error-primary,var(--dsw-alias-border-l3));border-radius:var(--dsw-radius-md,10px)}
.gb-error-icon{margin-top:2px;color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-secondary))}.gb-error-body{flex:1;min-width:0}
.gb-error-title{font-size:12px;line-height:18px;font-weight:600;color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary))}.gb-error-msg{margin-top:1px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.gb-notice{padding:7px 12px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2,transparent);border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,10px)}.gb-notice-success{color:var(--dsw-alias-state-success-primary,var(--dsw-alias-label-primary))}
.gb-notice-error{color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary))}.gb-tabs{display:flex;flex-wrap:wrap;gap:2px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.gb-tab{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;font:inherit;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);background:transparent;border:0;border-bottom:2px solid transparent;border-radius:var(--dsw-radius-sm,8px) var(--dsw-radius-sm,8px) 0 0;cursor:pointer;margin-bottom:-1px}.gb-tab:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.gb-tab[aria-selected="true"]{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-label-primary);font-weight:600}.gb-tab:focus-visible{outline:2px solid var(--dsw-alias-label-primary);outline-offset:-2px}
.gb-tab-count{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;font-size:11px;line-height:18px;font-weight:600;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-fill-l2,var(--dsw-alias-bg-skeleton,rgba(127,127,127,.18)));border-radius:999px}.gb-body{display:flex;flex-direction:column;gap:16px;min-width:0}
.gb-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}.gb-stat{display:flex;flex-direction:column;gap:2px;padding:12px 14px;background:var(--dsw-alias-bg-layer-2,transparent);border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,12px)}
.gb-stat-label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}.gb-stat-value{font-size:24px;line-height:32px;font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.gb-stat-foot{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}.gb-section{display:flex;flex-direction:column;gap:10px;min-width:0}
.gb-section-head{display:flex;align-items:baseline;gap:8px}.gb-section-title{margin:0;font-size:13px;line-height:20px;font-weight:600;color:var(--dsw-alias-label-primary)}
.gb-section-count{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}.gb-signals{display:flex;flex-wrap:wrap;gap:8px}
.gb-signal{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2,transparent);border:1px solid var(--dsw-alias-border-l1);border-radius:999px}.gb-signal strong{font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.gb-signal-error{border-color:var(--dsw-alias-state-error-primary,var(--dsw-alias-border-l3))}.gb-signal-warn{border-color:var(--dsw-alias-state-warn-primary,var(--dsw-alias-border-l2))}
.gb-areas{display:flex;flex-direction:column;gap:2px}.gb-area{display:grid;grid-template-columns:minmax(120px,1.1fr) minmax(180px,2.4fr) auto;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
.gb-area:last-child{border-bottom:0}.gb-area-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:var(--dsw-alias-label-primary)}
.gb-area-meta{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap}.gb-bars{display:flex;flex-direction:column;gap:5px;min-width:0}
.gb-bar{display:grid;grid-template-columns:46px minmax(60px,1fr) 56px;align-items:center;gap:8px;min-width:0}.gb-bar-label{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gb-bar-track{display:block;height:6px;overflow:hidden;background:var(--dsw-alias-bg-skeleton,var(--dsw-alias-fill-l2,rgba(127,127,127,.2)));border-radius:999px}.gb-bar-fill{display:block;height:100%;background:var(--dsw-alias-label-tertiary);border-radius:999px;transition:width .18s ease}
.gb-bar-fill-success{background:var(--dsw-alias-state-success-primary,var(--dsw-alias-label-secondary))}.gb-bar-fill-warn{background:var(--dsw-alias-state-warn-primary,var(--dsw-alias-label-secondary))}
.gb-bar-value{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);text-align:right;font-variant-numeric:tabular-nums}.gb-cards{display:flex;flex-direction:column;gap:10px}
.gb-card{display:flex;flex-direction:column;gap:8px;min-width:0;padding:12px 14px;background:var(--dsw-alias-bg-layer-2,transparent);border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,12px)}.gb-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.gb-card-title{margin:0;font-size:14px;line-height:21px;font-weight:600;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}.gb-card-sub{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.gb-badges{display:flex;flex-wrap:wrap;align-items:center;gap:4px}.gb-badge{display:inline-flex;align-items:center;gap:4px;padding:1px 7px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);background:transparent;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;white-space:nowrap}
.gb-badge-warn{color:var(--dsw-alias-state-warn-primary,var(--dsw-alias-label-secondary));border-color:var(--dsw-alias-state-warn-secondary,var(--dsw-alias-border-l3))}.gb-badge-error{color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-secondary));border-color:var(--dsw-alias-state-error-secondary,var(--dsw-alias-border-l3))}
.gb-badge-success{color:var(--dsw-alias-state-success-primary,var(--dsw-alias-label-secondary));border-color:var(--dsw-alias-state-success-secondary,var(--dsw-alias-border-l3))}.gb-field{display:flex;flex-direction:column;gap:2px;min-width:0}
.gb-field-label{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}.gb-field-value{font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;white-space:pre-wrap}
.gb-options{display:flex;flex-wrap:wrap;gap:6px}.gb-option{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;font:inherit;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);background:transparent;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm,8px);cursor:pointer}
.gb-option:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l3)}.gb-option:disabled{opacity:.45;cursor:not-allowed}
.gb-option:focus-visible{outline:2px solid var(--dsw-alias-label-primary);outline-offset:2px}.gb-files{display:flex;flex-direction:column;gap:1px;margin:0;padding:0;list-style:none}
.gb-file{font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}.gb-steps{display:flex;flex-direction:column;gap:2px}
.gb-step{display:flex;align-items:flex-start;gap:8px;padding:3px 0;cursor:pointer}.gb-step[data-disabled="true"]{cursor:not-allowed}
.gb-step input{margin:3px 0 0;accent-color:var(--dsw-alias-label-primary);cursor:inherit}.gb-step-text{min-width:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.gb-step-text-done{color:var(--dsw-alias-label-tertiary);text-decoration:line-through}.gb-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.gb-columns{display:grid;grid-template-columns:repeat(6,minmax(170px,1fr));gap:10px;align-items:start;overflow-x:auto;padding-bottom:4px}.gb-column{display:flex;flex-direction:column;gap:8px;min-width:0;padding:8px;background:var(--dsw-alias-bg-layer-1,transparent);border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,12px)}
.gb-column-head{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:0 2px 4px;border-bottom:1px solid var(--dsw-alias-border-l1)}.gb-column-title{font-size:12px;line-height:18px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.gb-column-count{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}.gb-column-body{display:flex;flex-direction:column;gap:6px;min-width:0}
.gb-column-empty{font-size:11px;line-height:16px;color:var(--dsw-alias-label-quaternary,var(--dsw-alias-label-tertiary));padding:2px}.gb-board-card{display:flex;flex-direction:column;gap:4px;min-width:0;padding:8px 9px;background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1,transparent));border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,10px)}
.gb-board-title{font-size:12px;line-height:17px;font-weight:500;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}.gb-board-area{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gb-changes{display:flex;flex-direction:column;gap:0}.gb-change{display:grid;grid-template-columns:96px 108px minmax(0,1fr);align-items:baseline;gap:10px;padding:7px 0;border-bottom:1px solid var(--dsw-alias-border-l1);font-size:12px;line-height:18px}
.gb-change:last-child{border-bottom:0}.gb-change-time{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap}
.gb-change-title{min-width:0;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gb-change-id{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gb-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:44px 20px;text-align:center;background:var(--dsw-alias-bg-layer-2,transparent);border:1px dashed var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg,12px)}.gb-empty-icon{color:var(--dsw-alias-label-tertiary);opacity:.8}
.gb-empty-title{margin:0;font-size:14px;line-height:21px;font-weight:600;color:var(--dsw-alias-label-primary)}.gb-empty-desc{max-width:440px;margin:0;font-size:12px;line-height:19px;color:var(--dsw-alias-label-tertiary)}
.gb-loading{display:flex;align-items:center;gap:10px;padding:20px 4px;font-size:13px;color:var(--dsw-alias-label-secondary)}.gb-spinner{width:14px;height:14px;border:2px solid var(--dsw-alias-border-l3);border-top-color:var(--dsw-alias-label-secondary);border-radius:50%;animation:gb-spin .8s linear infinite}
@keyframes gb-spin{to{transform:rotate(360deg)}}
.gb-fallback{display:flex;flex-direction:column;gap:8px;align-items:flex-start;padding:16px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,12px);background:var(--dsw-alias-bg-layer-2,transparent)}.gb-fallback-title{margin:0;font-size:14px;line-height:21px;font-weight:600;color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary))}
.gb-fallback-desc{margin:0;font-size:12px;line-height:19px;color:var(--dsw-alias-label-secondary)}.gb-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
@media (max-width:820px){.gb-root{padding:14px 14px 22px}.gb-area{grid-template-columns:minmax(90px,1fr) minmax(140px,2fr)}.gb-area .gb-area-meta{grid-column:1 / -1}.gb-change{grid-template-columns:80px minmax(0,1fr)}.gb-change .gb-change-kind{display:none}}
@media (prefers-reduced-motion:reduce){.gb-spinner{animation-duration:2.4s}.gb-bar-fill{transition:none}}
`;
    function isObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
    function asObject(value) { return isObject(value) ? value : {}; }
    function asArray(value) { return Array.isArray(value) ? value : []; }
    function asString(value, fallback) {
      if (typeof value === 'string') return value;
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
      return typeof fallback === 'string' ? fallback : '';
    }
    function asNumber(value, fallback) {
      const number = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(number) ? number : typeof fallback === 'number' ? fallback : 0;
    }
    function asBool(value) { return value === true; }
    function pickEnum(value, allowed, fallback) {
      const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
      return allowed.indexOf(text) >= 0 ? text : fallback;
    }
    function asStringList(value) {
      return asArray(value).map((entry) => asString(entry).trim()).filter((entry) => entry.length > 0);
    }
    function clampNumber(value, min, max) { return Math.min(max, Math.max(min, value)); }
    function toPercent(value, total) {
      const denominator = asNumber(total, 0);
      if (denominator <= 0) return 0;
      return clampNumber(Math.round((asNumber(value, 0) / denominator) * 100), 0, 100);
    }
    function formatTime(value) {
      const raw = asString(value);
      if (!raw) return '';
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) return raw;
      try {
        return new Intl.DateTimeFormat(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
      } catch (error) { return raw; }
    }
    function formatDate(value) {
      const raw = asString(value);
      if (!raw) return '';
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) return raw;
      try {
        return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
      } catch (error) { return raw; }
    }
    function createStore(initial) {
      let value = initial;
      const listeners = new Set();
      return {
        get: () => value,
        set(next) {
          if (Object.is(next, value)) return;
          value = next;
          for (const listener of [...listeners]) {
            try { listener(); } catch (error) { console.warn('[gameboard] store listener failed:', error); }
          }
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };
    }
    const useSyncExternalStore = typeof React.useSyncExternalStore === 'function' ? React.useSyncExternalStore : null;
    function useStore(store) {
      if (useSyncExternalStore) return useSyncExternalStore(store.subscribe, store.get, store.get);
      const [value, setValue] = React.useState(store.get());
      React.useEffect(() => store.subscribe(() => setValue(store.get())), [store]);
      return value;
    }
    function translator(t) {
      return (key, vars) => {
        try {
          if (typeof t !== 'function') return key;
          const text = t(key, vars);
          return typeof text === 'string' && text.length > 0 ? text : key;
        } catch (error) {
          console.warn('[gameboard] translation failed:', error);
          return key;
        }
      };
    }
    function normalizeGates(raw) {
      const gates = asObject(raw);
      return {
        decision: pickEnum(gates.decision, DECISION_GATES, 'none'),
        manual: pickEnum(gates.manual, MANUAL_GATES, 'none'),
        test: pickEnum(gates.test, TEST_GATES, 'untested'),
      };
    }
    function normalizeDecision(raw) {
      const decision = asObject(raw);
      return {
        question: asString(decision.question), options: asStringList(decision.options),
        impact: asString(decision.impact), deadline: asString(decision.deadline),
        choice: asString(decision.choice), at: asString(decision.at), by: asString(decision.by),
      };
    }
    function normalizeManual(raw) {
      const manual = asObject(raw);
      const steps = asStringList(manual.steps);
      const done = [];
      for (const entry of asArray(manual.done)) {
        const index = asNumber(entry, -1);
        if (Number.isInteger(index) && index >= 0 && index < steps.length && done.indexOf(index) < 0) done.push(index);
      }
      done.sort((left, right) => left - right);
      return { steps, done, estimate: asString(manual.estimate) };
    }
    function normalizeDerived(raw) {
      const derived = asObject(raw);
      const fileList = asStringList(derived.fileList).slice(0, 20);
      const testStatusRaw = typeof derived.testStatus === 'string' ? derived.testStatus : '';
      return {
        filesMatched: Math.max(0, asNumber(derived.filesMatched, fileList.length)), fileList,
        lastChangedAt: typeof derived.lastChangedAt === 'string' ? derived.lastChangedAt : null,
        testStatus: pickEnum(testStatusRaw, TEST_GATES, null),
        testTotal: Math.max(0, asNumber(derived.testTotal, 0)), testFailed: Math.max(0, asNumber(derived.testFailed, 0)),
        missing: asBool(derived.missing), truncated: asBool(derived.truncated),
      };
    }
    function normalizeItem(raw, index) {
      const item = asObject(raw);
      const id = asString(item.id).trim();
      const title = asString(item.title).trim();
      return {
        id: id || `item-${index + 1}`, title, area: asString(item.area).trim(),
        stage: pickEnum(item.stage, STAGES, 'idea'), priority: pickEnum(item.priority, PRIORITIES, 'normal'),
        owner: item.owner === 'human' ? 'human' : 'ai',
        tags: asStringList(item.tags), links: asStringList(item.links),
        match: asStringList(item.match), testMatch: asStringList(item.testMatch),
        gates: normalizeGates(item.gates), decision: normalizeDecision(item.decision),
        manual: normalizeManual(item.manual), test: { report: asString(asObject(item.test).report) },
        createdAt: asString(item.createdAt), updatedAt: asString(item.updatedAt),
        updatedBy: asString(item.updatedBy), path: asString(item.path), notes: asString(item.notes),
        errors: asStringList(item.errors), derived: normalizeDerived(item.derived),
      };
    }
    function computeCounts(items) {
      const counts = { total: items.length, built: 0, tested: 0, decisionPending: 0, manualPending: 0, testFailing: 0, missing: 0 };
      for (const item of items) {
        if (item.stage === 'built' || item.stage === 'tested' || item.stage === 'shipped') counts.built += 1;
        if (item.gates.test === 'passing') counts.tested += 1;
        if (item.gates.decision === 'pending') counts.decisionPending += 1;
        if (item.gates.manual === 'pending') counts.manualPending += 1;
        if (item.gates.test === 'failing') counts.testFailing += 1;
        if (item.derived.missing) counts.missing += 1;
      }
      return counts;
    }
    function computeAreas(items) {
      const byName = new Map();
      for (const item of items) {
        const name = item.area || '';
        if (!name) continue;
        let area = byName.get(name);
        if (!area) {
          area = { name, total: 0, built: 0, tested: 0, pending: 0 };
          byName.set(name, area);
        }
        area.total += 1;
        if (item.stage === 'built' || item.stage === 'tested' || item.stage === 'shipped') area.built += 1;
        if (item.gates.test === 'passing') area.tested += 1;
        if (item.gates.decision === 'pending' || item.gates.manual === 'pending') area.pending += 1;
      }
      return [...byName.values()].sort((left, right) => right.total - left.total);
    }
    function normalizeCounts(raw, items) {
      const counts = asObject(raw);
      const fallback = computeCounts(items);
      const result = {};
      for (const key of Object.keys(fallback)) result[key] = Math.max(0, asNumber(counts[key], fallback[key]));
      return result;
    }
    function normalizeArea(raw, index) {
      const area = asObject(raw);
      return {
        name: asString(area.name).trim() || `area-${index + 1}`,
        total: Math.max(0, asNumber(area.total, 0)), built: Math.max(0, asNumber(area.built, 0)),
        tested: Math.max(0, asNumber(area.tested, 0)), pending: Math.max(0, asNumber(area.pending, 0)),
      };
    }
    function normalizeChange(raw, index) {
      const change = asObject(raw);
      const kind = asString(change.kind).trim();
      return {
        key: `${asString(change.id)}-${kind}-${index}`, at: asString(change.at),
        kind: CHANGE_KINDS.indexOf(kind) >= 0 ? kind : 'unknown',
        id: asString(change.id), title: asString(change.title),
      };
    }
    function normalizeScan(raw, items) {
      const scan = asObject(raw);
      const errors = asArray(scan.errors)
        .map((entry) => {
          const error = asObject(entry);
          return { path: asString(error.path), message: asString(error.message) };
        })
        .filter((entry) => entry.path || entry.message);
      return {
        durationMs: Math.max(0, asNumber(scan.durationMs, 0)), files: Math.max(0, asNumber(scan.files, items.length)),
        truncated: asBool(scan.truncated), errors,
      };
    }
    function normalizeSnapshot(raw) {
      if (!isObject(raw) || raw.ok === false) return null;
      const items = asArray(raw.items)
        .map((item, index) => normalizeItem(item, index))
        .filter((item) => Boolean(item.id));
      const board = asObject(raw.board);
      const initialized = typeof board.initialized === 'boolean' ? board.initialized : items.length > 0 || Boolean(asString(board.dir));
      const areasRaw = asArray(raw.areas);
      return {
        generatedAt: asString(raw.generatedAt), revision: Math.max(0, asNumber(raw.revision, 0)),
        board: { dir: asString(board.dir), initialized }, scan: normalizeScan(raw.scan, items),
        counts: normalizeCounts(raw.counts, items),
        areas: areasRaw.length > 0 ? areasRaw.map(normalizeArea) : computeAreas(items),
        items, changes: asArray(raw.changes).map(normalizeChange).slice(0, 50),
      };
    }
    function sortPendingItems(items) {
      return items.slice().sort((left, right) => {
        const leftRank = PRIORITY_RANK[left.priority] === undefined ? 9 : PRIORITY_RANK[left.priority];
        const rightRank = PRIORITY_RANK[right.priority] === undefined ? 9 : PRIORITY_RANK[right.priority];
        if (leftRank !== rightRank) return leftRank - rightRank;
        return (Date.parse(right.updatedAt) || 0) - (Date.parse(left.updatedAt) || 0);
      });
    }
    function readToken() {
      try {
        const token = window[TOKEN_NAME];
        return typeof token === 'string' ? token.trim() : '';
      } catch (error) { return ''; }
    }
    function Icon({ size, children, active }) {
      return h(
        'svg',
        {
          className: 'gb-icon', width: size, height: size, viewBox: '0 0 16 16',
          fill: 'none', stroke: 'currentColor', strokeWidth: active ? 1.7 : 1.5,
          strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false,
        },
        children,
      );
    }
    function GameboardIcon({ size = 16, active = false }) {
      const edge = Math.max(10, asNumber(size, 16));
      return h(
        Icon,
        { size: edge, active },
        h('rect', { key: 'a', x: 1.75, y: 2.5, width: 3.2, height: 11, rx: 1.1 }),
        h('rect', { key: 'b', x: 6.4, y: 2.5, width: 3.2, height: 7, rx: 1.1 }),
        h('rect', { key: 'c', x: 11.05, y: 2.5, width: 3.2, height: 9.2, rx: 1.1 }),
      );
    }
    function RefreshIcon({ size = 14 }) {
      return h(Icon, { size }, h('path', { key: 'arc', d: 'M12.9 7.2a5 5 0 1 1-1.5-3.1' }), h('path', { key: 'head', d: 'M12.9 2.4v2.9h-2.9' }));
    }
    function CopyIcon({ size = 13 }) {
      return h(
        Icon,
        { size },
        h('rect', { key: 'back', x: 5.6, y: 5.6, width: 7.6, height: 7.6, rx: 1.4 }),
        h('path', { key: 'front', d: 'M10.4 5.6V3.9c0-.8-.6-1.4-1.4-1.4H3.9c-.8 0-1.4.6-1.4 1.4v5.1c0 .8.6 1.4 1.4 1.4h1.7' }),
      );
    }
    function CheckIcon({ size = 12 }) {
      return h(Icon, { size }, h('path', { key: 'tick', d: 'M2.8 8.4 6 11.4l7.2-7' }));
    }
    function AlertIcon({ size = 14 }) {
      return h(
        Icon,
        { size },
        h('path', { key: 'tri', d: 'M8 2.2 14.2 13H1.8L8 2.2Z' }),
        h('path', { key: 'bar', d: 'M8 6.2v3.1' }),
        h('path', { key: 'dot', d: 'M8 11.4h.01' }),
      );
    }
    function badgeTone(gate, value) {
      if (gate === 'decision') return value === 'pending' ? 'warn' : value === 'decided' ? 'success' : 'muted';
      if (gate === 'manual') return value === 'pending' ? 'warn' : value === 'done' ? 'success' : 'muted';
      return value === 'failing' ? 'error' : value === 'passing' ? 'success' : 'muted';
    }
    function Badge({ tone, children }) {
      const suffix = tone && tone !== 'muted' ? ` gb-badge-${tone}` : '';
      return h('span', { className: `gb-badge${suffix}` }, children);
    }
    function GateBadges({ tr, item, showNeutral }) {
      const entries = [
        ['decision', item.gates.decision, 'none'],
        ['manual', item.gates.manual, 'none'],
        ['test', item.gates.test, 'untested'],
      ];
      const badges = entries
        .filter((entry) => showNeutral || entry[1] !== entry[2])
        .map((entry) => h(Badge, { key: entry[0], tone: badgeTone(entry[0], entry[1]) }, tr(`gate.${entry[0]}.${entry[1]}`)));
      return badges.length === 0 ? null : h('div', { className: 'gb-badges' }, badges);
    }
    function StatCard({ label, value, foot }) {
      return h(
        'div',
        { className: 'gb-stat' },
        h('div', { className: 'gb-stat-label' }, label),
        h('div', { className: 'gb-stat-value' }, value),
        foot ? h('div', { className: 'gb-stat-foot' }, foot) : null,
      );
    }
    function ProgressBar({ label, value, total, tone }) {
      const pct = toPercent(value, total);
      const className = tone === 'success' ? 'gb-bar-fill gb-bar-fill-success' : tone === 'warn' ? 'gb-bar-fill gb-bar-fill-warn' : 'gb-bar-fill';
      const trackProps = {
        className: 'gb-bar-track', role: 'progressbar', 'aria-label': label,
        'aria-valuemin': 0, 'aria-valuemax': asNumber(total, 0),
        'aria-valuenow': clampNumber(asNumber(value, 0), 0, Math.max(asNumber(total, 0), 0)),
        'aria-valuetext': `${value} / ${total}`,
      };
      return h(
        'div',
        { className: 'gb-bar' },
        h('span', { className: 'gb-bar-label' }, label),
        h('span', trackProps, h('span', { className, style: { width: `${pct}%` } })),
        h('span', { className: 'gb-bar-value' }, `${value}/${total}`),
      );
    }
    function EmptyState({ icon, title, desc, action }) {
      return h(
        'div',
        { className: 'gb-empty' },
        icon ? h('div', { className: 'gb-empty-icon' }, icon) : null,
        h('h3', { className: 'gb-empty-title' }, title),
        desc ? h('p', { className: 'gb-empty-desc' }, desc) : null,
        action || null,
      );
    }
    function ErrorBanner({ tr, message, onDismiss }) {
      return h(
        'div',
        { className: 'gb-error', role: 'alert' },
        h('span', { className: 'gb-error-icon' }, h(AlertIcon, { size: 14 })),
        h('div', { className: 'gb-error-body' },
          h('div', { className: 'gb-error-title' }, tr('error.title')),
          h('div', { className: 'gb-error-msg' }, message)),
        h('button', { type: 'button', className: 'gb-btn gb-btn-sm', onClick: onDismiss }, tr('error.dismiss')),
      );
    }
    function Notice({ tone, children }) {
      const suffix = tone === 'error' ? ' gb-notice-error' : tone === 'success' ? ' gb-notice-success' : '';
      return h('div', { className: `gb-notice${suffix}`, role: 'status' }, children);
    }
    function WriteOffNotice({ tr }) {
      return h(
        'div',
        { className: 'gb-writeoff', role: 'note' },
        h('strong', null, tr('header.writeOff')),
        h('span', null, tr('header.writeOffHint')),
      );
    }
    function Tabs({ tr, active, pendingCount, onSelect }) {
      return h(
        'div',
        { className: 'gb-tabs', role: 'tablist', 'aria-label': tr('panel.title') },
        TABS.map((tab) =>
          h(
            'button',
            {
              key: tab.id, id: `gb-tab-${tab.id}`, type: 'button', role: 'tab', className: 'gb-tab',
              'aria-selected': active === tab.id ? 'true' : 'false',
              'aria-controls': `gb-panel-${tab.id}`, tabIndex: active === tab.id ? 0 : -1,
              onClick: () => onSelect(tab.id),
            },
            tr(tab.key),
            tab.id === 'pending' && pendingCount > 0 ? h('span', { className: 'gb-tab-count' }, String(pendingCount)) : null,
          ),
        ),
      );
    }
    function Loading({ tr }) {
      return h('div', { className: 'gb-loading', role: 'status' }, h('span', { className: 'gb-spinner' }), tr('state.loading'));
    }
    function Evidence({ tr, item, limit }) {
      const max = typeof limit === 'number' ? limit : 6;
      const files = item.derived.fileList.slice(0, max);
      const rest = Math.max(0, item.derived.fileList.length - files.length);
      return h(
        'div',
        { className: 'gb-field' },
        h('span', { className: 'gb-field-label' }, tr('pending.evidence')),
        files.length > 0
          ? h('ul', { className: 'gb-files' }, files.map((file) => h('li', { className: 'gb-file', key: file }, file)))
          : h('span', { className: 'gb-field-value' }, tr('pending.evidenceNone')),
        rest > 0 ? h('span', { className: 'gb-field-label' }, tr('pending.evidenceMore', { count: rest })) : null,
        item.derived.missing ? h('div', { className: 'gb-badges' }, h(Badge, { tone: 'error' }, tr('board.missing'))) : null,
      );
    }
    function ManualSteps({ tr, item, busy, writable, onStep, onManualDone }) {
      if (item.gates.manual !== 'pending') return null;
      const total = item.manual.steps.length;
      const done = item.manual.done.length;
      return h(
        'div',
        { className: 'gb-field' },
        h('span', { className: 'gb-field-label' }, tr('pending.steps', { done, total })),
        total === 0
          ? h(
              'div',
              { className: 'gb-actions' },
              h('span', { className: 'gb-field-value' }, tr('pending.noSteps')),
              h(
                'button',
                {
                  type: 'button',
                  className: 'gb-btn gb-btn-sm',
                  disabled: !writable || busy,
                  onClick: () => onManualDone(item),
                },
                tr('pending.markDone'),
              ),
            )
          : h(
              'div',
              { className: 'gb-steps' },
              item.manual.steps.map((step, index) => {
                const checked = item.manual.done.indexOf(index) >= 0;
                return h(
                  'label',
                  { className: 'gb-step', key: `${item.id}-step-${index}`, 'data-disabled': !writable || busy ? 'true' : 'false' },
                  h('input', {
                    type: 'checkbox',
                    checked,
                    disabled: !writable || busy,
                    onChange: () => onStep(item, index, !checked),
                  }),
                  h('span', { className: checked ? 'gb-step-text gb-step-text-done' : 'gb-step-text' }, step),
                );
              }),
            ),
      );
    }
    function buildPrompt(tr, kind, item) {
      const title = item.title || tr('item.untitled');
      if (kind === 'decision') {
        return tr('copy.promptDecision', {
          id: item.id, title,
          question: item.decision.question || tr('pending.noQuestion'),
          options: item.decision.options.length > 0 ? item.decision.options.join(' / ') : tr('pending.noOptions'),
          impact: item.decision.impact || '—',
          deadline: item.decision.deadline ? formatDate(item.decision.deadline) : tr('pending.noDeadline'),
        });
      }
      if (kind === 'manual') {
        const steps = item.manual.steps.length > 0
          ? item.manual.steps.map((step, index) => `${item.manual.done.indexOf(index) >= 0 ? '[x]' : '[ ]'} ${step}`).join('\n')
          : tr('pending.noSteps');
        return tr('copy.promptManual', { id: item.id, title, steps });
      }
      return tr('copy.promptTest', {
        id: item.id, title,
        files: item.derived.fileList.length > 0 ? item.derived.fileList.join('\n') : tr('pending.evidenceNone'),
      });
    }
    function ItemFacts({ tr, item }) {
      return h(
        'div',
        { className: 'gb-card-sub' },
        item.area ? h('span', null, tr('pending.area', { area: item.area })) : null,
        h('span', null, tr('pending.priority', { priority: tr(`priority.${item.priority}`) })),
        item.updatedAt ? h('span', null, tr('pending.updated', { time: formatTime(item.updatedAt) })) : null,
      );
    }
    function CopyButton({ tr, onClick }) {
      return h('button', { type: 'button', className: 'gb-btn gb-btn-sm', onClick }, h(CopyIcon, { size: 12 }), tr('pending.copy'));
    }
    function DecisionCard({ tr, item, busy, writable, onDecide, onStep, onManualDone, onCopy }) {
      const options = item.decision.options;
      const deadline = item.decision.deadline ? tr('pending.deadline', { date: formatDate(item.decision.deadline) }) : tr('pending.noDeadline');
      return h(
        'article',
        { className: 'gb-card' },
        h('div', { className: 'gb-card-head' },
          h('h3', { className: 'gb-card-title' }, item.title || tr('item.untitled')),
          h(GateBadges, { tr, item, showNeutral: false })),
        h(ItemFacts, { tr, item }),
        h('div', { className: 'gb-field' },
          h('span', { className: 'gb-field-label' }, tr('pending.question')),
          h('span', { className: 'gb-field-value' }, item.decision.question || tr('pending.noQuestion'))),
        item.decision.impact ? h('div', { className: 'gb-field' },
          h('span', { className: 'gb-field-label' }, tr('pending.impact', { impact: item.decision.impact }))) : null,
        h('div', { className: 'gb-badges' }, h(Badge, { tone: item.decision.deadline ? 'warn' : 'muted' }, deadline)),
        h('div', { className: 'gb-field' },
          h('span', { className: 'gb-field-label' }, tr('pending.choose')),
          options.length > 0
            ? h('div', { className: 'gb-options' }, options.map((option) => h('button', {
                key: option, type: 'button', className: 'gb-option', disabled: !writable || busy,
                onClick: () => onDecide(item, option),
              }, h(CheckIcon, { size: 11 }), option)))
            : h('span', { className: 'gb-field-value' }, tr('pending.noOptions'))),
        h(ManualSteps, { tr, item, busy, writable, onStep, onManualDone }),
        item.derived.fileList.length > 0 || item.derived.missing ? h(Evidence, { tr, item, limit: 4 }) : null,
        h('div', { className: 'gb-actions' }, h(CopyButton, { tr, onClick: () => onCopy(item, 'decision') })),
      );
    }
    function ManualCard({ tr, item, busy, writable, onStep, onManualDone, onCopy }) {
      return h(
        'article',
        { className: 'gb-card' },
        h('div', { className: 'gb-card-head' },
          h('h3', { className: 'gb-card-title' }, item.title || tr('item.untitled')),
          h(GateBadges, { tr, item, showNeutral: false })),
        h(ItemFacts, { tr, item }),
        h(ManualSteps, { tr, item, busy, writable, onStep, onManualDone }),
        item.manual.estimate ? h('div', { className: 'gb-field' },
          h('span', { className: 'gb-field-label' }, tr('pending.estimate')),
          h('span', { className: 'gb-field-value' }, item.manual.estimate)) : null,
        item.derived.fileList.length > 0 || item.derived.missing ? h(Evidence, { tr, item, limit: 4 }) : null,
        h('div', { className: 'gb-actions' }, h(CopyButton, { tr, onClick: () => onCopy(item, 'manual') })),
      );
    }
    function TestCard({ tr, item, onCopy }) {
      const report = item.test.report;
      return h(
        'article',
        { className: 'gb-card' },
        h('div', { className: 'gb-card-head' },
          h('h3', { className: 'gb-card-title' }, item.title || tr('item.untitled')),
          h(GateBadges, { tr, item, showNeutral: false })),
        h(ItemFacts, { tr, item }),
        h('div', { className: 'gb-field' },
          h('span', { className: 'gb-field-label' }, report ? tr('pending.testLine', { report }) : tr('pending.testFallback')),
          item.derived.testTotal > 0
            ? h('span', { className: 'gb-field-value' }, tr('stats.ratio', { value: item.derived.testTotal - item.derived.testFailed, total: item.derived.testTotal }))
            : null),
        h(Evidence, { tr, item, limit: 8 }),
        h('div', { className: 'gb-actions' }, h(CopyButton, { tr, onClick: () => onCopy(item, 'test') })),
      );
    }
    function BoardCard({ tr, item }) {
      return h(
        'div',
        { className: 'gb-board-card' },
        h('div', { className: 'gb-board-title' }, item.title || tr('item.untitled')),
        item.area ? h('div', { className: 'gb-board-area' }, item.area) : null,
        h(GateBadges, { tr, item, showNeutral: false }),
        item.derived.missing ? h('div', { className: 'gb-badges' }, h(Badge, { tone: 'error' }, tr('board.missing'))) : null,
      );
    }
    function OverviewTab({ tr, snapshot }) {
      const counts = snapshot.counts;
      const total = counts.total;
      const signal = (tone, label, value) =>
        h('span', { className: tone ? `gb-signal gb-signal-${tone}` : 'gb-signal' }, label, h('strong', null, String(value)));
      return h(
        'div',
        { className: 'gb-body' },
        h('div', { className: 'gb-stats' },
          h(StatCard, { label: tr('stats.built'), value: counts.built, foot: tr('stats.ratio', { value: counts.built, total }) }),
          h(StatCard, { label: tr('stats.tested'), value: counts.tested, foot: tr('stats.ratio', { value: counts.tested, total }) }),
          h(StatCard, { label: tr('stats.decision'), value: counts.decisionPending }),
          h(StatCard, { label: tr('stats.manual'), value: counts.manualPending })),
        h('div', { className: 'gb-section' },
          h('div', { className: 'gb-section-head' }, h('h2', { className: 'gb-section-title' }, tr('overview.health'))),
          h('div', { className: 'gb-signals' },
            signal(counts.testFailing > 0 ? 'error' : '', tr('stats.failing'), counts.testFailing),
            signal(counts.missing > 0 ? 'warn' : '', tr('stats.missing'), counts.missing),
            signal('', tr('stats.total'), total))),
        h('div', { className: 'gb-section' },
          h('div', { className: 'gb-section-head' },
            h('h2', { className: 'gb-section-title' }, tr('overview.areas')),
            h('span', { className: 'gb-section-count' }, String(snapshot.areas.length))),
          snapshot.areas.length === 0
            ? h('p', { className: 'gb-empty-desc' }, tr('overview.areasEmpty'))
            : h('div', { className: 'gb-areas' }, snapshot.areas.map((area) =>
                h('div', { className: 'gb-area', key: area.name },
                  h('span', { className: 'gb-area-name', title: area.name }, area.name),
                  h('div', { className: 'gb-bars' },
                    h(ProgressBar, { label: tr('stage.built'), value: area.built, total: area.total, tone: 'success' }),
                    h(ProgressBar, { label: tr('stage.tested'), value: area.tested, total: area.total, tone: 'warn' })),
                  h('span', { className: 'gb-area-meta' },
                    area.pending > 0
                      ? tr('overview.areaPending', { count: area.pending })
                      : tr('overview.areaLine', { total: area.total, built: area.built, tested: area.tested })))))),
      );
    }
    function Section({ tr, title, count, children }) {
      return h(
        'section',
        { className: 'gb-section' },
        h('div', { className: 'gb-section-head' },
          h('h2', { className: 'gb-section-title' }, title),
          count > 0 ? h('span', { className: 'gb-section-count' }, String(count)) : null),
        h('div', { className: 'gb-cards' }, children),
      );
    }
    function PendingTab({ tr, snapshot, busy, writable, actions }) {
      const items = snapshot.items;
      const decisions = sortPendingItems(items.filter((item) => item.gates.decision === 'pending'));
      const manuals = sortPendingItems(items.filter((item) => item.gates.decision !== 'pending' && item.gates.manual === 'pending'));
      const failing = sortPendingItems(items.filter(
        (item) => item.gates.decision !== 'pending' && item.gates.manual !== 'pending' && item.gates.test === 'failing',
      ));
      if (decisions.length === 0 && manuals.length === 0 && failing.length === 0) {
        return h(EmptyState, { tr, icon: h(CheckIcon, { size: 24 }), title: tr('pending.empty'), desc: tr('pending.emptyHint') });
      }
      return h(
        'div',
        { className: 'gb-body' },
        decisions.length > 0
          ? h(Section, { tr, title: tr('pending.decision'), count: decisions.length },
              decisions.map((item) => h(DecisionCard, {
                key: item.id, tr, item, writable, onDecide: actions.decide, onStep: actions.step,
                onManualDone: actions.manualDone, onCopy: actions.copy,
                busy: busy === `decide:${item.id}` || busy === `step:${item.id}`,
              })))
          : null,
        manuals.length > 0
          ? h(Section, { tr, title: tr('pending.manual'), count: manuals.length },
              manuals.map((item) => h(ManualCard, {
                key: item.id, tr, item, writable, onStep: actions.step, onManualDone: actions.manualDone, onCopy: actions.copy,
                busy: busy === `step:${item.id}` || busy === `manual:${item.id}`,
              })))
          : null,
        failing.length > 0
          ? h(Section, { tr, title: tr('pending.test'), count: failing.length },
              failing.map((item) => h(TestCard, { key: item.id, tr, item, onCopy: actions.copy })))
          : null,
      );
    }
    function BoardTab({ tr, snapshot }) {
      if (snapshot.items.length === 0) {
        return h(EmptyState, {
          tr,
          icon: h(GameboardIcon, { size: 24 }),
          title: tr('board.empty'),
          desc: tr('board.emptyHint'),
        });
      }
      return h(
        'div',
        { className: 'gb-columns' },
        STAGES.map((stage) => {
          const columnItems = snapshot.items.filter((item) => item.stage === stage);
          return h(
            'div',
            { className: 'gb-column', key: stage },
            h(
              'div',
              { className: 'gb-column-head' },
              h('span', { className: 'gb-column-title' }, tr(`stage.${stage}`)),
              h('span', { className: 'gb-column-count' }, String(columnItems.length)),
            ),
            h(
              'div',
              { className: 'gb-column-body' },
              columnItems.length === 0
                ? h('div', { className: 'gb-column-empty' }, tr('board.columnEmpty'))
                : columnItems.map((item) => h(BoardCard, { key: item.id, tr, item })),
            ),
          );
        }),
      );
    }
    function ChangesTab({ tr, snapshot }) {
      if (snapshot.changes.length === 0) {
        return h(EmptyState, {
          tr,
          icon: h(RefreshIcon, { size: 24 }),
          title: tr('changes.empty'),
          desc: tr('changes.emptyHint'),
        });
      }
      return h(
        'div',
        { className: 'gb-changes', role: 'list' },
        snapshot.changes.map((change) =>
          h(
            'div',
            { className: 'gb-change', role: 'listitem', key: change.key },
            h('span', { className: 'gb-change-time', title: change.at }, formatTime(change.at)),
            h('span', { className: 'gb-change-kind' }, h(Badge, { tone: change.kind === 'test-failed' || change.kind === 'item-missing' ? 'error' : 'muted' }, tr(`change.${change.kind}`))),
            h(
              'span',
              { className: 'gb-change-title', title: change.title || change.id },
              change.title || change.id || '—',
              change.id ? h('span', { className: 'gb-change-id' }, ` · ${change.id}`) : null,
            ),
          ),
        ),
      );
    }
    class PanelBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
        this.retry = this.retry.bind(this);
      }
      static getDerivedStateFromError(error) {
        return { error };
      }
      componentDidCatch(error, info) {
        console.error('[gameboard] panel render failed:', error, info);
      }
      retry() {
        this.setState({ error: null });
      }
      render() {
        const tr = this.props.tr;
        if (this.state.error) {
          return h(
            'div',
            { className: 'gb-root' },
            h(
              'div',
              { className: 'gb-fallback', role: 'alert' },
              h('h3', { className: 'gb-fallback-title' }, tr('boundary.title')),
              h('p', { className: 'gb-fallback-desc' }, tr('boundary.desc')),
              h('p', { className: 'gb-fallback-desc gb-mono' }, errorText(tr, errorInfo(this.state.error))),
              h('button', { type: 'button', className: 'gb-btn gb-btn-sm', onClick: this.retry }, tr('boundary.retry')),
            ),
          );
        }
        return this.props.children;
      }
    }
    function readPayload(response) {
      return response
        .json()
        .then((payload) => payload)
        .catch(() => null);
    }
    function httpFailure(response, payload) {
      const hostMessage = payload && typeof payload.error === 'string' ? payload.error.trim() : '';
      const failure = new Error(hostMessage);
      failure.status = response && typeof response.status === 'number' ? response.status : 0;
      failure.hostMessage = hostMessage;
      return failure;
    }
    function errorInfo(error) {
      if (!isObject(error)) return { key: 'error.unknown' };
      if (typeof error.hostMessage === 'string' && error.hostMessage) return { message: error.hostMessage };
      if (typeof error.key === 'string' && error.key) return { key: error.key, status: error.status };
      if (typeof error.status === 'number' && error.status > 0) return { key: 'error.http', status: error.status };
      if (typeof error.message === 'string' && error.message) return { message: error.message };
      return { key: 'error.unknown' };
    }
    function errorText(tr, error) {
      if (!isObject(error)) return tr('error.unknown');
      if (typeof error.message === 'string' && error.message) return error.message;
      if (error.key === 'error.http') return tr('error.http', { status: error.status || 0 });
      if (typeof error.key === 'string' && error.key) return tr(error.key);
      return tr('error.unknown');
    }
    async function copyText(text) {
      const value = typeof text === 'string' ? text : '';
      if (!value) throw new Error('empty text');
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(value);
        return;
      }
      const area = document.createElement('textarea');
      area.value = value;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.top = '0';
      area.style.left = '-9999px';
      area.style.opacity = '0';
      document.documentElement.appendChild(area);
      try {
        area.select();
        const copied = typeof document.execCommand === 'function' ? document.execCommand('copy') : false;
        if (!copied) throw new Error('copy command failed');
      } finally {
        area.remove();
      }
    }
    function PanelHeader({ tr, snapshot, refreshing, busy, writable, onRefresh, onScan }) {
      const meta = [];
      if (snapshot) {
        meta.push(
          h('span', { className: 'gb-meta-item', key: 'last' }, tr('header.lastScan', { time: formatTime(snapshot.generatedAt) || tr('header.never') })),
        );
        meta.push(
          h('span', { className: 'gb-meta-item', key: 'scan' }, tr('header.scan', { files: snapshot.scan.files, ms: snapshot.scan.durationMs })),
        );
        meta.push(
          h(
            'span',
            {
              className: snapshot.scan.errors.length > 0 ? 'gb-meta-item gb-meta-error' : 'gb-meta-item',
              key: 'errors',
              title: snapshot.scan.errors.length > 0 ? snapshot.scan.errors.map((entry) => `${entry.path}: ${entry.message}`).join('\n') : undefined,
            },
            tr('header.errors', { count: snapshot.scan.errors.length }),
          ),
        );
        if (snapshot.scan.truncated) {
          meta.push(h('span', { className: 'gb-meta-item gb-meta-warn', key: 'truncated' }, tr('header.truncated')));
        }
        meta.push(h('span', { className: 'gb-meta-item', key: 'revision' }, tr('header.revision', { revision: snapshot.revision })));
      } else {
        meta.push(h('span', { className: 'gb-meta-item', key: 'last' }, tr('header.never')));
      }
      const scanning = busy === 'scan';
      return h(
        'header',
        { className: 'gb-header' },
        h(
          'div',
          { className: 'gb-heading' },
          h('div', { className: 'gb-kicker' }, tr('panel.kicker')),
          h('h1', { className: 'gb-title' }, tr('panel.title')),
          h('div', { className: 'gb-meta' }, meta),
        ),
        h(
          'div',
          { className: 'gb-head-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'gb-btn',
              disabled: !writable || Boolean(busy),
              title: writable ? undefined : tr('header.writeOff'),
              onClick: onScan,
            },
            scanning ? tr('action.scanBusy') : tr('header.scanNow'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'gb-btn gb-btn-primary',
              disabled: refreshing,
              onClick: onRefresh,
            },
            h(RefreshIcon, { size: 13 }),
            refreshing ? tr('header.refreshing') : tr('header.refresh'),
          ),
        ),
      );
    }
    function createGameboardPanel(deps) {
      const store = deps.store;
      const refresh = deps.refresh;
      const runAction = deps.runAction;
      const notify = deps.notify;
      const dismissError = deps.dismissError;
      function GameboardPanel({ t }) {
        const tr = translator(t);
        const state = useStore(store);
        const [tab, setTab] = React.useState('overview');
        const snapshot = state.snapshot;
        const busy = state.busy;
        const writable = readToken().length > 0;
        const pendingCount = snapshot
          ? snapshot.items.filter(
              (item) => item.gates.decision === 'pending' || item.gates.manual === 'pending' || item.gates.test === 'failing',
            ).length
          : 0;
        const actions = {
          decide(item, choice) {
            runAction(
              { op: 'decide', id: item.id, choice },
              { busyKey: `decide:${item.id}`, successKey: 'action.decided', successVars: { choice } },
            );
          },
          step(item, index, done) {
            runAction(
              { op: 'manual-step', id: item.id, index, done },
              { busyKey: `step:${item.id}`, successKey: 'action.stepSaved' },
            );
          },
          manualDone(item) {
            runAction(
              { op: 'manual-set', id: item.id, status: 'done' },
              { busyKey: `manual:${item.id}`, successKey: 'action.doneSaved' },
            );
          },
          copy(item, kind) {
            let text = '';
            try {
              text = buildPrompt(tr, kind, item);
            } catch (error) {
              console.warn('[gameboard] could not build prompt:', error);
            }
            copyText(text)
              .then(() => notify('success', 'pending.copied'))
              .catch((error) => {
                console.warn('[gameboard] clipboard write failed:', error);
                notify('error', 'pending.copyFailed');
              });
          },
        };
        const onRefresh = () => {
          refresh({ manual: true });
        };
        const onScan = () => {
          runAction({ op: 'scan' }, { busyKey: 'scan', successKey: 'action.scanDone' });
        };
        const onInit = () => {
          runAction({ op: 'init' }, { busyKey: 'init', successKey: 'action.initDone' });
        };
        let content;
        if (!snapshot) {
          content = state.loading
            ? h(Loading, { tr })
            : h(EmptyState, {
                tr,
                icon: h(AlertIcon, { size: 24 }),
                title: tr('state.noSnapshot'),
                desc: tr('state.offline'),
                action: h('button', { type: 'button', className: 'gb-btn', onClick: onRefresh }, tr('state.retry')),
              });
        } else if (!snapshot.board.initialized) {
          content = h(EmptyState, {
            tr,
            icon: h(GameboardIcon, { size: 26 }),
            title: tr('empty.init.title'),
            desc: tr('empty.init.desc'),
            action: h(
              'button',
              {
                type: 'button',
                className: 'gb-btn gb-btn-primary',
                disabled: !writable || Boolean(busy),
                title: writable ? undefined : tr('header.writeOff'),
                onClick: onInit,
              },
              busy === 'init' ? tr('empty.init.busy') : tr('empty.init.action'),
            ),
          });
        } else {
          let tabBody;
          if (tab === 'pending') {
            tabBody = h(PendingTab, { tr, snapshot, busy, writable, actions });
          } else if (tab === 'board') {
            tabBody = h(BoardTab, { tr, snapshot });
          } else if (tab === 'changes') {
            tabBody = h(ChangesTab, { tr, snapshot });
          } else {
            tabBody = h(OverviewTab, { tr, snapshot });
          }
          content = h(
            React.Fragment,
            null,
            h(Tabs, { tr, active: tab, pendingCount, onSelect: setTab }),
            h(
              'div',
              {
                className: 'gb-panel',
                id: `gb-panel-${tab}`,
                role: 'tabpanel',
                'aria-labelledby': `gb-tab-${tab}`,
              },
              tabBody,
            ),
          );
        }
        return h(
          'div',
          { className: 'gb-root' },
          h(PanelHeader, {
            tr,
            snapshot,
            refreshing: state.refreshing,
            busy,
            writable,
            onRefresh,
            onScan,
          }),
          writable ? null : h(WriteOffNotice, { tr }),
          state.error ? h(ErrorBanner, { tr, message: errorText(tr, state.error), onDismiss: dismissError }) : null,
          state.notice ? h(Notice, { tone: state.notice.tone }, tr(state.notice.key, state.notice.vars)) : null,
          content,
        );
      }
      return GameboardPanel;
    }
    function SidebarPanelIcon({ size, active }) {
      return h(GameboardIcon, { size: asNumber(size, 16), active: Boolean(active) });
    }
    function Apply(ctx) {
      const store = createStore({
        snapshot: null,
        loading: true,
        error: null,
        notice: null,
        refreshing: false,
        busy: null,
      });
      let inFlight = null;
      let queueManual = false;
      function patch(partial) {
        store.set({ ...store.get(), ...partial });
      }
      function dismissError() {
        patch({ error: null });
      }
      function notify(tone, key, vars) {
        patch({ notice: { tone, key, vars: vars || null } });
      }
      async function refresh(options) {
        const manual = Boolean(options && options.manual);
        if (manual) patch({ refreshing: true });
        if (inFlight) {
          if (manual) queueManual = true;
          return inFlight;
        }
        if (!store.get().snapshot) patch({ loading: true });
        inFlight = (async () => {
          try {
            const response = await fetch('/gameboard/snapshot', {
              method: 'GET',
              headers: { accept: 'application/json' },
              cache: 'no-store',
            });
            const payload = await readPayload(response);
            if (!response.ok) throw httpFailure(response, payload);
            const snapshot = normalizeSnapshot(payload);
            if (!snapshot) {
              const failure = new Error('');
              failure.key = 'error.badPayload';
              throw failure;
            }
            patch({ snapshot, loading: false, refreshing: false, error: null });
          } catch (error) {
            patch({ loading: false, refreshing: false, error: errorInfo(error) });
          } finally {
            inFlight = null;
            if (queueManual) {
              queueManual = false;
              refresh({ manual: true });
            }
          }
        })();
        return inFlight;
      }
      async function runAction(body, options) {
        const opts = options || {};
        const token = readToken();
        if (!token) {
          notify('error', 'header.writeOff');
          return null;
        }
        if (store.get().busy) return null;
        patch({ busy: opts.busyKey || 'action', notice: null, error: null });
        try {
          const response = await fetch('/gameboard/action', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              accept: 'application/json',
              'x-gameboard-token': token,
            },
            body: JSON.stringify(body || {}),
          });
          const payload = await readPayload(response);
          if (!response.ok) throw httpFailure(response, payload);
          if (!payload || payload.ok !== true) {
            if (payload && typeof payload.error === 'string' && payload.error.trim()) throw httpFailure(response, payload);
            const failure = new Error('');
            failure.key = 'error.badPayload';
            throw failure;
          }
          let applied = false;
          if (payload.snapshot) {
            const snapshot = normalizeSnapshot(payload.snapshot);
            if (snapshot) {
              patch({ snapshot, loading: false, refreshing: false, error: null });
              applied = true;
            }
          }
          if (opts.successKey) notify('success', opts.successKey, opts.successVars);
          if (!applied) refresh({ manual: false });
          return payload;
        } catch (error) {
          patch({ error: errorInfo(error) });
          return null;
        } finally {
          patch({ busy: null });
        }
      }
      ctx.effect(
        () => {
          const style = document.createElement('style');
          style.dataset.plugin = 'dsh-gameboard';
          style.textContent = css;
          document.head.appendChild(style);
          return () => style.remove();
        },
        'gameboard: styles',
      );
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'gameboard: dictionaries');
      ctx.effect(
        () => {
          let timer = null;
          const tick = () => {
            if (document.visibilityState === 'hidden') return;
            refresh({ manual: false });
          };
          const onVisibility = () => {
            if (document.visibilityState === 'visible') refresh({ manual: false });
          };
          refresh({ manual: false });
          timer = window.setInterval(tick, POLL_MS);
          document.addEventListener('visibilitychange', onVisibility);
          return () => {
            if (timer !== null) window.clearInterval(timer);
            timer = null;
            document.removeEventListener('visibilitychange', onVisibility);
          };
        },
        'gameboard: snapshot polling',
      );
      const GameboardPanel = createGameboardPanel({ store, refresh, runAction, notify, dismissError });
      function GameboardPanelSlot({ t }) {
        const tr = translator(t);
        return h(PanelBoundary, { tr }, h(GameboardPanel, { t }));
      }
      function panelLabel() {
        try {
          const translate = ctx.locale.bind(NS);
          const label = translate('nav.label');
          return typeof label === 'string' && label.length > 0 ? label : 'Gameboard';
        } catch (error) {
          return 'Gameboard';
        }
      }
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: 'gameboard',
            order: 40,
            locale: NS,
            label: panelLabel,
          },
          SidebarPanelIcon,
        ),
      );
      ctx.slots.inject('main', () =>
        ctx.slots.register(
          {
            name: 'main',
            key: 'gameboard',
            locale: NS,
          },
          GameboardPanelSlot,
        ),
      );
    }
    return { inject: ['slots', 'locale'], apply: Apply };
  },
});
