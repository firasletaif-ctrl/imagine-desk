/* ═══════════════════════════════════════════════════════════════════
   Imagine Self Check-in — page publique d'un congrès.
   Aucune donnée personnelle n'est stockée dans le navigateur : le nom saisi
   part directement au serveur, qui répond par un simple accusé d'arrivée.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var RESET_DELAY = 12000;      // retour à l'écran d'accueil (borne)
  var card = document.getElementById('selfCard');
  var shell = document.getElementById('selfShell');
  var clock = document.getElementById('selfClock');
  var token = (function () {
    var match = String(location.pathname || '').match(/\/self\/([A-Za-z0-9._-]+)/);
    return match ? match[1] : '';
  })();
  var state = {
    event: null,
    counts: { total: 0, arrived: 0 },
    open: true,
    busy: false,
    timer: null,
    attempts: 0
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function dateLabel(value) {
    if (!value) return '';
    var date = new Date(String(value).length <= 10 ? value + 'T09:00:00' : value);
    if (isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('fr-TN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(date);
  }

  function timeLabel(value) {
    var date = value ? new Date(value) : new Date();
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('fr-TN', { hour: '2-digit', minute: '2-digit' }).format(date);
  }

  function tickClock() {
    if (!clock) return;
    clock.textContent = timeLabel(new Date().toISOString());
  }

  function progressHtml() {
    var total = state.counts.total || 0;
    var arrived = state.counts.arrived || 0;
    if (!total) return '';
    var percent = Math.min(100, Math.round(arrived / total * 100));
    return '' +
      '<div class="self-progress">' +
        '<div class="self-progress-label"><span>' + arrived + ' arrivée' + (arrived === 1 ? '' : 's') + '</span><span>' + total + ' inscrit' + (total === 1 ? '' : 's') + '</span></div>' +
        '<div class="self-progress-bar"><i style="width:' + percent + '%"></i></div>' +
      '</div>';
  }

  function renderWelcome(message) {
    clearTimeout(state.timer);
    if (!state.event) return renderProblem('Ce lien de check-in n’est plus actif.', 'Demandez le lien à l’organisateur du congrès.');
    if (!state.open) {
      return renderProblem('Le check-in en ligne est fermé.', 'Adressez-vous directement à l’accueil du congrès : nous vous enregistrons sur place.');
    }
    card.innerHTML = '' +
      '<div class="self-event">' +
        '<h1>' + escapeHtml(state.event.name) + '</h1>' +
        '<p class="self-meta">' + escapeHtml(dateLabel(state.event.date) || 'Date à confirmer') + (state.event.venue ? ' · ' + escapeHtml(state.event.venue) : '') + '</p>' +
      '</div>' +
      (message ? '<div class="self-notice" role="status">' + message + '</div>' : '') +
      '<form class="self-form" id="selfForm" novalidate>' +
        '<label class="self-label" for="selfQuery">Votre code badge ou votre e-mail d’inscription</label>' +
        '<input class="self-input" id="selfQuery" name="query" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="180" placeholder="IE-1001" required>' +
        '<button class="self-submit" id="selfSubmit" type="submit">Je confirme mon arrivée</button>' +
        '<p class="self-help">Le code se trouve sur votre badge ou dans votre e-mail de confirmation. En cas de difficulté, l’accueil vous enregistre sur place.</p>' +
      '</form>' +
      progressHtml();
    var input = document.getElementById('selfQuery');
    if (input) setTimeout(function () { try { input.focus(); } catch (error) {} }, 60);
  }

  function renderProblem(title, detail) {
    clearTimeout(state.timer);
    card.innerHTML = '' +
      '<div class="self-state self-error" role="alert">' +
        '<span class="self-state-icon">!</span>' +
        '<h1>' + escapeHtml(title) + '</h1>' +
        '<p>' + escapeHtml(detail || '') + '</p>' +
      '</div>';
  }

  function renderSuccess(payload) {
    clearTimeout(state.timer);
    var person = payload.participant || {};
    state.counts = payload.counts || state.counts;
    var already = !!payload.already;
    card.innerHTML = '' +
      '<div class="self-state ' + (already ? 'self-already' : 'self-success') + '" role="status">' +
        '<span class="self-state-icon">' + (already ? '✓' : '✓') + '</span>' +
        '<p class="self-state-kicker">' + (already ? 'Arrivée déjà enregistrée' : 'Bienvenue !') + '</p>' +
        '<h1>' + escapeHtml(person.name) + '</h1>' +
        (person.company ? '<p class="self-company">' + escapeHtml(person.company) + '</p>' : '') +
        '<p class="self-state-time">' + (already ? 'Enregistré à ' : 'Arrivée confirmée à ') + '<strong>' + escapeHtml(timeLabel(person.checkedInAt)) + '</strong></p>' +
        '<p class="self-state-hint">Présentez cette confirmation à l’accueil pour retirer votre badge.</p>' +
      '</div>' +
      progressHtml() +
      '<button class="self-next" id="selfNext" type="button">Personne suivante</button>' +
      '<p class="self-restart">Retour automatique à l’accueil dans quelques secondes…</p>';
    state.timer = setTimeout(function () { renderWelcome(''); }, RESET_DELAY);
  }

  function renderLoading() {
    card.innerHTML = '<p class="self-kicker">Chargement du check-in…</p>';
  }

  function renderOffline(message) {
    renderProblem('Connexion au serveur impossible.', message || 'Vérifiez votre réseau puis réessayez. L’accueil peut vous enregistrer directement.');
  }

  function load() {
    if (!token) {
      renderProblem('Lien incomplet.', 'Scannez le QR code affiché à l’entrée du congrès, ou demandez le lien à l’accueil.');
      return;
    }
    renderLoading();
    fetch('/api/self/' + encodeURIComponent(token), { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          if (!response.ok) throw new Error(data.error || 'Ce lien de check-in n’est plus actif.');
          return data;
        });
      })
      .then(function (data) {
        state.event = data.event;
        state.counts = data.counts || { total: 0, arrived: 0 };
        state.open = data.open !== false;
        document.title = 'Check-in · ' + (data.event && data.event.name ? data.event.name : 'Imagine Events');
        renderWelcome('');
      })
      .catch(function (error) {
        renderProblem(error.message || 'Ce lien de check-in n’est plus actif.',
          'Vérifiez le lien, ou adressez-vous directement à l’accueil du congrès.');
      });
  }

  function submit(event) {
    event.preventDefault();
    if (state.busy) return;
    var input = document.getElementById('selfQuery');
    var query = input ? String(input.value || '').trim() : '';
    if (query.length < 3) {
      if (input) { input.classList.add('self-input-error'); try { input.focus(); } catch (error) {} }
      return;
    }
    if (input) input.classList.remove('self-input-error');
    state.busy = true;
    var button = document.getElementById('selfSubmit');
    if (button) { button.disabled = true; button.textContent = 'Enregistrement…'; }
    shell.setAttribute('data-busy', '1');
    fetch('/api/self/' + encodeURIComponent(token) + '/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: query })
    })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          return { ok: response.ok, status: response.status, data: data };
        });
      })
      .then(function (result) {
        if (result.ok && result.data && result.data.participant) {
          renderSuccess(result.data);
          return;
        }
        if (result.status === 429) {
          renderWelcome('<strong>Trop de tentatives.</strong> Patientez une minute, ou passez à l’accueil.');
          return;
        }
        var message = (result.data && result.data.error) || 'Inscription introuvable.';
        renderWelcome('<strong>' + escapeHtml(message) + '</strong> Vérifiez le code (lettres et chiffres) puis réessayez.');
      })
      .catch(function () {
        renderOffline('Le réseau a été interrompu pendant l’enregistrement. Vérifiez votre connexion puis réessayez.');
      })
      .finally(function () {
        state.busy = false;
        state.attempts += 1;
        shell.removeAttribute('data-busy');
        var buttonAgain = document.getElementById('selfSubmit');
        if (buttonAgain) { buttonAgain.disabled = false; buttonAgain.textContent = 'Je confirme mon arrivée'; }
      });
  }

  document.addEventListener('submit', function (event) {
    if (event.target && event.target.id === 'selfForm') submit(event);
  });

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target) return;
    if (target.id === 'selfRetry') load();
    if (target.id === 'selfNext') renderWelcome('');
  });

  // Entrée sans formulaire actif (borne avec lecteur code-barres).
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && state.event && !state.busy) renderWelcome('');
  });

  window.addEventListener('online', function () { if (!state.event) load(); });

  tickClock();
  setInterval(tickClock, 20000);
  load();
  setInterval(function () {
    // Mise à jour discrète du compteur, sans interrompre la saisie en cours.
    if (!token || !state.event || state.busy) return;
    if (document.getElementById('selfQuery')) {
      fetch('/api/self/' + encodeURIComponent(token), { headers: { Accept: 'application/json' }, cache: 'no-store' })
        .then(function (response) { return response.ok ? response.json() : null; })
        .then(function (data) {
          if (!data || !data.counts) return;
          state.counts = data.counts;
          var bar = card.querySelector('.self-progress');
          if (bar) bar.outerHTML = progressHtml();
        })
        .catch(function () {});
    }
  }, 45000);
})();
