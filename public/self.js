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
    attempts: 0,
    // Prise en charge : organisation reconnue, choisie ou corrigée.
    care: null,
    participantId: '',
    person: null,
    already: false,
    careOpen: false,
    careSkipped: false,
    careError: ''
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
    state.care = null; state.participantId = ''; state.person = null; state.already = false;
    state.careOpen = false; state.careSkipped = false; state.careError = '';
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
        '<p class="self-help">Le code se trouve sur votre badge ou dans votre e-mail de confirmation. Nous vous indiquons ensuite <strong>où aller</strong> et <strong>qui vous prend en charge</strong>. En cas de difficulté, l’accueil vous enregistre sur place.</p>' +
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

  function careNeedsAction() {
    if (!state.care) return false;
    if (state.careOpen) return true;
    var org = state.care.org;
    if (org) return !state.care.confirmed;
    return !state.careSkipped && (state.care.choices || []).length > 0;
  }

  function careCardHtml(org, confirmed) {
    return '' +
      '<div class="self-care ' + (confirmed ? 'self-care-confirmed' : 'self-care-suggested') + '">' +
        '<p class="self-care-kicker">' + (confirmed ? 'Votre prise en charge' : 'Organisation reconnue') + '</p>' +
        '<h2 class="self-care-name">' + escapeHtml(org.name) + '</h2>' +
        (org.desk ? '<p class="self-care-line self-care-desk"><span>Où aller</span><strong>' + escapeHtml(org.desk) + '</strong></p>' : '') +
        (org.host ? '<p class="self-care-line"><span>Qui vous prend en charge</span><strong>' + escapeHtml(org.host) + '</strong></p>' : '') +
        (org.contact ? '<p class="self-care-line"><span>Contact sur place</span><strong>' + escapeHtml(org.contact) + '</strong></p>' : '') +
        (org.message ? '<p class="self-care-message">' + escapeHtml(org.message) + '</p>' : '') +
        (confirmed
          ? '<button class="self-care-change" type="button" data-self-care-change="1">Ce n’est pas mon organisation</button>'
          : '<div class="self-care-actions">' +
              '<button class="self-care-yes" type="button" data-self-care-pick="' + escapeHtml(org.name) + '">Oui, c’est mon organisation</button>' +
              '<button class="self-care-change" type="button" data-self-care-change="1">Choisir une autre</button>' +
            '</div>') +
      '</div>';
  }

  function careHtml() {
    var care = state.care;
    if (!care) return '';
    var error = state.careError ? '<p class="self-care-error" role="alert">' + escapeHtml(state.careError) + '</p>' : '';
    var org = care.org;
    var choices = care.choices || [];
    var suggestions = care.suggestions || [];
    if (state.careOpen || (!org && !state.careSkipped && choices.length)) {
      if (!state.careOpen && suggestions.length) {
        return '' +
          '<div class="self-care self-care-pick">' +
            '<p class="self-care-kicker">Prise en charge</p>' +
            '<h2>Qui vous accueille ?</h2>' +
            '<p class="self-care-help">Indiquez l’organisation qui vous prend en charge : nous vous dirons où aller.</p>' +
            '<div class="self-care-suggests">' +
              suggestions.map(function (item) {
                return '<button type="button" data-self-care-pick="' + escapeHtml(item.name) + '">' + escapeHtml(item.name) + '</button>';
              }).join('') +
            '</div>' +
            '<button class="self-care-more" type="button" data-self-care-open="1">Aucune ne correspond — voir toutes les organisations</button>' +
            '<button class="self-care-change" type="button" data-self-care-skip="1">Je ne sais pas : accueil général</button>' +
            error +
          '</div>';
      }
      return '' +
        '<div class="self-care self-care-pick">' +
          '<p class="self-care-kicker">Prise en charge</p>' +
          '<h2>Choisissez votre organisation</h2>' +
          '<p class="self-care-help">Touchez le nom de l’organisation qui vous prend en charge.</p>' +
          '<div class="self-care-grid">' +
            choices.map(function (item) {
              return '<button type="button" data-self-care-pick="' + escapeHtml(item.name) + '">' +
                '<strong>' + escapeHtml(item.name) + '</strong>' +
                (item.desk ? '<small>' + escapeHtml(item.desk) + '</small>' : '') +
              '</button>';
            }).join('') +
          '</div>' +
          '<button class="self-care-change" type="button" data-self-care-skip="1">Je ne sais pas : accueil général</button>' +
          error +
        '</div>';
    }
    if (org) return careCardHtml(org, !!care.confirmed) + error;
    if (state.careSkipped) {
      return '' +
        '<div class="self-care self-care-general">' +
          '<p class="self-care-kicker">Prise en charge</p>' +
          '<h2>Accueil général</h2>' +
          '<p class="self-care-help">Présentez-vous à l’accueil du congrès avec cette confirmation : l’équipe vous orientera vers la bonne organisation.</p>' +
          '<button class="self-care-change" type="button" data-self-care-change="1">Choisir une organisation</button>' +
        '</div>';
    }
    return '';
  }

  function renderSuccess(payload) {
    clearTimeout(state.timer);
    payload = payload || {};
    if (payload.participant) state.person = payload.participant;
    if (payload.participantId) state.participantId = payload.participantId;
    if (payload.care !== undefined) state.care = payload.care;
    if (payload.counts) state.counts = payload.counts;
    if (payload.already !== undefined) state.already = !!payload.already;
    var person = state.person || {};
    var already = state.already;
    card.innerHTML = '' +
      '<div class="self-state ' + (already ? 'self-already' : 'self-success') + '" role="status">' +
        '<span class="self-state-icon">✓</span>' +
        '<p class="self-state-kicker">' + (already ? 'Arrivée déjà enregistrée' : 'Bienvenue !') + '</p>' +
        '<h1>' + escapeHtml(person.name) + '</h1>' +
        (person.company ? '<p class="self-company">' + escapeHtml(person.company) + '</p>' : '') +
        '<p class="self-state-time">' + (already ? 'Enregistré à ' : 'Arrivée confirmée à ') + '<strong>' + escapeHtml(timeLabel(person.checkedInAt)) + '</strong></p>' +
        '<p class="self-state-hint">Présentez cette confirmation à l’accueil pour retirer votre badge.</p>' +
      '</div>' +
      careHtml() +
      progressHtml() +
      '<button class="self-next" id="selfNext" type="button">Personne suivante</button>' +
      (careNeedsAction()
        ? '<p class="self-restart">Choisissez votre organisation, ou appuyez sur « Personne suivante ».</p>'
        : '<p class="self-restart">Retour automatique à l’accueil dans quelques secondes…</p>');
    if (!careNeedsAction()) state.timer = setTimeout(function () { renderWelcome(''); }, RESET_DELAY);
  }

  function chooseOrg(orgName) {
    if (state.busy || !state.participantId) return;
    state.busy = true;
    state.careError = '';
    var buttons = card.querySelectorAll('[data-self-care-pick]');
    for (var i = 0; i < buttons.length; i++) buttons[i].disabled = true;
    fetch('/api/self/' + encodeURIComponent(token) + '/care', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ participantId: state.participantId, org: String(orgName || '') })
    })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok && result.data && result.data.care) {
          state.care = result.data.care;
          if (result.data.participant) state.person = result.data.participant;
          state.careOpen = false;
          state.careSkipped = false;
          state.careError = '';
          renderSuccess({});
          return;
        }
        state.careError = (result.data && result.data.error) || 'Organisation non reconnue : choisissez dans la liste.';
        renderSuccess({});
      })
      .catch(function () {
        state.careError = 'Réseau interrompu : réessayez, ou présentez-vous à l’accueil.';
        renderSuccess({});
      })
      .finally(function () {
        state.busy = false;
        shell.removeAttribute('data-busy');
      });
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
    if (!target || !target.closest) return;
    if (target.id === 'selfRetry') load();
    if (target.id === 'selfNext') renderWelcome('');
    var pick = target.closest('[data-self-care-pick]');
    if (pick) { chooseOrg(pick.getAttribute('data-self-care-pick')); return; }
    if (target.closest('[data-self-care-open]')) { state.careOpen = true; state.careError = ''; renderSuccess({}); return; }
    if (target.closest('[data-self-care-skip]')) { state.careSkipped = true; state.careOpen = false; state.careError = ''; renderSuccess({}); return; }
    if (target.closest('[data-self-care-change]')) { state.careOpen = true; state.careSkipped = false; state.careError = ''; renderSuccess({}); return; }
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
    // Mise à jour discrète du compteur : jamais pendant une saisie, ni sur
    // l’écran de prise en charge affiché après un check-in.
    if (!token || !state.event || state.busy || state.care) return;
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
