import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const html = fs.readFileSync(
  path.resolve("knowledge", "graph", "knowledge-graph.html"),
  "utf8"
);

const css = fs.readFileSync(
  path.resolve("knowledge", "graph", "knowledge-graph.css"),
  "utf8"
);

const js = fs.readFileSync(
  path.resolve("knowledge", "graph", "knowledge-graph.js"),
  "utf8"
);

test("knowledge-graph.html 提供展示型信息画布骨架", () => {
  assert.match(html, /<svg[^>]+id="graph-canvas"/);
  assert.match(html, /id="graph-viewport"/);
  assert.match(html, /id="graph-empty-state"/);
  assert.match(html, /class="details panel graph-drawer"/);
  assert.match(html, /class="graph-panel-head"[\s\S]*id="search-input"/);
  assert.match(html, /class="detail-heading-main"/);
  assert.match(html, /class="detail-heading-side"/);
  assert.match(html, /class="detail-reading panel"/);
  assert.match(html, /id="detail-reading-panel"/);
  assert.doesNotMatch(html, /class="toolbar toolbar-primary"/);
  assert.doesNotMatch(html, /class="toolbar toolbar-secondary"/);
  assert.doesNotMatch(html, /class="type-toggle-group"/);
});

test("knowledge-graph.css 提供当前图谱布局与节点语法样式", () => {
  assert.match(css, /\.canvas-shell/);
  assert.match(css, /\.graph-canvas/);
  assert.match(css, /\.graph-drawer/);
  assert.match(css, /\.graph-panel-head/);
  assert.match(css, /\.graph-panel-search/);
  assert.match(css, /\.node-badge/);
  assert.match(css, /\.node-practice-card/);
  assert.match(css, /\.node-option-recommended/);
  assert.match(css, /\.detail-heading-main/);
  assert.match(css, /\.detail-heading-side/);
  assert.match(css, /\.detail-reading/);
  assert.match(css, /\.detail-reading-grid/);
  assert.doesNotMatch(css, /\.type-toggle-group/);
});

test("knowledge-graph.js 输出统一抽屉和下方阅读区结构", () => {
  assert.match(js, /detailReadingPanel:\s*document\.querySelector\("#detail-reading-panel"\)/);
  assert.match(js, /detail-block detail-header-block/);
  assert.match(js, /detail-block detail-facts-block/);
  assert.match(js, /detail-block detail-relations-block/);
  assert.match(js, /detail-block detail-body-block/);
  assert.match(js, /detail-block detail-evidence-block/);
  assert.match(js, /relation-group/);
  assert.doesNotMatch(js, /detail-stage/);
  assert.doesNotMatch(js, /detail-structure/);
  assert.doesNotMatch(js, /detail-score-hero/);
});

test("knowledge-graph 使用中文节点类型标签", () => {
  assert.match(html, />实践</);
  assert.match(html, />推荐方案</);
  assert.match(js, /practice:\s*"实践"/);
  assert.match(js, /option:\s*"方案"/);
  assert.match(js, /context:\s*"场景"/);
  assert.match(js, /constraint:\s*"约束"/);
  assert.match(js, /rule:\s*"规则"/);
  assert.match(js, /project_profile:\s*"项目画像"/);
});

test("knowledge-graph 使用中文评分文案", () => {
  assert.match(js, /最终分/);
  assert.match(js, /基础分/);
  assert.match(js, /项目加减分/);
  assert.match(js, /推荐状态/);
  assert.doesNotMatch(js, /<span>\s*final_score\s*<\/span>/);
  assert.doesNotMatch(js, /<span>\s*base_score\s*<\/span>/);
  assert.doesNotMatch(js, /<span>\s*adjustment\s*<\/span>/);
  assert.doesNotMatch(js, /<span>\s*project_adjustment\s*<\/span>/);
  assert.doesNotMatch(js, /<span>\s*score_state\s*<\/span>/);
});
