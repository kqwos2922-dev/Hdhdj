(function () {
    'use strict';

    var mod_version = '1.0.0';

    // --- Утилиты из оригинального плагина для идеальной работы ссылок ---

    function startsWith(str, searchString) {
        return str.lastIndexOf(searchString, 0) === 0;
    }

    function endsWith(str, searchString) {
        var start = str.length - searchString.length;
        if (start < 0) return false;
        return str.indexOf(searchString, start) === start;
    }

    function parseURL(link) {
        var url = {
            href: link,
            protocol: '',
            host: '',
            origin: '',
            pathname: '',
            search: '',
            hash: ''
        };
        var pos = link.indexOf('#');

        if (pos !== -1) {
            url.hash = link.substring(pos);
            link = link.substring(0, pos);
        }

        pos = link.indexOf('?');

        if (pos !== -1) {
            url.search = link.substring(pos);
            link = link.substring(0, pos);
        }

        pos = link.indexOf(':');
        var path_pos = link.indexOf('/');

        if (pos !== -1 && (path_pos === -1 || path_pos > pos)) {
            url.protocol = link.substring(0, pos + 1);
            link = link.substring(pos + 1);
        }

        if (startsWith(link, '//')) {
            pos = link.indexOf('/', 2);

            if (pos !== -1) {
                url.host = link.substring(2, pos);
                link = link.substring(pos);
            } else {
                url.host = link.substring(2);
                link = '/';
            }

            url.origin = url.protocol + '//' + url.host;
        }

        url.pathname = link;
        return url;
    }

    function fixLink(link, referrer) {
        if (link) {
            if (!referrer || link.indexOf('://') !== -1) return link;
            var url = parseURL(referrer);
            if (startsWith(link, '//')) return url.protocol + link;
            if (startsWith(link, '/')) return url.origin + link;
            if (startsWith(link, '?')) return url.origin + url.pathname + link;
            if (startsWith(link, '#')) return url.origin + url.pathname + url.search + link;
            var base = url.origin + url.pathname;
            base = base.substring(0, base.lastIndexOf('/') + 1);
            return base + link;
        }
        return link;
    }

    function fixLinkProtocol(link, prefer_http, replace_protocol) {
        if (link) {
            if (startsWith(link, '//')) {
                return (prefer_http ? 'http:' : 'https:') + link;
            } else if (prefer_http && replace_protocol) {
                return link.replace('https://', 'http://');
            } else if (!prefer_http && replace_protocol === 'full') {
                return link.replace('http://', 'https://');
            }
        }
        return link;
    }

    // --- Компонент Kinogo ---

    function KinogoComponent(object) {
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var items = [];
        var html = $('<div></div>');
        var active_card = object.movie;
        var select_title = active_card.title || active_card.name || '';

        // ВАЖНО: Рендерим скролл сразу, чтобы Lampa не крашилась с восклицательным знаком
        html.append(scroll.render());

        this.create = function () {
            var _this = this;

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
            var playlist = []; // Формируем плейлист для плеера

            data.forEach(function (element) {
                if (!element.file) return; // Пропускаем если нет потока

                var stream_title = element.title || 'Дубляж';
                var quality = element.quality || '1080p';

                // Чиним ссылку с помощью утилит оригинального плагина
                var file_url = fixLink(element.file, 'https://bylampa.online');
                file_url = fixLinkProtocol(file_url, false, 'full');

                // Используем стандартный шаблон кнопки
                var item = Lampa.Template.get('button', {
                    title: stream_title,
                    subtitle: quality
                });

                var video = {
                    url: file_url,
                    title: select_title + ' — ' + stream_title,
                    quality: quality
                };

                item.on('hover:enter', function () {
                    if (element.loading) return;
                    
                    // Добавляем в историю Lampa
                    if (active_card.id) Lampa.Favorite.add('history', active_card, 100);
                    
                    element.loading = true;

                    // Передаем плейлист и запускаем видео
                    Lampa.Player.playlist(playlist);
                    Lampa.Player.play(video);

                    element.loading = false;
                });

                scroll.append(item);
                items.push(item);
                playlist.push(video);
            });

            // Если после фильтрации ничего нет - показываем пустоту
            if (items.length === 0) {
                _this.empty();
            } else {
                Lampa.Controller.enable('content');
            }
        };

        this.empty = function () {
            var emptyView = Lampa.Template.get('empty', {
                title: 'Ничего не найдено',
                descr: 'Не удалось извлечь потоки Kinogo'
            });
            scroll.append(emptyView);
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

    // --- Инициализация плагина ---

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

    function initMain() {
        if (typeof Lampa === 'undefined') return;

        Lampa.Component.add('kinogo', KinogoComponent);

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

        if (Lampa.Plugins && typeof Lampa.Plugins.add === 'function') {
            Lampa.Plugins.add(manifest);
        }

        var buttonTemplate = '<div class="full-start__button selector view--kinogo" data-subtitle="Kinogo">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:8px;">' +
            '<polygon points="5 3 19 12 5 21 5 3"></polygon>' +
            '</svg>' +
            '<span>Kinogo</span>' +
            '</div>';

        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                try {
                    var activity = e.object.activity || e.object;
                    var renderNode = activity && typeof activity.render === 'function' ? activity.render() : false;

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
