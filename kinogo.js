(function () {
    'use strict';

    var plugin_version = '1.0.0';

    function KinogoComponent(object) {
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var files = new Lampa.Files();
        var filter = new Lampa.Filter();
        var items = [];
        var html = $('<div></div>');
        var active_card = object.movie;

        this.create = function () {
            var _this = this;

            this.activity.loader(true);

            // Динамический запрос к API балансеров / Kinogo по ID Кинопоиск / TMDB / Названию
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

            network.silent(searchUrl, function (response) {
                _this.activity.loader(false);

                if (response && response.data && response.data.length) {
                    _this.build(response.data);
                } else {
                    _this.empty();
                }
            }, function () {
                // Фоллбэк запрос по названию
                var fallbackUrl = 'https://nb557.github.io/plugins/online_mod.js?title=' + encodeURIComponent(title);
                network.silent(fallbackUrl, function (res) {
                    _this.activity.loader(false);
                    if (res && res.data && res.data.length) {
                        _this.build(res.data);
                    } else {
                        _this.empty();
                    }
                }, function () {
                    _this.activity.loader(false);
                    _this.empty();
                });
            });

            return this.render();
        };

        this.build = function (data) {
            var _this = this;

            data.forEach(function (element) {
                var item = Lampa.Template.get('button', {
                    title: element.title || 'Дубляж',
                    subtitle: element.quality || '1080p'
                });

                item.on('hover:enter', function () {
                    if (element.file) {
                        Lampa.Player.play({
                            url: element.file,
                            title: active_card.title + ' — ' + (element.title || 'Дубляж'),
                            quality: element.quality || '1080p'
                        });
                        Lampa.Player.playlist([element]);
                    }
                });

                scroll.append(item);
                items.push(item);
            });

            html.append(scroll.render());
        };

        this.empty = function () {
            var emptyView = Lampa.Template.get('empty', {
                title: 'Ничего не найдено',
                descr: 'Не удалось автоматически найти поток на Kinogo'
            });
            html.append(emptyView);
        };

        this.render = function () {
            return html;
        };

        this.destroy = function () {
            network.clear();
            scroll.destroy();
            files.destroy();
            filter.destroy();
            html.remove();
        };
    }

    function initPlugin() {
        // Регистрация компонента
        Lampa.Component.add('kinogo', KinogoComponent);

        // Регистрация плагина в манифесте Lampa
        Lampa.Manifest.plugins = {
            type: 'video',
            version: plugin_version,
            name: 'Kinogo',
            description: 'Онлайн просмотр с Kinogo / Cinemap CDN',
            component: 'kinogo'
        };

        // Шаблон кнопки
        var btnTemplate = '<div class="full-start__button selector view--kinogo" style="background:#e50914;color:#ffffff;border-radius:6px;padding:10px 18px;margin-left:10px;display:inline-flex;align-items:center;cursor:pointer;font-weight:600;">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:8px;">' +
            '<polygon points="5 3 19 12 5 21 5 3"></polygon>' +
            '</svg>' +
            '<span>Kinogo</span>' +
            '</div>';

        // Слушатель открытия карточки
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                var btn = $(btnTemplate);

                btn.on('hover:enter', function () {
                    Lampa.Activity.push({
                        url: '',
                        title: 'Kinogo — ' + (e.data.movie.title || e.data.movie.name),
                        component: 'kinogo',
                        movie: e.data.movie,
                        page: 1
                    });
                });

                var container = e.object.activity.render().find('.view--torrent');
                if (container.length) {
                    container.after(btn);
                } else {
                    e.object.activity.render().find('.full-start__buttons').append(btn);
                }
            }
        });
    }

    if (typeof window !== 'undefined') {
        if (window.appready) {
            initPlugin();
        } else if (typeof Lampa !== 'undefined' && Lampa.Listener) {
            Lampa.Listener.follow('app', function (e) {
                if (e.type === 'ready') initPlugin();
            });
        }
    }
})();
