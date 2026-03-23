#!/usr/bin/env node

/**
 * 状态管理工具
 * 用于管理 feature-flow 各阶段的执行状态
 *
 * 使用方式：
 * node claude/utils/state-manager.js init <requirementName> <prdUrl> <description>
 * node claude/utils/state-manager.js update <requirementName> <stageName> <status> [output] [metadataJson]
 * node claude/utils/state-manager.js decision <requirementName> <decision>
 * node claude/utils/state-manager.js get <requirementName>
 * node claude/utils/state-manager.js list
 */

const fs = require('fs');
const path = require('path');

class StateManager {
  constructor(requirementName, baseDir = 'docs') {
    this.requirementName = requirementName;
    this.baseDir = baseDir;
    this.statePath = path.join(baseDir, requirementName, 'state.json');
  }

  /**
   * 初始化状态文件
   * @param {string} prdUrl - PRD 链接
   * @param {string} description - 需求描述
   * @returns {object} 初始化的状态对象
   */
  init(prdUrl, description = '') {
    const state = {
      requirement: {
        name: this.requirementName,
        prd_url: prdUrl,
        description: description,
        created_at: new Date().toISOString()
      },
      current_stage: 'tech-plan',
      current_substage: 'initializing',
      next_action: 'read_prd',
      approved_sections: [],
      artifacts: {},
      stages: {
        'tech-plan': { status: 'in_progress' },
        'task-list': { status: 'pending' },
        'tdd-implementation': { status: 'pending' },
        'code-execution': { status: 'pending' }
      },
      decisions: []
    };
    this._write(state);
    return state;
  }

  /**
   * 更新阶段状态
   * @param {string} stageName - 阶段名称
   * @param {string} status - 状态: pending/in_progress/completed
   * @param {string} output - 输出文件路径
   * @param {object} metadata - 额外的元数据
   * @returns {object} 更新后的状态对象
   */
  updateStage(stageName, status, output = null, metadata = {}) {
    const state = this.get();
    state.stages[stageName] = {
      status,
      output,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      ...metadata
    };

    if (metadata.substage) {
      state.current_substage = metadata.substage;
    }
    if (metadata.next_action) {
      state.next_action = metadata.next_action;
    }
    if (metadata.artifacts && typeof metadata.artifacts === 'object') {
      state.artifacts = {
        ...(state.artifacts || {}),
        ...metadata.artifacts
      };
    }
    if (Array.isArray(metadata.approved_sections)) {
      state.approved_sections = metadata.approved_sections;
    }

    // 更新当前阶段
    if (status === 'completed') {
      const stageOrder = ['tech-plan', 'task-list', 'tdd-implementation', 'code-execution'];
      const currentIndex = stageOrder.indexOf(stageName);
      if (currentIndex < stageOrder.length - 1) {
        state.current_stage = stageOrder[currentIndex + 1];
      }
    } else if (status === 'in_progress') {
      state.current_stage = stageName;
    }

    this._write(state);
    return state;
  }

  /**
   * 添加关键决策
   * @param {string} decision - 决策内容
   * @returns {object} 更新后的状态对象
   */
  addDecision(decision) {
    const state = this.get();
    state.decisions.push({
      text: decision,
      timestamp: new Date().toISOString()
    });
    this._write(state);
    return state;
  }

  updateMeta(metadata = {}) {
    const state = this.get();
    if (metadata.current_substage) {
      state.current_substage = metadata.current_substage;
    }
    if (metadata.next_action) {
      state.next_action = metadata.next_action;
    }
    if (metadata.artifacts && typeof metadata.artifacts === 'object') {
      state.artifacts = {
        ...(state.artifacts || {}),
        ...metadata.artifacts
      };
    }
    if (Array.isArray(metadata.approved_sections)) {
      state.approved_sections = metadata.approved_sections;
    }
    this._write(state);
    return state;
  }

  /**
   * 获取状态
   * @returns {object} 状态对象
   */
  get() {
    return this._read();
  }

  /**
   * 获取当前阶段
   * @returns {string} 当前阶段名称
   */
  getCurrentStage() {
    return this.get().current_stage;
  }

  /**
   * 检查阶段是否完成
   * @param {string} stageName - 阶段名称
   * @returns {boolean} 是否完成
   */
  isStageCompleted(stageName) {
    const stage = this.get().stages[stageName];
    return stage && stage.status === 'completed';
  }

  /**
   * 检查状态文件是否存在
   * @returns {boolean} 是否存在
   */
  exists() {
    return fs.existsSync(this.statePath);
  }

