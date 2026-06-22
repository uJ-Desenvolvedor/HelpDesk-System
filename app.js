'use strict';

/* Chaves do storage */
const STORAGE_TICKETS = 'helpdesk_tickets';
const STORAGE_SESSION = 'helpdesk_session';

/* Estado global — fonte única da verdade */
const state = {
  tickets:       [],
  filterStatus:  'todos',
  session:       null,
  activeTicketId: null,
};

const PRIORITY_MAP = {
  baixa: { label: 'Baixa', cls: 'low',     icon: '🟢' },
  media: { label: 'Média', cls: 'medium', icon: '🟡' },
  alta:  { label: 'Alta',  cls: 'high',    icon: '🔴' },
};

const STATUS_MAP = {
  aberto:    { label: 'Aberto',       cls: 'open',     rowCls: '' },
  andamento: { label: 'Em Andamento', cls: 'progress', rowCls: '' },
  concluido: { label: 'Concluído',    cls: 'done',     rowCls: 'row--done' },
};


/* Storage */

function loadTickets() {
  try {
    const raw = localStorage.getItem(STORAGE_TICKETS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Erro ao carregar tickets:', e);
    return [];
  }
}

function saveTickets() {
  try {
    localStorage.setItem(STORAGE_TICKETS, JSON.stringify(state.tickets));
  } catch (e) { 
    console.error('Erro ao salvar tickets:', e); 
  }
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(session) {
  try {
    sessionStorage.setItem(STORAGE_SESSION, JSON.stringify(session));
  } catch (e) { console.error('Erro ao salvar sessão:', e); }
}

function clearSession() {
  sessionStorage.removeItem(STORAGE_SESSION);
}


/* Helpers */

function generateId() {
  // Substituído Math.random por crypto.randomUUID (ou fallback) para evitar colisões de IDs
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `T-${crypto.randomUUID().substring(0, 8)}`;
  }
  return `T-${Date.now()}-${Math.floor(Math.random() * 1000).toString(16)}`;
}

function getTimestamp() {
  return new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isSupport() {
  return state.session?.role === 'suporte';
}


/* Login / Logout */

function login(name, role) {
  if (!name || !name.trim()) {
    showToast('⚠️ Digite seu nome para entrar.', 'danger');
    return;
  }

  state.session = { name: name.trim(), role };
  saveSession(state.session);

  const loginScreen = document.getElementById('login-screen');
  const appScreen = document.getElementById('app');
  
  if (loginScreen) loginScreen.style.display = 'none';
  if (appScreen) appScreen.hidden = false;

  const elUsername = document.getElementById('header-username');
  const elRole = document.getElementById('header-role');
  const elAvatar = document.getElementById('header-avatar');
  const sectionNewTicket = document.getElementById('section-new-ticket');

  if (elUsername) elUsername.textContent = state.session.name;
  if (elRole) elRole.textContent = role === 'suporte' ? '🛠️ Suporte Técnico' : '👤 Usuário';
  if (elAvatar) elAvatar.textContent = role === 'suporte' ? '🛠️' : '👤';

  if (sectionNewTicket) sectionNewTicket.hidden = isSupport();

  if (!isSupport()) {
    const elUserNameInput = document.getElementById('user-name');
    if (elUserNameInput) elUserNameInput.value = state.session.name;
  }

  renderTickets();
  updateDashboard();
  showToast(`✅ Bem-vindo(a), ${state.session.name}!`, 'success');
}

function logout() {
  state.session = null;
  state.activeTicketId = null;
  clearSession();

  const appScreen = document.getElementById('app');
  const loginScreen = document.getElementById('login-screen');

  if (appScreen) appScreen.hidden = true;
  if (loginScreen) loginScreen.style.display = '';

  ['login-user-name', 'login-user-pass', 'login-sup-name', 'login-sup-pass']
    .forEach(id => { 
      const el = document.getElementById(id);
      if (el) el.value = ''; 
    });
}


/* Lógica de negócio */

function addTicket(fields) {
  const ticket = {
    id:           generateId(),
    user:         fields.userName.trim(),
    sector:       fields.sector.trim(),
    subject:      fields.subject.trim(),
    description:  fields.description.trim(),
    priority:     fields.priority,
    status:       'aberto',
    createdAt:    getTimestamp(),
    comments:     [],
    techResponse: null,
  };

  state.tickets.unshift(ticket);
  saveTickets();
  renderTickets();
  updateDashboard();
  showToast('✅ Chamado aberto com sucesso!', 'success');
}

// Escopo global para os botões do HTML inline conseguirem acessar
window.updateStatus = function(id, newStatus) {
  const ticket = state.tickets.find(t => t.id === id);
  if (!ticket) return;

  const label = STATUS_MAP[newStatus]?.label || newStatus;
  const msg = prompt(`Mensagem de atualização técnica para o usuário:\n(Chamado: ${ticket.subject} → ${label})`);

  if (msg === null) return;

  ticket.status = newStatus;

  if (msg.trim()) {
    ticket.techResponse = {
      text:   msg.trim(),
      author: state.session.name,
      time:   getTimestamp(),
    };
  }

  saveTickets();
  renderTickets();
  updateDashboard();

  if (state.activeTicketId === id) {
    renderModalDetails(ticket);
  }

  const toastType = newStatus === 'concluido' ? 'success' : 'warning';
  showToast(`🔄 Status: "${label}"`, toastType);
};

window.deleteTicket = function(id) {
  if (!confirm('Tem certeza que deseja excluir este chamado?')) return;
  state.tickets = state.tickets.filter(t => t.id !== id);
  saveTickets();
  renderTickets();
  updateDashboard();
  closeModal();
  showToast('🗑️ Chamado excluído.', 'danger');
};

window.openModal = function(id) {
  const ticket = state.tickets.find(t => t.id === id);
  if (!ticket) return;

  state.activeTicketId = id;

  renderModalDetails(ticket);
  renderComments(ticket.comments || []);

  const commentFormSec = document.getElementById('comment-form-section');
  if (commentFormSec) commentFormSec.hidden = false;

  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    void overlay.offsetHeight;
    overlay.classList.add('is-visible');
  }
  
  const commentText = document.getElementById('comment-text');
  if (commentText) commentText.focus();
  document.body.style.overflow = 'hidden';
};

function addComment(text) {
  if (!text || !text.trim()) {
    showToast('⚠️ Digite um comentário antes de enviar.', 'danger');
    return;
  }

  const ticket = state.tickets.find(t => t.id === state.activeTicketId);
  if (!ticket) return;

  if (!Array.isArray(ticket.comments)) ticket.comments = [];

  const comment = {
    id:     generateId(),
    author: state.session.name,
    role:   state.session.role,
    text:   text.trim(),
    time:   getTimestamp(),
  };

  ticket.comments.push(comment);
  saveTickets();

  renderComments(ticket.comments);
  
  const elCommentText = document.getElementById('comment-text');
  if (elCommentText) elCommentText.value = '';
  
  // Atualiza a listagem em background para refletir o contador de comentários da linha
  renderTickets(); 
  showToast('💬 Comentário adicionado!', 'success');
}


/* Render */

function renderTickets() {
  const emptyState   = document.getElementById('empty-state');
  const tableWrapper = document.getElementById('table-wrapper');
  const tbody        = document.getElementById('ticket-list');

  if (!tbody) return;

  const visible = state.tickets.filter(t =>
    state.filterStatus === 'todos' || t.status === state.filterStatus
  );

  if (visible.length === 0) {
    if (emptyState) emptyState.hidden = false;
    if (tableWrapper) tableWrapper.hidden = true;
    tbody.innerHTML = '';
    return;
  }

  if (emptyState) emptyState.hidden = true;
  if (tableWrapper) tableWrapper.hidden = false;
  tbody.innerHTML = visible.map(renderRow).join('');
}

function renderRow(ticket) {
  const prio   = PRIORITY_MAP[ticket.priority] || { label: 'N/A', cls: 'low', icon: '⚪' };
  const status = STATUS_MAP[ticket.status]     || { label: 'N/A', cls: 'open', rowCls: '' };

  let actionBtns = '';

  if (isSupport()) {
    if (ticket.status === 'aberto') {
      actionBtns += `<button class="btn btn--xs btn--progress" onclick="updateStatus('${ticket.id}','andamento')" title="Mover para Em Andamento">⚙️ Andamento</button>`;
    } else if (ticket.status === 'andamento') {
      actionBtns += `<button class="btn btn--xs btn--done" onclick="updateStatus('${ticket.id}','concluido')" title="Marcar como Concluído">✅ Concluir</button>`;
    }
    actionBtns += `<button class="btn btn--xs btn--danger" onclick="deleteTicket('${ticket.id}')" title="Excluir">🗑️</button>`;
  }

  actionBtns += `<button class="btn btn--xs btn--detail" onclick="openModal('${ticket.id}')" title="Ver detalhes">🔍 Detalhes</button>`;

  const commentsCount = Array.isArray(ticket.comments) ? ticket.comments.length : 0;

  const techLine = ticket.techResponse
    ? `<div class="ticket-tech-response">🔧 ${escapeHtml(ticket.techResponse.text)}</div>`
    : '';

  return `
    <tr class="${status.rowCls}" data-id="${ticket.id}">
      <td class="ticket-id">#${ticket.id.split('-')[1] || ticket.id}</td>
      <td>
        <span class="ticket-user">${escapeHtml(ticket.user)}</span><br/>
        <span class="ticket-sector">${escapeHtml(ticket.sector)}</span>
      </td>
      <td class="ticket-subject">
        ${escapeHtml(ticket.subject)}
        ${commentsCount > 0 ? `<span class="badge badge--open" style="margin-left:.25rem">💬 ${commentsCount}</span>` : ''}
        ${techLine}
      </td>
      <td><span class="badge badge--${prio.cls}">${prio.icon} ${prio.label}</span></td>
      <td><span class="badge badge--${status.cls}">${status.label}</span></td>
      <td class="ticket-date">${ticket.createdAt}</td>
      <td><div class="ticket-actions">${actionBtns}</div></td>
    </tr>`;
}

function updateDashboard() {
  const elOpen = document.getElementById('count-open');
  const elProgress = document.getElementById('count-progress');
  const elDone = document.getElementById('count-done');

  if (elOpen) elOpen.textContent = state.tickets.filter(t => t.status === 'aberto').length;
  if (elProgress) elProgress.textContent = state.tickets.filter(t => t.status === 'andamento').length;
  if (elDone) elDone.textContent = state.tickets.filter(t => t.status === 'concluido').length;
}

function renderModalDetails(ticket) {
  const prio   = PRIORITY_MAP[ticket.priority] || { label: 'N/A', cls: 'low', icon: '⚪' };
  const status = STATUS_MAP[ticket.status]     || { label: 'N/A', cls: 'open', rowCls: '' };

  const modalGrid = document.getElementById('modal-detail-grid');
  if (modalGrid) {
    modalGrid.innerHTML = `
      <div class="detail-item">
        <span class="detail-item__label">Usuário</span>
        <span class="detail-item__value">${escapeHtml(ticket.user)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-item__label">Setor</span>
        <span class="detail-item__value">${escapeHtml(ticket.sector)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-item__label">Prioridade</span>
        <span class="detail-item__value"><span class="badge badge--${prio.cls}">${prio.icon} ${prio.label}</span></span>
      </div>
      <div class="detail-item">
        <span class="detail-item__label">Status Atual</span>
        <span class="detail-item__value"><span class="badge badge--${status.cls}">${status.label}</span></span>
      </div>
      <div class="detail-item">
        <span class="detail-item__label">Aberto em</span>
        <span class="detail-item__value">${ticket.createdAt}</span>
      </div>
      <div class="detail-item">
        <span class="detail-item__label">ID do Chamado</span>
        <span class="detail-item__value">#${ticket.id.split('-')[1] || ticket.id}</span>
      </div>`;
  }

  const modalDesc = document.getElementById('modal-description');
  const modalTitle = document.getElementById('modal-title');
  
  if (modalDesc) modalDesc.textContent = ticket.description;
  if (modalTitle) modalTitle.textContent = `🎫 ${ticket.subject}`;

  const techSection = document.getElementById('tech-response-section');
  const techText    = document.getElementById('modal-tech-response');

  if (techSection && techText) {
    if (ticket.techResponse) {
      techText.textContent = `${ticket.techResponse.text} — ${ticket.techResponse.author}, ${ticket.techResponse.time}`;
      techSection.hidden = false;
    } else {
      techSection.hidden = true;
    }
  }
}

function renderComments(comments) {
  const container = document.getElementById('modal-comments');
  if (!container) return;

  if (!comments || comments.length === 0) {
    container.innerHTML = '<p class="comments__empty" id="comments-empty">Nenhum comentário ainda.</p>';
    return;
  }

  container.innerHTML = comments.map(c => `
    <div class="comment comment--${c.role}">
      <div class="comment__header">
        <span>
          <span class="comment__author">${escapeHtml(c.author)}</span>
          <span class="comment__role">(${c.role === 'suporte' ? '🛠️ Suporte' : '👤 Usuário'})</span>
        </span>
        <span class="comment__time">${c.time}</span>
      </div>
      <p class="comment__text">${escapeHtml(c.text)}</p>
    </div>`).join('');
}


/* Modal */

function closeModal() {
  state.activeTicketId = null;
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.remove('is-visible');
  
  const commentText = document.getElementById('comment-text');
  if (commentText) commentText.value = '';
  document.body.style.overflow = '';
}


/* Formulário */

function getFormValues() {
  return {
    userName:    document.getElementById('user-name')?.value || '',
    sector:      document.getElementById('sector')?.value || '',
    subject:     document.getElementById('subject')?.value || '',
    description: document.getElementById('description')?.value || '',
    priority:    document.getElementById('priority')?.value || '',
  };
}

function clearForm() {
  ['user-name', 'sector', 'subject', 'description', 'priority'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = (id === 'user-name' && !isSupport()) ? (state.session?.name || '') : '';
    el.classList.remove('form__input--error', 'form__select--error', 'form__textarea--error');
  });
}

