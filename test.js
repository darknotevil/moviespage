/**
 * my_collections_mdblist.js - Lampa plugin: personal collections via MDBList
 *
 * MDBList is a service for creating movie/TV lists with automatic import
 * from IMDB watchlists, Letterboxd, Trakt, and more.
 * Every public list is available as a plain JSON endpoint:
 *   https://mdblist.com/lists/{user}/{slug}/json/
 * No auth, no API key required - public lists only.
 *
 * This plugin reads several such lists and renders each one
 * as a separate row on the Lampa home screen.
 *
 * Setup:
 *  1) Create an account at mdblist.com
 *  2) Create lists (manual, dynamic, or imported from IMDB/Letterboxd/Trakt)
 *  3) Make the lists public
 *  4) Fill in the LISTS array below (user/slug + display title + sort order)
 *  5) Host this file over HTTPS and add it to Lampa as a plugin
 */

(function () {
    'use strict';

    // ====== CONFIGURATION ======
    // Your MDBList lists. user/slug come directly from the list URL.
    // Example: https://mdblist.com/lists/linaspurinis/top-watched-movies-of-the-week
    //          user = 'linaspurinis', slug = 'top-watched-movies-of-the-week'
    var LISTS = [
        { user: 'linaspurinis', slug: 'top-watched-movies-of-the-week',   title: 'IMDB Watchlist',         order: 1 },
        { user: 'garycrawfordgc', slug: 'top-movies-of-the-week', title: 'Letterboxd: Watch Later', order: 2 },
        { user: 'hdlists', slug: 'mindfuck-movies', title: 'Horror Favorites',        order: 3 }
    ];

    var MDBLIST_URL = 'https://mdblist.com/lists/{user}/{slug}/json/';
    var TMDB_API    = 'https://api.themoviedb.org/3';
    var TMDB_KEY    = '4ef0d7355d9ffb5151e987764708ce96'; // Lampa's built-in public TMDB key
    var TMDB_LANG   = 'ru-RU';

    // Guard against double initialisation
    if (window.my_mdblist_ready) return;
    window.my_mdblist_ready = true;

    // Build a safe identifier string from arbitrary text
    function slug(s) {
        return String(s)
            .toLowerCase()
            .replace(/[^a-z0-9а-яё]+/gi, '_')
            .replace(/^_|_$/g, '') || 'row';
    }

    /**
     * Fetch a single TMDB card by id and media type.
     * MDBList uses mediatype='show' for series; TMDB calls the same thing 'tv'.
     */
    function fetchCard(tmdbId, mediaType) {
        var tmdbType = mediaType === 'show' ? 'tv' : 'movie';
        var url = TMDB_API + '/' + tmdbType + '/' + tmdbId +
                  '?api_key=' + TMDB_KEY + '&language=' + TMDB_LANG;
        return fetch(url)
            .then(function (r) {
                if (!r.ok) throw new Error('TMDB ' + r.status);
                return r.json();
            })
            .then(function (data) {
                // media_type is required so Lampa knows how to open the card
                data.media_type = tmdbType;
                return data;
            });
    }

    /**
     * Load one MDBList list and return resolved Lampa card objects.
     *
     * MDBList JSON shape:
     *   [{ "id": 123, "imdb_id": "tt...", "tvdb_id": 0,
     *      "title": "...", "release_year": 2020,
     *      "mediatype": "movie" | "show" }, ...]
     *
     * The "id" field is already the TMDB id - no conversion needed.
     */
    function loadList(item) {
        var url = MDBLIST_URL.replace('{user}', item.user).replace('{slug}', item.slug);
        return fetch(url)
            .then(function (r) {
                if (!r.ok) throw new Error('MDBList ' + r.status);
                return r.json();
            })
            .then(function (entries) {
                // Drop entries without a TMDB id (can happen with very new releases)
                var valid = (entries || []).filter(function (e) {
                    return e && e.id && (e.mediatype === 'movie' || e.mediatype === 'show');
                });

                // Cap at 40 to avoid hammering TMDB with hundreds of parallel requests
                valid = valid.slice(0, 40);

                var promises = valid.map(function (e) {
                    return fetchCard(e.id, e.mediatype).catch(function (err) {
                        console.warn('[my_mdblist]', item.slug, 'tmdb', e.id, err.message);
                        return null; // skip broken cards, keep the rest
                    });
                });

                return Promise.all(promises).then(function (cards) {
                    return {
                        title:   item.title,
                        order:   typeof item.order === 'number' ? item.order : 999,
                        slugId:  slug(item.user + '_' + item.slug),
                        results: cards.filter(Boolean)
                    };
                });
            })
            .catch(function (err) {
                console.error('[my_mdblist] list', item.slug, 'failed:', err);
                return null;
            });
    }

    // Register a single row on the Lampa home screen
    function registerRow(rowData) {
        if (!rowData || !rowData.results.length) return;

        Lampa.ContentRows.add({
            name:   'mdblist_' + rowData.slugId, // unique key - both name and title are required
            title:  rowData.title,
            index:  rowData.order,
            screen: ['main'],
            call: function (params, screen) {
                return function (callback) {
                    callback({
                        results:    rowData.results,
                        title:      rowData.title,
                        collection: true
                    });
                };
            }
        });
    }

    function start() {
        Promise.all(LISTS.map(loadList)).then(function (rows) {
            rows.filter(Boolean).forEach(registerRow);
            var ok = rows.filter(Boolean).length;
            console.log('[my_mdblist] registered ' + ok + '/' + LISTS.length + ' list(s)');
        });
    }

    // ContentRows is only available after the app is fully ready
    if (window.appready) {
        start();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') start();
        });
    }
})();