  /**
   * 内部方法：读取文件
   * @returns {object} 状态对象
   */
  _read() {
    if (!fs.existsSync(this.statePath)) {
      throw new Error(`State file not found: ${this.statePath}`);
    }
    return JSON.parse(fs.readFileSync(this.statePath, 'utf8'));
  }

  /**
   * 内部方法：写入文件
   * @param {object} state - 状态对象
   */
  _write(state) {
    const dir = path.dirname(this.statePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2), 'utf8');
  }
}

/**
 * 列出所有进行中的需求
 * @returns {Array} 需求列表
 */
function listRequirements() {
  const docsDir = 'docs';
  if (!fs.existsSync(docsDir)) {
    return [];
  }

  const requirements = [];

  const entries = fs.readdirSync(docsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const statePath = path.join(docsDir, entry.name, 'state.json');
      if (fs.existsSync(statePath)) {
        try {
          const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
          requirements.push({
            name: state.requirement.name,
            current_stage: state.current_stage,
            stages: state.stages,
            decisions: state.decisions,
            created_at: state.requirement.created_at
          });
        } catch (e) {
          // 跳过无法解析的文件
        }
      }
    }
  }

  return requirements.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// CLI 入口
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'init') {
    const requirementName = args[1];
    const prdUrl = args[2] || '';
    const description = args[3] || '';

    if (!requirementName) {
      console.error('Usage: node state-manager.js init <requirementName> <prdUrl> [description]');
      process.exit(1);
    }

    const manager = new StateManager(requirementName);
    const state = manager.init(prdUrl, description);
    console.log(JSON.stringify(state, null, 2));
  } else if (command === 'update') {
    const requirementName = args[1];
    const stageName = args[2];
    const status = args[3];
    const output = args[4] || null;
    const metadataJson = args[5] || null;

    if (!requirementName || !stageName || !status) {
      console.error('Usage: node state-manager.js update <requirementName> <stageName> <status> [output] [metadataJson]');
      process.exit(1);
    }

    let metadata = {};
    if (metadataJson) {
      try {
        metadata = JSON.parse(metadataJson);
      } catch (e) {
        console.error(`Invalid metadata JSON: ${metadataJson}`);
        process.exit(1);
      }
    }

    const manager = new StateManager(requirementName);
    const state = manager.updateStage(stageName, status, output, metadata);
    console.log(JSON.stringify(state, null, 2));
  } else if (command === 'decision') {
    const requirementName = args[1];
    const decision = args.slice(2).join(' ');

    if (!requirementName || !decision) {
      console.error('Usage: node state-manager.js decision <requirementName> <decision>');
      process.exit(1);
    }

    const manager = new StateManager(requirementName);
    const state = manager.addDecision(decision);
    console.log(JSON.stringify(state, null, 2));
  } else if (command === 'meta') {
    const requirementName = args[1];
    const metadataJson = args[2];

    if (!requirementName || !metadataJson) {
      console.error('Usage: node state-manager.js meta <requirementName> <metadataJson>');
      process.exit(1);
    }

    let metadata = {};
    try {
      metadata = JSON.parse(metadataJson);
    } catch (e) {
      console.error(`Invalid metadata JSON: ${metadataJson}`);
      process.exit(1);
    }

    const manager = new StateManager(requirementName);
    const state = manager.updateMeta(metadata);
    console.log(JSON.stringify(state, null, 2));
  } else if (command === 'get') {
    const requirementName = args[1];

    if (!requirementName) {
      console.error('Usage: node state-manager.js get <requirementName>');
      process.exit(1);
    }

    const manager = new StateManager(requirementName);
    const state = manager.get();
    console.log(JSON.stringify(state, null, 2));
  } else if (command === 'list') {
    const requirements = listRequirements();
    console.log(JSON.stringify(requirements, null, 2));
  } else if (command === 'exists') {
    const requirementName = args[1];
    if (!requirementName) {
      console.error('Usage: node state-manager.js exists <requirementName>');
      process.exit(1);
    }
    const manager = new StateManager(requirementName);
    console.log(manager.exists() ? 'true' : 'false');
  } else {
    console.log(`
Usage:
  node state-manager.js init <requirementName> <prdUrl> [description]
  node state-manager.js update <requirementName> <stageName> <status> [output]
  node state-manager.js decision <requirementName> <decision>
  node state-manager.js get <requirementName>
  node state-manager.js list
  node state-manager.js exists <requirementName>

Stages: tech-plan, task-list, tdd-implementation, code-execution
Status: pending, in_progress, completed
    `);
  }
}

module.exports = { StateManager, listRequirements };
