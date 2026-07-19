(function () {
    'use strict';

    // ============================================================
    // Плагин Kinogo для Lampa
    // Источник: kinogo.la — поиск, страница фильма, плеер ortified.ws
    // ============================================================

    if (window.kinogo_plugin_started) return;
    window.kinogo_plugin_started = true;

    var KINOGO_HOST = 'https://kinogo.la';
    var PROXY = ''; // CORS прокси (настраивается в настройках)

    // ======== Переводы ========
    if (!Lampa.Lang) {
        var lang_data = {};
        Lampa.Lang = {
            add: function (d) { lang_data = d; },
            translate: function (k) { return lang_data[k] ? lang_data[k].ru : k; }
        };
    }

    Lampa.Lang.add({
        kinogo_title: { ru: 'Kinogo', en: 'Kinogo', uk: 'Kinogo' },
        kinogo_nolink: { ru: 'Не удалось извлечь ссылку', en: 'Failed to fetch link', uk: 'Не вдалося отримати посилання' },
        kinogo_proxy: { ru: 'Прокси Kinogo', en: 'Kinogo Proxy', uk: 'Проксі Kinogo' },
        kinogo_proxy_descr: { ru: 'Для обхода CORS (напр. https://cors.example.com/)', en: 'For CORS bypass', uk: 'Для обходу CORS' }
    });

    // ======== Шаблоны ========
    var tpl_online = '<div class="online selector"><div class="online__body">' +
        '<div style="position:absolute;left:0;top:-0.3em;width:2.4em;height:2.4em">' +
        '<svg style="height:2.4em;width:2.4em" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<circle cx="64" cy="64" r="56" stroke="white" stroke-width="16"/>' +
        '<path d="M90.5 64.3827L50 87.7654L50 41L90.5 64.3827Z" fill="white"/></svg></div>' +
        '<div class="online__title" style="padding-left:2.1em">{title}</div>' +
        '<div class="online__quality" style="padding-left:3.4em">{quality}{info}</div>' +
        '</div></div>';

    var tpl_folder = '<div class="online selector"><div class="online__body">' +
        '<div style="position:absolute;left:0;top:-0.3em;width:2.4em;height:2.4em">' +
        '<svg style="height:2.4em;width:2.4em" viewBox="0 0 128 112" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect y="20" width="128" height="92" rx="13" fill="white"/>' +
        '<path d="M29.9963 8H98.0037C96.0446 3.3021 91.4079 0 86 0H42C36.5921 0 31.9555 3.3021 29.9963 8Z" fill="white" fill-opacity="0.23"/>' +
        '<rect x="11" y="8" width="106" height="76" rx="13" fill="white" fill-opacity="0.51"/>' +
        '</svg></div>' +
        '<div class="online__title" style="padding-left:2.1em">{title}</div>' +
        '<div class="online__quality" style="padding-left:3.4em">{quality}{info}</div>' +
        '</div></div>';

    function resetTemplates() {
        Lampa.Template.add('kinogo_online', tpl_online);
        Lampa.Template.add('kinogo_folder', tpl_folder);
    }

    // ======== Декодер PlayerJS (из Lampac) ========
    function decodePlayerjsFile(input) {
        var ctx = {
            dm: null, _ml: null,
            ex: ['slice', 'atob', 'substr', 'salt', 'temp', 'escape', 'push', 'this',
                'btoa', 'pop', 'JSON.stringify', 'length', 'JSON.parse', 'forEach',
                'splice', 'decodeURIComponent', 'unshift', '', 'clone', 'insert'],
            load: function (e) {
                if (typeof e === 'object') return e;
                if (typeof e === 'string' && e.indexOf('#2') === 0) return this.loadFromString(e.substr(2));
                return '';
            },
            loadFromString: function (e) {
                this.dm = e.substr(0, 2);
                this._ml = Math.pow(2, 5);
                return this.readString(this.slice(e.substr(2)), 1, 5, 15, 12);
            },
            slice: function (e) {
                var self = this;
                return e.split(String.fromCharCode(this.dm)).map(function (part) {
                    var t = parseInt(part.slice(-1), 10);
                    return part.length > self._ml
                        ? part.substr(2 * t, part.length - 3 * t - 1) + part.substr(0, t)
                        : part;
                }).join(self.ex[17]);
            },
            readString: function (val) {
                var actions = Array.prototype.slice.call(arguments, 1);
                var padding = val.length % 4;
                if (padding) val += '='.repeat(4 - padding);
                actions.forEach(function (v) {
                    switch (ctx.ex[v]) {
                        case 'atob': val = atob(val); break;
                        case 'escape': val = escape(val); break;
                        case 'decodeURIComponent': val = decodeURIComponent(val); break;
                        case 'JSON.parse': val = JSON.parse(val); break;
                    }
                });
                return val;
            }
        };
        return ctx.load(input);
    }

    // ======== Прокси ========
    function getProxy() {
        return Lampa.Storage.get('kinogo_proxy', '') || '';
    }

    function proxify(url) {
        var p = getProxy();
        if (!p) return url;
        if (p.slice(-1) !== '/') p += '/';
        return p + url;
    }

    // ======== Компонент ========
    function KinogoComponent(object) {
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var files = new Lampa.Files(object);
        var filter = new Lampa.Filter(object);
        var html = $('<div></div>');
        var active_card = object.movie;
        var playlist = [];

        scroll.body().addClass('torrent-list');

        function minus() {
            scroll.minus(window.innerWidth > 580 ? false : files.render().find('.files__left'));
        }
        window.addEventListener('resize', minus, false);
        minus();

        // ---- Создание ----
        this.create = function () {
            var _this = this;
            this.activity.loader(true);

            filter.onSearch = function (value) {
                Lampa.Activity.replace({ search: value, clarification: true });
            };
            filter.onBack = function () {
                Lampa.Activity.backward();
            };

            filter.render();
            files.append(scroll.render());
            scroll.append(filter.render());

            // Шаг 1: Поиск на kinogo
            var searchTitle = object.search || active_card.title || active_card.name || '';

            _this.searchKinogo(searchTitle);

            return this.render();
        };

        // ---- Поиск на kinogo ----
        this.searchKinogo = function (title) {
            var _this = this;
            var searchUrl = proxify(KINOGO_HOST + '/search/' + encodeURIComponent(title));

            network.timeout(15000);
            network.native(searchUrl, function (html) {
                // Парсим результаты поиска
                var resultLink = _this.parseSearch(html, title, active_card.year);

                if (resultLink) {
                    _this.loadFilmPage(resultLink);
                } else {
                    _this.activity.loader(false);
                    _this.emptyShow();
                    _this.activity.toggle();
                }
            }, function () {
                _this.activity.loader(false);
                _this.emptyShow();
                _this.activity.toggle();
            }, false, { dataType: 'text' });
        };

        // ---- Парсинг результатов поиска ----
        this.parseSearch = function (html, title, year) {
            // Ищем ссылки на фильмы в результатах поиска
            var regex = /href="https?:\/\/[^\/]+\/(\d+-[^"]+\.html)"[^>]*>([^<]+)/g;
            var match;
            var bestMatch = null;
            var titleLower = (title || '').toLowerCase();

            while ((match = regex.exec(html)) !== null) {
                var href = match[1];
                var name = match[2];

                // Точное совпадение по названию и году
                if (name.toLowerCase().indexOf(titleLower) !== -1) {
                    if (year) {
                        var yearStr = year.toString();
                        if (name.indexOf(yearStr) !== -1) {
                            return href;
                        }
                    } else {
                        if (!bestMatch) bestMatch = href;
                    }
                }
            }

            return bestMatch;
        };

        // ---- Загрузка страницы фильма ----
        this.loadFilmPage = function (href) {
            var _this = this;
            var filmUrl = proxify(KINOGO_HOST + '/' + href);

            network.timeout(15000);
            network.native(filmUrl, function (html) {
                // Ищем iframe плеера (ortified.ws)
                var iframeMatch = html.match(/<iframe[^>]+data-src="([^"]+ortified[^"]+)"/);
                if (!iframeMatch) {
                    // Пробуем любой iframe
                    iframeMatch = html.match(/<iframe[^>]+data-src="([^"]+)"/);
                }

                if (iframeMatch) {
                    var embedUrl = iframeMatch[1];
                    if (embedUrl.indexOf('&#58;') !== -1) {
                        embedUrl = embedUrl.replace(/&#58;/g, ':').replace(/&amp;/g, '&');
                    }
                    if (embedUrl.indexOf('//') === 0) embedUrl = 'https:' + embedUrl;

                    _this.loadPlayer(embedUrl, href);
                } else {
                    _this.activity.loader(false);
                    _this.emptyShow();
                    _this.activity.toggle();
                }
            }, function () {
                _this.activity.loader(false);
                _this.emptyShow();
                _this.activity.toggle();
            }, false, { dataType: 'text' });
        };

        // ---- Загрузка плеера ----
        this.loadPlayer = function (embedUrl, referer) {
            var _this = this;
            var playerUrl = proxify(embedUrl);

            var headers = {};
            if (referer) headers['Referer'] = KINOGO_HOST + '/' + referer;

            network.timeout(15000);
            network.native(playerUrl, function (html) {
                // Ищем закодированный "file" в плеере
                var fileMatch = html.match(/"file"\s*:\s*"([^"]+)"/);

                if (fileMatch) {
                    var fileEncode = fileMatch[1];
                    _this.decodeAndBuild(fileEncode);
                } else {
                    // Пробуем найти прямой m3u8
                    var m3u8Match = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/);
                    if (m3u8Match) {
                        _this.buildFromStream(m3u8Match[1]);
                    } else {
                        _this.activity.loader(false);
                        _this.emptyShow();
                        _this.activity.toggle();
                    }
                }
            }, function () {
                _this.activity.loader(false);
                _this.emptyShow();
                _this.activity.toggle();
            }, false, { dataType: 'text', headers: headers });
        };

        // ---- Декодирование и построение списка ----
        this.decodeAndBuild = function (fileEncode) {
            var _this = this;
            var result;

            try {
                result = decodePlayerjsFile(fileEncode);
            } catch (e) {
                _this.activity.loader(false);
                _this.emptyShow();
                _this.activity.toggle();
                return;
            }

            _this.activity.loader(false);

            if (!result) {
                _this.emptyShow();
                _this.activity.toggle();
                return;
            }

            // Фильм — один уровень (массив озвучек)
            if (Array.isArray(result)) {
                result.forEach(function (item) {
                    if (item.file) _this.addItem(item.title || 'Озвучка', item.file, item.subtitle);
                });
            }
            // Сериал — два уровня (сезоны → эпизоды → озвучки)
            else if (result.folder && Array.isArray(result.folder)) {
                result.folder.forEach(function (season) {
                    if (season.folder && Array.isArray(season.folder)) {
                        season.folder.forEach(function (episode) {
                            var epTitle = (season.title || 'Сезон') + ' — ' + (episode.title || 'Эпизод');
                            if (episode.file) {
                                _this.addItem(epTitle, episode.file, episode.subtitle);
                            } else if (episode.folder && Array.isArray(episode.folder)) {
                                episode.folder.forEach(function (voice) {
                                    var voiceTitle = epTitle + ' (' + (voice.title || 'Озвучка') + ')';
                                    if (voice.file) _this.addItem(voiceTitle, voice.file, voice.subtitle);
                                });
                            }
                        });
                    } else if (season.file) {
                        _this.addItem(season.title || 'Озвучка', season.file, season.subtitle);
                    }
                });
            }
            // Простой объект с file
            else if (result.file) {
                _this.addItem(result.title || 'Смотреть', result.file, result.subtitle);
            }

            if (playlist.length === 0) _this.emptyShow();
            _this.activity.toggle();
        };

        // ---- Прямой m3u8 ----
        this.buildFromStream = function (streamUrl) {
            this.addItem('Смотреть', streamUrl, null);
            this.activity.loader(false);
            this.activity.toggle();
        };

        // ---- Добавить элемент в список ----
        this.addItem = function (title, fileUrl, subtitles) {
            var _this = this;
            var movieTitle = active_card.title || active_card.name || '';
            var streamUrl = fileUrl;

            if (streamUrl.indexOf('//') === 0) streamUrl = 'https:' + streamUrl;

            // Проксируем поток если есть прокси
            streamUrl = proxify(streamUrl);

            var quality = '1080p';
            var info = '';

            var item = Lampa.Template.get('kinogo_online', {
                title: title,
                quality: quality,
                info: info
            });

            var playData = {
                url: streamUrl,
                title: movieTitle + ' — ' + title,
                quality: quality
            };

            // Субтитры
            if (subtitles) {
                var subs = _this.parseSubtitles(subtitles);
                if (subs.length > 0) playData.subtitles = subs;
            }

            item.on('hover:enter', function () {
                Lampa.Player.play(playData);
                Lampa.Player.playlist(playlist);
            });

            item.on('hover:focus', function () {
                scroll.update(item);
            });

            playlist.push(playData);
            scroll.append(item);
        };

        // ---- Парсинг субтитров ----
        this.parseSubtitles = function (subStr) {
            var result = [];
            if (!subStr) return result;
            var regex = /\[([^\]]+)\]([^\[\,]+)/g;
            var match;
            while ((match = regex.exec(subStr)) !== null) {
                var url = match[2];
                if (url.indexOf('//') === 0) url = 'https:' + url;
                result.push({ label: match[1], url: proxify(url) });
            }
            return result;
        };

        // ---- Пусто ----
        this.emptyShow = function () {
            var empty = Lampa.Template.get('empty', {
                title: Lampa.Lang.translate('kinogo_nolink'),
                descr: ''
            });
            scroll.append(empty);
        };

        // ---- Рендер ----
        this.render = function () { return html; };

        // ---- Уничтожение ----
        this.destroy = function () {
            network.clear();
            scroll.destroy();
            files.destroy();
            filter.destroy();
            html.remove();
            playlist = [];
            window.removeEventListener('resize', minus, false);
        };
    }

    // ======== Заглушка при старте ========
    resetTemplates();
    Lampa.Component.add('kinogo', KinogoComponent);

    // ======== Манифест ========
    Lampa.Manifest.plugins = {
        type: 'video',
        version: '1.0.0',
        name: 'Kinogo',
        description: 'Онлайн просмотр с Kinogo',
        component: 'kinogo',
        onContextMenu: function (object) {
            return { name: 'Kinogo', description: '' };
        },
        onContextLauch: function (object) {
            resetTemplates();
            Lampa.Component.add('kinogo', KinogoComponent);
            Lampa.Activity.push({
                url: '',
                title: 'Kinogo',
                component: 'kinogo',
                movie: object,
                page: 1
            });
        }
    };

    // ======== Настройка прокси ========
    Lampa.Params.select('kinogo_proxy', '', '');
    Lampa.Template.add('settings_kinogo', '<div>' +
        '<div class="settings-param selector" data-type="input" data-name="kinogo_proxy" placeholder="https://cors.example.com/">' +
        '<div class="settings-param__name">#{kinogo_proxy}</div>' +
        '<div class="settings-param__value"></div>' +
        '<div class="settings-param__descr">#{kinogo_proxy_descr}</div>' +
        '</div></div>');

    function addSettings() {
        if (Lampa.Settings.main && !Lampa.Settings.main().render().find('[data-component="kinogo"]').length) {
            var field = $('<div class="settings-folder selector" data-component="kinogo">' +
                '<div class="settings-folder__icon">' +
                '<svg height="46" viewBox="0 0 42 46" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                '<rect x="1.5" y="26.5" width="39" height="18" rx="1.5" stroke="white" stroke-width="3"/>' +
                '<circle cx="9.5" cy="35.5" r="3.5" fill="white"/>' +
                '<circle cx="26.5" cy="35.5" r="2.5" fill="white"/>' +
                '<circle cx="32.5" cy="35.5" r="2.5" fill="white"/>' +
                '<circle cx="21.5" cy="5.5" r="5.5" fill="white"/>' +
                '<rect x="31" y="4" width="11" height="3" rx="1.5" fill="white"/>' +
                '<rect y="4" width="11" height="3" rx="1.5" fill="white"/>' +
                '<rect x="20" y="14" width="3" height="7" rx="1.5" fill="white"/>' +
                '</svg></div>' +
                '<div class="settings-folder__name">Kinogo</div></div>');
            Lampa.Settings.main().render().find('[data-component="more"]').after(field);
            Lampa.Settings.main().update();
        }
    }

    // ======== Кнопка в карточке фильма ========
    var button = '<div class="full-start__button selector view--kinogo" data-subtitle="Kinogo">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 30.051 30.051" style="enable-background:new 0 0 512 512">' +
        '<g xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M19.982,14.438l-6.24-4.536c-0.229-0.166-0.533-0.191-0.784-0.062c-0.253,0.128-0.411,0.388-0.411,0.669v9.069c0,0.284,0.158,0.543,0.411,0.671c0.107,0.054,0.224,0.081,0.342,0.081c0.154,0,0.31-0.049,0.442-0.146l6.24-4.532c0.197-0.145,0.312-0.369,0.312-0.607C20.295,14.803,20.177,14.58,19.982,14.438z" fill="currentColor"/>' +
        '<path d="M15.026,0.002C6.726,0.002,0,6.728,0,15.028c0,8.297,6.726,15.021,15.026,15.021c8.298,0,15.025-6.725,15.025-15.021C30.052,6.728,23.324,0.002,15.026,0.002z M15.026,27.542c-6.912,0-12.516-5.601-12.516-12.514c0-6.91,5.604-12.518,12.516-12.518c6.911,0,12.514,5.607,12.514,12.518C27.541,21.941,21.937,27.542,15.026,27.542z" fill="currentColor"/>' +
        '</g></svg>' +
        '<span>#{kinogo_title}</span></div>';

    Lampa.Listener.follow('full', function (e) {
        if (e.type == 'complite') {
            var btn = $(Lampa.Lang.translate(button));
            btn.on('hover:enter', function () {
                resetTemplates();
                Lampa.Component.add('kinogo', KinogoComponent);
                Lampa.Activity.push({
                    url: '',
                    title: Lampa.Lang.translate('kinogo_title'),
                    component: 'kinogo',
                    search: e.data.movie.title || e.data.movie.name || '',
                    search_one: e.data.movie.title || e.data.movie.name || '',
                    search_two: e.data.movie.original_title || '',
                    movie: e.data.movie,
                    page: 1
                });
            });
            e.object.activity.render().find('.view--torrent').after(btn);
        }
    });

    // ======== Инициализация настроек ========
    if (window.appready) addSettings();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') addSettings();
        });
    }

})();
