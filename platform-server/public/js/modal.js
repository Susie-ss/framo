// modal.js — 统一弹窗组件（所有弹窗都通过这里创建）
//
// 用法：
//   Modal.show({ title:'编辑', body:'<div>...</div>', buttons:[...], width:440 })
//   Modal.show({ title:'确认', subtitle:'副标题', body:'...', footer:'<button>自定义</button>' })
//   Modal.hide('my-modal-id')

var Modal = (function() {
  var _stack = [];

  function _buildHeading(title, subtitle) {
    if (!title) return '';
    return '<div class="modal-header">' +
      '<div>' +
        '<div style="font-size:15px;font-weight:600">' + title + '</div>' +
        (subtitle ? '<div style="font-size:12px;color:var(--text-muted);margin-top:2px">' + subtitle + '</div>' : '') +
      '</div>' +
      '<button class="modal-close-btn" onclick="Modal.hide()"><svg class="iconpark iconpark-lg"><use href="/libs/iconpark/sprite.svg#close"/></svg></button>' +
    '</div>';
  }

  function show(opts) {
    opts = opts || {};
    var title = opts.title || '';
    var subtitle = opts.subtitle || '';
    var body = opts.body || '';
    var footer = opts.footer || '';
    var width = opts.width || 440;
    var buttons = opts.buttons || [];
    var id = opts.id || ('modal-' + Date.now());
    var onClose = opts.onClose;

    // Remove existing same-id modal
    var existing = document.getElementById(id);
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = id;
    _stack.push(overlay);

    // Buttons
    var btnHTML = buttons.map(function(b) {
      return '<button class="' + (b.cls || 'btn btn-ghost') + '" data-modal-btn="' + b.text.replace(/"/g,'') + '">' + b.text + '</button>';
    }).join('');

    var footerHTML = '';
    if (btnHTML) {
      footerHTML = '<div class="modal-actions">' + btnHTML + '</div>';
    } else if (footer) {
      footerHTML = footer;
    }

    overlay.innerHTML =
      '<div class="modal" style="width:' + width + 'px;max-height:85vh;overflow-y:auto" onclick="event.stopPropagation()">' +
        _buildHeading(title, subtitle) +
        (body ? '<div class="modal-body">' + body + '</div>' : '') +
        (footerHTML ? '<div style="padding:0 24px 20px">' + footerHTML + '</div>' : '') +
      '</div>';

    document.body.appendChild(overlay);

    // Button events
    buttons.forEach(function(b) {
      var el = overlay.querySelector('[data-modal-btn="' + b.text.replace(/"/g,'') + '"]');
      if (el && b.onClick) {
        el.addEventListener('click', async function() {
          await b.onClick(overlay);
        });
      }
    });

    // Overlay click closes
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        _remove(overlay, onClose);
      }
    });

    return overlay;
  }

  function _remove(overlay, onClose) {
    if (onClose) onClose();
    overlay.remove();
    _stack = _stack.filter(function(o) { return o !== overlay; });
  }

  function hide(id) {
    if (id) {
      var el = document.getElementById(id);
      if (el) el.remove();
      return;
    }
    // Hide topmost modal
    var top = _stack.pop();
    if (top) top.remove();
  }

  // Alias for legacy openModal compatibility
  function legacyOpenModal(title, bodyHTML, buttons, opts) {
    opts = opts || {};
    return show({
      title: title,
      body: bodyHTML,
      buttons: buttons,
      width: opts.width || 440,
      id: opts.id,
      onClose: opts.onClose
    });
  }

  return { show: show, hide: hide, legacyOpenModal: legacyOpenModal };
})();

window.Modal = Modal;
// Keep legacy openModal working
window.openModal = Modal.legacyOpenModal;
