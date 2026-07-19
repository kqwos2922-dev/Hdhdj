(function () {
    'use strict';

    // ======== Переводы ========
    if (!Lampa.Lang) {
        var lang_data = {};
        Lampa.Lang = {
            add: function (data) { lang_data = data; },
            translate: function (key) { return lang_data[key] ? lang_data[key].ru : key; }
        };
    }

    Lampa.Lang.add({
        kinogo_title: {
            ru: 'Kinogo',
            en: 'Kinogo',
            uk: 'Kinogo'
        },
        kinogo_nolink: {
            ru: 'Не удалось извлечь ссылку',
            en: 'Failed to fetch link',
            uk: 'Не вдалося отримати посилання'
        }
    });

    // ======== Шаблоны элементов списка ========
    function resetTemplates() {
        Lampa.Template.add('kinogo_item', '<div class="online selector">' +
            '<div class="online__body">' +
            '<div style="position:absolute;left:0;top:-0.3em;width:2.4em;height:2.4em">' +
            '<svg style="height:2.4em;width:2.4em" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<circle cx="64" cy="64" r="56" stroke="white" stroke-width="16"/>' +
            '<path d="M90.5 64.3827L50 87.7654L50 41L90.5 64.3827Z" fill="white"/>' +
            '</svg>' +
            '</div>' +
            '<div class="online__title" style="padding-left:2.1em">{title}</div>' +
            '<div class="online__quality" style="padding-left:3.4em">{quality}{info}</div>' +
            '</div>' +
            '</div>');
    }

    // ======== Кнопка в карточке фильма ========
    var button = '<div class="full-start__button selector view--kinogo" data-subtitle="Kinogo">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 30.051 30.051" style="enable-background:new 0 0 512 512">' +
        '<g xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M19.982,14.438l-6.24-4.536c-0.229-0.166-0.533-0.191-0.784-0.062c-0.253,0.128-0.411,0.388-0.411,0.669v9.069c0,0.284,0.158,0.543,0.411,0.671c0.107,0.054,0.224,0.081,0.342,0.081c0.154,0,0.31-0.049,0.442-0.146l6.24-4.532c0.197-0.145,0.312-0.369,0.312-0.607C20.295,14.803,20.177,14.58,19.982,14.438z" fill="currentColor"/>' +
        '<path d="M15.026,0.002C6.726,0.002,0,6.728,0,15.028c0,8.297,6.726,15.021,15.026,15.021c8.298,0,15.025-6.725,15.025-15.021C30.052,6.728,23.324,0.002,15.026,0.002z M15.026,27.542c-6.912,0-12.516-5.601-12.516-12.514c0-6.91,5.604-12.518,12.516-12.518c6.911,0,12.514,5.607,12.514,12.518C27.541,21.941,21.937,27.542,15.026,27.542z" fill="currentColor"/>' +
        '</g></svg>' +
        '<span>#{kinogo_title}</span>' +
        '</div>';

    // ======== Компонент Kinogo ========
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
                Lampa.Activity.replace({
                    search: value,
                    clarification: true
                });
            };

            filter.onBack = function () {
                Lampa.Activity.backward();
            };

            filter.render().find('.selector').on('hover:focus', function (e) {
                // запоминаем последний фильтр
            });

            filter.render();
            files.append(scroll.render());
            scroll.append(filter.render());

            // Запрос к API
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
                    _this.emptyShow();
                }

                _this.activity.toggle();
            }, function () {
                _this.activity.loader(false);
                _this.emptyShow();
                _this.activity.toggle();
            });

            return this.render();
        };

        // ---- Построение списка ----
        this.build = function (data) {
            var _this = this;

            playlist = [];

            data.forEach(function (element) {
                var movieTitle = active_card.title || active_card.name || '';
                var voiceTitle = element.title || 'Дубляж';
                var quality = element.quality || '1080p';
                var streamUrl = element.file || element.url || '';

                if (!streamUrl) return;

                var item = Lampa.Template.get('kinogo_item', {
                    title: voiceTitle,
                    quality: quality,
                    info: ''
                });

                item.on('hover:enter', function () {
                    Lampa.Player.play({
                        url: streamUrl,
                        title: movieTitle + ' — ' + voiceTitle,
                        quality: quality
                    });

                    Lampa.Player.playlist(playlist);
                });

                item.on('hover:focus', function () {
                    scroll.update(item);
                });

                playlist.push({
                    url: streamUrl,
                    title: movieTitle + ' — ' + voiceTitle,
                    quality: quality
                });

                scroll.append(item);
            });

            if (playlist.length === 0) {
                this.emptyShow();
            }
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
        this.render = function () {
            return html;
        };

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
        description: 'Смотреть онлайн Kinogo (Cinemap)',
        component: 'kinogo',
        onContextMenu: function (object) {
            return {
                name: 'Kinogo',
                description: ''
            };
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

    // ======== Кнопка в карточке ========
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

})();on (response) {
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
