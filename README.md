# 手工造纸帘纹与工序档案

围绕手工造纸的纸帘、纤维料批、抄纸工序与成纸样本建立一体化档案。界面可登记纸帘丝径与帘纹间距、推算网目密度，跟踪料批打浆度，复测抄纸帘纹偏差，并按匀度与帘纹条数复核样本。所有业务数据保存在浏览器 IndexedDB 中，无需后端服务。

## Docker 一键启动

```bash
cp .env.example .env && docker compose up -d --build
```

默认映射端口为 `21807`。启动后访问 `http://localhost:21807`。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端框架 | React 18 + TypeScript 5 |
| 构建工具 | Vite 5 |
| 界面组件 | MUI 5 + Emotion |
| 路由 | React Router 6 |
| 状态管理 | Zustand 4 |
| 本地数据库 | Dexie 4 + IndexedDB |
| 部署 | Nginx + Docker Compose |

## 访问地址

`http://localhost:21807`

## 本地开发方式

```bash
cd frontend
npm install
npm run dev
```

本地开发服务器默认运行在 `http://localhost:5173`。

## 目录结构

```text
.
├── docker-compose.yml
├── .env.example
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── src/
│       ├── components/common/  公共可视化组件
│       ├── components/rework/  返修单登记与应用面板
│       ├── hooks/              筛选与单位换算
│       ├── pages/              五个业务页面
│       ├── router/             路由表
│       ├── stores/             Zustand 状态与持久化动作
│       ├── types/              五类业务模型
│       └── utils/              Stripe 计算、Dexie 与 JSON 导出
└── README.md
```

## 数据存储说明

数据存储使用 IndexedDB，Dexie 数据库名为 `gbpapermill-db`。

- `version(1)`：建立 `moulds`、`fiberBatches`、`sheetRuns`、`paperSamples` 四张表及编号、日期、状态等索引。
- `version(2)`：为四张表加入 `schemaRev` 索引，并通过 `upgrade` 将存量记录回填为版本 `2`。
- `version(3)`：新增 `reworkOrders` 返修单表；`moulds` 增加 `specRev` 现行规格版本；`sheetRuns` 增加 `specRev` 与丝径/间距快照（既有工序按当时规格锁定，偏差判定不变）；`paperSamples` 增加 `specRev`、`recheckState`（未复检/待复检/已复检）与 `archiveState`（待归档/已归档）。升级会回填全部旧记录，旧数据升级后仍能读完。
- 数据库首次创建时通过 `populate` 写入 5 张纸帘、5 个纤维料批、8 槽抄纸工序、7 个成纸样本和 2 张返修单（含一张已应用、一张待应用）。
- 纸帘返修流程：在纸帘台帐开立返修单（写清拟改丝径/帘纹间距与原因）→ 应用时在一个事务里标出该帘未复检样本、切换台帐现行规格并抬升 `specRev`；任一写入失败整体回滚，原数据保留，返修单维持“待应用”可重试。样本复检后才能归档。
- 页面顶部的“导出 JSON”可下载五张表的完整备份，并附 `runSpecBasis` 逐条说明每槽工序判定偏差所依据的规格版本。

## 核心功能与路由表

| 路由 | 页面标题 | 核心功能 |
| --- | --- | --- |
| `/` | 工作台 | 查看纸帘状态分布、本周工序及其规格依据版本、待复检样本与标准工序路径 |
| `/moulds` | 纸帘台帐 | 筛选纸帘，登记新纸帘，实时推算网目密度；开立/应用/作废返修单，台帐保留现行规格版本 |
| `/fibers` | 纤维料批台账 | 按原料和打浆度筛选、比较，展开查看关联抄纸工序 |
| `/runs` | 抄纸工序记录台 | 按日期和帘号筛选，登记工序并锁定当时规格版本，按锁定规格判定 ±0.2 mm 帘纹偏差 |
| `/samples` | 成纸样本与透光检验卡 | 按匀度与帘纹条数分档，登记复检、复检后归档，查看透光帘纹预览和存档位置 |

未匹配的地址会回到工作台。