function validateForm(fields) {
  const rules = [
    { field: 'user-name',   value: fields.userName,    cls: 'form__input--error' },
    { field: 'sector',      value: fields.sector,      cls: 'form__input--error' },
    { field: 'subject',     value: fields.subject,     cls: 'form__input--error' },
    { field: 'description', value: fields.description, cls: 'form__textarea--error' },
    { field: 'priority',    value: fields.priority,    cls: 'form__select--error' },
  ];
  let isValid = true;
  rules.forEach(({ field, value, cls }) => {
    const el = document.getElementById(field);
    if (!el) return;
    if (!value || !value.trim()) { el.classList.add(cls); isValid = false; }
    else { el.classList.remove(cls); }
  });
  return isValid;
}


/* UI */

let toastTimeout;
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  clearTimeout(toastTimeout); // Reseta transições sobrepostas se clicar muito rápido
  toast.textContent = message;
  toast.className   = `toast toast--${type}`;
  void toast.offsetHeight;
  toast.classList.add('toast--visible');
  toastTimeout = setTimeout(() => toast.classList.remove('toast--visible'), 3000);
}

function applyFilter(status) {
  state.filterStatus = status;
  renderTickets();
}

function renderHeaderDate() {
  const el = document.getElementById('header-date');
  if (el) el.textContent = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
}


