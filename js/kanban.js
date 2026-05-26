// BlacksiteLab Fleet Command — Kanban Board

const Kanban = {
  init() {
    document.getElementById('btnAddTask').addEventListener('click', () => this.openTaskModal());
    document.getElementById('btnSaveTask').addEventListener('click', () => this.saveTask());
    document.getElementById('btnCancelTask').addEventListener('click', () => this.closeTaskModal());
    document.getElementById('taskModalBackdrop').addEventListener('click', () => this.closeTaskModal());
    this.setupDragDrop();
  },

  render() {
    ['backlog', 'in-progress', 'review', 'done'].forEach(col => {
      const container = document.getElementById(`col-${col}`);
      const tasks = State.getColumnTasks(col);
      container.innerHTML = tasks.map(t => this.taskCard(t)).join('');
      // Update column counts
      const header = container.closest('.kanban-col').querySelector('.kanban-col-header');
      const existingCount = header.querySelector('.kanban-col-count');
      if (existingCount) existingCount.remove();
      header.insertAdjacentHTML('beforeend', `<span class="kanban-col-count">${tasks.length}</span>`);
    });

    // Rebind drag/drop
    this.setupDragDrop();

    // Rebind delete buttons
    document.querySelectorAll('.kc-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.closest('.kanban-card').dataset.taskId;
        State.deleteTask(id);
        this.render();
      });
    });
  },

  taskCard(task) {
    const agent = AGENTS_BY_ID[task.assignee];
    const color = agent ? agent.color : '#62666d';
    const assignee = task.assignee || '--';
    return `
      <div class="kanban-card" draggable="true" data-task-id="${task.id}">
        <div class="kc-agent" style="background:${color}"></div>
        <div class="kc-title">${esc(task.title)}</div>
        ${task.desc ? `<div class="kc-desc">${esc(task.desc)}</div>` : ''}
        <div class="kc-meta">
          <span class="kc-priority ${task.priority}">${task.priority}</span>
          <span class="kc-assignee">${assignee}</span>
          <button class="kc-delete" title="Delete">×</button>
        </div>
      </div>`;
  },

  setupDragDrop() {
    const cards = document.querySelectorAll('.kanban-card[draggable]');
    const columns = document.querySelectorAll('.kanban-cards');

    cards.forEach(card => {
      card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', card.dataset.taskId);
        card.style.opacity = '0.5';
      });
      card.addEventListener('dragend', e => {
        card.style.opacity = '1';
      });
    });

    columns.forEach(col => {
      col.addEventListener('dragover', e => {
        e.preventDefault();
        col.style.background = 'rgba(113,112,255,0.05)';
      });
      col.addEventListener('dragleave', e => {
        col.style.background = '';
      });
      col.addEventListener('drop', e => {
        e.preventDefault();
        col.style.background = '';
        const taskId = e.dataTransfer.getData('text/plain');
        const toCol = col.closest('.kanban-col').dataset.col;
        State.moveTask(taskId, toCol);
        this.render();
      });
    });
  },

  openTaskModal(task = null) {
    document.getElementById('taskModalTitle').textContent = task ? 'Edit Task' : 'Add Task';
    document.getElementById('taskTitle').value = task?.title || '';
    document.getElementById('taskDesc').value = task?.desc || '';
    document.getElementById('taskAssignee').value = task?.assignee || '';
    document.getElementById('taskPriority').value = task?.priority || 'medium';
    document.getElementById('taskModal').classList.add('open');
    document.getElementById('btnSaveTask').dataset.editId = task?.id || '';
  },

  closeTaskModal() {
    document.getElementById('taskModal').classList.remove('open');
  },

  saveTask() {
    const title = document.getElementById('taskTitle').value.trim();
    if (!title) return;
    const editId = document.getElementById('btnSaveTask').dataset.editId;
    if (editId) {
      const task = State.tasks.find(t => t.id === editId);
      if (task) {
        task.title = title;
        task.desc = document.getElementById('taskDesc').value.trim();
        task.assignee = document.getElementById('taskAssignee').value;
        task.priority = document.getElementById('taskPriority').value;
        State.saveTasks();
      }
    } else {
      State.addTask({
        title,
        desc: document.getElementById('taskDesc').value.trim(),
        assignee: document.getElementById('taskAssignee').value,
        priority: document.getElementById('taskPriority').value,
        column: 'backlog',
      });
    }
    this.closeTaskModal();
    this.render();
  },
};

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
