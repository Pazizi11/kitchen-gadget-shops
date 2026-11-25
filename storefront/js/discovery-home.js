/* =========================================================
   KITCHEN GADGET SHOPS â€” HOMEPAGE 1
   Discovery / Authentication / Search / Product Behavior
========================================================= */

(function () {
  "use strict";


  /* ---------------------------------------------------------
     Determine whether the customer is already authenticated
  --------------------------------------------------------- */

  function isCustomerLoggedIn() {

    try {

      /*
       * Existing customer-auth.js uses:
       * kgs_customer_auth_v1
       */

      const raw =
        localStorage.getItem("kgs_customer_auth_v1");

      if (!raw) {
        return false;
      }

      const auth =
        JSON.parse(raw);

      return Boolean(
        auth &&
        (
          auth.token ||
          auth.accessToken ||
          auth.access_token
        )
      );

    } catch (error) {

      console.warn(
        "Unable to determine customer authentication state.",
        error
      );

      return false;
    }
  }


  /* ---------------------------------------------------------
     Popup elements
  --------------------------------------------------------- */

  function getModalElements() {

    const modal =
      document.getElementById("discoveryLoginModal");

    if (!modal) {
      return null;
    }

    return {

      modal,

      closeButton:
        document.getElementById("discoveryModalClose"),

      overlay:
        modal.querySelector(
          "[data-close-discovery-modal]"
        ),

      loginForm:
        document.getElementById("discoveryLoginForm"),

      emailInput:
        document.getElementById("discoveryEmail"),

      googleButton:
        document.getElementById("discoveryGoogleButton"),

      registerLink:
        document.getElementById("discoveryRegisterLink"),

      unlockButton:
        document.getElementById("heroUnlockButton"),

      exploreButton:
        document.getElementById("heroExploreButton")
    };
  }


  /* ---------------------------------------------------------
     Open popup
  --------------------------------------------------------- */

  function openLoginModal() {

    const elements =
      getModalElements();

    if (!elements) {
      return;
    }

    if (isCustomerLoggedIn()) {
      return;
    }

    elements.modal.classList.add("is-open");

    elements.modal.setAttribute(
      "aria-hidden",
      "false"
    );

    setTimeout(function () {

      if (elements.emailInput) {
        elements.emailInput.focus();
      }

    }, 100);
  }


  /* ---------------------------------------------------------
     Close popup
  --------------------------------------------------------- */

  function closeLoginModal() {

    const elements =
      getModalElements();

    if (!elements) {
      return;
    }

    elements.modal.classList.remove("is-open");

    elements.modal.setAttribute(
      "aria-hidden",
      "true"
    );
  }


  /* ---------------------------------------------------------
     Save destination before authentication
  --------------------------------------------------------- */

  function saveReturnUrl(url) {

    try {

      sessionStorage.setItem(
        "kgs_auth_return_url",
        url
      );

    } catch (error) {

      console.warn(
        "Could not save authentication return URL.",
        error
      );

    }
  }


  /* ---------------------------------------------------------
     CART â†’ LOGIN POPUP
  --------------------------------------------------------- */

  function setupCartNavigation() {

    const cartLinks =
      document.querySelectorAll(
        ".discovery-cart-link"
      );

    cartLinks.forEach(function (link) {

      link.addEventListener(
        "click",
        function (event) {

          /*
           * Logged-in customers can continue
           * to the normal cart page.
           */

          if (isCustomerLoggedIn()) {
            return;
          }


          /*
           * Logged-out customer:
           * stop cart navigation.
           */

          event.preventDefault();


          /*
           * Remember the cart page so the existing
           * authentication flow can return there.
           */

          const destination =
            link.getAttribute("href") ||
            "cart.html";

          saveReturnUrl(destination);


          /*
           * Reuse the existing homepage login popup.
           */

          openLoginModal();

        }
      );

    });

  }


  /* ---------------------------------------------------------
     Handle protected links
  --------------------------------------------------------- */

  function setupProtectedNavigation() {

    const protectedLinks =
      document.querySelectorAll(
        [
          ".discovery-category-card",
          ".discovery-need-card",
          ".discovery-protected-link"
        ].join(",")
      );


    protectedLinks.forEach(function (link) {

      link.addEventListener(
        "click",
        function (event) {

          if (isCustomerLoggedIn()) {
            return;
          }


          event.preventDefault();


          const destination =
            link.getAttribute("href");

          if (destination) {
            saveReturnUrl(destination);
          }


          openLoginModal();

        }
      );

    });

  }


  /* =========================================================
     SEARCH SUGGESTIONS
  ========================================================= */

  let searchTimer = null;

  let searchRequestId = 0;


  /* ---------------------------------------------------------
     Get search elements
  --------------------------------------------------------- */

  function getSearchElements() {

    const input =
      document.getElementById(
        "discoverySearch"
      );

    const button =
      document.getElementById(
        "discoverySearchButton"
      );

    if (!input) {
      return null;
    }

    return {
      input,
      button
    };
  }


  /* ---------------------------------------------------------
     Create search suggestion container
  --------------------------------------------------------- */

  function getSearchSuggestionsContainer() {

    const existing =
      document.getElementById(
        "discoverySearchSuggestions"
      );

    if (existing) {
      return existing;
    }


    const searchWrapper =
      document.querySelector(
        ".discovery-search"
      );

    if (!searchWrapper) {
      return null;
    }


    const container =
      document.createElement("div");

    container.id =
      "discoverySearchSuggestions";

    container.className =
      "discovery-search-suggestions";

    container.setAttribute(
      "role",
      "listbox"
    );

    container.setAttribute(
      "aria-label",
      "Product suggestions"
    );


    searchWrapper.appendChild(
      container
    );


    return container;
  }


  /* ---------------------------------------------------------
     Normalize product
  --------------------------------------------------------- */

  function normalizeProduct(product) {

    if (!product) {
      return null;
    }


    /*
     * apiGetAll("products") already maps Medusa
     * products through mapMedusaProduct().
     */

    if (product.name || product.title) {
      return product;
    }


    return null;
  }


  /* ---------------------------------------------------------
     Get product image
  --------------------------------------------------------- */

  function getProductImage(product) {

    if (!product) {
      return "";
    }


    return (
      product.image_url ||
      product.thumbnail ||
      (
        product.images &&
        product.images[0] &&
        product.images[0].url
      ) ||
      ""
    );
  }


  /* ---------------------------------------------------------
     Render search suggestions
  --------------------------------------------------------- */

  function renderSearchSuggestions(products) {

    const container =
      getSearchSuggestionsContainer();

    if (!container) {
      return;
    }


    container.innerHTML = "";


    if (!products.length) {

      container.innerHTML =
        '<div class="discovery-search-empty">' +
          'No kitchen products found.' +
        '</div>';

      container.classList.add("is-visible");

      return;
    }


    products
      .slice(0, 6)
      .forEach(function (product, index) {

        const item =
          document.createElement("button");

        item.type = "button";

        item.className =
          "discovery-search-suggestion";

        item.setAttribute(
          "role",
          "option"
        );


        const image =
          getProductImage(product);

        const name =
          product.name ||
          product.title ||
          "Kitchen Gadget";


        item.innerHTML =

          '<span class="discovery-search-suggestion-image">' +

            (
              image
                ? '<img src="' +
                    escapeHtml(image) +
                    '" alt="' +
                    escapeHtml(name) +
                    '" loading="lazy">'
                : '<i class="fa-solid fa-kitchen-set"></i>'
            ) +

          '</span>' +

          '<span class="discovery-search-suggestion-info">' +

            '<strong>' +
              escapeHtml(name) +
            '</strong>' +

            '<small>' +
              "Sign in to view price" +
            '</small>' +

          '</span>';


        item.addEventListener(
          "click",
          function () {

            selectSearchProduct(
              product
            );

          }
        );


        container.appendChild(item);

      });


    container.classList.add(
      "is-visible"
    );
  }


  /* ---------------------------------------------------------
     Search products through existing Medusa adapter
  --------------------------------------------------------- */

  async function searchProducts(query) {

    const currentRequest =
      ++searchRequestId;


    if (
      typeof apiGetAll !== "function"
    ) {

      console.error(
        "apiGetAll() is not available. Check js/utils.js."
      );

      return [];

    }


    try {

      /*
       * Fetch the current Medusa product list.
       *
       * The existing utility already:
       * - calls Medusa
       * - sends the publishable key
       * - applies the USD region
       * - maps the product data.
       */

      const products =
        await apiGetAll(
          "products",
          {
            limit: 100
          }
        );


      /*
       * Ignore an older request if a newer
       * search has already started.
       */

      if (
        currentRequest !== searchRequestId
      ) {
        return [];
      }


      const normalizedQuery =
        String(query || "")
          .trim()
          .toLowerCase();


      if (!normalizedQuery) {
        return [];
      }


      /*
       * Match title, description, category and SKU.
       */

      const matches =
        products
          .map(normalizeProduct)
          .filter(Boolean)
          .filter(function (product) {

            const searchableText =
              [
                product.name,
                product.title,
                product.description,
                product.short_description,
                product.category,
                product.sku
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            return searchableText.indexOf(
              normalizedQuery
            ) !== -1;

          });


      /*
       * Put products whose title starts with
       * the search phrase first.
       */

      matches.sort(function (a, b) {

        const aName =
          String(
            a.name ||
            a.title ||
            ""
          ).toLowerCase();

        const bName =
          String(
            b.name ||
            b.title ||
            ""
          ).toLowerCase();


        const aStarts =
          aName.indexOf(
            normalizedQuery
          ) === 0;

        const bStarts =
          bName.indexOf(
            normalizedQuery
          ) === 0;


        if (aStarts && !bStarts) {
          return -1;
        }

        if (!aStarts && bStarts) {
          return 1;
        }

        return 0;

      });


      return matches.slice(0, 6);

    } catch (error) {

      console.error(
        "Kitchen Gadget Shops search failed:",
        error
      );

      return [];

    }

  }


  /* ---------------------------------------------------------
     Handle typing
  --------------------------------------------------------- */

  function handleSearchInput() {

    const elements =
      getSearchElements();

    if (!elements) {
      return;
    }


    const query =
      elements.input.value.trim();


    clearTimeout(searchTimer);


    if (!query) {

      const container =
        getSearchSuggestionsContainer();

      if (container) {

        container.innerHTML = "";

        container.classList.remove(
          "is-visible"
        );

      }

      return;
    }


    /*
     * Wait briefly before querying Medusa.
     * This prevents a request on every keystroke.
     */

    searchTimer =
      setTimeout(
        async function () {

          const products =
            await searchProducts(
              query
            );


          /*
           * Only display results if the
           * input still contains the same query.
           */

          const current =
            elements.input.value.trim();


          if (
            current !== query
          ) {
            return;
          }


          renderSearchSuggestions(
            products
          );

        },
        250
      );

  }


  /* ---------------------------------------------------------
     Search button
  --------------------------------------------------------- */

  function handleSearchButton() {

    const elements =
      getSearchElements();

    if (!elements) {
      return;
    }


    const query =
      elements.input.value.trim();


    if (!query) {
      elements.input.focus();
      return;
    }


    /*
     * If suggestions are visible, the customer
     * can select one directly.
     *
     * Otherwise search for matching products
     * and show the first result.
     */

    searchProducts(query)
      .then(function (products) {

        if (!products.length) {

          renderSearchSuggestions([]);

          return;
        }


        selectSearchProduct(
          products[0]
        );

      })
      .catch(function (error) {

        console.error(
          "Search button error:",
          error
        );

      });

  }


  /* ---------------------------------------------------------
     Select product from search
  --------------------------------------------------------- */

  function selectSearchProduct(product) {

    if (!product) {
      return;
    }


    const elements =
      getSearchElements();


    if (elements) {

      elements.input.value =
        product.name ||
        product.title ||
        "";

    }


    const suggestions =
      document.getElementById(
        "discoverySearchSuggestions"
      );


    if (suggestions) {

      suggestions.innerHTML = "";

      suggestions.classList.remove(
        "is-visible"
      );

    }


    renderSelectedProduct(
      product
    );


    /*
     * Move the selected product into view.
     */

    const productGrid =
      document.getElementById(
        "discoveryProductGrid"
      );


    if (productGrid) {

      productGrid.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

    }

  }


  /* =========================================================
     SELECTED PRODUCT
  ========================================================= */

  function renderSelectedProduct(product) {

    const productGrid =
      document.getElementById(
        "discoveryProductGrid"
      );


    if (!productGrid) {
      return;
    }


    const loggedIn =
      isCustomerLoggedIn();


    const name =
      product.name ||
      product.title ||
      "Kitchen Gadget";


    const description =
      product.short_description ||
      product.description ||
      "Discover this useful kitchen gadget.";


    const image =
      getProductImage(product);


    /*
     * IMPORTANT:
     *
     * We intentionally DO NOT put the product price
     * into the HTML for logged-out customers.
     *
     * Homepage 1 never renders the actual Medusa price.
     * Both logged-out and logged-in visitors see:
     * "Sign in to view price"
     * when the customer is authenticated.
     */

    /*
     * Homepage 1 NEVER displays product prices.
     *
     * Keep the real Medusa price completely out of the
     * logged-out and logged-in Homepage 1 DOM.
     */

    let priceHtml =
      '<button type="button" ' +
        'class="discovery-selected-product-login-price" ' +
        'id="discoverySelectedProductLoginButton">' +
        'Sign in to view price' +
      '</button>';

    productGrid.innerHTML =

      '<article class="discovery-selected-product">' +

        '<div class="discovery-selected-product-image">' +

          (
            image
              ? '<img src="' +
                  escapeHtml(image) +
                  '" alt="' +
                  escapeHtml(name) +
                  '">'
              : '<div class="discovery-selected-product-placeholder">' +
                  '<i class="fa-solid fa-kitchen-set"></i>' +
                '</div>'
          ) +

        '</div>' +

        '<div class="discovery-selected-product-content">' +

          '<span class="discovery-section-eyebrow">' +
            'SELECTED KITCHEN FIND' +
          '</span>' +

          '<h3>' +
            escapeHtml(name) +
          '</h3>' +

          '<p>' +
            escapeHtml(description) +
          '</p>' +

          priceHtml +

        '</div>' +

      '</article>';


    /*
     * Logged-out price button opens the existing
     * login popup.
     */

    if (!loggedIn) {

      const loginButton =
        document.getElementById(
          "discoverySelectedProductLoginButton"
        );


      if (loginButton) {

        loginButton.addEventListener(
          "click",
          function () {

            saveReturnUrl(
              window.location.href
            );

            openLoginModal();

          }
        );

      }

    }

  }


  /* ---------------------------------------------------------
     Setup search
  --------------------------------------------------------- */

  function setupProductSearch() {

    const elements =
      getSearchElements();

    if (!elements) {
      return;
    }


    /*
     * Prevent the search form/button from causing
     * an unwanted page navigation.
     */

    elements.input.addEventListener(
      "input",
      handleSearchInput
    );


    elements.input.addEventListener(
      "keydown",
      function (event) {

        if (event.key === "Enter") {

          event.preventDefault();

          handleSearchButton();

        }

        if (event.key === "Escape") {

          const container =
            getSearchSuggestionsContainer();

          if (container) {

            container.classList.remove(
              "is-visible"
            );

          }

        }

      }
    );


    if (elements.button) {

      elements.button.addEventListener(
        "click",
        handleSearchButton
      );

    }


    /*
     * Close suggestions when clicking elsewhere.
     */

    document.addEventListener(
      "click",
      function (event) {

        const searchWrapper =
          document.querySelector(
            ".discovery-search"
          );


        if (
          !searchWrapper ||
          searchWrapper.contains(event.target)
        ) {
          return;
        }


        const container =
          document.getElementById(
            "discoverySearchSuggestions"
          );


        if (container) {

          container.classList.remove(
            "is-visible"
          );

        }

      }
    );

  }


  /* ---------------------------------------------------------
     Setup popup
  --------------------------------------------------------- */

  function setupLoginModal() {

    const elements =
      getModalElements();

    if (!elements) {
      return;
    }


    /* ---------------------------------------------
       Unlock Pricing
    --------------------------------------------- */

    if (elements.unlockButton) {

      elements.unlockButton.addEventListener(
        "click",
        function () {

          if (isCustomerLoggedIn()) {

            window.location.href =
              "shop.html";

            return;
          }

          openLoginModal();

        }
      );

    }


    /* ---------------------------------------------
       Explore Kitchen Gadgets
    --------------------------------------------- */

    if (elements.exploreButton) {

      elements.exploreButton.addEventListener(
        "click",
        function () {

          if (isCustomerLoggedIn()) {

            window.location.href =
              "products.html";

            return;
          }


          saveReturnUrl(
            "products.html"
          );

          openLoginModal();

        }
      );

    }


    /* ---------------------------------------------
       Close button
    --------------------------------------------- */

    if (elements.closeButton) {

      elements.closeButton.addEventListener(
        "click",
        closeLoginModal
      );

    }


    /* ---------------------------------------------
       Click outside popup
    --------------------------------------------- */

    if (elements.overlay) {

      elements.overlay.addEventListener(
        "click",
        closeLoginModal
      );

    }


    /* ---------------------------------------------
       Escape key
    --------------------------------------------- */

    document.addEventListener(
      "keydown",
      function (event) {

        if (event.key === "Escape") {
          closeLoginModal();
        }

      }
    );


    /* ---------------------------------------------
       Email Continue
    --------------------------------------------- */

    if (elements.loginForm) {

      elements.loginForm.addEventListener(
        "submit",
        function (event) {

          event.preventDefault();


          const email =
            elements.emailInput?.value.trim();


          if (!email) {
            return;
          }


          const nextPage =
            sessionStorage.getItem(
              "kgs_auth_return_url"
            ) ||
            "shop.html";


          const loginUrl =
            "login.html?next=" +
            encodeURIComponent(
              nextPage
            );


          window.location.href =
            loginUrl;

        }
      );

    }


    /* ---------------------------------------------
       Create account
    --------------------------------------------- */

    if (elements.registerLink) {

      elements.registerLink.addEventListener(
        "click",
        function () {

          const nextPage =
            sessionStorage.getItem(
              "kgs_auth_return_url"
            ) ||
            "shop.html";


          this.href =
            "register.html?next=" +
            encodeURIComponent(
              nextPage
            );

        }
      );

    }


    /* ---------------------------------------------
       Google Login
    --------------------------------------------- */

    if (elements.googleButton) {

      elements.googleButton.addEventListener(
        "click",
        async function () {

          elements.googleButton.disabled = true;

          const originalGoogleButton =
            elements.googleButton.innerHTML;

          elements.googleButton.innerHTML =
            '<span class="discovery-google-icon">G</span>' +
            ' Connecting to Google...';

          try {

            await startGoogleCustomerAuth();

          } catch (error) {

            console.error(
              "Google customer authentication failed:",
              error
            );

            elements.googleButton.disabled = false;

            elements.googleButton.innerHTML =
              originalGoogleButton;

            alert(
              error && error.message
                ? error.message
                : "Google sign-in could not be started."
            );

          }

        }
      );

    }

  }


  /* ---------------------------------------------------------
     Automatic popup
  --------------------------------------------------------- */

  function setupAutomaticPopup() {

    if (isCustomerLoggedIn()) {
      return;
    }


    let popupShown = null;


    try {

      popupShown =
        sessionStorage.getItem(
          "kgs_discovery_popup_shown"
        );

    } catch (error) {

      console.warn(
        "Could not read popup session state.",
        error
      );

    }


    if (!popupShown) {

      setTimeout(
        function () {

          if (isCustomerLoggedIn()) {
            return;
          }


          openLoginModal();


          try {

            sessionStorage.setItem(
              "kgs_discovery_popup_shown",
              "true"
            );

          } catch (error) {

            console.warn(
              "Could not save popup session state.",
              error
            );

          }

        },
        700
      );

    }

  }


  /* ---------------------------------------------------------
     Trending kitchen products carousel
  --------------------------------------------------------- */

  function cleanTrendingProductDescription(value) {
    if (!value) return "";

    const temp = document.createElement("div");
    temp.innerHTML = String(value);

    return (temp.textContent || temp.innerText || "")
        .replace(/\s+/g, " ")
        .trim();
}
function renderTrendingProductCard(product, index) {

    const name =
      product.name ||
      product.title ||
      "Kitchen Gadget";

    const image =
      getProductImage(product);

    const safeName = String(name)
      .replace(/"/g, "&quot;");

    const safeImage = image
      ? String(image).replace(/"/g, "&quot;")
      : "";

    return `
      <article
        class="discovery-trending-card"
        data-trending-index="${index}"
        tabindex="0"
        role="button"
        aria-label="View ${safeName}"
      >

        <div class="discovery-trending-image-wrap">

          ${
            safeImage
              ? `
                <img
                  class="discovery-trending-image"
                  src="${safeImage}"
                  alt="${safeName}"
                  loading="lazy"
                >
              `
              : `
                <div class="discovery-trending-image discovery-trending-image-placeholder">
                  <span>Kitchen Gadget</span>
                </div>
              `
          }

          <span class="discovery-trending-badge">
            Bestseller
          </span>

        </div>

        <div class="discovery-trending-content">

          <h3 title="${safeName}">
            ${name}
          </h3>

          <button
            type="button"
            class="discovery-trending-price"
            data-trending-login="true"
            aria-label="Sign in to view price for ${safeName}"
          >
            Sign in to view price
          </button>

        </div>

      </article>
    `;
}
function setupTrendingProducts() {

    const productGrid =
      document.getElementById(
        "discoveryProductGrid"
      );

    if (!productGrid) {
      return;
    }

    /*
     * Prevent duplicate initialization.
     */

    if (
      productGrid.dataset.trendingInitialized === "true"
    ) {
      return;
    }

    productGrid.dataset.trendingInitialized =
      "true";

    /*
     * Fetch the same Medusa product source already
     * used by the existing discovery search.
     */

    if (typeof apiGetAll !== "function") {

      console.error(
        "apiGetAll() is not available for trending products."
      );

      return;
    }

    apiGetAll(
      "products",
      {
        limit: 100
      }
    )
      .then(function (products) {

        const normalizedProducts =
          (Array.isArray(products)
            ? products
            : []
          )
            .map(normalizeProduct)
            .filter(Boolean);

        /*
         * Prioritize products that clearly belong to
         * the kitchen-gadget discovery experience.
         *
         * This does not change the catalog or pricing.
         * It only determines carousel order.
         */

        const kitchenKeywords = [
          "kitchen",
          "cook",
          "cooking",
          "air fryer",
          "airfryer",
          "chopper",
          "cutter",
          "vegetable",
          "onion",
          "microwave",
          "storage",
          "organizer",
          "holder",
          "rack",
          "knife",
          "utensil",
          "grinder",
          "slicer",
          "peeler",
          "strainer",
          "colander",
          "container",
          "bottle",
          "spice",
          "food",
          "bakery",
          "baking",
          "pan",
          "pot",
          "dish",
          "tableware"
        ];

        function productScore(product) {

          const searchableText =
            [
              product.name,
              product.title,
              product.description,
              product.short_description,
              product.category,
              product.sku
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          let score = 0;

          kitchenKeywords.forEach(
            function (keyword) {

              if (
                searchableText.indexOf(
                  keyword
                ) !== -1
              ) {
                score += 1;
              }

            }
          );

          if (
            product.cj_source ===
            "cjdropshipping"
          ) {
            score += 2;
          }

          return score;
        }

        const rankedProducts =
          normalizedProducts
            .map(function (product, index) {

              return {
                product: product,
                score: productScore(product),
                originalIndex: index
              };

            })
            .sort(function (a, b) {

              if (b.score !== a.score) {
                return b.score - a.score;
              }

              return (
                a.originalIndex -
                b.originalIndex
              );

            })
            .map(function (item) {
              return item.product;
            });

        /*
         * Use up to 12 products for the carousel.
         */

        const trendingProducts =
          rankedProducts.slice(0, 12);

        if (!trendingProducts.length) {

          productGrid.innerHTML =
            '<div class="discovery-trending-empty">' +
              'No kitchen finds are available right now.' +
            '</div>';

          return;
        }

        /*
         * Build a dedicated carousel wrapper inside
         * the existing discoveryProductGrid element.
         */

        productGrid.innerHTML =
          '<div class="discovery-trending-carousel" ' +
            'aria-label="Trending kitchen finds">' +

            '<div class="discovery-trending-track">' +

              trendingProducts
                .map(
                  renderTrendingProductCard
                )
                .join("") +

            '</div>' +

            '<button type="button" ' +
              'class="discovery-trending-arrow discovery-trending-prev" ' +
              'aria-label="Previous kitchen finds">' +
              '<i class="fa-solid fa-chevron-left"></i>' +
            '</button>' +

            '<button type="button" ' +
              'class="discovery-trending-arrow discovery-trending-next" ' +
              'aria-label="Next kitchen finds">' +
              '<i class="fa-solid fa-chevron-right"></i>' +
            '</button>' +

          '</div>';

        const carousel =
          productGrid.querySelector(
            ".discovery-trending-carousel"
          );

        const track =
          productGrid.querySelector(
            ".discovery-trending-track"
          );

        const cards =
          productGrid.querySelectorAll(
            ".discovery-trending-card"
          );

        const previousButton =
          productGrid.querySelector(
            ".discovery-trending-prev"
          );

        const nextButton =
          productGrid.querySelector(
            ".discovery-trending-next"
          );

        if (
          !carousel ||
          !track ||
          !cards.length
        ) {
          return;
        }

        let currentIndex = 0;
        let autoSlideTimer = null;

        function getVisibleCount() {

          if (window.innerWidth <= 700) {
            return 1;
          }

          if (window.innerWidth <= 1050) {
              return 2;
            }

            return 5;
        }

        function updateCarousel() {

          const visibleCount =
            getVisibleCount();

          const maxIndex =
            Math.max(
              0,
              cards.length - visibleCount
            );

          if (currentIndex > maxIndex) {
            currentIndex = 0;
          }

          const firstCard =
            cards[0];

          if (!firstCard) {
            return;
          }

          const cardWidth =
            firstCard.getBoundingClientRect().width;

          const gap =
            parseFloat(
              getComputedStyle(track).gap
            ) || 0;

          const offset =
            currentIndex *
            (cardWidth + gap);

          track.style.transform =
            "translate3d(-" +
            offset +
            "px, 0, 0)";

        }

        function nextSlide() {

          const visibleCount =
            getVisibleCount();

          const maxIndex =
            Math.max(
              0,
              cards.length - visibleCount
            );

          if (maxIndex === 0) {
            return;
          }

          currentIndex += 1;

          if (currentIndex > maxIndex) {
            currentIndex = 0;
          }

          updateCarousel();

        }

        function previousSlide() {

          const visibleCount =
            getVisibleCount();

          const maxIndex =
            Math.max(
              0,
              cards.length - visibleCount
            );

          if (maxIndex === 0) {
            return;
          }

          currentIndex -= 1;

          if (currentIndex < 0) {
            currentIndex = maxIndex;
          }

          updateCarousel();

        }

        function stopAutoSlide() {

          if (autoSlideTimer) {

            clearInterval(
              autoSlideTimer
            );

            autoSlideTimer = null;

          }

        }

        function startAutoSlide() {

          stopAutoSlide();

          if (cards.length <= 1) {
            return;
          }

          autoSlideTimer =
            setInterval(
              nextSlide,
              4500
            );

        }

        if (nextButton) {

          nextButton.addEventListener(
            "click",
            function () {

              nextSlide();

              startAutoSlide();

            }
          );

        }

        if (previousButton) {

          previousButton.addEventListener(
            "click",
            function () {

              previousSlide();

              startAutoSlide();

            }
          );

        }

        /*
         * Pause automatic movement while the visitor
         * interacts with the carousel.
         */

        carousel.addEventListener(
          "mouseenter",
          stopAutoSlide
        );

        carousel.addEventListener(
          "mouseleave",
          startAutoSlide
        );

        carousel.addEventListener(
          "focusin",
          stopAutoSlide
        );

        carousel.addEventListener(
          "focusout",
          function () {

            setTimeout(
              function () {

                if (
                  !carousel.contains(
                    document.activeElement
                  )
                ) {
                  startAutoSlide();
                }

              },
              0
            );

          }
        );

        /*
         * Every logged-out product card opens the
         * EXISTING login popup.
         */

        cards.forEach(
          function (card) {

            card.addEventListener(
              "click",
              function (event) {

                if (
                  isCustomerLoggedIn()
                ) {
                  return;
                }

                event.preventDefault();
                event.stopPropagation();

                saveReturnUrl(
                  window.location.href
                );

                openLoginModal();

              }
            );

          }
        );

        /*
         * The price button also explicitly opens
         * the same existing login popup.
         */

        const loginPriceButtons =
          productGrid.querySelectorAll(
            "[data-trending-login='true']"
          );

        loginPriceButtons.forEach(
          function (button) {

            button.addEventListener(
              "click",
              function (event) {

                event.preventDefault();
                event.stopPropagation();

                if (
                  isCustomerLoggedIn()
                ) {
                  return;
                }

                saveReturnUrl(
                  window.location.href
                );

                openLoginModal();

              }
            );

          }
        );

        updateCarousel();

        startAutoSlide();

        window.addEventListener(
          "resize",
          updateCarousel
        );

      })
      .catch(function (error) {

        console.error(
          "Trending kitchen products failed:",
          error
        );

        productGrid.innerHTML =
          '<div class="discovery-trending-empty">' +
            'Unable to load kitchen finds right now.' +
          '</div>';

      });

  }

  /* ---------------------------------------------------------
     Initialize
  --------------------------------------------------------- */

  function initializeDiscoveryHome() {

    setupLoginModal();

    setupProtectedNavigation();

    setupCartNavigation();

    setupProductSearch();

    setupTrendingProducts();

    setupAutomaticPopup();

  }


  if (
    document.readyState === "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initializeDiscoveryHome
    );

  } else {

    initializeDiscoveryHome();

  }

})();