/* Eventos */

function bindEvents() {
  // Troca de aba no login
  document.querySelectorAll('.role-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.role-tab').forEach(t => {
        t.classList.remove('role-tab--active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('role-tab--active');
      tab.setAttribute('aria-selected', 'true');

      ['panel-user', 'panel-support'].forEach(id => {
        document.getElementById(id)?.classList.add('login-panel--hidden');
      });
      
      const controlsId = tab.getAttribute('aria-controls');
      if (controlsId) {
        document.getElementById(controlsId)?.classList.remove('login-panel--hidden');
      }
    });
  });

  document.getElementById('btn-login-user')?.addEventListener('click', () => {
    const input = document.getElementById('login-user-name');
    if (input) login(input.value, 'usuario');
  });

  document.getElementById('btn-login-support')?.addEventListener('click', () => {
    const input = document.getElementById('login-sup-name');
    if (input) login(input.value, 'suporte');
  });

  document.getElementById('login-user-pass')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-login-user')?.click();
  });
  document.getElementById('login-sup-pass')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-login-support')?.click();
  });

  document.getElementById('btn-logout')?.addEventListener('click', logout);

  document.getElementById('btn-submit')?.addEventListener('click', () => {
    const fields = getFormValues();
    if (!validateForm(fields)) {
      showToast('⚠️ Preencha todos os campos obrigatórios.', 'danger');
      return;
    }
    addTicket(fields);
    clearForm();
  });

  document.getElementById('btn-clear')?.addEventListener('click', clearForm);

  ['user-name', 'sector', 'subject', 'description'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', function () {
      this.classList.remove('form__input--error', 'form__textarea--error');
    });
  });
  document.getElementById('priority')?.addEventListener('change', function () {
    this.classList.remove('form__select--error');
  });

  document.getElementById('filter-status')?.addEventListener('change', e => {
    applyFilter(e.target.value);
  });

  document.getElementById('modal-close')?.addEventListener('click', closeModal);

  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  document.getElementById('btn-add-comment')?.addEventListener('click', () => {
    const input = document.getElementById('comment-text');
    if (input) addComment(input.value);
  });

  document.getElementById('comment-text')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Evita quebra de linha indesejada se enviar com o Enter puro
      document.getElementById('btn-add-comment')?.click();
    }
  });
}


/* Init */

function migrateTickets(tickets) {
  return tickets.map(t => ({
    comments:     [],
    techResponse: null,
    ...t,
  }));
}

function init() {
  state.tickets = migrateTickets(loadTickets());
  bindEvents();
  renderHeaderDate();

  const savedSession = loadSession();
  if (savedSession) {
    login(savedSession.name, savedSession.role);
  }
}

document.addEventListener('DOMContentLoaded', init);