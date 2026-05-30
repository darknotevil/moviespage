(function () {
    'use strict';

    // Кнопка «Открыть в КиноПоиске» в карточке фильма.
    // На Android запускает приложение КиноПоиск (TV или телефон) по deeplink,
    // если установлено; иначе открывает страницу в браузере.

    // Кандидаты пакетов: сначала ТВ, потом телефонная версия.
    var PACKAGES = ['ru.kinopoisk.tv', 'ru.kinopoisk.yandex'];

    function hasStartApp() {
      return typeof startApp !== 'undefined' && startApp && typeof startApp.set === 'function';
    }

    // Достаём kinopoisk_id из разных мест события 'full'.
    function getKpId(e) {
      var srcs = [e && e.data && e.data.movie, e && e.object && e.object.card, e && e.object && e.object.movie, e && e.object];
      for (var i = 0; i < srcs.length; i++) {
        var o = srcs[i];
        if (o && o.kinopoisk_id) return o.kinopoisk_id;
      }
      return null;
    }

    function getTitle(e) {
      var srcs = [e && e.data && e.data.movie, e && e.object && e.object.card, e && e.object && e.object.movie];
      for (var i = 0; i < srcs.length; i++) {
        var o = srcs[i];
        if (o && (o.title || o.name)) return o.title || o.name;
      }
      return '';
    }

    function filmUrl(id) {
      return 'https://www.kinopoisk.ru/film/' + id + '/';
    }

    function searchUrl(title) {
      return 'https://www.kinopoisk.ru/index.php?kp_query=' + encodeURIComponent(title);
    }

    function openBrowser(url) {
      if (window.Lampa && Lampa.Android && Lampa.Android.openBrowser) Lampa.Android.openBrowser(url);
      else window.open(url, '_blank');
    }

    // Находим установленный пакет КиноПоиска (перебор кандидатов через startApp.check).
    function findInstalled(cb) {
      if (!hasStartApp()) return cb(null);
      var i = 0;
      (function next() {
        if (i >= PACKAGES.length) return cb(null);
        var pkg = PACKAGES[i++];
        startApp.set({ application: pkg }).check(function () {
          cb(pkg);
        }, function () {
          next();
        });
      })();
    }

    function openKinopoisk(url) {
      findInstalled(function (pkg) {
        if (hasStartApp() && pkg) {
          // 1) пробуем открыть конкретную страницу в приложении
          startApp.set({
            action: 'android.intent.action.VIEW',
            uri: url,
            package: pkg
          }).start(function () {}, function () {
            // 2) не вышло по deeplink — просто запускаем приложение
            startApp.set({ application: pkg }).start(function () {}, function () {
              openBrowser(url);
            });
          });
        } else {
          // приложения нет / не Android — открываем в браузере
          openBrowser(url);
        }
      });
    }

    function buttonHtml() {
      return '<div class="full-start__button selector view--kinopoisk">' +
        '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<text x="16" y="22" font-family="Arial, sans-serif" font-size="15" font-weight="700" text-anchor="middle" fill="currentColor">КП</text>' +
        '</svg>' +
        '<span>КиноПоиск</span>' +
        '</div>';
    }

    function getContainer(e) {
      if (e && e.object && e.object.activity && typeof e.object.activity.render === 'function') return e.object.activity.render();
      if (e && e.body) return e.body;
      return null;
    }

    function addButton(e) {
      if (e.type !== 'complite') return;

      var container = getContainer(e);
      if (!container) return;

      var root = container.find ? container : $(container);
      var buttons = root.find('.full-start-new__buttons');
      if (!buttons.length) return;
      if (buttons.find('.view--kinopoisk').length) return; // не дублируем

      var id = getKpId(e);
      var title = getTitle(e);
      if (!id && !title) return; // нечего открывать

      var url = id ? filmUrl(id) : searchUrl(title);

      var btn = $(buttonHtml());
      btn.on('hover:enter', function () {
        openKinopoisk(url);
      });

      buttons.append(btn);
    }

    function start() {
      Lampa.Listener.follow('full', addButton);
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) {
      if (e.type === 'ready') start();
    });

})();
