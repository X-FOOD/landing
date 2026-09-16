# XFOOD Controlling — лендинг xfood.tech

Статический лендинг-дискаунтер. Публикуется на **GitHub Pages** с привязанным доменом `xfood.tech`,
DNS — в Cloudflare (режим DNS-only, без прокси — чтобы стабильно открывался из РФ).

## Структура

```
src/                      исходники сайта (то, что редактируем)
├── index.html            главная: разметка + SEO-теги + JSON-LD
├── 404.html              страница «не найдено»
├── input.css             Tailwind + @font-face (Inter, self-hosted)
├── js/prices.js          ЦЕНЫ И ТАРИФЫ — единственное место, где они правятся
├── js/main.js            логика переключения планов и события аналитики
├── assets/               логотип, favicon-набор, og.png, шрифты
├── CNAME                 домен для GitHub Pages
├── robots.txt            разрешение индексации + ссылка на sitemap
├── sitemap.xml           карта сайта
└── site.webmanifest      PWA-манифест (иконки, цвета)
scripts/copy.mjs          копирует src → dist при сборке
scripts/gen-images.py     генерирует favicon/og.png из assets/logo.png (руками, при смене логотипа)
.github/workflows/deploy.yml  сборка и деплой на Pages при push в main
dist/                     результат сборки (в git не хранится)
```

## Локальная разработка

```bash
npm install
npm run build      # src → dist + сборка Tailwind
npm run serve      # http://localhost:8787 (раздаёт dist/)
npm run dev        # пересобирает CSS при изменениях (index.html копируется один раз — после правок HTML запустите build снова)
```

Требования: Node 20+. Для `gen-images.py` — Python 3 + Pillow (`pip install pillow numpy`).

## Как поменять цены

Откройте [`src/js/prices.js`](src/js/prices.js) — там один объект `PRICES`:

```js
'1cam': {
  '12': { current: 3999, old: null, discount: null },   // цена, старая цена (или null), % для бейджа (или null)
  '20': { current: 4999, old: 6665, discount: 25 },
  ...
}
```

После правки — `git commit` и `git push` в `main`, сайт пересоберётся сам (2–3 минуты).

Две вещи держите синхронными вручную (они нужны поисковикам, которые не выполняют JS):
1. начальные цены в `src/index.html` (`id="price-1cam"`, `id="price-3cam"`, бейджи `data-plan-discount`);
2. цены в JSON-LD (`"price": "3999"` / `"5999"` в блоке `application/ld+json`).

Цена пробной проверки («1 ₽») упоминается в тексте `index.html` (баннер, кнопки, тарифы, FAQ), в meta/OG-описаниях, JSON-LD и на `og.png` — при изменении правьте эти места и перегенерируйте картинку (`python3 scripts/gen-images.py`).

## Деплой

Push в `main` → GitHub Actions (`deploy.yml`) → `npm ci` → `npm run build` → артефакт `dist/` → GitHub Pages.
Статус: вкладка **Actions** репозитория. Ручной запуск: Actions → «Build & Deploy to GitHub Pages» → Run workflow.

Настройки Pages (Settings → Pages): Source = **GitHub Actions**, Custom domain = `xfood.tech`, Enforce HTTPS = on.

## DNS (Cloudflare, зона xfood.tech)

| Имя | Тип | Значение | Прокси |
|---|---|---|---|
| `xfood.tech` | A | 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153 | DNS only |
| `xfood.tech` | AAAA | 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153 | DNS only |
| `www` | CNAME | `x-food.github.io` | DNS only |
| `app` | A | 203.189.233.60 (RU-сервер, Nginx Proxy Manager) | DNS only |
| MX / TXT / DKIM | — | Proton Mail — не трогать | — |

