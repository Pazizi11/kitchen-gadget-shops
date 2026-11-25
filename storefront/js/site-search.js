/* ==========================================================================
   Kitchen Gadget Shops — Site-Wide Search
   Searches Medusa products and product categories.
   ========================================================================== */

(function () {
  'use strict';

  let SITE_SEARCH_PRODUCTS = null;
  let SITE_SEARCH_LOADING = null;

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getProductImage(product) {
    if (!product) return '';

    if (product.image) {
      return String(product.image);
    }

    if (product.thumbnail) {
      return String(product.thumbnail);
    }

    if (Array.isArray(product.images) && product.images.length) {
      const first = product.images[0];

      if (typeof first === 'string') {
        return first;
      }

      if (first && first.url) {
        return String(first.url);
      }
    }

    return '';
  }

  async function loadSiteSearchProducts() {
    if (Array.isArray(SITE_SEARCH_PRODUCTS)) {
      return SITE_SEARCH_PRODUCTS;
    }

    if (SITE_SEARCH_LOADING) {
      return SITE_SEARCH_LOADING;
    }

    SITE_SEARCH_LOADING = apiGetAll('products')
      .then(function (products) {
        SITE_SEARCH_PRODUCTS = Array.isArray(products) ? products : [];

        SITE_SEARCH_PRODUCTS.forEach(function (product) {
          if (
            product &&
            product.id &&
            window._productCache
          ) {
            window._productCache[product.id] = product;
          }
        });

        return SITE_SEARCH_PRODUCTS;
      })
      .catch(function (error) {
        console.error('Site search could not load products:', error);
        SITE_SEARCH_PRODUCTS = [];
        return [];
      });

    return SITE_SEARCH_LOADING;
  }

  function getCategories(products) {
    const seen = {};
    const categories = [];

    (products || []).forEach(function (product) {
      const category = String(product.category || '').trim();

      if (!category) return;

      const key = category.toLowerCase();

      if (!seen[key]) {
        seen[key] = true;
        categories.push(category);
      }
    });

    return categories.sort(function (a, b) {
      return a.localeCompare(b);
    });
  }

  function matchesProduct(product, search) {
    const name = String(product.name || '').toLowerCase();
    const description = String(product.short_description || '').toLowerCase();
    const category = String(product.category || '').toLowerCase();

    return (
      name.includes(search) ||
      description.includes(search) ||
      category.includes(search)
    );
  }

  function renderSuggestions(wrapper, input, query, products) {
    if (!wrapper) return;

    const search = String(query || '').trim().toLowerCase();

    if (!search) {
      wrapper.innerHTML = '';
      wrapper.classList.remove('open');
      return;
    }

    const matchingProducts = (products || [])
      .filter(function (product) {
        return matchesProduct(product, search);
      })
      .slice(0, 6);

    const matchingCategories = getCategories(products)
      .filter(function (category) {
        return category.toLowerCase().includes(search);
      })
      .slice(0, 4);

    if (
      matchingProducts.length === 0 &&
      matchingCategories.length === 0
    ) {
      wrapper.innerHTML =
        '<div class="site-search-empty">No products or categories found</div>';

      wrapper.classList.add('open');
      return;
    }

    let html = '';

    if (matchingProducts.length > 0) {
      html += '<div class="site-search-section-title">Products</div>';

      matchingProducts.forEach(function (product) {
        const image = getProductImage(product);

        html +=
          '<a href="product.html?id=' +
          encodeURIComponent(product.id) +
          '" class="site-search-result site-search-product-result">' +
          (
            image
              ? '<img src="' +
                escapeHtml(image) +
                '" alt="' +
                escapeHtml(product.name) +
                '">'
              : '<span class="site-search-result-icon"><i class="fa-solid fa-utensils"></i></span>'
          ) +
          '<span class="site-search-result-text">' +
          '<strong>' +
          escapeHtml(product.name) +
          '</strong>' +
          (
            product.category
              ? '<small>' + escapeHtml(product.category) + '</small>'
              : ''
          ) +
          '</span>' +
          '</a>';
      });
    }

    if (matchingCategories.length > 0) {
      html += '<div class="site-search-section-title">Categories</div>';

      matchingCategories.forEach(function (category) {
        html +=
          '<a href="products.html?category=' +
          encodeURIComponent(category) +
          '" class="site-search-result site-search-category-result">' +
          '<span class="site-search-category-icon">' +
          '<i class="fa-solid fa-layer-group"></i>' +
          '</span>' +
          '<span class="site-search-result-text">' +
          '<strong>' +
          escapeHtml(category) +
          '</strong>' +
          '<small>View category</small>' +
          '</span>' +
          '</a>';
      });
    }

    html +=
      '<a href="products.html?search=' +
      encodeURIComponent(query.trim()) +
      '" class="site-search-view-all">' +
      'View all results <i class="fa-solid fa-arrow-right"></i>' +
      '</a>';

    wrapper.innerHTML = html;
    wrapper.classList.add('open');

    wrapper.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        wrapper.classList.remove('open');
      });
    });
  }

  function goToSearch(input) {
    const query = String(input.value || '').trim();

    if (!query) {
      return;
    }

    window.location.href =
      'products.html?search=' + encodeURIComponent(query);
  }

  function setupSearchBox(input, wrapper) {
    if (!input || !wrapper) return;

    let debounceTimer = null;

    input.addEventListener('input', function () {
      const query = input.value.trim();

      clearTimeout(debounceTimer);

      if (!query) {
        wrapper.innerHTML = '';
        wrapper.classList.remove('open');
        return;
      }

      debounceTimer = setTimeout(function () {
        loadSiteSearchProducts().then(function (products) {
          renderSuggestions(wrapper, input, query, products);
        });
      }, 120);
    });

    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        goToSearch(input);
      }

      if (event.key === 'Escape') {
        wrapper.classList.remove('open');
      }
    });

    input.addEventListener('focus', function () {
      const query = input.value.trim();

      if (!query) return;

      loadSiteSearchProducts().then(function (products) {
        renderSuggestions(wrapper, input, query, products);
      });
    });
  }

  function closeSearchWhenClickingOutside() {
    document.addEventListener('click', function (event) {
      if (
        event.target.closest &&
        event.target.closest('.site-search')
      ) {
        return;
      }

      document
        .querySelectorAll('.site-search-suggestions.open')
        .forEach(function (wrapper) {
          wrapper.classList.remove('open');
        });
    });
  }

  window.initSiteSearch = function () {
    const desktopInput =
      document.getElementById('siteSearchInput');

    const desktopSuggestions =
      document.getElementById('siteSearchSuggestions');

    const mobileInput =
      document.getElementById('mobileSiteSearchInput');

    const mobileSuggestions =
      document.getElementById('mobileSiteSearchSuggestions');

    setupSearchBox(
      desktopInput,
      desktopSuggestions
    );

    setupSearchBox(
      mobileInput,
      mobileSuggestions
    );

    closeSearchWhenClickingOutside();
  };
})();