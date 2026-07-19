(function () {
    'use strict';

    var mod_version = '1.0.0';

    function initLang() {
        if (typeof Lampa !== 'undefined' && Lampa.Lang) {
            Lampa.Lang.add({
                kinogo_title: {
                    ru: 'Kinogo',
                    en: 'Kinogo',
                    uk: 'Kinogo'
                }
            });
        }
    }

    function KinogoComponent(object) {
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var items = [];
        var html = $('<div></div>');
        var active_card = object.movie;

        this.create = function () {
            var _this = this;

            // Показываем загрузчик
            if (this.activity && typeof this.activity.loader === 'function') {
                this.activity.loader(true);
            }

            var kpId = active_card.kinopoisk_id || active_card.kp_id || '';
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
                if (_this.activity && typeof _this.activity.loader === 'function') {
                    _this.activity.loader(false);
                }
                
                if (response && response.data && response.data.length) {
                    _this.build(response.data);
                } else {
                    _this.empty();
                }
            }, function (err) {
                if (_this.activity && typeof _this.activity.loader === 'function') {
                    _this.activity.loader(false);
                }
                _this.empty();
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
                        var video = {
                            url: element.file,
                            title: (active_card.title || active_card.name || 'Кино') + ' — ' + (element.title || 'Дубляж'),
                            quality: element.quality || '1080p'
                        };

                        // Сначала передаем плейлист, затем запускаем
                        Lampa.Player.playlist([video]);
                        Lampa.Player.play(video);
                        
                        // Скрываем背景 (зависит от версии Lampa, обычно вызывается автоматически, но можно добавить)
                        // Lampa.Controller.toggle('content'); 
                    } else {
                        Lampa.Noty.show('Нет доступного потока для этой озвучки');
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
                descr: 'Не удалось извлечь потоки Kinogo'
            });
            html.append(emptyView);
        };

        this.render = function () {
            return html;
        };

        this.destroy = function () {
            network.clear();
            scroll.destroy();
            items.forEach(function (item) { item.remove(); });
            items = [];
            html.remove();
        };
    }

    function initMain() {
        if (typeof Lampa === 'undefined') return;

        // 1. Регистрация компонента
        Lampa.Component.add('kinogo', KinogoComponent);

        // 2. Манифест плагина
        var manifest = {
            type: 'video',
            version: mod_version,
            name: 'Kinogo',
            description: 'Смотреть онлайн Kinogo',
            component: 'kinogo',
            onContextMenu: function (object) {
                return {
                    name: 'Kinogo',
                    description: 'Смотреть онлайн'
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

        // Безопасная регистрация плагина
        if (Lampa.Plugins && typeof Lampa.Plugins.add === 'function') {
            Lampa.Plugins.add(manifest);
        }

        // 3. Шаблон кнопки
        var buttonTemplate = '<div class="full-start__button selector view--kinogo" data-subtitle="Kinogo">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:8px;">' +
            '<polygon points="5 3 19 12 5 21 5 3"></polygon>' +
            '</svg>' +
            '<span>Kinogo</span>' +
            '</div>';

        // 4. Слушатель карточки фильма
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                var renderNode = e.object.activity && e.object.activity.render ? e.object.activity.render() : null;
                if (!renderNode) return;

                // Защита от дублирования кнопки
                if (renderNode.find('.view--kinogo').length) return;

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

                var target = renderNode.find('.view--torrent');
                if (target.length) {
                    target.after(btn);
                } else {
                    var buttonsContainer = renderNode.find('.full-start__buttons');
                    if (buttonsContainer.length) {
                        buttonsContainer.append(btn);
                    }
                }
            }
        });
    }

    function startPlugin() {
        initLang();
        initMain();
    }

    // Безопасный запуск
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
