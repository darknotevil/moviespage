(function () {
    'use strict';

    // Lampa - Disable ALL content blocking mechanisms

    // 1. Disable DMCA blocking (copyright-based content blocking)
    //    Source: src/services/dmca.js - checks disable_features.dmca
    window.lampa_settings.disable_features.dmca = true;

    // 2. Disable LGBT content blocking
    //    Source: src/services/lgbt.js - checks disable_features.lgbt
    window.lampa_settings.disable_features.lgbt = true;

    // 3. Disable plugin blacklist
    //    Source: src/core/plugins.js - checks disable_features.blacklist
    window.lampa_settings.disable_features.blacklist = true;

    // 4. Clear DMCA blocklist (prevents Utils.dcma() from matching any content)
    //    Source: src/utils/utils.js dcma() function
    window.lampa_settings.dcma = [];

    // 5. Clear LGBT blocklist (prevents list-based blocking in full.js and card module)
    //    Source: src/components/full.js and src/interaction/card/module/lgbt.js
    window.lampa_settings.lgbt = {};

    // 6. Clear lgbt_content_block storage (prevents forced blocking for RU/BY users)
    //    Source: src/components/full.js checks Storage.field('lgbt_content_block')
    try {
        localStorage.setItem('lampa_lgbt_content_block', 'false');
    } catch (e) {}

    // 7. Enable adult content view (bypasses adult keyword blocking)
    //    Source: src/components/full.js - if Storage.field('adult_content_view') adult_block = false
    try {
        localStorage.setItem('lampa_adult_content_view', 'true');
    } catch (e) {}

    // 8. Attempt to clear Keys arrays (lgbt, adult, filter keywords)
    //    Source: src/core/tmdb/keys.js - used by full.js, descr.js, tmdb.js, cub.js
    //    These are ES6 module exports - try to find them in the bundled output
    (function clearKeys() {
        // Try to find Keys module through window.Lampa or other global references
        var targets = [];

        // Search window.Lampa properties
        if (window.Lampa) {
            for (var key in window.Lampa) {
                var obj = window.Lampa[key];
                if (obj && typeof obj === 'object') {
                    if (Array.isArray(obj.lgbt) && Array.isArray(obj.adult) && Array.isArray(obj.filter)) {
                        targets.push(obj);
                    }
                    // Also check nested objects
                    for (var subKey in obj) {
                        var subObj = obj[subKey];
                        if (subObj && typeof subObj === 'object') {
                            if (Array.isArray(subObj.lgbt) && Array.isArray(subObj.adult) && Array.isArray(subObj.filter)) {
                                targets.push(subObj);
                            }
                        }
                    }
                }
            }
        }

        // Clear found arrays
        for (var i = 0; i < targets.length; i++) {
            var t = targets[i];
            if (t.lgbt) t.lgbt.length = 0;
            if (t.adult) t.adult.length = 0;
            if (t.filter) t.filter.length = 0;
        }
    })();

})();
