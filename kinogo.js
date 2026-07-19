(function () {
    'use strict';

    var mod_version = '1.0.0';

    function initLang() {
        if (typeof Lampa !== 'undefined' && !Lampa.Lang) {
            var lang_data = {};

            Lampa.Lang = {
                add: function (data) { lang_data = data; },
                translate: function (key) { return lang_data[key] ? lang_data[key].ru : key; }
            };
        }

        if (typeof Lampa !== 'undefined' && Lampa.Lang) {
            Lampa.Lang.add({
                kinogo_title: {
                    ru: 'Kinogo',
                    en: 'Kinogo',
                    uk: 'Kinogo'
                },
                kinogo_empty: {
                    ru: 'Ничего не найдено',
                    en: 'Nothing found',
                    uk: 'Нічого не знайдено'
                },
                kinogo_empty_descr: {
                    ru: 'Не удалось извлечь потоки Kinogo',
                    en: 'Failed to fetch Kinogo streams',
                    uk: 'Не вдалося отримати потоки Kinogo'
                }
            });
        }
    }

    function initTemplates() {
        Lampa.Template.add('kinogo_item', '<div class="torrent-item selector">' +
            '<div class="torrent-item__title">{title}</div>' +
            '<div class="torrent-item__size">{quality}</div>' +
            '</div>');
    }

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

        this.create = function () {
            var _this = this;

            this.activity.loader(true);

            var kpId = active_card.kp_id || active_card.kinopoisk_id || '';
            var imdbId = active_card.imdb_id || '';
            var tmdbId = active_card.id || '';
            var title = active_card.title || active_card.name || '';
            var year = active_card.year || (active_card.first_air_date ? active_card.first_air_date.substring(0, 4) : '') || '';

            var searchUrl = 'https://bylampa.online/online/all?' +
                'kp_id=' + encodeURIComponent(kpId) +
                '&imdb_id=' + encodeURIComponent(imdbId) +
                '&tmdb_id=' + encodeURIComponent(tmdbId) +
                '&title=' + encodeURIComponent(title) +
                '&year=' + encodeURIComponent(year);

            network.timeout(15000);

            network.silent(searchUrl, function (response) {
                _this.activity.loader(false);

                if (response && response.data && response.data.length) {
                    _this.build(response.data);
                } else {
                    _this.empty();
                }

                _this.activity.toggle();
            }, function (a, c) {
                _this.activity.loader(false);
                _this.empty();
                _this.activity.toggle();
            });

            files.append(scroll.render());
            scroll.append(filter.render());
            html.append(files.render());

            return this.render();
        };

        this.build = function (data) {
            var _this = this;

            playlist = [];

            data.forEach(function (element) {
                var movieTitle = (active_card.title || active_card.name || '');
                var voiceTitle = element.title || 'Дубляж';
                var quality = element.quality || '1080p';
                var streamUrl = element.file || element.url || '';

                if (!streamUrl) return;

                var item = Lampa.Template.get('kinogo_item', {
                    title: voiceTitle,
                    quality: quality
                });

                item.on('hover:enter', function () {
                    Lampa.Player.play({
                        url: streamUrl,
                        title: movieTitle + ' — ' + voiceTitle,
                        quality: quality
                    });

                    Lampa.Player.playlist(playlist);
                });

                playlist.push({
                    url: streamUrl,
                    title: movieTitle + ' — ' + voiceTitle,
                    quality: quality
                });

                scroll.append(item);
            });

            if (playlist.length === 0) {
                this.empty();
            }
        };

        this.empty = function () {
            var emptyView = Lampa.Template.get('empty', {
                title: Lampa.Lang.translate('kinogo_empty'),
                descr: Lampa.Lang.translate('kinogo_empty_descr')
            });

            scroll.append(emptyView);
        };

        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll.render());
                    Lampa.Controller.collectionFocus(false, scroll.render());
                },
                left: function () {
                    if (navigator.on) navigator.on();
                },
                right: function () {
                    if (navigator.on) navigator.on();
                },
                up: function () {
                    if (navigator.on) navigator.on();
                },
                down: function () {
                    if (navigator.on) navigator.on();
                },
                back: function () {
                    Lampa.Activity.backward();
                }
            });

            Lampa.Controller.toggle('content');
        };

        this.pause = function () {};

        this.stop = function () {};

        this.render = function () {
            return html;
        };

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

    function initMain() {
        if (typeof Lampa === 'undefined') return;

        // Регистрация шаблонов
        initTemplates();

        // Регистрация компонента
        Lampa.Component.add('kinogo', KinogoComponent);

        // Манифест плагина для контекстного меню
        var manifest = {
            type: 'video',
            version: mod_version,
            name: 'Kinogo',
            description: 'Смотреть онлайн Kinogo (Cinemap)',
            component: 'kinogo',
            onContextMenu: function (object) {
                return {
                    name: 'Kinogo',
                    description: ''
                };
            },
            onContextLauch: function (object) {
                Lampa.Activity.push({
                    url: '',
                    title: 'Kinogo',
                    component: 'kinogo',
                    movie: object,
                    page: 1
                });
            }
        };

        Lampa.Manifest.plugins = manifest;

        // Кнопка в карточке фильма
        var buttonTemplate = '<div class="full-start__button selector view--kinogo" data-subtitle="Kinogo">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:8px;">' +
            '<polygon points="5 3 19 12 5 21 5 3"></polygon>' +
            '</svg>' +
            '<span>Kinogo</span>' +
            '</div>';

        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                var btn = $(buttonTemplate);

                btn.on('hover:enter', function () {
                    Lampa.Activity.push({
                        url: '',
                        title: 'Kinogo — ' + (e.data.movie.title || e.data.movie.name || ''),
                        component: 'kinogo',
                        movie: e.data.movie,
                        page: 1
                    });
                });

                var target = e.object.activity.render().find('.view--torrent');

                if (target.length) {
                    target.after(btn);
                } else {
                    e.object.activity.render().find('.full-start__buttons').append(btn);
                }
            }
        });
    }

    function startPlugin() {
        initLang();
        initMain();
    }

    if (typeof window !== 'undefined') {
        if (window.appready) {
            startPlugin();
        } else if (typeof Lampa !== 'undefined' && Lampa.Listener) {
            Lampa.Listener.follow('app', function (e) {
                if (e.type === 'ready') startPlugin();
            });
        } else {
            startPlugin();
        }
    }
})();
            this.activity.loader(true);

            var kpId = active_card.kp_id || active_card.kinopoisk_id || '';
            var imdbId = active_card.imdb_id || '';
            var tmdbId = active_card.id || '';
            var title = active_card.title || active_card.name || '';
            var year = active_card.year || (active_card.first_air_date ? active_card.first_air_date.substring(0, 4) : '') || '';

            var searchUrl = 'https://bylampa.online/online/all?' +
                'kp_id=' + encodeURIComponent(kpId) +
                '&imdb_id=' + encodeURIComponent(imdbId) +
                '&tmdb_id=' + encodeURIComponent(tmdbId) +
                '&title=' + encodeURIComponent(title) +
                '&year=' + encodeURIComponent(year);

            network.timeout(15000);

            network.silent(searchUrl, function (response) {
                _this.activity.loader(false);

                if (response && response.data && response.data.length) {
                    _this.build(response.data);
                } else {
                    _this.empty();
                }

                _this.activity.toggle();
            }, function (a, c) {
                _this.activity.loader(false);
                _this.empty();
                _this.activity.toggle();
            });

            files.append(scroll.render());
            scroll.append(filter.render());
            html.append(files.render());

            return this.render();
        };

        this.build = function (data) {
            var _this = this;

            playlist = [];

            data.forEach(function (element) {
                var movieTitle = (active_card.title || active_card.name || '');
                var voiceTitle = element.title || 'Р”СѓР±Р»СЏР¶';
                var quality = element.quality || '1080p';
                var streamUrl = element.file || element.url || '';

                if (!streamUrl) return;

                var item = Lampa.Template.get('kinogo_item', {
                    title: voiceTitle,
                    quality: quality
                });

                item.on('hover:enter', function () {
                    Lampa.Player.play({
                        url: streamUrl,
                        title: movieTitle + ' вЂ” ' + voiceTitle,
                        quality: quality
                    });

                    Lampa.Player.playlist(playlist);
                });

                playlist.push({
                    url: streamUrl,
                    title: movieTitle + ' вЂ” ' + voiceTitle,
                    quality: quality
                });

                scroll.append(item);
            });

            if (playlist.length === 0) {
                this.empty();
            }
        };

        this.empty = function () {
            var emptyView = Lampa.Template.get('empty', {
                title: Lampa.Lang.translate('kinogo_empty'),
                descr: Lampa.Lang.translate('kinogo_empty_descr')
            });

            scroll.append(emptyView);
        };

        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll.render());
                    Lampa.Controller.collectionFocus(false, scroll.render());
                },
                left: function () {
                    if (navigator.on) navigator.on();
                },
                right: function () {
                    if (navigator.on) navigator.on();
                },
                up: function () {
                    if (navigator.on) navigator.on();
                },
                down: function () {
                    if (navigator.on) navigator.on();
                },
                back: function () {
                    Lampa.Activity.backward();
                }
            });

            Lampa.Controller.toggle('content');
        };

        this.pause = function () {};

        this.stop = function () {};

        this.render = function () {
            return html;
        };

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

    function initMain() {
        if (typeof Lampa === 'undefined') return;

        // Р РµРіРёСЃС‚СЂР°С†РёСЏ С€Р°Р±Р»РѕРЅРѕРІ
        initTemplates();

        // Р РµРіРёСЃС‚СЂР°С†РёСЏ РєРѕРјРїРѕРЅРµРЅС‚Р°
        Lampa.Component.add('kinogo', KinogoComponent);

        // РњР°РЅРёС„РµСЃС‚ РїР»Р°РіРёРЅР° РґР»СЏ РєРѕРЅС‚РµРєСЃС‚РЅРѕРіРѕ РјРµРЅСЋ
        var manifest = {
            type: 'video',
            version: mod_version,
            name: 'Kinogo',
            description: 'РЎРјРѕС‚СЂРµС‚СЊ РѕРЅР»Р°Р№РЅ Kinogo (Cinemap)',
            component: 'kinogo',
            onContextMenu: function (object) {
                return {
                    name: 'Kinogo',
                    description: ''
                };
            },
            onContextLauch: function (object) {
                Lampa.Activity.push({
                    url: '',
                    title: 'Kinogo',
                    component: 'kinogo',
                    movie: object,
                    page: 1
                });
            }
        };

        Lampa.Manifest.plugins = manifest;

        // РљРЅРѕРїРєР° РІ РєР°СЂС‚РѕС‡РєРµ С„РёР»СЊРјР°
        var buttonTemplate = '<div class="full-start__button selector view--kinogo" data-subtitle="Kinogo">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:8px;">' +
            '<polygon points="5 3 19 12 5 21 5 3"></polygon>' +
            '</svg>' +
            '<span>Kinogo</span>' +
            '</div>';

        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                var btn = $(buttonTemplate);

                btn.on('hover:enter', function () {
                    Lampa.Activity.push({
                        url: '',
                        title: 'Kinogo вЂ” ' + (e.data.movie.title || e.data.movie.name || ''),
                        component: 'kinogo',
                        movie: e.data.movie,
                        page: 1
                    });
                });

                var target = e.object.activity.render().find('.view--torrent');

                if (target.length) {
                    target.after(btn);
                } else {
                    e.object.activity.render().find('.full-start__buttons').append(btn);
                }
            }
        });
    }

    function startPlugin() {
        initLang();
        initMain();
    }

    if (typeof window !== 'undefined') {
        if (window.appready) {
            startPlugin();
        } else if (typeof Lampa !== 'undefined' && Lampa.Listener) {
            Lampa.Listener.follow('app', function (e) {
                if (e.type === 'ready') startPlugin();
            });
        } else {
            startPlugin();
        }
    }
})();e: 1
                        });
                    });

                    var target = renderNode.find('.view--torrent');
                    if (target.length) {
                        target.after(btn);
                    } else {
                        var buttonsContainer = renderNode.find('.full-start__buttons');
                        if (buttonsContainer.length) {
                            buttonsContainer.append(btn);
                        }
                    }
                } catch (er) {
                    console.log('Kinogo plugin listener error:', er);
                }
            }
        });
    }

    function startPlugin() {
        initLang();
        initMain();
    }

    if (typeof window !== 'undefined') {
        if (window.appready) {
            startPlugin();
        } else if (typeof Lampa !== 'undefined' && Lampa.Listener) {
            Lampa.Listener.follow('app', function (e) {
                if (e.type === 'ready') startPlugin();
            });
        } else {
            window.addEventListener('load', startPlugin);
        }
    }
})();
