(function () {
    'use strict';

    // ── Урезанная версия Lampa Movie Enhancer ───────────────────────────────
    // Оставлена только функция «Все кнопки в карточке» + редактор кнопок.
    // Кнопка реакций (эмодзи) скрывается из ряда. Сетевых обращений нет.

    function main$8() {
      Lampa.Lang.add({
        lme_title: {
          ru: "Movie Enhancer",
          en: "Movie Enhancer"
        },
        lme_showbutton_desc: {
          ru: "Выводит все кнопки действий в карточке",
          en: "Show all action button in card"
        },
        lme_showbutton_name: {
          ru: "Все кнопки в карточке",
          en: "All buttons in card"
        },
        lme_showbuttonwn_desc: {
          ru: "Показывать только иконки",
          en: "Show only icon"
        },
        lme_showbuttonwn_name: {
          ru: "Скрыть текст",
          en: "Hide text"
        },
        lme_button_editor_name: {
          ru: "Редактировать кнопки",
          en: "Edit buttons"
        },
        lme_button_editor_desc: {
          ru: "Сортировка и скрытие кнопок карточки",
          en: "Reorder and hide card buttons"
        },
        lme_fastbook_name: {
          ru: "Закладка одним нажатием",
          en: "One-tap bookmark"
        },
        lme_fastbook_desc: {
          ru: "Кнопка закладки сразу добавляет/убирает из закладок, без меню",
          en: "Bookmark button adds/removes the bookmark directly, without the menu"
        }
      });
    }
    var Lang = {
      main: main$8
    };

    var STYLE_ID = 'lme-button-style';
    var ORDER_KEY = 'lme_buttonsort';
    var HIDE_KEY = 'lme_buttonhide';
    var lastFullContainer = null;
    var lastStartInstance = null;
    var FALLBACK_TITLES = {
      'button--play': function buttonPlay() {
        return Lampa.Lang.translate('title_watch');
      },
      'button--book': function buttonBook() {
        return Lampa.Lang.translate('settings_input_links');
      },
      'button--reaction': function buttonReaction() {
        return Lampa.Lang.translate('title_reactions');
      },
      'button--subscribe': function buttonSubscribe() {
        return Lampa.Lang.translate('title_subscribe');
      },
      'button--options': function buttonOptions() {
        return Lampa.Lang.translate('more');
      },
      'view--torrent': function viewTorrent() {
        return Lampa.Lang.translate('full_torrents');
      },
      'view--trailer': function viewTrailer() {
        return Lampa.Lang.translate('full_trailers');
      }
    };
    function ensureStyles() {
      if (document.getElementById(STYLE_ID)) return;
      var style = "\n        .lme-buttons {\n            display: flex;\n            flex-wrap: wrap;\n            gap: 10px;\n        }\n        .lme-button-hide {\n            display: none !important;\n        }\n        .lme-button-text-hidden span {\n            display: none;\n        }\n        .full-start-new__buttons.lme-button-text-hidden .full-start__button span {\n            display: none !important;\n        }\n    ";
      $('head').append("<style id=\"".concat(STYLE_ID, "\">").concat(style, "</style>"));
    }
    function readArray(key) {
      var value = Lampa.Storage.get(key);
      if (Array.isArray(value)) return value.slice();
      if (typeof value === 'string') {
        try {
          var parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          return value.split(',').map(function (v) {
            return v.trim();
          }).filter(Boolean);
        }
      }
      return [];
    }
    function getFullContainer(e) {
      if (e && e.body) return e.body;
      if (e && e.link && e.link.html) return e.link.html;
      if (e && e.object && e.object.activity && typeof e.object.activity.render === 'function') return e.object.activity.render();
      return null;
    }
    function resolveActiveFullContainer() {
      var current = $('.full-start-new').first();
      if (current.length) return current;
      return null;
    }
    function getButtonId($button) {
      function findIdClass($el) {
        var className = ($el.attr('class') || '').split(/\s+/);
        return className.find(function (c) {
          return c.startsWith('button--') && c !== 'button--priority';
        }) || className.find(function (c) {
          return c.startsWith('view--');
        });
      }
      var idClass = findIdClass($button);
      if (!idClass) {
        $button.find('[class*="button--"], [class*="view--"]').each(function () {
          var found = findIdClass($(this));
          if (found && !idClass) idClass = found;
        });
      }
      if (idClass) return idClass;
      var dataId = $button.data('id') || $button.data('name') || $button.data('action') || $button.data('type') || $button.attr('data-name') || $button.attr('data-action');
      if (dataId) return "data:".concat(dataId);
      var title = $button.text().trim();
      if (title) return "text:".concat(title);
      return "html:".concat(Lampa.Utils.hash($button.clone().removeClass('focus').prop('outerHTML')));
    }
    function getButtonTitle(id, $button) {
      var label = $button.find('span').first().text().trim() || $button.text().trim();
      if (label) return label;
      var titled = $button.attr('aria-label') || $button.attr('title') || $button.data('title');
      if (titled) return titled;
      if (FALLBACK_TITLES[id]) return FALLBACK_TITLES[id]();
      return id;
    }
    function collectButtonNodes($container) {
      var results = [];
      var seen = new Set();
      function push(el) {
        if (el && !seen.has(el)) {
          seen.add(el);
          results.push(el);
        }
      }
      $container.find('.full-start__button, .full-start-new__button').each(function () {
        push(this);
      });
      $container.find('[class*="button--"], [class*="view--"]').each(function () {
        var $el = $(this);
        var closest = $el.closest('.full-start__button, .full-start-new__button, .selector, button, [role="button"]');
        push(closest.length ? closest[0] : this);
      });
      if (!results.length) {
        $container.find('.selector, button, [role="button"]').each(function () {
          var $el = $(this);
          if ($el.find('.selector').length) return;
          push(this);
        });
      }
      return $(results);
    }
    function scanButtons(fullContainer, detach, includePriority) {
      var targetContainer = fullContainer.find('.full-start-new__buttons');
      var extraContainer = fullContainer.find('.buttons--container');
      var items = [];
      var map = {};
      function makeUniqueId(id, $btn) {
        if (!map[id]) return id;
        var fingerprint = Lampa.Utils.hash($btn.clone().removeClass('focus').prop('outerHTML'));
        return "".concat(id, ":").concat(fingerprint);
      }
      function collect($buttons) {
        $buttons.each(function () {
          var $btn = $(this);
          if ($btn.hasClass('button--play')) return;
          if ($btn.hasClass('button--reaction')) return; // скрываем кнопку реакций (эмодзи)
          if (!includePriority && $btn.hasClass('button--priority')) return;
          var baseId = getButtonId($btn);
          var id = baseId ? makeUniqueId(baseId, $btn) : null;
          if (!id || map[id]) return;
          map[id] = detach ? $btn.detach() : $btn;
          items.push(id);
        });
      }
      collect(collectButtonNodes(targetContainer));
      collect(collectButtonNodes(extraContainer));
      return {
        items: items,
        map: map,
        targetContainer: targetContainer,
        extraContainer: extraContainer
      };
    }
    function normalizeOrder(order, ids) {
      var result = [];
      var known = new Set(ids);
      order.forEach(function (id) {
        if (known.has(id)) result.push(id);
      });
      ids.forEach(function (id) {
        if (!result.includes(id)) result.push(id);
      });
      return result;
    }
    function applyHidden(map) {
      var hidden = new Set(readArray(HIDE_KEY));
      Object.keys(map).forEach(function (id) {
        map[id].toggleClass('lme-button-hide', hidden.has(id));
      });
    }
    function applyLayout(fullContainer) {
      if (!fullContainer || !fullContainer.length) return;
      ensureStyles();
      // Скрываем блок реакций других пользователей (эмодзи) над рядом кнопок
      fullContainer.find('.full-start-new__reactions').addClass('lme-button-hide');
      var priority = fullContainer.find('.full-start-new__buttons .button--priority').detach();
      fullContainer.find('.full-start-new__buttons .button--play').remove();
      var _scanButtons = scanButtons(fullContainer, true, false),
        items = _scanButtons.items,
        map = _scanButtons.map,
        targetContainer = _scanButtons.targetContainer;
      var order = normalizeOrder(readArray(ORDER_KEY), items);
      targetContainer.empty();
      if (priority.length) targetContainer.append(priority);
      order.forEach(function (id) {
        if (map[id]) targetContainer.append(map[id]);
      });
      targetContainer.toggleClass('lme-button-text-hidden', Lampa.Storage.get('lme_showbuttonwn') == true);
      targetContainer.addClass('lme-buttons');
      applyHidden(map);
      Lampa.Controller.toggle("full_start");
      if (lastStartInstance && lastStartInstance.html && fullContainer[0] === lastStartInstance.html[0]) {
        var firstButton = targetContainer.find('.full-start__button.selector').not('.hide').not('.lme-button-hide').first();
        if (firstButton.length) lastStartInstance.last = firstButton[0];
      }
    }
    function openEditor(fullContainer) {
      if (!fullContainer || !fullContainer.length) return;
      var _scanButtons2 = scanButtons(fullContainer, false, true),
        items = _scanButtons2.items,
        map = _scanButtons2.map;
      var order = normalizeOrder(readArray(ORDER_KEY), items);
      var hidden = new Set(readArray(HIDE_KEY));
      var list = $('<div class="menu-edit-list"></div>');
      order.forEach(function (id) {
        var $btn = map[id];
        if (!$btn || !$btn.length) return;
        var title = getButtonTitle(id, $btn);
        var icon = $btn.find('svg').first().prop('outerHTML') || '';
        var item = $("<div class=\"menu-edit-list__item\" data-id=\"".concat(id, "\">\n            <div class=\"menu-edit-list__icon\"></div>\n            <div class=\"menu-edit-list__title\">").concat(title, "</div>\n            <div class=\"menu-edit-list__move move-up selector\">\n                <svg width=\"22\" height=\"14\" viewBox=\"0 0 22 14\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n                    <path d=\"M2 12L11 3L20 12\" stroke=\"currentColor\" stroke-width=\"4\" stroke-linecap=\"round\"/>\n                </svg>\n            </div>\n            <div class=\"menu-edit-list__move move-down selector\">\n                <svg width=\"22\" height=\"14\" viewBox=\"0 0 22 14\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n                    <path d=\"M2 2L11 11L20 2\" stroke=\"currentColor\" stroke-width=\"4\" stroke-linecap=\"round\"/>\n                </svg>\n            </div>\n            <div class=\"menu-edit-list__toggle toggle selector\">\n                <svg width=\"26\" height=\"26\" viewBox=\"0 0 26 26\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n                    <rect x=\"1.89111\" y=\"1.78369\" width=\"21.793\" height=\"21.793\" rx=\"3.5\" stroke=\"currentColor\" stroke-width=\"3\"/>\n                    <path d=\"M7.44873 12.9658L10.8179 16.3349L18.1269 9.02588\" stroke=\"currentColor\" stroke-width=\"3\" class=\"dot\" opacity=\"0\" stroke-linecap=\"round\"/>\n                </svg>\n            </div>\n        </div>"));
        if (icon) item.find('.menu-edit-list__icon').append(icon);
        item.toggleClass('lme-button-hidden', hidden.has(id));
        item.find('.dot').attr('opacity', hidden.has(id) ? 0 : 1);
        item.find('.move-up').on('hover:enter', function () {
          var prev = item.prev();
          if (prev.length) item.insertBefore(prev);
        });
        item.find('.move-down').on('hover:enter', function () {
          var next = item.next();
          if (next.length) item.insertAfter(next);
        });
        item.find('.toggle').on('hover:enter', function () {
          item.toggleClass('lme-button-hidden');
          item.find('.dot').attr('opacity', item.hasClass('lme-button-hidden') ? 0 : 1);
        });
        list.append(item);
      });
      Lampa.Modal.open({
        title: 'Edit buttons',
        html: list,
        size: 'small',
        scroll_to_center: true,
        onBack: function onBack() {
          var newOrder = [];
          var newHidden = [];
          list.find('.menu-edit-list__item').each(function () {
            var id = $(this).data('id');
            if (!id) return;
            newOrder.push(id);
            if ($(this).hasClass('lme-button-hidden')) newHidden.push(id);
          });
          Lampa.Storage.set(ORDER_KEY, newOrder);
          Lampa.Storage.set(HIDE_KEY, newHidden);
          Lampa.Modal.close();
          applyLayout(fullContainer);
        }
      });
    }
    function openEditorFromSettings() {
      var enabled = Lampa.Controller.enabled().name;
      if (!lastFullContainer || !lastFullContainer.length || !document.body.contains(lastFullContainer[0])) {
        var current = resolveActiveFullContainer();
        if (current) {
          lastFullContainer = current;
        }
      }
      if (!lastFullContainer || !lastFullContainer.length || !document.body.contains(lastFullContainer[0])) {
        Lampa.Modal.open({
          title: Lampa.Lang.translate('title_error'),
          html: Lampa.Template.get('error', {
            title: Lampa.Lang.translate('title_error'),
            text: 'Open a movie card to edit buttons'
          }),
          size: 'small',
          scroll_to_center: true,
          onBack: function onBack() {
            Lampa.Modal.close();
            Lampa.Controller.toggle(enabled);
          }
        });
        return;
      }
      openEditor(lastFullContainer);
    }
    function main$7() {
      Lampa.Listener.follow('full', function (e) {
        if (e.type === 'build' && e.name === 'start' && e.item && e.item.html) {
          lastStartInstance = e.item;
        }
        if (e.type === 'complite') {
          var fullContainer = getFullContainer(e);
          if (!fullContainer) return;
          lastFullContainer = fullContainer;
          setTimeout(function () {
            applyLayout(fullContainer);
          }, 0);
        }
      });
    }
    var showButton = {
      main: main$7,
      openEditorFromSettings: openEditorFromSettings
    };

    // Переопределяем штатную кнопку «закладка»: одно нажатие = toggle book без меню.
    // Иконка обновляется сама (движок шлёт state:changed, штатный листенер ловит).
    function fastBookMain() {
      Lampa.Listener.follow('full', function (e) {
        if (e.type !== 'complite') return;
        var render = e.object && e.object.activity && typeof e.object.activity.render === 'function' ? e.object.activity.render() : null;
        if (!render) return;
        var book = render.find('.button--book');
        if (!book.length) return;
        var card = e.data && e.data.movie ? e.data.movie : e.object && (e.object.card || e.object.movie);
        if (!card) return;
        book.unbind('hover:enter');
        book.on('hover:enter', function () {
          Lampa.Favorite.toggle('book', card);
        });
      });
    }
    var fastBook = {
      main: fastBookMain
    };

    function main$6() {
      Lampa.SettingsApi.addComponent({
        component: "lme",
        name: Lampa.Lang.translate('lme_title'),
        icon: '<svg height="200px" width="200px" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 431.661 431.661" xml:space="preserve" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path style="fill:#ffffff;" d="M180.355,213.668l40.079,40.085L42.526,431.661L2.446,391.576L180.355,213.668z M228.877,245.316 l-40.079-40.085l68.905-68.911l40.091,40.079L228.877,245.316z"></path> <polygon style="fill:#ffffff;" points="380.066,218.525 391.999,218.519 391.999,181.309 429.215,181.309 429.215,169.376 391.999,169.376 391.999,132.166 380.066,132.166 380.066,169.376 342.862,169.376 342.862,181.309 380.066,181.309 "></polygon> <polygon style="fill:#ffffff;" points="393.282,260.424 393.282,248.49 356.073,248.49 356.073,211.281 344.145,211.281 344.145,248.49 306.93,248.49 306.93,260.424 344.145,260.424 344.145,297.633 356.073,297.633 356.073,260.424 "></polygon> <polygon style="fill:#ffffff;" points="302.956,37.209 265.741,37.209 265.741,0 253.807,0 253.807,37.209 216.603,37.209 216.603,49.143 253.807,49.143 253.807,86.353 265.741,86.353 265.741,49.143 302.956,49.143 "></polygon> <polygon style="fill:#ffffff;" points="223.853,73.148 186.638,73.148 186.638,35.932 174.71,35.932 174.71,73.148 137.495,73.148 137.495,85.076 174.71,85.076 174.71,122.291 186.638,122.291 186.638,85.076 223.853,85.076 "></polygon> </g> </g></svg>'
      });
      //Button in one line
      Lampa.SettingsApi.addParam({
        component: "lme",
        param: {
          name: "lme_showbutton",
          type: "trigger",
          "default": false
        },
        field: {
          name: Lampa.Lang.translate('lme_showbutton_name'),
          description: Lampa.Lang.translate('lme_showbutton_desc')
        },
        onChange: function onChange(value) {
          Lampa.Settings.update();
        }
      });
      if (Lampa.Storage.get('lme_showbutton') == true) {
        Lampa.SettingsApi.addParam({
          component: "lme",
          param: {
            name: "lme_showbuttonwn",
            type: "trigger",
            "default": false
          },
          field: {
            name: Lampa.Lang.translate('lme_showbuttonwn_name'),
            description: Lampa.Lang.translate('lme_showbuttonwn_desc')
          },
          onChange: function onChange(value) {
            Lampa.Settings.update();
          }
        });
        Lampa.SettingsApi.addParam({
          component: "lme",
          param: {
            name: "lme_button_editor",
            type: "button"
          },
          field: {
            name: Lampa.Lang.translate('lme_button_editor_name'),
            description: Lampa.Lang.translate('lme_button_editor_desc')
          },
          onChange: function onChange() {
            showButton.openEditorFromSettings();
          }
        });
      }
      // Закладка одним нажатием (независимо от «Все кнопки»)
      Lampa.SettingsApi.addParam({
        component: "lme",
        param: {
          name: "lme_fastbook",
          type: "trigger",
          "default": false
        },
        field: {
          name: Lampa.Lang.translate('lme_fastbook_name'),
          description: Lampa.Lang.translate('lme_fastbook_desc')
        },
        onChange: function onChange(value) {
          Lampa.Settings.update();
        }
      });
    }
    var CONFIG = {
      main: main$6
    };

    var manifest = {
      type: "other",
      version: "0.0.5-lite",
      author: '@lme_chat',
      name: "Movie Enhancer (lite)",
      description: "All action buttons in card",
      component: "lme"
    };
    function add() {
      Lang.main();
      Lampa.Manifest.plugins = manifest;
      CONFIG.main();
      if (Lampa.Storage.get('lme_showbutton') == true) showButton.main();
      if (Lampa.Storage.get('lme_fastbook') == true) fastBook.main();
    }
    function startPlugin() {
      window.plugin_lme_ready = true;
      if (window.appready) add();else {
        Lampa.Listener.follow("app", function (e) {
          if (e.type === "ready") add();
        });
      }
    }
    if (!window.plugin_lme_ready) startPlugin();

})();
