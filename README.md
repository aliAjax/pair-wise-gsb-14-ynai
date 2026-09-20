# 油品价格维护

- 行业：石油
- 技术栈：Vue3、Vite、TypeScript、Pinia、Naive UI
- 启动：`npm install && npm run dev`
- 构建：`npm run build`

站区联动的油品调价审批闭环：每笔调价登记站点、区域指导价、申请人与生效日；
同站同油品仅保留一笔在途记录；偏离指导价超 0.3 元须填写依据并指定复核人，
否则只能存草稿；生效后金额冻结，改价先撤回未生效记录，撤回后恢复最近有效
价格，没有则显示未定价。

## 目录结构（规则 / 存储 / 页面分离）

- `src/domain/types.ts`：领域模型与常量（状态机、0.3 元偏离阈值）
- `src/domain/rules.ts`：纯业务规则（价差、审批要素校验、在途唯一、撤回恢复）
- `src/store/storage.ts`：localStorage 持久化（带版本信封）与种子数据
- `src/store/priceStore.ts`：Pinia 状态层，串起规则与存储
- `src/components/`：站区看板、调价登记、审批记录、历史、异常五个页面组件

数据默认保存在浏览器 localStorage（key：`dfwlfront-9-price`），刷新后审批
状态、价差与撤销历史保持一致；业务异常统一列出站点、油品和日期。
