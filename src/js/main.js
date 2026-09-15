/* Логика лендинга: переключение планов, отрисовка цен из PRICES, события аналитики.
 * Цены НЕ здесь — см. js/prices.js. */
(function () {
  'use strict';

  var P = window.PRICES;
  if (!P) return;

  function formatPrice(n) {
    // 12890 → "12 890 ₽" (неразрывный пробел между разрядами)
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ' + P.currency;
  }

  function render(tariff, plan) {
    var data = P.tariffs[tariff] && P.tariffs[tariff][plan];
    if (!data) return;

    var priceEl = document.getElementById('price-' + tariff);
    var oldEl = document.getElementById('old-price-' + tariff);
    if (priceEl) priceEl.textContent = formatPrice(data.current);
    if (oldEl) {
      if (data.old) {
        oldEl.textContent = formatPrice(data.old);
        oldEl.classList.remove('hidden');
      } else {
        oldEl.textContent = '';
        oldEl.classList.add('hidden');
      }
    }
  }

  function initTariff(tariff) {
    var radios = document.querySelectorAll('input[name="plan-' + tariff + '"]');
    if (!radios.length) return;

    radios.forEach(function (input) {
      var plan = input.value;
      var planInfo = P.plans[plan] || {};
      var data = P.tariffs[tariff][plan] || {};
      var card = input.closest('label');

      // Подписи плана и бейдж скидки — из конфига, чтобы не разъезжались с ценами.
      var labelEl = card && card.querySelector('[data-plan-label]');
      var checksEl = card && card.querySelector('[data-plan-checks]');
      var badgeEl = card && card.querySelector('[data-plan-discount]');
      if (labelEl && planInfo.label) labelEl.textContent = planInfo.label;
      if (checksEl && planInfo.checks) checksEl.textContent = planInfo.checks;
      if (badgeEl) {
        if (data.discount) {
          badgeEl.textContent = '-' + data.discount + '%';
          badgeEl.classList.remove('hidden');
        } else {
          badgeEl.classList.add('hidden');
        }
      }

      input.addEventListener('change', function () {
        if (input.checked) {
          render(tariff, plan);
          track('select_plan', { tariff: tariff, plan: plan, value: data.current });
        }
      });

      if (input.checked) render(tariff, plan);
    });
  }

  // --- Аналитика: единая точка отправки событий (GA4, если подключена) ---
  function track(eventName, params) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params || {});
    }
  }

  function initTracking() {
    document.querySelectorAll('[data-track]').forEach(function (el) {
      el.addEventListener('click', function () {
        track(el.getAttribute('data-track'), {
          label: el.getAttribute('data-track-label') || el.textContent.trim(),
          currency: 'RUB'
        });
      });
    });
  }

  function init() {
    Object.keys(P.tariffs).forEach(initTariff);
    initTracking();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