**Почему DNS-only:** трафик из РФ идёт напрямую в GitHub Pages, минуя прокси Cloudflare, у которого
периодически бывают проблемы у части российских провайдеров. TLS-сертификат выдаёт GitHub (Let's Encrypt).

Правило Cloudflare «Redirect legacy to RU» (редирект корня в app.critfaktor.ru) **отключено** —
не включайте: оно уведёт лендинг обратно в CRM, если кто-то включит оранжевую тучу.

## Редиректы

```
https://xfood.tech/            → лендинг (GitHub Pages)
https://www.xfood.tech/        → 301 → https://xfood.tech/          (делает GitHub Pages)
https://app.xfood.tech/        → 301 → https://xfood.tech/          (Nginx Proxy Manager, location = /)
https://app.xfood.tech/<путь>  → 301 → https://app.critfaktor.ru/<путь>  (старые ссылки на проверки)
```

`app.xfood.tech` — это **Redirection Host** в Nginx Proxy Manager на RU-сервере (`ssh xfood-npm`, контейнер `npm`).
Разделение «корень → лендинг / путь → CRM» сделано блоком:

```nginx
# app.xfood.tech: пустой корень → лендинг; всё остальное → CRM (location / из NPM)
location = / {
    return 301 https://xfood.tech/$is_args$args;
}
```

**Сейчас применён вариант C** (файл `/data/nginx/custom/server_redirect.conf` внутри контейнера `npm`, применён 2026-09-15). Если захотите перенести блок в UI NPM (вариант A/B) — **сначала удалите этот файл** (`docker exec npm rm /data/nginx/custom/server_redirect.conf` + `nginx -s reload`), иначе nginx упадёт на `duplicate location "= /"`.

Подробнее — см. раздел «Nginx Proxy Manager» ниже. Точный `location = /` имеет приоритет над `location /`,
поэтому редирект глубоких ссылок в CRM не меняется.

### Nginx Proxy Manager: как править

Вариант A — через UI: Hosts → Redirection Hosts → `app.xfood.tech` → Edit → вкладка **Advanced** → поле
«Custom Nginx Configuration» → вставить блок выше → Save. NPM сам перегенерирует конфиг и перезагрузит nginx.

Вариант B — через MCP из Claude Code (файл `.mcp.json` в корне проекта, в git не попадает):

```bash
# 1. туннель до админки NPM (порт 81 — plain HTTP, пароль через интернет не отправляем)
ssh -N -f -L 8181:127.0.0.1:81 xfood-npm
# 2. креды админа NPM — только в окружении
export NPM_EMAIL='admin@...' NPM_PASSWORD='...'
# 3. перезапустить сессию Claude Code, подтвердить project MCP "npm"
```

Дальше: `get_redirection_host(host_id=1)` → `update_redirection_host(host_id=1, advanced_config="...")`.

Вариант C — без кредов, через docker (файл подключается шаблоном NPM ко ВСЕМ Redirection Host):

```bash
ssh xfood-npm 'docker exec npm sh -c "mkdir -p /data/nginx/custom && cat > /data/nginx/custom/server_redirect.conf"' <<'EOF'
location = / {
    return 301 https://xfood.tech/$is_args$args;
}
EOF
ssh xfood-npm 'docker exec npm nginx -t && docker exec npm nginx -s reload'
```

> ⚠️ Админ-API NPM (порт 81) сейчас открыт в интернет: `http://203.189.233.60:81/api/` отвечает снаружи.
> Рекомендуется закрыть порт фаерволом и ходить только через SSH-туннель.

## Google Analytics 4 — подключение

1. Откройте [analytics.google.com](https://analytics.google.com/) → **Admin** (шестерёнка внизу слева) → **Create → Property**.
2. Название `XFOOD Controlling`, часовой пояс `Москва`, валюта `RUB` → Next → заполните данные о бизнесе → Create.
3. **Data streams → Add stream → Web**: URL `https://xfood.tech`, название `xfood.tech` → Create stream.
4. На экране потока скопируйте **Measurement ID** — вида `G-XXXXXXXXXX`.
5. В [`src/index.html`](src/index.html) в блоке `<!-- Google tag (gtag.js) -->` подставьте свой ID в двух местах
   (`gtag/js?id=G-…` и `gtag('config', 'G-…')`). Сейчас там уже стоит рабочий ID `G-G85X8HWWKG`.
6. `git commit` + `git push` → через пару минут откройте сайт и проверьте:
   GA4 → **Reports → Realtime** — должен появиться 1 активный пользователь.
   Точнее: Admin → **DebugView** с расширением [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger/jnkmfdileelhofjcijamephohjechhna).

Что уже отправляется в GA (см. `src/js/main.js`):
- `page_view` — автоматически (сниппет gtag.js в `<head>`);
- `generate_lead` — клики по «Попробовать» (баннер, hero), «Связаться», «Оформить подписку», Telegram в футере (параметр `label`: `banner_trial`, `hero_trial`, `nav_contact`, `tariff_1cam`, `tariff_3cam`, `footer_telegram`);
- `select_plan` — выбор плана (`tariff`, `plan`, `value`).

Рекомендуется в GA4: Admin → **Events** → отметить `generate_lead` как **Key event** (конверсия).

Замечания для РФ-аудитории:
- у части провайдеров скрипты Google грузятся медленно или блокируются — данные GA будут неполными.
  Если нужна точная статистика по РФ, добавьте **Яндекс.Метрику** тем же способом (счётчик → код → в `<head>`).
- по 152-ФЗ и практике РКН стоит добавить уведомление об использовании cookie/метрик (баннер), если начнёте собирать аналитику.

## Google Analytics из Claude Code (MCP)

Установлен [google-analytics-mcp](https://github.com/googleanalytics/google-analytics-mcp) (пакет `analytics-mcp`, запуск через `uvx`):
`claude mcp add analytics-mcp --scope user -- uvx analytics-mcp`. Он читает отчёты GA4 (`run_report`, `run_realtime_report`, `run_funnel_report`, …).

Чтобы он заработал, нужны учётные данные Google (делается один раз, руками владельца GA).

> ⚠️ Команда `gcloud auth application-default login --scopes=…analytics.readonly` со встроенным client ID gcloud
> **больше не работает** («Приложение заблокировано»): Google запретил этот scope для дефолтного клиента.
> Нужен свой OAuth-клиент (вариант A) или сервисный аккаунт (вариант B, проще).

Общий шаг: в [Google Cloud Console](https://console.cloud.google.com/) создайте проект и включите
[Google Analytics Admin API](https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com) и
[Google Analytics Data API](https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com).

### Вариант B — сервисный аккаунт (рекомендуется, без браузерного OAuth)

1. Console → **IAM & Admin → Service Accounts → Create service account**: имя `analytics-mcp`, роли не нужны → Done.
   Либо в терминале (после `gcloud auth login` и `gcloud config set project PROJECT_ID`):
   ```bash
   gcloud iam service-accounts create analytics-mcp --display-name "Analytics MCP"
   gcloud iam service-accounts keys create ~/.config/gcloud/analytics-mcp-sa.json --iam-account analytics-mcp@PROJECT_ID.iam.gserviceaccount.com
   chmod 600 ~/.config/gcloud/analytics-mcp-sa.json
   ```
   (В консоли: открыть аккаунт → **Keys → Add key → Create new key → JSON**, сохранить в `~/.config/gcloud/analytics-mcp-sa.json`.)
2. Дать сервисному аккаунту доступ к GA4: [analytics.google.com](https://analytics.google.com/) → **Admin → Property → Property access management → +** →
   e-mail `analytics-mcp@PROJECT_ID.iam.gserviceaccount.com`, роль **Viewer**.
3. Перерегистрировать MCP с путём к ключу и ID проекта:
   ```bash
   claude mcp remove analytics-mcp -s user
   claude mcp add analytics-mcp --scope user -e GOOGLE_APPLICATION_CREDENTIALS=$HOME/.config/gcloud/analytics-mcp-sa.json -e GOOGLE_PROJECT_ID=PROJECT_ID -- uvx analytics-mcp
   ```
4. Перезапустить сессию Claude Code и спросить: «покажи мои свойства Google Analytics».

### Вариант A — свой OAuth-клиент (вход под вашим Google-аккаунтом)

1. Console → **APIs & Services → OAuth consent screen** (Google Auth Platform): тип **External**, статус **Testing**,
   в **Test users** добавьте свой Google-аккаунт (тот, у которого есть доступ к GA4).
2. **Credentials → Create credentials → OAuth client ID → Desktop app** → скачать JSON в `~/.config/gcloud/oauth-client.json`.
3. Авторизоваться уже со своим клиентом:
   ```bash
   gcloud auth application-default login --scopes=https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform --client-id-file=$HOME/.config/gcloud/oauth-client.json
   ```
   Файл ADC сохранится в `~/.config/gcloud/application_default_credentials.json`, MCP найдёт его сам.
4. Перерегистрировать MCP с ID проекта и перезапустить сессию:
   ```bash
   claude mcp remove analytics-mcp -s user
   claude mcp add analytics-mcp --scope user -e GOOGLE_PROJECT_ID=PROJECT_ID -- uvx analytics-mcp
   ```

## SEO-чеклист (что уже сделано)

- `<title>`, `meta description`, `canonical`, `robots`, `theme-color`, `lang="ru"`;
- Open Graph + Twitter Card с картинкой 1200×630 (`assets/og.png`);
- JSON-LD: `Organization`, `WebSite`, `WebPage`, `Service` c `Offer` (цены), `FAQPage`;
- favicon (`.ico`, 32px PNG, apple-touch-icon 180px), `site.webmanifest`;
- `robots.txt` + `sitemap.xml`;
- своя `404.html`;
- шрифт Inter и логотип хостятся локально, Tailwind собирается в один минифицированный CSS (без CDN);
- семантика: `<main>`, `<section aria-labelledby>`, `<article>` для тарифов, `<fieldset>`/`<legend>` у радиокнопок, `width/height` у изображений.

После публикации: добавьте сайт в **Google Search Console** и **Яндекс.Вебмастер** (подтверждение через DNS TXT в Cloudflare или через HTML-тег в `<head>`), отправьте `https://xfood.tech/sitemap.xml`.
